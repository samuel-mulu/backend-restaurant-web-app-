import { User, UserDoc } from "../auth/user.model";
import { hashPassword } from "../../common/utils/password";
import { Role } from "../../constants/roles";

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: "cashier" | "waiter";
  salary?: number;
}

export interface UpdateStaffInput {
  phone?: string;
  salary?: number;
  role?: "cashier" | "waiter";
}

export interface ListStaffFilters {
  role?: Role;
  search?: string;
  page?: number;
  limit?: number;
}

export const listStaff = async (filters: ListStaffFilters = {}) => {
  const { role, search, page = 1, limit = 50 } = filters;
  const query: any = {
    role: { $in: ["cashier", "waiter"] }, // Only staff roles
    isDeleted: { $ne: true }, // Exclude soft-deleted staff
  };

  if (role && (role === "cashier" || role === "waiter")) {
    query.role = role;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [staff, total] = await Promise.all([
    User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    staff,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getStaffById = async (id: string): Promise<UserDoc | null> => {
  const staff = await User.findOne({
    _id: id,
    isDeleted: { $ne: true },
  })
    .select("-password")
    .lean()
    .exec();

  if (!staff) {
    return null;
  }

  // Validate it's a staff member (cashier or waiter)
  if (staff.role !== "cashier" && staff.role !== "waiter") {
    throw new Error("User is not a staff member");
  }

  return staff as any;
};

export const createStaff = async (
  data: CreateStaffInput & { clientId?: string }
): Promise<UserDoc> => {
  // Check for idempotency if clientId provided
  if (data.clientId) {
    const existing = await User.findOne({ clientId: data.clientId });
    if (existing) {
      return existing;
    }
  }

  // Validate role
  if (data.role !== "cashier" && data.role !== "waiter") {
    throw { status: 400, message: "Role must be cashier or waiter" };
  }

  // Check if email exists
  const existingEmail = await User.findOne({
    email: data.email.toLowerCase().trim(),
  });
  if (existingEmail) {
    throw { status: 409, message: "Email already exists" };
  }

  // Check if phone exists
  const existingPhone = await User.findOne({ phone: data.phone });
  if (existingPhone) {
    throw { status: 409, message: "Phone number already exists" };
  }

  const hashedPassword = await hashPassword(data.password);

  const staff = await User.create({
    name: data.name,
    email: data.email.toLowerCase().trim(),
    password: hashedPassword,
    phone: data.phone,
    role: data.role,
    salary: data.salary,
    clientId: data.clientId,
  });

  return staff;
};

export const updateStaff = async (
  id: string,
  data: UpdateStaffInput
): Promise<UserDoc | null> => {
  const staff = await User.findOne({
    _id: id,
    isDeleted: { $ne: true },
  });

  if (!staff) {
    throw { status: 404, message: "Staff member not found" };
  }

  // Validate it's a staff member
  if (staff.role !== "cashier" && staff.role !== "waiter") {
    throw { status: 400, message: "User is not a staff member" };
  }

  // Validate role if provided
  if (data.role && data.role !== "cashier" && data.role !== "waiter") {
    throw { status: 400, message: "Role must be cashier or waiter" };
  }

  // Check phone uniqueness if updating
  if (data.phone && data.phone !== staff.phone) {
    const existingPhone = await User.findOne({ phone: data.phone });
    if (existingPhone) {
      throw { status: 409, message: "Phone number already exists" };
    }
    staff.phone = data.phone;
  }

  if (data.salary !== undefined) {
    staff.salary = data.salary;
  }

  if (data.role) {
    staff.role = data.role;
  }

  await staff.save();

  return staff;
};

export const deleteStaff = async (id: string): Promise<UserDoc | null> => {
  const staff = await User.findById(id);

  if (!staff) {
    throw { status: 404, message: "Staff member not found" };
  }

  // Validate it's a staff member
  if (staff.role !== "cashier" && staff.role !== "waiter") {
    throw { status: 400, message: "User is not a staff member" };
  }

  // Check if already deleted
  if (staff.isDeleted) {
    throw { status: 404, message: "Staff member not found" };
  }

  // Soft delete: mark as deleted
  staff.isDeleted = true;
  staff.deletedAt = new Date();
  await staff.save();

  return staff;
};

export const getStaffAttendance = async (id: string) => {
  // Optional: Return attendance records
  // This can be implemented later if attendance tracking is needed
  return null;
};
