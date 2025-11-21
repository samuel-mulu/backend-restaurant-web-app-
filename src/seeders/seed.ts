import mongoose from "mongoose";
import { connectMongo, closeMongoConnection } from "../config/database";
import { Category } from "../modules/categories/category.model";
import { Item } from "../modules/items/item.model";
import { Inventory } from "../modules/inventory/inventory.model";

// Sample data
const categories = [
  { name: "Appetizers" },
  { name: "Main Courses" },
  { name: "Desserts" },
  { name: "Salads" },
  { name: "Pizza" },
  { name: "Soft Drinks" },
  { name: "Coffee" },
  { name: "Tea" },
  { name: "Juices" },
];

const menuItems = [
  // Appetizers
  {
    categoryId: "", // Will be set after category creation
    itemCode: "APP-001",
    name: "Spring Rolls",
    description: "Crispy vegetable spring rolls served with sweet chili sauce",
    price: 8.99,
    isAvailable: true,
  },
  {
    categoryId: "",
    itemCode: "APP-002",
    name: "Chicken Wings",
    description: "Spicy buffalo wings with blue cheese dip",
    price: 12.99,
    isAvailable: true,
  },
  // Main Courses
  {
    categoryId: "",
    itemCode: "MAIN-001",
    name: "Grilled Salmon",
    description: "Fresh Atlantic salmon with lemon butter sauce and vegetables",
    price: 24.99,
    isAvailable: true,
  },
  {
    categoryId: "",
    itemCode: "MAIN-002",
    name: "Beef Steak",
    description:
      "Tender ribeye steak cooked to perfection with mashed potatoes",
    price: 29.99,
    isAvailable: true,
  },
  {
    categoryId: "",
    itemCode: "MAIN-003",
    name: "Chicken Curry",
    description: "Spicy chicken curry with basmati rice and naan bread",
    price: 18.99,
    isAvailable: true,
  },
  // Salads
  {
    categoryId: "",
    itemCode: "SAL-001",
    name: "Caesar Salad",
    description: "Fresh romaine lettuce with caesar dressing and parmesan",
    price: 11.99,
    isAvailable: true,
  },
  {
    categoryId: "",
    itemCode: "SAL-002",
    name: "Greek Salad",
    description: "Mixed greens with feta cheese, olives, and vinaigrette",
    price: 12.99,
    isAvailable: true,
  },
  // Pizza
  {
    categoryId: "",
    itemCode: "PIZ-001",
    name: "Margherita Pizza",
    description: "Classic pizza with tomato, mozzarella, and basil",
    price: 14.99,
    isAvailable: true,
  },
  {
    categoryId: "",
    itemCode: "PIZ-002",
    name: "Pepperoni Pizza",
    description: "Traditional pizza with pepperoni and mozzarella cheese",
    price: 16.99,
    isAvailable: true,
  },
  // Desserts
  {
    categoryId: "",
    itemCode: "DES-001",
    name: "Chocolate Cake",
    description: "Rich chocolate layer cake with vanilla frosting",
    price: 9.99,
    isAvailable: true,
  },
  {
    categoryId: "",
    itemCode: "DES-002",
    name: "Ice Cream Sundae",
    description: "Vanilla ice cream with hot fudge and whipped cream",
    price: 7.99,
    isAvailable: true,
  },
];

const inventoryItems = [
  {
    name: "Rice (10kg bag)",
    itemCode: "INV-001",
    description: "Premium basmati rice for restaurant use",
    categoryId: "", // Will be set after category creation
    quantity: 50,
    unit: "bag",
    minThreshold: 10,
  },
  {
    name: "Olive Oil (5L)",
    itemCode: "INV-002",
    description: "Extra virgin olive oil for cooking",
    categoryId: "",
    quantity: 30,
    unit: "bottle",
    minThreshold: 5,
  },
  {
    name: "Flour (20kg)",
    itemCode: "INV-003",
    description: "All-purpose flour for baking",
    categoryId: "",
    quantity: 75,
    unit: "bag",
    minThreshold: 15,
  },
  {
    name: "Coffee Beans (2kg)",
    itemCode: "INV-004",
    description: "Premium arabica coffee beans",
    categoryId: "",
    quantity: 20,
    unit: "bag",
    minThreshold: 5,
  },
  {
    name: "Sugar (10kg)",
    itemCode: "INV-005",
    description: "Granulated white sugar",
    categoryId: "",
    quantity: 100,
    unit: "bag",
    minThreshold: 20,
  },
];

async function seedDatabase() {
  try {
    console.log("🌱 Starting database seeding...");

    // Connect to MongoDB
    await connectMongo();

    // Clear existing data (optional - comment out if you want to keep existing data)
    const clearData = process.env.CLEAR_DATA === "true";
    if (clearData) {
      console.log("🗑️  Clearing existing data...");
      await Category.deleteMany({});
      await Item.deleteMany({});
      await Inventory.deleteMany({});
      console.log("✅ Existing data cleared");
    }

    // Seed Categories
    console.log("📦 Seeding categories...");
    const createdCategories = await Category.insertMany(categories);
    console.log(`✅ Created ${createdCategories.length} categories`);

    // Create a map of category names to IDs
    const categoryMap: { [key: string]: string } = {};
    createdCategories.forEach((cat) => {
      categoryMap[cat.name] = cat._id.toString();
    });

    // Helper function to get category ID by name
    const getCategoryId = (name: string): string => {
      return categoryMap[name];
    };

    // Seed Menu Items
    console.log("🍽️  Seeding menu items...");
    const menuItemsWithCategories = menuItems.map((item, index) => {
      let categoryId = "";
      if (item.itemCode.startsWith("APP")) {
        categoryId = getCategoryId("Appetizers");
      } else if (item.itemCode.startsWith("MAIN")) {
        categoryId = getCategoryId("Main Courses");
      } else if (item.itemCode.startsWith("SAL")) {
        categoryId = getCategoryId("Salads");
      } else if (item.itemCode.startsWith("PIZ")) {
        categoryId = getCategoryId("Pizza");
      } else if (item.itemCode.startsWith("DES")) {
        categoryId = getCategoryId("Desserts");
      }
      return { ...item, categoryId };
    });

    const createdMenuItems = await Item.insertMany(menuItemsWithCategories);
    console.log(`✅ Created ${createdMenuItems.length} menu items`);

    // Seed Inventory Records (standalone)
    console.log("📊 Seeding inventory records...");
    const inventoryItemsWithCategories = inventoryItems.map((item) => {
      // Use Main Courses category for inventory items
      const categoryId = getCategoryId("Main Courses");
      return {
        ...item,
        categoryId: categoryId
          ? new mongoose.Types.ObjectId(categoryId)
          : undefined,
      };
    });

    const createdInventory = await Inventory.insertMany(
      inventoryItemsWithCategories
    );
    console.log(`✅ Created ${createdInventory.length} inventory records`);

    console.log("\n🎉 Database seeding completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Categories: ${createdCategories.length}`);
    console.log(`   - Menu Items: ${createdMenuItems.length}`);
    console.log(`   - Inventory Records: ${createdInventory.length}`);

    // Close connection
    await closeMongoConnection();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    await closeMongoConnection();
    process.exit(1);
  }
}

// Run seeder
seedDatabase();
