import Joi from "joi";
import { Types } from "mongoose";

export const createInventorySchema = Joi.object({
  productId: Joi.string()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .required(),
  quantity: Joi.number().min(0).required(),
  unit: Joi.string().required(),
  minThreshold: Joi.number().min(0).optional(),
});

export const updateInventorySchema = Joi.object({
  quantity: Joi.number().min(0).optional(),
  minThreshold: Joi.number().min(0).optional(),
});

export const purchaseSchema = Joi.object({
  quantity: Joi.number().min(0).required(),
  cost: Joi.number().min(0).required(),
  purchaseDate: Joi.date().optional(),
});
