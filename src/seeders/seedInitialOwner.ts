import "dotenv/config";
import { connectMongo, closeMongoConnection } from "../config/database";
import { User } from "../modules/auth/user.model";
import { hashPassword } from "../common/utils/password";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function seedInitialOwner() {
  const name = requiredEnv("OWNER_NAME");
  const phone = requiredEnv("OWNER_PHONE");
  const password = requiredEnv("OWNER_PASSWORD");
  const email = process.env.OWNER_EMAIL?.trim() || undefined;

  if (password.length < 6) {
    throw new Error("OWNER_PASSWORD must be at least 6 characters");
  }

  await connectMongo();

  const existingOwner = await User.findOne({ role: "owner" }).select(
    "name email phone role"
  );
  if (existingOwner) {
    console.log("Owner already exists. No users were created or changed.");
    console.log(`  name: ${existingOwner.name}`);
    console.log(`  phone: ${existingOwner.phone ?? ""}`);
    console.log(`  email: ${existingOwner.email ?? ""}`);
    await closeMongoConnection();
    process.exit(0);
  }

  const conflictQuery: Array<Record<string, string>> = [{ phone }];
  if (email) {
    conflictQuery.push({ email });
  }

  const conflict = await User.findOne({ $or: conflictQuery }).select(
    "name email phone role"
  );
  if (conflict) {
    throw new Error(
      `A user already uses this phone or email (${conflict.role}). Owner was not created.`
    );
  }

  const user = await User.create({
    name,
    phone,
    email,
    password: await hashPassword(password),
    role: "owner",
  });

  console.log("Owner created.");
  console.log(`  id: ${user._id.toString()}`);
  console.log(`  name: ${user.name}`);
  console.log(`  phone: ${user.phone ?? ""}`);
  console.log(`  email: ${user.email ?? ""}`);
  console.log("  role: owner");
  console.log("Password is not printed. Use OWNER_PHONE + OWNER_PASSWORD to log in.");

  await closeMongoConnection();
  process.exit(0);
}

seedInitialOwner().catch(async (error) => {
  console.error("Owner seed failed:", error instanceof Error ? error.message : error);
  try {
    await closeMongoConnection();
  } catch {
    // ignore close errors after a failed seed
  }
  process.exit(1);
});
