import Joi from "joi";
import { Types } from "mongoose";

export const createOrderSchema = Joi.object({
  tableNumber: Joi.string().required(),
  peopleCount: Joi.number().integer().min(1).optional(),
  items: Joi.array()
    .items(
      Joi.object({
        itemId: Joi.string()
          .custom((value, helpers) => {
            if (!Types.ObjectId.isValid(value)) {
              return helpers.error("any.invalid");
            }
            return value;
          })
          .required(),
        typeSnapshot: Joi.string().valid("food", "beverage").required(),
        qty: Joi.number().integer().min(1).required(),
        nameSnapshot: Joi.string().required(),
        priceSnapshot: Joi.number().min(0).required(),
      })
    )
    .min(1)
    .required(),
  note: Joi.string().optional(),
  notes: Joi.string().optional(),
  allergyRequirements: Joi.object({
    noAllergies: Joi.boolean().optional(),
    glutenFree: Joi.boolean().optional(),
    dairyFree: Joi.boolean().optional(),
    nutFree: Joi.boolean().optional(),
    vegetarian: Joi.boolean().optional(),
    vegan: Joi.boolean().optional(),
  }).optional(),
  customerChannel: Joi.string().required(),
  waiterId: Joi.string()
    .custom((value, helpers) => {
      if (!Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .optional(),
  discount: Joi.number().min(0).optional(),
});

export const updateOrderSchema = Joi.object({
  discount: Joi.number().min(0).optional(),
  notes: Joi.string().optional(),
  items: Joi.array()
    .items(
      Joi.object({
        itemId: Joi.string()
          .custom((value, helpers) => {
            if (!Types.ObjectId.isValid(value)) {
              return helpers.error("any.invalid");
            }
            return value;
          })
          .required(),
        typeSnapshot: Joi.string().valid("food", "beverage").required(),
        qty: Joi.number().integer().min(1).required(),
        nameSnapshot: Joi.string().required(),
        priceSnapshot: Joi.number().min(0).required(),
      })
    )
    .min(1)
    .optional(),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid("pending", "preparing", "ready", "served", "completed")
    .required(),
});
