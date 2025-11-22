import { connectMongo, closeMongoConnection } from "../config/database";
import { User } from "../modules/auth/user.model";
import { Table } from "../modules/tables/table.model";
import { hashPassword } from "../common/utils/password";
import { Role } from "../constants/roles";

// Demo user data
const demoUsers = [
  {
    name: "John Owner",
    email: "owner@restaurant.com",
    phone: "+1234567890",
    password: "owner123",
    role: "owner" as Role,
    salary: 5000,
  },
  {
    name: "Sarah Cashier",
    email: "cashier@restaurant.com",
    phone: "+1234567891",
    password: "cashier123",
    role: "cashier" as Role,
    salary: 2500,
  },
  {
    name: "Mike Cashier",
    email: "cashier2@restaurant.com",
    phone: "+1234567892",
    password: "cashier123",
    role: "cashier" as Role,
    salary: 2500,
  },
  {
    name: "Emma Waiter",
    email: "waiter@restaurant.com",
    phone: "+1234567893",
    password: "waiter123",
    role: "waiter" as Role,
    salary: 2000,
  },
  {
    name: "David Waiter",
    email: "waiter2@restaurant.com",
    phone: "+1234567894",
    password: "waiter123",
    role: "waiter" as Role,
    salary: 2000,
  },
  {
    name: "Lisa Waiter",
    email: "waiter3@restaurant.com",
    phone: "+1234567895",
    password: "waiter123",
    role: "waiter" as Role,
    salary: 2000,
  },
];

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

async function seedAll() {
  try {
    console.log("🌱 Starting complete database seeding...\n");

    // Connect to MongoDB
    await connectMongo();

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await User.collection.deleteMany({});
    await Table.collection.deleteMany({});
    console.log("✅ Existing data cleared\n");

    // Seed Users
    console.log("=".repeat(50));
    console.log("SEEDING USERS");
    console.log("=".repeat(50));
    console.log("👥 Creating demo users...");
    const createdUsers = [];

    for (const userData of demoUsers) {
      const hashedPassword = await hashPassword(userData.password);
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        password: hashedPassword,
        role: userData.role,
        salary: userData.salary,
      });

      createdUsers.push({
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        password: userData.password,
      });
    }

    console.log(`✅ Created ${createdUsers.length} users\n`);

    // Seed Tables
    console.log("=".repeat(50));
    console.log("SEEDING TABLES");
    console.log("=".repeat(50));
    console.log("🪑 Creating demo tables...");
    const createdTables = [];

    for (const tableData of demoTables) {
      const table = await Table.create({
        tableNumber: tableData.tableNumber,
      });

      createdTables.push({
        id: table._id,
        tableNumber: table.tableNumber,
      });
    }

    console.log(`✅ Created ${createdTables.length} tables\n`);

    // Summary
    console.log("=".repeat(50));
    console.log("🎉 All seeding completed successfully!");
    console.log("=".repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   - Users: ${createdUsers.length}`);
    console.log(`   - Tables: ${createdTables.length}`);

    console.log("\n📋 Created Users:");
    createdUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.role})`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Phone: ${user.phone}`);
      console.log(`      Password: ${user.password}`);
    });

    console.log("\n📋 Created Tables:");
    createdTables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.tableNumber}`);
    });

    // Close connection
    await closeMongoConnection();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    await closeMongoConnection();
    process.exit(1);
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedAll();
}

export { seedAll };
