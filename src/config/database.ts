import dns from "dns";
import mongoose from "mongoose";
import { env } from "./env";

let isShuttingDown = false;

export async function connectMongo() {
  try {
    // Some Windows/ISP DNS resolvers reject SRV lookups required by mongodb+srv URIs.
    if (env.mongoUri.startsWith("mongodb+srv://")) {
      dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
    }

    await mongoose.connect(env.mongoUri, {
      maxPoolSize: env.isProd ? 50 : 10,
      minPoolSize: env.isProd ? 10 : 1,
      autoIndex: !env.isProd,

      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      serverSelectionTimeoutMS: 30000,
      family: 4,

      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    });

    console.log("✅ MongoDB connected");
    registerEventHandlers();

  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // 🔥 critical fix
  }
}

function registerEventHandlers() {
  mongoose.connection.on("connected", () => {
    console.log("📦 MongoDB connection established");
  });

  mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    if (!isShuttingDown) {
      console.warn("⚠️ Mongoose disconnected unexpectedly!");
    }
  });

  mongoose.connection.on("reconnected", () => {
    console.log("🔄 MongoDB reconnected");
  });
}

export async function closeMongoConnection() {
  isShuttingDown = true;
  await mongoose.connection.close();
}

export function getMongoHealth() {
  const state = mongoose.connection.readyState;
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return { status: states[state], readyState: state };
}