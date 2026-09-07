import Joi from "joi";

export const createInventorySchema = Joi.object({
  name: Joi.string().trim().required(),
  description: Joi.string().trim().optional(),
  quantity: Joi.number().min(0).required(),
  unit: Joi.string().trim().required(),
  price: Joi.number().min(0).required(),
  isBarman: Joi.boolean().optional(),
});

export const updateInventorySchema = Joi.object({
  name: Joi.string().trim().optional(),
  description: Joi.string().trim().optional().allow(null, ""),
  quantity: Joi.number().min(0).optional(),
  unit: Joi.string().trim().optional(),
  price: Joi.number().min(0).optional(),
  isBarman: Joi.boolean().optional(),
});

export const assignInventorySchema = Joi.object({
  barmanId: Joi.string().required(),
  assignedQuantity: Joi.number().positive().required(),
});

export const approveAssignmentSchema = Joi.object({
  approvedQuantity: Joi.number().positive().required(),
});
