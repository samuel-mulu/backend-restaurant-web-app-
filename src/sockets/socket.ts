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
    console.log(`🔌 Client connected: ${socket.id}`);

    // Owner/cashiers subscribe to all order events
    socket.on("join-owner", () => {
      socket.join("owner:orders");
      console.log(`👑 Owner joined: ${socket.id}`);
    });

    // Owner subscriptions for different modules
    socket.on("join-owner-orders", () => {
      socket.join("owner:orders");
      console.log(`📋 Owner joined orders: ${socket.id}`);
    });

    socket.on("join-owner-items", () => {
      socket.join("owner:items");
      console.log(`🍽️ Owner joined items: ${socket.id}`);
    });

    socket.on("join-owner-categories", () => {
      socket.join("owner:categories");
      console.log(`📁 Owner joined categories: ${socket.id}`);
    });

    socket.on("join-owner-users", () => {
      socket.join("owner:users");
      console.log(`👥 Owner joined users: ${socket.id}`);
    });

    socket.on("join-owner-dashboard", () => {
      socket.join("owner:dashboard");
      console.log(`📊 Owner joined dashboard: ${socket.id}`);
    });

    // Cashiers subscribe to new orders
    socket.on("join-cashier", () => {
      socket.join("cashier:orders");
      socket.join("cashier:inventory");
      console.log(`💰 Cashier joined: ${socket.id}`);
    });

    // Waiters subscribe to their assigned orders
    socket.on("join-waiter", (waiterId: string) => {
      socket.join(`waiter:${waiterId}`);
      console.log(`🍽️ Waiter ${waiterId} joined: ${socket.id}`);
    });

    // Owner full access subscriptions (legacy support - also joins owner:orders)
    socket.on("join-owner-full", () => {
      socket.join("owner:inventory");
      socket.join("owner:dashboard");
      socket.join("owner:orders");
      console.log(`👑 Owner joined with full access: ${socket.id}`);
    });

    // Customers subscribe with their private channel (uuid)
    socket.on("join-customer", (channel: string) => {
      socket.join(`customer:${channel}`);
      console.log(`👤 Customer joined channel: ${channel} (${socket.id})`);
    });

    // General order events subscription
    socket.on("subscribe-orders", () => {
      socket.join("orders:general");
      console.log(`📋 Client subscribed to orders: ${socket.id}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
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
