import mongoose from "mongoose";
import { connectMongo, closeMongoConnection } from "../config/database";
import { User } from "../modules/auth/user.model";
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

async function seedUsers() {
  try {
    console.log("🌱 Starting user seeding...");

    // Connect to MongoDB
    await connectMongo();

    // Clear existing users (optional - comment out if you want to keep existing users)
    console.log("🗑️  Clearing existing users...");
    await User.collection.deleteMany({});
    console.log("✅ Existing users cleared");

    // Hash passwords and create users
    console.log("👥 Creating demo users...");
    const createdUsers = [];

    for (const userData of demoUsers) {
      // Check if user already exists (by phone or email)
      const existingUser = await User.findOne({
        $or: [{ phone: userData.phone }, { email: userData.email }],
      });

      if (existingUser) {
        console.log(`⚠️  User with phone ${userData.phone} or email ${userData.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);

      // Create user
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
        password: userData.password, // Store plain password for reference
      });
    }

    console.log("\n🎉 User seeding completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Users created: ${createdUsers.length}`);

    console.log("\n📋 Created Users:");
    createdUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.role})`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Phone: ${user.phone}`);
      console.log(`      Password: ${user.password}`);
    });

    // Close connection
    await closeMongoConnection();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding users:", error);
    await closeMongoConnection();
    process.exit(1);
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedUsers();
}

export { seedUsers };

