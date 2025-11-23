/**
 * Migration script to fix orderCode index issue
 *
 * This script drops the old orderCode_1 index that's causing duplicate key errors.
 * Run this once to fix the database schema.
 *
 * Usage:
 *   - Import and call fixOrderIndex() in your app startup
 *   - Or run directly: npx ts-node src/modules/orders/fix-order-index.ts
 */

import mongoose from "mongoose";
import { Order } from "./order.model";

export async function fixOrderIndex(): Promise<void> {
  try {
    const collection = Order.collection;

    // Get all indexes
    const indexes = await collection.indexes();
    console.log(
      "Current indexes:",
      indexes.map((idx) => idx.name)
    );

    // Check if orderCode_1 index exists
    const orderCodeIndex = indexes.find((idx) => idx.name === "orderCode_1");

    if (orderCodeIndex) {
      console.log("Found old orderCode_1 index, dropping it...");
      await collection.dropIndex("orderCode_1");
      console.log("✓ Successfully dropped orderCode_1 index");
    } else {
      console.log("✓ orderCode_1 index not found (already fixed)");
    }

    // Verify orderNumber index exists
    const orderNumberIndex = indexes.find(
      (idx) =>
        idx.name === "orderNumber_1" ||
        (idx.key && (idx.key as any).orderNumber)
    );

    if (!orderNumberIndex) {
      console.log("Creating orderNumber index...");
      await collection.createIndex({ orderNumber: 1 }, { unique: true });
      console.log("✓ Successfully created orderNumber_1 index");
    } else {
      console.log("✓ orderNumber index already exists");
    }

    console.log("Migration completed successfully!");
  } catch (error: any) {
    if (error.code === 27 || error.codeName === "IndexNotFound") {
      console.log("✓ orderCode_1 index not found (already fixed)");
    } else {
      console.error("Error fixing order index:", error);
      throw error;
    }
  }
}

// Run directly if executed as script
if (require.main === module) {
  const mongoose = require("mongoose");
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant-app";

  mongoose
    .connect(mongoUri)
    .then(async () => {
      console.log("Connected to MongoDB");
      await fixOrderIndex();
      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
      process.exit(0);
    })
    .catch((error: Error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}
