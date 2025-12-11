import http from "http";
import app from "./app";
import { env } from "./config/env";
import { connectMongo, closeMongoConnection } from "./config/database";

import { initSockets } from "./sockets/socket";

async function main() {
  console.log("Starting server...");
  console.log(`NODE_ENV: ${env.nodeEnv}`);
  console.log(`PORT from env: ${process.env.PORT || "not set"}`);
  console.log(`Using port: ${env.port}`);

  await connectMongo();
  console.log("MongoDB connected successfully");

  const server = http.createServer(app); // ⬅ http server for socket.io
  initSockets(server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || "*").split(","),
      credentials: true,
    },
  });

  server.listen(env.port, "0.0.0.0", () => {
    console.log(`✅ Server running on port: ${env.port}`);
    console.log(`✅ Server listening on 0.0.0.0:${env.port}`);
    console.log(
      `✅ Health check available at http://0.0.0.0:${env.port}/health`
    );
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
  console.error("Failed to start server:", e);
  process.exit(1);
});
