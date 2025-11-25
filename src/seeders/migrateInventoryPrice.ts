import mongoose from "mongoose";
import { connectMongo, closeMongoConnection } from "../config/database";
import { Inventory } from "../modules/inventory/inventory.model";

async function migrateInventoryPrice() {
  try {
    console.log("🌱 Starting inventory price migration...");

    // Connect to MongoDB
    await connectMongo();

    // Find all inventory items without price or with price = 0
    const inventoriesWithoutPrice = await Inventory.find({
      $or: [{ price: { $exists: false } }, { price: 0 }],
    });

    console.log(
      `📊 Found ${inventoriesWithoutPrice.length} inventory items without price`
    );

    if (inventoriesWithoutPrice.length === 0) {
      console.log("✅ All inventory items already have prices");
      await closeMongoConnection();
      process.exit(0);
    }

    // Update all items to have price = 0 (default)
    const result = await Inventory.updateMany(
      {
        $or: [{ price: { $exists: false } }, { price: 0 }],
      },
      {
        $set: { price: 0 },
      }
    );

    console.log(
      `✅ Updated ${result.modifiedCount} inventory items with default price (0)`
    );
    console.log(
      "⚠️  Note: You should manually update prices for these items in the inventory management interface"
    );

    // Close connection
    await closeMongoConnection();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error migrating inventory prices:", error);
    await closeMongoConnection();
    process.exit(1);
  }
}

// Run migration
migrateInventoryPrice();
