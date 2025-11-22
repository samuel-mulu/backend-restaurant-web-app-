import mongoose, { Types } from "mongoose";
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
    categoryName: "Appetizers",
    name: "Spring Rolls",
    description: "Crispy vegetable spring rolls served with sweet chili sauce",
    price: 8.99,
    image: {
      url: "https://placeholder.com/400x300?text=Spring+Rolls",
      publicId: "seed/app-001",
    },
    isAvailable: true,
  },
  {
    categoryName: "Appetizers",
    name: "Chicken Wings",
    description: "Spicy buffalo wings with blue cheese dip",
    price: 12.99,
    image: {
      url: "https://placeholder.com/400x300?text=Chicken+Wings",
      publicId: "seed/app-002",
    },
    isAvailable: true,
  },
  // Main Courses
  {
    categoryName: "Main Courses",
    name: "Grilled Salmon",
    description: "Fresh Atlantic salmon with lemon butter sauce and vegetables",
    price: 24.99,
    image: {
      url: "https://placeholder.com/400x300?text=Grilled+Salmon",
      publicId: "seed/main-001",
    },
    isAvailable: true,
  },
  {
    categoryName: "Main Courses",
    name: "Beef Steak",
    description:
      "Tender ribeye steak cooked to perfection with mashed potatoes",
    price: 29.99,
    image: {
      url: "https://placeholder.com/400x300?text=Beef+Steak",
      publicId: "seed/main-002",
    },
    isAvailable: true,
  },
  {
    categoryName: "Main Courses",
    name: "Chicken Curry",
    description: "Spicy chicken curry with basmati rice and naan bread",
    price: 18.99,
    image: {
      url: "https://placeholder.com/400x300?text=Chicken+Curry",
      publicId: "seed/main-003",
    },
    isAvailable: true,
  },
  // Salads
  {
    categoryName: "Salads",
    name: "Caesar Salad",
    description: "Fresh romaine lettuce with caesar dressing and parmesan",
    price: 11.99,
    image: {
      url: "https://placeholder.com/400x300?text=Caesar+Salad",
      publicId: "seed/sal-001",
    },
    isAvailable: true,
  },
  {
    categoryName: "Salads",
    name: "Greek Salad",
    description: "Mixed greens with feta cheese, olives, and vinaigrette",
    price: 12.99,
    image: {
      url: "https://placeholder.com/400x300?text=Greek+Salad",
      publicId: "seed/sal-002",
    },
    isAvailable: true,
  },
  // Pizza
  {
    categoryName: "Pizza",
    name: "Margherita Pizza",
    description: "Classic pizza with tomato, mozzarella, and basil",
    price: 14.99,
    image: {
      url: "https://placeholder.com/400x300?text=Margherita+Pizza",
      publicId: "seed/piz-001",
    },
    isAvailable: true,
  },
  {
    categoryName: "Pizza",
    name: "Pepperoni Pizza",
    description: "Traditional pizza with pepperoni and mozzarella cheese",
    price: 16.99,
    image: {
      url: "https://placeholder.com/400x300?text=Pepperoni+Pizza",
      publicId: "seed/piz-002",
    },
    isAvailable: true,
  },
  // Desserts
  {
    categoryName: "Desserts",
    name: "Chocolate Cake",
    description: "Rich chocolate layer cake with vanilla frosting",
    price: 9.99,
    image: {
      url: "https://placeholder.com/400x300?text=Chocolate+Cake",
      publicId: "seed/des-001",
    },
    isAvailable: true,
  },
  {
    categoryName: "Desserts",
    name: "Ice Cream Sundae",
    description: "Vanilla ice cream with hot fudge and whipped cream",
    price: 7.99,
    image: {
      url: "https://placeholder.com/400x300?text=Ice+Cream+Sundae",
      publicId: "seed/des-002",
    },
    isAvailable: true,
  },
];

