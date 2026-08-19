#!/bin/bash
set -euo pipefail

# Single-node replica set + keyfile + auth for 3T Juice House.
# This script stays inside the Mongo container so the localhost exception
# can create the first users. It does not talk to any other Compose project.

: "${MONGO_ROOT_USERNAME:?MONGO_ROOT_USERNAME is required}"
: "${MONGO_ROOT_PASSWORD:?MONGO_ROOT_PASSWORD is required}"
: "${MONGO_APP_USERNAME:?MONGO_APP_USERNAME is required}"
: "${MONGO_APP_PASSWORD:?MONGO_APP_PASSWORD is required}"
: "${MONGO_APP_DATABASE:?MONGO_APP_DATABASE is required}"

KEYFILE="${MONGO_KEYFILE_PATH:-/mongo-keyfile/mongo-keyfile}"
RS_HOST="${MONGO_REPLICA_HOST:-3t-juice-house-mongo:27017}"

mkdir -p "$(dirname "$KEYFILE")" /data/db /data/configdb

if [ ! -s "$KEYFILE" ]; then
  echo "[3t-mongo] generating replica-set keyfile"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 756 > "$KEYFILE"
  else
    head -c 756 /dev/urandom | base64 | tr -d '\n' > "$KEYFILE"
    echo >> "$KEYFILE"
  fi
fi

chmod 400 "$KEYFILE"
chown mongodb:mongodb "$KEYFILE" 2>/dev/null || chown 999:999 "$KEYFILE"

shutdown() {
  echo "[3t-mongo] stopping mongod"
  if [ -n "${MONGO_PID:-}" ]; then
    kill -SIGTERM "$MONGO_PID" 2>/dev/null || true
    wait "$MONGO_PID" 2>/dev/null || true
  fi
}
trap shutdown SIGINT SIGTERM

echo "[3t-mongo] starting mongod --replSet rs0 with keyfile auth"
docker-entrypoint.sh mongod \
  --replSet rs0 \
  --bind_ip_all \
  --keyFile "$KEYFILE" \
  --auth \
  --wiredTigerCacheSizeGB 0.25 &
MONGO_PID=$!

echo "[3t-mongo] waiting for mongod to accept connections"
ready=0
for _ in $(seq 1 90); do
  if mongosh --quiet --eval 'db.adminCommand({ ping: 1 })' >/dev/null 2>&1; then
    ready=1
    break
  fi
  if mongosh --quiet \
    -u "$MONGO_ROOT_USERNAME" \
    -p "$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --eval 'db.adminCommand({ ping: 1 })' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "[3t-mongo] mongod did not become reachable"
  shutdown
  exit 1
fi

AUTH_ARGS=()
if ! mongosh --quiet --eval 'db.adminCommand({ ping: 1 })' >/dev/null 2>&1; then
  AUTH_ARGS=( -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin )
fi

echo "[3t-mongo] ensuring replica set and users"
mongosh --quiet "${AUTH_ARGS[@]}" --eval '
const rsHost = process.env.MONGO_REPLICA_HOST || "3t-juice-house-mongo:27017";
const rootUser = process.env.MONGO_ROOT_USERNAME;
const rootPass = process.env.MONGO_ROOT_PASSWORD;
const appUser = process.env.MONGO_APP_USERNAME;
const appPass = process.env.MONGO_APP_PASSWORD;
const appDbName = process.env.MONGO_APP_DATABASE;

function isPrimary() {
  try {
    const h = db.hello();
    return !!(h && (h.isWritablePrimary || h.ismaster));
  } catch (e) {
    return false;
  }
}

function rsOk() {
  try {
    const s = rs.status();
    return !!(s && s.ok === 1);
  } catch (e) {
    return false;
  }
}

if (!rsOk()) {
  print("[3t-mongo] initiating replica set rs0 at " + rsHost);
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: rsHost }]
  });
}

let attempts = 0;
while (!isPrimary() && attempts < 60) {
  sleep(1000);
  attempts += 1;
}

if (!isPrimary()) {
  throw new Error("replica set rs0 did not become PRIMARY");
}

function userExists(database, username) {
  try {
    return !!database.getUser(username);
  } catch (e) {
    return false;
  }
}

const admin = db.getSiblingDB("admin");
if (!userExists(admin, rootUser)) {
  print("[3t-mongo] creating root user");
  admin.createUser({
    user: rootUser,
    pwd: rootPass,
    roles: [{ role: "root", db: "admin" }]
  });
}

try {
  admin.auth(rootUser, rootPass);
} catch (e) {
  // already authenticated on later boots
}

const appDb = db.getSiblingDB(appDbName);
if (!userExists(appDb, appUser)) {
  print("[3t-mongo] creating app user");
  appDb.createUser({
    user: appUser,
    pwd: appPass,
    roles: [
      { role: "readWrite", db: appDbName },
      { role: "read", db: "local" }
    ]
  });
}

print("[3t-mongo] replica set rs0 is ready");
'

echo "[3t-mongo] init complete; handing off to mongod"
wait "$MONGO_PID"
