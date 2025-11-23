import Joi from "joi";

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().lowercase().trim().optional(),
  phone: Joi.string().optional(), // Will be handled based on role
  // Explicitly reject these fields
  password: Joi.any().forbidden(),
  salary: Joi.any().forbidden(),
  role: Joi.any().forbidden(),
});

export const updateOwnerProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().lowercase().trim().optional(),
  phone: Joi.string()
    .pattern(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
    )
    .message("Phone number must be a valid format")
    .optional(),
  // Explicitly reject these fields
  password: Joi.any().forbidden(),
  salary: Joi.any().forbidden(),
  role: Joi.any().forbidden(),
});

export const updateStaffProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().lowercase().trim().optional(),
  // Explicitly reject these fields
  phone: Joi.any().forbidden(),
  password: Joi.any().forbidden(),
  salary: Joi.any().forbidden(),
  role: Joi.any().forbidden(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().min(6),
  newPassword: Joi.string().required().min(6),
});

export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().required().min(6),
});

