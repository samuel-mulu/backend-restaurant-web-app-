import Joi from "joi";
import { Types } from "mongoose";

export const createTableSchema = Joi.object({
  tableNumber: Joi.string().required().trim().min(1).max(20),
  clientId: Joi.string().optional(),
});

export const updateTableSchema = Joi.object({
  tableNumber: Joi.string().trim().min(1).max(20).optional(),
});

export const listTablesSchema = Joi.object({
  search: Joi.string().optional(),
});

export const tableIdSchema = Joi.object({
  id: Joi.string()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .required(),
});
