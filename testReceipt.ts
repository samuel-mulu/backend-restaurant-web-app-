import { formatReceipt } from "./src/common/utils/receiptFormatter";

const mockOrder: any = {
    orderNumber: "ORD-20260225-TEST",
    createdAt: new Date(),
    tableNumber: "12",
    items: [
        {
            nameSnapshot: "ካርፓቺዮ ዲ ማንዞ ዲ ቺያ",
            qty: 1,
            priceSnapshot: 280.00
        },
        {
            nameSnapshot: "Coca Cola",
            qty: 2,
            priceSnapshot: 45.00
        }
    ],
    totalAmount: 370.00,
    status: "OPEN",
    waiterId: { name: "David Waiter" },
    cashierId: { name: "Sarah Cashier" }
};

console.log(formatReceipt(mockOrder));
