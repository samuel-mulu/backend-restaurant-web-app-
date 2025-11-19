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

    // Admin/cashiers subscribe to all order events
    socket.on("join-admin", () => {
      socket.join("admin:orders");
      console.log(`👨‍💼 Admin joined: ${socket.id}`);
    });

    // Admin subscriptions for different modules
    socket.on("join-admin-orders", () => {
      socket.join("admin:orders");
      console.log(`📋 Admin joined orders: ${socket.id}`);
    });

    socket.on("join-admin-items", () => {
      socket.join("admin:items");
      console.log(`🍽️ Admin joined items: ${socket.id}`);
    });

    socket.on("join-admin-categories", () => {
      socket.join("admin:categories");
      console.log(`📁 Admin joined categories: ${socket.id}`);
    });

    socket.on("join-admin-users", () => {
      socket.join("admin:users");
      console.log(`👥 Admin joined users: ${socket.id}`);
    });

    socket.on("join-admin-dashboard", () => {
      socket.join("admin:dashboard");
      console.log(`📊 Admin joined dashboard: ${socket.id}`);
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

    // Owner subscriptions
    socket.on("join-owner", () => {
      socket.join("owner:inventory");
      socket.join("owner:dashboard");
      socket.join("admin:orders");
      console.log(`👑 Owner joined: ${socket.id}`);
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
