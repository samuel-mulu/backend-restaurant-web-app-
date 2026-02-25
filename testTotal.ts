import { formatReceipt } from "./src/common/utils/receiptFormatter";

const mockOrderWithZeroTotal: any = {
    orderNumber: "ORD-TOTAL-TEST",
    createdAt: new Date(),
    items: [
        {
            nameSnapshot: "Item 1",
            qty: 2,
            priceSnapshot: 100.00
        },
        {
            nameSnapshot: "Item 2",
            qty: 1,
            priceSnapshot: 50.00
        }
    ],
    totalAmount: 0, // Testing fallback
    status: "OPEN"
};

console.log("--- Receipt with Zero TotalAmount ---");
console.log(formatReceipt(mockOrderWithZeroTotal));
