import Joi from "joi";
import { Types } from "mongoose";

export const createSalarySchema = Joi.object({
  staffId: Joi.string()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .required(),
  amount: Joi.number().min(0).required(),

  // Gregorian fields (optional - will be auto-calculated from Ethiopian dates)
  month: Joi.string()
    .pattern(/^\d{4}-\d{2}$/)
    .message("Month must be in YYYY-MM format")
    .optional(),
  year: Joi.number().integer().min(2020).max(2100).optional(),
  paymentDate: Joi.date().optional(),

  status: Joi.string().valid("pending", "paid").optional(),
  remarks: Joi.string().optional().allow("", null),

  // Ethiopian calendar fields (required)
  registeredDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .message("Registered date must be in YYYY-MM-DD format (Ethiopian)")
    .required(),
  paymentDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .message("Payment date must be in YYYY-MM-DD format (Ethiopian)")
    .required(),
  // Legacy field name (optional, for backward compatibility)
  ethiopianPaymentDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .message("Ethiopian payment date must be in YYYY-MM-DD format")
    .optional(),
  salaryPeriod: Joi.string().valid("monthly", "per_month").optional(),
});

export const updateSalarySchema = Joi.object({
  amount: Joi.number().min(0).optional(),
  status: Joi.string().valid("pending", "paid").optional(),
  paymentDate: Joi.date().optional(),
  remarks: Joi.string().optional().allow("", null),

  // Ethiopian calendar fields (optional updates)
  ethiopianPaymentDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .message("Ethiopian payment date must be in YYYY-MM-DD format")
    .optional(),
  registeredDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .message("Registered date must be in YYYY-MM-DD format (Ethiopian)")
    .optional(),
  salaryPeriod: Joi.string().valid("monthly", "per_month").optional(),
});

export const listSalarySchema = Joi.object({
  staffId: Joi.string()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .optional(),
  month: Joi.string()
    .pattern(/^\d{4}-\d{2}$/)
    .message("Month must be in YYYY-MM format")
    .optional(),
  year: Joi.number().integer().min(2020).max(2100).optional(),
  status: Joi.string().valid("pending", "paid").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

// Withdrawal validation schemas
export const createWithdrawalSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  reason: Joi.string()
    .valid("cash", "broke_products", "advance", "deduction", "loan", "other")
    .required(),
  description: Joi.string().optional().allow("", null),
});

export const updateWithdrawalSchema = Joi.object({
  amount: Joi.number().min(0).optional(),
  reason: Joi.string()
    .valid("cash", "broke_products", "advance", "deduction", "loan", "other")
    .optional(),
  description: Joi.string().optional().allow("", null),
});

// Payment validation schemas
export const createPaymentSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  paymentDate: Joi.date()
    .optional()
    .default(() => new Date()),
  paymentMethod: Joi.string()
    .valid("cash", "bank_transfer", "check", "mobile_money", "other")
    .optional(),
  remarks: Joi.string().optional().allow("", null),
});

export const updatePaymentSchema = Joi.object({
  amount: Joi.number().min(0).optional(),
  paymentDate: Joi.date().optional(),
  paymentMethod: Joi.string()
    .valid("cash", "bank_transfer", "check", "mobile_money", "other")
    .optional(),
  remarks: Joi.string().optional().allow("", null),
});

// Ethiopian date validation helper
export const ethiopianDateSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .message("Ethiopian date must be in YYYY-MM-DD format");
