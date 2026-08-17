import { OrderDoc } from "../../modules/orders/order.model";

/**
 * Format order data into a receipt text optimized for thermal printers (58mm width)
 * Thermal printers typically support 32 characters per line
 */
export function formatReceipt(order: OrderDoc): string {
  const MAX_LINE_WIDTH = 32;
  const restaurantName = "3T Juice House";

  // Helper function to center text
  const center = (text: string, width: number = MAX_LINE_WIDTH): string => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  };

  // Helper function to create separator line
  const separator = (char: string = "-"): string => {
    return char.repeat(MAX_LINE_WIDTH);
  };

  // Helper function to format line with left and right alignment
  const line = (left: string, right: string, width: number = MAX_LINE_WIDTH): string => {
    const padding = Math.max(1, width - left.length - right.length);
    return left + " ".repeat(padding) + right;
  };

  const lines: string[] = [];

  // Header
  lines.push(separator("="));
  lines.push(center(restaurantName));
  lines.push(separator("="));

  // Order Information
  lines.push(`Order: ${order.orderNumber}`);
  const orderDate = new Date(order.createdAt || order.placedAt);
  lines.push(`Date: ${orderDate.toLocaleDateString()} ${orderDate.toLocaleTimeString()}`);

  if (order.tableNumber) {
    lines.push(`Table: ${order.tableNumber}`);
  }

  lines.push(separator("-"));

  // Items
  lines.push("ITEMS:");
  lines.push(separator("-"));

  order.items.forEach((item) => {
    const itemName = item.nameSnapshot || (typeof item.itemId === "object" && (item.itemId as any)?.name) || "Unknown Item";
    const quantity = item.qty;
    const price = item.priceSnapshot;
    const subtotal = quantity * price;

    // Item name (may wrap if too long)
    const nameLine = `${quantity}x ${itemName}`;
    if (nameLine.length <= MAX_LINE_WIDTH - 12) {
      lines.push(nameLine);
      lines.push(line(`  @${price.toFixed(2)}`, `BIRR ${subtotal.toFixed(2)}`));
    } else {
      // Wrap item name if needed
      lines.push(`${quantity}x`);
      const wrappedName = wrapText(itemName, MAX_LINE_WIDTH - 12);
      wrappedName.forEach((line) => lines.push(`  ${line}`));
      lines.push(line(`  @${price.toFixed(2)}`, `BIRR ${subtotal.toFixed(2)}`));
    }
  });

  lines.push(separator("-"));

  // Notes
  if (order.note) {
    lines.push("NOTES:");
    const wrappedNote = wrapText(order.note, MAX_LINE_WIDTH);
    wrappedNote.forEach((line) => lines.push(line));
    lines.push("");
  }

  // Total
  const calculatedTotal = order.items.reduce((acc, item) => acc + (item.priceSnapshot * item.qty), 0);
  const displayTotal = order.totalAmount || calculatedTotal;

  lines.push(separator("-"));
  lines.push(line("TOTAL:", `BIRR ${displayTotal.toFixed(2)}`, MAX_LINE_WIDTH));
  lines.push(separator("-"));

  // Status - use friendly labels, omit for OPEN
  const STATUS_LABELS: Record<string, string> = {
    OPEN: "Pending",
    PAID_TO_CASHIER: "Paid to Waiter",
    TRANSFERRED_TO_OWNER: "Paid to Cashier",
    OWNER_CONFIRMED: "Confirmed",
    VOIDED: "Voided",
    DISPUTED: "Disputed",
  };
  let statusLabel = STATUS_LABELS[order.status] || order.status;
  if (order.status === "TRANSFERRED_TO_OWNER" && order.paymentMethod) {
    const pm = order.paymentMethod === "mobile_banking" ? "Mobile Banking" : "Cash";
    statusLabel += ` (${pm})`;
  }
  if (order.status !== "OPEN") {
    lines.push(`Status: ${statusLabel}`);
  }

  // Staff Information
  if (order.waiterId && typeof order.waiterId === "object") {
    const waiterName = (order.waiterId as any).name || "Unknown";
    lines.push(`Waiter: ${waiterName}`);
  }

  if (order.cashierId && typeof order.cashierId === "object") {
    const cashierName = (order.cashierId as any).name || "Unknown";
    lines.push(`Cashier: ${cashierName}`);
  }

  lines.push(separator("="));
  lines.push(center("Thank you for your visit!"));
  lines.push(center("Have a great day!"));
  lines.push(separator("="));

  return lines.join("\n");
}

/**
 * Wrap text to fit within specified width
 */
function wrapText(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
      // If word itself is longer than width, break it
      if (word.length > width) {
        while (word.length > width) {
          lines.push(word.substring(0, width));
          word = word.substring(width);
        }
        currentLine = word;
      }
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

/**
 * Format multiple orders into a single merged receipt
 */
export function formatMergedReceipt(orders: OrderDoc[]): string {
  const MAX_LINE_WIDTH = 32;
  const restaurantName = "3T Juice House";

  const center = (text: string, width: number = MAX_LINE_WIDTH): string => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  };

  const separator = (char: string = "-"): string => char.repeat(MAX_LINE_WIDTH);

  const line = (left: string, right: string, width: number = MAX_LINE_WIDTH): string => {
    const padding = Math.max(1, width - left.length - right.length);
    return left + " ".repeat(padding) + right;
  };

  const lines: string[] = [];

  // Header
  lines.push(separator("="));
  lines.push(center(restaurantName));
  lines.push(separator("="));
  lines.push(center("MERGED RECEIPT"));

  const printDate = new Date();
  lines.push(`Date: ${printDate.toLocaleDateString()} ${printDate.toLocaleTimeString()}`);
  lines.push(separator("-"));

  let grandTotal = 0;

  // Process Each Order
  orders.forEach((order) => {
    lines.push(`Order: ${order.orderNumber}`);

    if (order.tableNumber) {
      lines.push(`Table: ${order.tableNumber}`);
    }

    let orderTotalCalc = 0;

    order.items.forEach((item) => {
      const itemName = item.nameSnapshot || (typeof item.itemId === "object" && (item.itemId as any)?.name) || "Unknown Item";
      const quantity = item.qty;
      const price = item.priceSnapshot;
      const subtotal = quantity * price;

      orderTotalCalc += subtotal;

      const nameLine = `${quantity}x ${itemName}`;
      if (nameLine.length <= MAX_LINE_WIDTH - 12) {
        lines.push(nameLine);
        lines.push(line(`  @${price.toFixed(2)}`, `BIRR ${subtotal.toFixed(2)}`));
      } else {
        lines.push(`${quantity}x`);
        wrapText(itemName, MAX_LINE_WIDTH - 12).forEach((l) => lines.push(`  ${l}`));
        lines.push(line(`  @${price.toFixed(2)}`, `BIRR ${subtotal.toFixed(2)}`));
      }
    });

    const displayTotal = order.totalAmount || orderTotalCalc;
    grandTotal += displayTotal;

    lines.push(line("Order Total:", `BIRR ${displayTotal.toFixed(2)}`));
    lines.push(separator("-"));
  });

  // Grand Total
  lines.push(separator("="));
  lines.push(line("GRAND TOTAL:", `BIRR ${grandTotal.toFixed(2)}`, MAX_LINE_WIDTH));
  lines.push(separator("="));

  lines.push(center("Thank you for your visit!"));
  lines.push(center("Have a great day!"));
  lines.push(separator("="));

  return lines.join("\n");
}

