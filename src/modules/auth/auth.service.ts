import { User, UserDoc } from "./user.model";
import { hashPassword } from "../../common/utils/password";
import { signAccessToken } from "../../common/utils/jwt";

import { Role } from "../../constants/roles";

export const createUser = async (data: {
  name: string;
  email: string;
  password: string;
  role?: Role;
}) => {
  const exists = await User.findOne({ email: data.email });
  if (exists) throw { status: 409, message: "Email already exists" };
  const hashedPassword = await hashPassword(data.password);
  const user = await User.create({
    name: data.name,
    email: data.email,
    role: data.role || "cashier",
    password: hashedPassword,
  });
  return user;
};

// Legacy login function - kept for backward compatibility
// The new enhanced login logic is now in auth.controller.ts
export const login = async (email: string, password: string) => {
  const user = await User.findOne({ email, isActive: true });
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
      role: user.role,
    },
  };
};

export const listUsers = () =>
  User.find().select("-password").sort({ createdAt: -1 });
export const deactivate = (id: string) =>
  User.findByIdAndUpdate(id, { isActive: false }, { new: true });
