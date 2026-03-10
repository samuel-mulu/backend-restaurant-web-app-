import { Server, ServerOptions } from "socket.io";
import { Server as HttpServer } from "http";
import {
  startOrderChangeStream,
  startInventoryChangeStream,
} from "./changeStreams";

let io: Server | null = null;

export const initSockets = (
  server: HttpServer,
  options?: Partial<ServerOptions>
) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    ...options,
  });

  io.on("connection", (socket) => {
    // Owner/cashiers subscribe to all order events
    socket.on("join-owner", () => {
      socket.join("owner:orders");
    });

    // Owner subscriptions for different modules
    socket.on("join-owner-orders", () => {
      socket.join("owner:orders");
    });

    socket.on("join-owner-items", () => {
      socket.join("owner:items");
    });

    socket.on("join-owner-categories", () => {
      socket.join("owner:categories");
    });

    socket.on("join-owner-users", () => {
      socket.join("owner:users");
    });

    socket.on("join-owner-dashboard", () => {
      socket.join("owner:dashboard");
    });

    // Cashiers subscribe to new orders
    socket.on("join-cashier", () => {
      socket.join("cashier:orders");
      socket.join("cashier:inventory");
    });

    // Waiters subscribe to their assigned orders
    socket.on("join-waiter", (waiterId: string) => {
      socket.join(`waiter:${waiterId}`);
    });

    // Owner full access subscriptions (legacy support - also joins owner:orders)
    socket.on("join-owner-full", () => {
      socket.join("owner:inventory");
      socket.join("owner:dashboard");
      socket.join("owner:orders");
    });

    // Customers subscribe with their private channel (uuid)
    socket.on("join-customer", (channel: string) => {
      socket.join(`customer:${channel}`);
    });

    // General order events subscription
    socket.on("subscribe-orders", () => {
      socket.join("orders:general");
    });

    socket.on("disconnect", (reason) => {
      // Handle disconnect silently
    });
  });

  // Start MongoDB Change Streams for automatic order detection
  startOrderChangeStream(io);
  startInventoryChangeStream(io);

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
