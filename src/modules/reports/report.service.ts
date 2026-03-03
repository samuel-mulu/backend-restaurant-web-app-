import { Expense } from "../expenses/expense.model";
import { Order } from "../orders/order.model";

export const getReportData = async (startDate: Date, endDate: Date) => {
  const matchQuery = {
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const expenseQuery = {
    date: { $gte: startDate, $lte: endDate },
  };

  const [orders, expenses, salesByPaymentMethod, staffPerformance] = await Promise.all([
    // Basic Order Summary
    Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$totalAmount" },
        },
      },
    ]),

    // Expenses
    Expense.aggregate([
      { $match: expenseQuery },
      {
        $group: {
          _id: "$reason",
          total: { $sum: "$amount" },
          items: { $push: "$$ROOT" },
        },
      },
    ]),

    // Sales by Payment Method & Bank
    Order.aggregate([
      { 
        $match: { 
          ...matchQuery, 
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] },
          paymentMethod: { $exists: true }
        } 
      },
      {
        $group: {
          _id: {
            method: "$paymentMethod",
            bank: "$paymentBankName"
          },
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 }
        }
      }
    ]),

    // Staff Performance
    Order.aggregate([
      { 
        $match: { 
          ...matchQuery, 
          status: { $in: ["PAID_TO_CASHIER", "OWNER_CONFIRMED"] } 
        } 
      },
      {
        $facet: {
          byWaiter: [
            { $match: { waiterId: { $exists: true } } },
            {
              $group: {
                _id: "$waiterId",
                count: { $sum: 1 },
                total: { $sum: "$totalAmount" }
              }
            },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "waiter"
              }
            },
            { $unwind: "$waiter" },
            {
              $project: {
                name: "$waiter.name",
                count: 1,
                total: 1
              }
            }
          ],
          byCashier: [
            { $match: { cashierId: { $exists: true } } },
            {
              $group: {
                _id: "$cashierId",
                count: { $sum: 1 },
                total: { $sum: "$totalAmount" }
              }
            },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "cashier"
              }
            },
            { $unwind: "$cashier" },
            {
              $project: {
                name: "$cashier.name",
                count: 1,
                total: 1
              }
            }
          ]
        }
      }
    ])
  ]);

  return {
    orders,
    expenses,
    salesByPaymentMethod,
    staffPerformance: staffPerformance[0]
  };
};
