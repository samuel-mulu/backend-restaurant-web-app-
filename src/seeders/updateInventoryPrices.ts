import mongoose from "mongoose";
import { connectMongo, closeMongoConnection } from "../config/database";
import { Inventory } from "../modules/inventory/inventory.model";

// Price mapping based on seeder data
const priceMap: { [key: string]: number } = {
  rice: 45.0,
  "olive oil": 120.0,
  flour: 35.0,
  "coffee beans": 85.0,
  sugar: 25.0,
};

async function updateInventoryPrices() {
  try {
    console.log("🌱 Starting inventory price update migration...");

    // Connect to MongoDB
    await connectMongo();

    // Get all inventory items
    const allInventories = await Inventory.find({});

    console.log(`📊 Found ${allInventories.length} inventory items`);

    if (allInventories.length === 0) {
      console.log("⚠️  No inventory items found");
      await closeMongoConnection();
      process.exit(0);
    }

    let updatedCount = 0;
    let notFoundCount = 0;

    // Update each inventory item based on name matching
    for (const inventory of allInventories) {
      const nameLower = inventory.name.toLowerCase().trim();
      let matched = false;
      let matchedPrice: number | null = null;

      // Try to match by name (case-insensitive, partial match)
      for (const [key, price] of Object.entries(priceMap)) {
        if (nameLower.includes(key.toLowerCase())) {
          matchedPrice = price;
          matched = true;
          break;
        }
      }

      if (matched && matchedPrice !== null) {
        // Only update if price is 0 or doesn't exist
        if (!inventory.price || inventory.price === 0) {
          inventory.price = matchedPrice;
          await inventory.save();
          console.log(
            `✅ Updated "${
              inventory.name
            }" with price: Br ${matchedPrice.toFixed(2)}`
          );
          updatedCount++;
        } else {
          console.log(
            `⏭️  Skipped "${
              inventory.name
            }" - already has price: Br ${inventory.price.toFixed(2)}`
          );
        }
      } else {
        console.log(
          `⚠️  Could not match price for "${inventory.name}" - keeping existing price or 0`
        );
        notFoundCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Migration Summary:");
    console.log(`   - Total items: ${allInventories.length}`);
    console.log(`   - Updated: ${updatedCount}`);
    console.log(`   - Not matched: ${notFoundCount}`);
    console.log("=".repeat(50));

    // Close connection
    await closeMongoConnection();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating inventory prices:", error);
    await closeMongoConnection();
    process.exit(1);
  }
}

// Run migration
updateInventoryPrices();