const inventoryItems = [
  {
    name: "Rice (10kg bag)",
    description: "Premium basmati rice for restaurant use",
    categoryName: "Main Courses", // Will be set after category creation
    quantity: 50,
    unit: "bag",
    minThreshold: 10,
  },
  {
    name: "Olive Oil (5L)",
    description: "Extra virgin olive oil for cooking",
    categoryName: "Main Courses",
    quantity: 30,
    unit: "bottle",
    minThreshold: 5,
  },
  {
    name: "Flour (20kg)",
    description: "All-purpose flour for baking",
    categoryName: "Main Courses",
    quantity: 75,
    unit: "bag",
    minThreshold: 15,
  },
  {
    name: "Coffee Beans (2kg)",
    description: "Premium arabica coffee beans",
    categoryName: "Coffee",
    quantity: 20,
    unit: "bag",
    minThreshold: 5,
  },
  {
    name: "Sugar (10kg)",
    description: "Granulated white sugar",
    categoryName: "Main Courses",
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

    // Clear existing data before seeding
    // Using collection.deleteMany to bypass pre-hooks that filter isDeleted: false
    console.log("🗑️  Clearing existing data...");
    await Category.collection.deleteMany({});
    await Item.collection.deleteMany({});
    await Inventory.collection.deleteMany({});
    console.log("✅ Existing data cleared");

    // Drop any leftover indexes that might cause conflicts
    console.log("🔧 Cleaning up indexes...");

    // Drop itemCode index from Items collection
    try {
      await Item.collection.dropIndex("itemCode_1");
      console.log("✅ Dropped itemCode_1 index");
    } catch (error: any) {
      // Index might not exist, which is fine
      if (error.code !== 27) {
        // 27 is the error code for index not found
        console.warn("⚠️  Could not drop itemCode_1 index:", error.message);
      }
    }

    // Drop productId index from Inventory collection
    try {
      await Inventory.collection.dropIndex("productId_1");
      console.log("✅ Dropped productId_1 index");
    } catch (error: any) {
      // Index might not exist, which is fine
      if (error.code !== 27) {
        // 27 is the error code for index not found
        console.warn("⚠️  Could not drop productId_1 index:", error.message);
      }
    }

    // Drop itemCode index from Inventory collection
    try {
      await Inventory.collection.dropIndex("itemCode_1");
      console.log("✅ Dropped itemCode_1 index from Inventory");
    } catch (error: any) {
      // Index might not exist, which is fine
      if (error.code !== 27) {
        // 27 is the error code for index not found
        console.warn(
          "⚠️  Could not drop itemCode_1 index from Inventory:",
          error.message
        );
      }
    }

    // Seed Categories
    console.log("📦 Seeding categories...");
    const createdCategories = await Category.insertMany(categories);
    console.log(`✅ Created ${createdCategories.length} categories`);

    // Create a map of category names to IDs
    // Note: Category schema has lowercase: true, so names are stored in lowercase
    const categoryMap: { [key: string]: Types.ObjectId } = {};
    createdCategories.forEach((cat) => {
      // Names are already lowercase due to schema lowercase: true
      categoryMap[cat.name] = cat._id;
    });

    // Helper function to get category ID by name
    const getCategoryId = (name: string): Types.ObjectId | undefined => {
      return categoryMap[name.toLowerCase()];
    };

    // Seed Menu Items
    console.log("🍽️  Seeding menu items...");
    const menuItemsWithCategories = menuItems.map((item) => {
      const categoryId = getCategoryId(item.categoryName);
      if (!categoryId) {
        throw new Error(`Category not found: ${item.categoryName}`);
      }
      const { categoryName, ...itemData } = item;
      // Price will be automatically converted to cents by the schema setter
      // categoryId is required, so we ensure it's a valid ObjectId
      return { ...itemData, categoryId };
    });

    const createdMenuItems = await Item.insertMany(menuItemsWithCategories);
    console.log(`✅ Created ${createdMenuItems.length} menu items`);

    // Seed Inventory Records
    console.log("📊 Seeding inventory records...");
    const inventoryItemsWithCategories = inventoryItems.map((item) => {
      const categoryId = getCategoryId(item.categoryName);
      const { categoryName, ...itemData } = item;
      // categoryId is optional for Inventory, so we can leave it undefined if not found
      return {
        ...itemData,
        categoryId: categoryId || undefined,
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
