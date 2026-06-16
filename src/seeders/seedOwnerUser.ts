import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo, closeMongoConnection } from "../config/database";
import { User } from "../modules/auth/user.model";
import { hashPassword } from "../common/utils/password";
import { Role } from "../constants/roles";

// Demo owner user data
const demoOwners = [
  {
    name: "John Owner",
    email: "owner@restaurant.com",
    phone: "+1234567890",
    password: "owner123",
    role: "owner" as Role,
    salary: 5000,
  },
];

async function seedOwnerUser() {
  try {
    console.log("🌱 Starting owner user seeding...");

    // Connect to MongoDB
    await connectMongo();

    // Clear existing owner users
    console.log("🗑️  Clearing existing owner users...");
    await User.collection.deleteMany({ role: "owner" });
    console.log("✅ Existing owner users cleared");

    // Hash passwords and create owner users
    console.log("👤 Creating demo owner users...");
    const createdUsers = [];

    for (const userData of demoOwners) {
      // Check if user already exists (by phone or email)
      const existingUser = await User.findOne({
        $or: [{ phone: userData.phone }, { email: userData.email }],
      });

      if (existingUser) {
        console.log(
          `⚠️  User with phone ${userData.phone} or email ${userData.email} already exists, skipping...`
        );
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

    console.log("\n🎉 Owner user seeding completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Owner users created: ${createdUsers.length}`);

    console.log("\n📋 Created Owner Users:");
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
    console.error("❌ Error seeding owner users:", error);
    await closeMongoConnection();
    process.exit(1);
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedOwnerUser();
}

export { seedOwnerUser };
