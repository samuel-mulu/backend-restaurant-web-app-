import { Server } from "socket.io";
import { Order } from "../modules/orders/order.model";
import { Inventory } from "../modules/inventory/inventory.model";
import {
  notifyCashiersNewOrder,
  notifyCustomerOrderUpdated,
  notifyInventoryLowStock,
} from "./events";
import { connectMongo } from "../config/database";

let changeStream: any = null;

export const startOrderChangeStream = (io: Server) => {
  const startStream = async () => {
    try {
      // Ensure MongoDB connection
      await connectMongo();

      // Check if MongoDB supports change streams (requires replica set)
      const isReplicaSet = await checkReplicaSetSupport();

      if (!isReplicaSet) {
        startPollingFallback(io);
        return;
      }

      // Create change stream for Order collection
      changeStream = Order.watch([
        {
          $match: {
            $or: [
              { operationType: "insert" },
              { operationType: "update" },
              { operationType: "delete" },
            ],
          },
        },
      ]);


      changeStream.on("change", async (change: any) => {

        try {
          switch (change.operationType) {
            case "insert":
              await handleOrderInsert(io, change);
              break;
            case "update":
              await handleOrderUpdate(io, change);
              break;
            case "delete":
              await handleOrderDelete(io, change);
              break;
          }
        } catch (error) {
          console.error("Error handling change stream event:", error);
        }
      });

      changeStream.on("error", (error: any) => {
        console.error("Change stream error:", error);

        // Stop change stream and start polling fallback
        if (changeStream) {
          changeStream.close();
          changeStream = null;
        }

        startPollingFallback(io);
      });
    } catch (error) {
      console.error("Failed to start change stream:", error);
      startPollingFallback(io);
    }
  };

  startStream();
};

// Check if MongoDB supports change streams (replica set)
const checkReplicaSetSupport = async (): Promise<boolean> => {
  try {
    // Try to create a simple change stream to test support
    const testStream = Order.watch([], { maxAwaitTimeMS: 1000 });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        testStream.close();
        resolve(true); // If no error, change streams are supported
      }, 1000);

      testStream.on("error", (error: any) => {
        clearTimeout(timeout);
        testStream.close();
        if (error.code === 40573) {
          // Change stream not supported
          reject(new Error("Change streams not supported"));
        } else {
          reject(error);
        }
      });
    });
    return true;
  } catch (error: any) {
    return false;
  }
};

// Polling fallback for standalone MongoDB instances
let pollingInterval: NodeJS.Timeout | null = null;
let lastOrderCount = 0;

const startPollingFallback = (io: Server) => {

  // Clear any existing polling
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Initial count
  Order.countDocuments().then((count) => {
    lastOrderCount = count;
  });

  pollingInterval = setInterval(async () => {
    try {
      const currentCount = await Order.countDocuments();

      if (currentCount > lastOrderCount) {
        // New orders detected
        const newOrders = await Order.find()
          .sort({ createdAt: -1 })
          .limit(currentCount - lastOrderCount)
          .populate(
            "items.itemId",
            "name description price images type isAvailable ingredients"
          );


        for (const order of newOrders) {
          await handleOrderInsert(io, { fullDocument: order });
        }
      }

      lastOrderCount = currentCount;
    } catch (error) {
      console.error("Error in polling fallback:", error);
    }
  }, 5000); // Poll every 5 seconds
};

const handleOrderInsert = async (_io: Server, change: any) => {
  const rawOrder = change.fullDocument;
  const orderId = rawOrder?._id;

  try {
    let orderDoc = await Order.findById(orderId).populate(
      "items.itemId",
      "name description price images type isAvailable ingredients"
    );

    if (!orderDoc && rawOrder) {
      orderDoc = await Order.hydrate(rawOrder).populate(
        "items.itemId",
        "name description price images type isAvailable ingredients"
      );
    }

    if (!orderDoc) {
      console.warn(
        "[warn] Unable to load order document for change stream insert:",
        orderId
      );
      return;
    }

    notifyCashiersNewOrder(orderDoc, "change_stream");
  } catch (error) {
    console.error("Error handling order insert via change stream:", error);
  }
};

const handleOrderUpdate = async (_io: Server, change: any) => {
  const orderId = change.documentKey._id;
  const updatedFields = change.updateDescription?.updatedFields ?? {};


  try {
    const order = await Order.findById(orderId).populate(
      "items.itemId",
      "name description price images type isAvailable ingredients"
    );

    if (!order) {
      console.warn("[warn] Order not found for change stream update:", orderId);
      return;
    }

    notifyCustomerOrderUpdated(order, {
      source: "change_stream",
      updatedFields,
      broadcastToCustomer: false,
    });
  } catch (error) {
    console.error("Error handling order update via change stream:", error);
  }
};

const handleOrderDelete = async (io: Server, change: any) => {
  const orderId = change.documentKey._id;


  // Broadcast to all relevant clients
  io.to("owner:orders").emit("orderDeleted", {
    type: "order_deleted",
    data: { id: orderId },
    timestamp: new Date(),
    source: "change_stream",
  });

  io.to("orders:general").emit("orderEvent", {
    type: "order_deleted",
    data: { id: orderId },
    timestamp: new Date(),
    source: "change_stream",
  });
};

export const restartChangeStream = (io: Server) => {
  if (changeStream) {
    changeStream.close();
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  startOrderChangeStream(io);
};

export const stopChangeStream = () => {
  if (changeStream) {
    changeStream.close();
    changeStream = null;
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
};

// Inventory Change Stream
let inventoryChangeStream: any = null;

export const startInventoryChangeStream = (io: Server) => {
  const startStream = async () => {
    try {
      await connectMongo();

      const isReplicaSet = await checkReplicaSetSupport();

      if (!isReplicaSet) {
        return;
      }

      inventoryChangeStream = Inventory.watch([
        {
          $match: {
            operationType: "update",
          },
        },
      ]);


      inventoryChangeStream.on("change", async (change: any) => {
        try {
          if (change.operationType === "update") {
            await handleInventoryUpdate(io, change);
          }
        } catch (error) {
          console.error("Error handling inventory change stream event:", error);
        }
      });

      inventoryChangeStream.on("error", (error: any) => {
        console.error("Inventory change stream error:", error);
      });
    } catch (error) {
      console.error("Failed to start inventory change stream:", error);
    }
  };

  startStream();
};

const handleInventoryUpdate = async (_io: Server, change: any) => {
  const inventoryId = change.documentKey._id;
  const updatedFields = change.updateDescription?.updatedFields ?? {};

  // Check if quantity was updated
  if (updatedFields.quantity !== undefined) {
    try {
      const inventory = await Inventory.findById(inventoryId);

      if (!inventory) {
        return;
      }

      // Check if quantity is low (0 or less)
      if (inventory.quantity <= 0) {
        notifyInventoryLowStock({
          inventoryId: inventory._id.toString(),
          inventoryName: inventory.name,
          quantity: inventory.quantity,
          minThreshold: 0,
        });
      }
    } catch (error) {
      console.error(
        "Error handling inventory update via change stream:",
        error
      );
    }
  }
};
