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
  month: Joi.string()
    .pattern(/^\d{4}-\d{2}$/)
    .message("Month must be in YYYY-MM format")
    .required(),
  year: Joi.number().integer().min(2020).max(2100).required(),
  paymentDate: Joi.date().required(),
  status: Joi.string().valid("pending", "paid").optional(),
  remarks: Joi.string().optional(),
});

export const updateSalarySchema = Joi.object({
  amount: Joi.number().min(0).optional(),
  status: Joi.string().valid("pending", "paid").optional(),
  paymentDate: Joi.date().optional(),
  remarks: Joi.string().optional(),
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

