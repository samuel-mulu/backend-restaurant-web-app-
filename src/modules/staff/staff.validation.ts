import Joi from "joi";
import { Types } from "mongoose";

export const createStaffSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  email: Joi.string().email().required().lowercase().trim(),
  password: Joi.string().required().min(6),
  phone: Joi.string()
    .required()
    .pattern(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
    )
    .message("Phone number must be a valid format"),
  role: Joi.string().valid("cashier", "waiter").required(),
  salary: Joi.number().min(0).optional(),
});

export const updateStaffSchema = Joi.object({
  phone: Joi.string()
    .pattern(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
    )
    .message("Phone number must be a valid format")
    .optional(),
  salary: Joi.number().min(0).optional(),
  role: Joi.string().valid("cashier", "waiter").optional(),
});

export const listStaffSchema = Joi.object({
  role: Joi.string().valid("cashier", "waiter").optional(),
  search: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

export const staffIdSchema = Joi.object({
  id: Joi.string()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .required(),
});
