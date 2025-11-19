import http from "http";
import app from "./app";
import { env } from "./config/env";
import { connectMongo, closeMongoConnection } from "./config/database";

import { initSockets } from "./sockets/socket";

async function main() {
  await connectMongo();

  const server = http.createServer(app); // ⬅ http server for socket.io
  initSockets(server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || "*").split(","),
      credentials: true,
    },
  });

  server.listen(env.port, () => {
    console.log(`Server running on port: ${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received: closing server and DB...`);
    await closeMongoConnection();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error(e);
});
