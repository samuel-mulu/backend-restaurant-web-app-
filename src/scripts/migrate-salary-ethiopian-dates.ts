/**
 * Migration Script: Add Ethiopian Calendar Dates to Existing Salary Records
 *
 * This script migrates existing salary records to include Ethiopian calendar dates.
 * Run this script once after deploying the new salary model changes.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-salary-ethiopian-dates.ts
 */

import mongoose from "mongoose";
import { Salary } from "../modules/salary/salary.model";
import {
  gregorianToEthiopian,
  formatEthiopianDate,
  getCurrentEthiopianDate,
} from "../common/utils/ethiopianCalendar";
import { config } from "dotenv";

// Load environment variables
config();

async function migrateSalaryEthiopianDates() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI environment variable is not set");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Find all salary records without Ethiopian dates
    const salariesToMigrate = await Salary.find({
      $or: [
        { ethiopianPaymentDate: { $exists: false } },
        { registeredDate: { $exists: false } },
        { ethiopianPaymentDate: null },
        { registeredDate: null },
      ],
    });

    console.log(`Found ${salariesToMigrate.length} salary records to migrate`);

    if (salariesToMigrate.length === 0) {
      console.log("No records to migrate. Exiting.");
      await mongoose.disconnect();
      return;
    }

    let migrated = 0;
    let errors = 0;
    const currentEthDate = getCurrentEthiopianDate();

    for (const salary of salariesToMigrate) {
      try {
        // Convert payment date to Ethiopian
        const paymentDate = new Date(salary.paymentDate);
        const ethiopianPaymentDate = gregorianToEthiopian(paymentDate);

        // Use current Ethiopian date as registered date if not set
        // In production, you might want to use createdAt date instead
        const registeredDate = formatEthiopianDate(currentEthDate);

        // Update salary record
        salary.ethiopianMonth = ethiopianPaymentDate.month;
        salary.ethiopianYear = ethiopianPaymentDate.year;
        salary.ethiopianPaymentDate = formatEthiopianDate(ethiopianPaymentDate);
        salary.registeredDate = registeredDate;
        salary.salaryPeriod = salary.salaryPeriod || "monthly";

        // Initialize tracking fields if not set
        if (salary.netAmount === undefined || salary.netAmount === null) {
          salary.netAmount = salary.amount;
        }
        if (
          salary.totalWithdrawals === undefined ||
          salary.totalWithdrawals === null
        ) {
          salary.totalWithdrawals = 0;
        }
        if (
          salary.totalPayments === undefined ||
          salary.totalPayments === null
        ) {
          salary.totalPayments = 0;
        }

        await salary.save();
        migrated++;

        if (migrated % 10 === 0) {
          console.log(
            `Migrated ${migrated}/${salariesToMigrate.length} records...`
          );
        }
      } catch (error) {
        errors++;
        console.error(`Error migrating salary ${salary._id}:`, error);
      }
    }

    console.log("\nMigration completed!");
    console.log(`Successfully migrated: ${migrated}`);
    console.log(`Errors: ${errors}`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrateSalaryEthiopianDates()
    .then(() => {
      console.log("Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateSalaryEthiopianDates };
