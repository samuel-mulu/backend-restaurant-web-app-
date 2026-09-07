import Joi from "joi";
import { Types } from "mongoose";

const allowedStaffColors = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "blue",
  "indigo",
  "purple",
  "pink",
] as const;

export const createStaffSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  email: Joi.string().email().optional().lowercase().trim().allow("", null),
  password: Joi.string().when("role", {
    is: Joi.string().valid("cashier", "waiter", "barman"),
    then: Joi.string().required().min(6),
    otherwise: Joi.string().optional().allow("", null),
  }),
  phone: Joi.string().when("role", {
    is: Joi.string().valid("cashier", "waiter", "barman"),
    then: Joi.string()
      .required()
      .pattern(
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
      )
      .message("Phone number must be a valid format"),
    otherwise: Joi.string()
      .optional()
      .allow("", null)
      .pattern(
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
      )
      .message("Phone number must be a valid format"),
  }),
  role: Joi.string().valid("cashier", "waiter", "staff", "barman").required(),
  salary: Joi.number().min(0).required(),
  color: Joi.string()
    .valid(...allowedStaffColors)
    .optional()
    .lowercase()
    .trim()
    .allow("", null),
});

export const updateStaffSchema = Joi.object({
  phone: Joi.string()
    .pattern(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
    )
    .message("Phone number must be a valid format")
    .optional()
    .allow("", null),
  salary: Joi.number().min(0).optional(),
  role: Joi.string().valid("cashier", "waiter", "staff", "barman").optional(),
  color: Joi.string()
    .valid(...allowedStaffColors)
    .optional()
    .lowercase()
    .trim()
    .allow("", null),
});

export const listStaffSchema = Joi.object({
  role: Joi.string().valid("cashier", "waiter", "staff", "barman").optional(),
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
