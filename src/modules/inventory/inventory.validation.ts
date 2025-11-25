import Joi from "joi";
import { Types } from "mongoose";

export const createInventorySchema = Joi.object({
  name: Joi.string().trim().required(),
  description: Joi.string().trim().optional(),
  categoryId: Joi.string()
    .custom((value, helpers) => {
      if (value && !Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .optional()
    .allow(null, ""),
  quantity: Joi.number().min(0).required(),
  unit: Joi.string().trim().required(),
  price: Joi.number().min(0).required(),
  minThreshold: Joi.number().min(0).optional(),
});

export const updateInventorySchema = Joi.object({
  name: Joi.string().trim().optional(),
  description: Joi.string().trim().optional().allow(null, ""),
  categoryId: Joi.string()
    .custom((value, helpers) => {
      if (value && !Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .optional()
    .allow(null, ""),
  quantity: Joi.number().min(0).optional(),
  price: Joi.number().min(0).optional(),
  minThreshold: Joi.number().min(0).optional(),
});
