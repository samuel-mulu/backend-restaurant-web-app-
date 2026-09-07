import { User, UserDoc } from "./user.model";
import { hashPassword, verifyPassword } from "../../common/utils/password";
import { signAccessToken } from "../../common/utils/jwt";

import { Role } from "../../constants/roles";

export const createUser = async (data: {
  name: string;
  email?: string;
  phone: string;
  password: string;
  role?: Role;
}) => {
  const exists = await User.findOne({ phone: data.phone });
  if (exists) throw { status: 409, message: "Phone number already exists" };

  if (data.email) {
    const emailExists = await User.findOne({ email: data.email });
    if (emailExists) throw { status: 409, message: "Email already exists" };
  }

  const hashedPassword = await hashPassword(data.password);
  const user = await User.create({
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role || "cashier",
    password: hashedPassword,
  });
  return user;
};

// Legacy login function - kept for backward compatibility
// The new enhanced login logic is now in auth.controller.ts
export const login = async (phone: string, password: string) => {
  const user = await User.findOne({ phone });
  if (!user) throw { status: 401, message: "Invalid credentials" };

  const { verifyPassword } = await import("../../common/utils/password");
  const ok = await verifyPassword(password, user.password);
  if (!ok) throw { status: 401, message: "Invalid credentials" };

  const token = signAccessToken({
    id: user._id.toString(),
    _id: user._id.toString(),
    role: user.role,
  });

  return {
    token,
    user: {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  };
};

export const listUsers = () =>
  User.find().select("-password").sort({ createdAt: -1 });
export const deactivate = (id: string) => User.findByIdAndDelete(id);

export const updateUserProfile = async (
  userId: string,
  data: { name?: string; email?: string; phone?: string },
  userRole: Role
): Promise<UserDoc> => {
  const user = await User.findById(userId);
  if (!user) {
    throw { status: 404, message: "User not found" };
  }

  // Validate that restricted fields are not being updated by staff
  if (userRole !== "owner" && data.phone !== undefined) {
    throw { status: 403, message: "Staff cannot update phone number" };
  }

  // Update name if provided
  if (data.name !== undefined) {
    user.name = data.name.trim();
  }

  // Update email if provided
  if (data.email !== undefined) {
    const emailLower = data.email.toLowerCase().trim();
    // Check if email is already in use by another user
    const existingEmail = await User.findOne({
      email: emailLower,
      _id: { $ne: userId },
    });
    if (existingEmail) {
      throw { status: 409, message: "Email already in use" };
    }
    user.email = emailLower;
  }

  // Update phone if provided and user is owner
  if (data.phone !== undefined && userRole === "owner") {
    const phoneTrimmed = data.phone.trim();
    // Check if phone is already in use by another user
    const existingPhone = await User.findOne({
      phone: phoneTrimmed,
      _id: { $ne: userId },
    });
    if (existingPhone) {
      throw { status: 409, message: "Phone number already in use" };
    }
    user.phone = phoneTrimmed;
  }

  await user.save();
  return user;
};

export const changeUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const user = await User.findById(userId).select("password");
  if (!user) {
    throw { status: 404, message: "User not found" };
  }

  // Verify current password
  const isCurrentPasswordValid = await verifyPassword(
    currentPassword,
    user.password
  );
  if (!isCurrentPasswordValid) {
    throw { status: 400, message: "Current password is incorrect" };
  }

  // Hash and update new password
  const hashedNewPassword = await hashPassword(newPassword);
  user.password = hashedNewPassword;
  await user.save();
};

export const resetStaffPassword = async (
  staffId: string,
  newPassword: string
): Promise<void> => {
  const staff = await User.findById(staffId);
  if (!staff) {
    throw { status: 404, message: "Staff member not found" };
  }

  // Validate it's a staff member, not owner
  if (staff.role === "owner") {
    throw { status: 403, message: "Cannot reset owner password" };
  }

  if (
    staff.role !== "cashier" &&
    staff.role !== "waiter" &&
    staff.role !== "barman"
  ) {
    throw { status: 400, message: "User is not a staff member" };
  }

  // Hash and update password
  const hashedPassword = await hashPassword(newPassword);
  staff.password = hashedPassword;
  await staff.save();
};
