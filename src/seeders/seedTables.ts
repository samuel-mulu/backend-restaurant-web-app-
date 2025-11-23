import mongoose from "mongoose";
import { connectMongo, closeMongoConnection } from "../config/database";
import { Table } from "../modules/tables/table.model";

// Demo table data
const demoTables = [
  { tableNumber: "T1" },
  { tableNumber: "T2" },
  { tableNumber: "T3" },
  { tableNumber: "T4" },
  { tableNumber: "T5" },
  { tableNumber: "T6" },
  { tableNumber: "T7" },
  { tableNumber: "T8" },
  { tableNumber: "T9" },
  { tableNumber: "T10" },
  { tableNumber: "T11" },
  { tableNumber: "T12" },
  { tableNumber: "T13" },
  { tableNumber: "T14" },
  { tableNumber: "T15" },
  { tableNumber: "T16" },
  { tableNumber: "T17" },
  { tableNumber: "T18" },
  { tableNumber: "T19" },
  { tableNumber: "T20" },
];

async function seedTables() {
  try {
    console.log("🌱 Starting table seeding...");

    // Connect to MongoDB
    await connectMongo();

    // Clear existing tables (optional - comment out if you want to keep existing tables)
    console.log("🗑️  Clearing existing tables...");
    await Table.collection.deleteMany({});
    console.log("✅ Existing tables cleared");

    // Create tables
    console.log("🪑 Creating demo tables...");
    const createdTables = [];

    for (const tableData of demoTables) {
      // Check if table already exists
      const existingTable = await Table.findOne({
        tableNumber: tableData.tableNumber.toUpperCase(),
      });

      if (existingTable) {
        console.log(
          `⚠️  Table ${tableData.tableNumber} already exists, skipping...`
        );
        continue;
      }

      // Create table
      const table = await Table.create({
        tableNumber: tableData.tableNumber,
      });

      createdTables.push({
        id: table._id,
        tableNumber: table.tableNumber,
      });
    }

    console.log("\n🎉 Table seeding completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Tables created: ${createdTables.length}`);

    console.log("\n📋 Created Tables:");
    createdTables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.tableNumber}`);
    });

    // Close connection
    await closeMongoConnection();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding tables:", error);
    await closeMongoConnection();
    process.exit(1);
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedTables();
}

export { seedTables };
