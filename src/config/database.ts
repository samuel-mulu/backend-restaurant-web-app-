import mongoose from "mongoose";
import { env } from "./env";

let isShuttingDown = false;

export async function connectMongo() {
  try {
    await mongoose.connect(env.mongoUri, {
      maxPoolSize: env.isProd ? 50 : 10,
      minPoolSize: env.isProd ? 10 : 1,
      autoIndex: !env.isProd,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    });

    registerEventHandlers();
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

function registerEventHandlers() {
  mongoose.connection.on("connected", () => {
  });

  mongoose.connection.on("error", (err) => {
    console.error("Mongoose connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    if (!isShuttingDown) {
      console.warn("Mongoose disconnected unexpectedly!");
    }
  });

  mongoose.connection.on("reconnected", () => {
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
