import { hashPassword } from "../../common/utils/password";
import { Role } from "../../constants/roles";
import { User, UserDoc } from "../auth/user.model";

const STAFF_ROLES = ["cashier", "waiter", "staff", "barman"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

const isStaffRole = (role: string): role is StaffRole =>
  (STAFF_ROLES as readonly string[]).includes(role);

const isLoginStaffRole = (role: string) =>
  role === "cashier" || role === "waiter" || role === "barman";

export interface CreateStaffInput {
  name: string;
  email?: string;
  password?: string;
  phone?: string;
  role: StaffRole;
  salary: number;
  color?: string;
}

export interface UpdateStaffInput {
  phone?: string;
  salary?: number;
  role?: StaffRole;
  color?: string;
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
    role: { $in: [...STAFF_ROLES] },
    isDeleted: { $ne: true },
  };

  if (role && isStaffRole(role)) {
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

  if (!isStaffRole(staff.role)) {
    throw new Error("User is not a staff member");
  }

  return staff as any;
};

export const createStaff = async (
  data: CreateStaffInput & { clientId?: string },
): Promise<UserDoc> => {
  if (data.clientId) {
    const existing = await User.findOne({ clientId: data.clientId });
    if (existing) {
      return existing;
    }
  }

  if (!isStaffRole(data.role)) {
    throw {
      status: 400,
      message: "Role must be cashier, waiter, staff, or barman",
    };
  }

  if (isLoginStaffRole(data.role) && !data.password) {
    throw {
      status: 400,
      message: "Password is required for cashier, waiter, and barman roles",
    };
  }

  if (isLoginStaffRole(data.role) && (!data.phone || !data.phone.trim())) {
    throw {
      status: 400,
      message: "Phone is required for cashier, waiter, and barman roles",
    };
  }

  if (data.email && data.email.trim()) {
    const existingEmail = await User.findOne({
      email: data.email.toLowerCase().trim(),
    });
    if (existingEmail) {
      throw { status: 409, message: "Email already exists" };
    }
  }

  if (data.phone && data.phone.trim()) {
    const existingPhone = await User.findOne({ phone: data.phone.trim() });
    if (existingPhone) {
      throw { status: 409, message: "Phone number already exists" };
    }
  }

  let hashedPassword: string | undefined;
  if (data.password && data.password.trim()) {
    hashedPassword = await hashPassword(data.password);
  } else if (isLoginStaffRole(data.role)) {
    throw {
      status: 400,
      message: "Password is required for cashier, waiter, and barman roles",
    };
  }

  const userData: any = {
    name: data.name,
    role: data.role,
    salary: data.salary,
    clientId: data.clientId,
  };

  if (data.color !== undefined) {
    userData.color = data.color || undefined;
  }

  if (data.email && data.email.trim()) {
    userData.email = data.email.toLowerCase().trim();
  }

  if (data.phone && data.phone.trim()) {
    userData.phone = data.phone.trim();
  }

  if (hashedPassword) {
    userData.password = hashedPassword;
  } else if (data.role === "staff") {
    userData.password = await hashPassword(
      `staff_${Date.now()}_${Math.random()}`,
    );
  }

  const staff = await User.create(userData);

  return staff;
};

export const updateStaff = async (
  id: string,
  data: UpdateStaffInput,
): Promise<UserDoc | null> => {
  const staff = await User.findOne({
    _id: id,
    isDeleted: { $ne: true },
  });

  if (!staff) {
    throw { status: 404, message: "Staff member not found" };
  }

  if (!isStaffRole(staff.role)) {
    throw { status: 400, message: "User is not a staff member" };
  }

  if (data.role && !isStaffRole(data.role)) {
    throw {
      status: 400,
      message: "Role must be cashier, waiter, staff, or barman",
    };
  }

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

  if (data.color !== undefined) {
    staff.color = data.color || undefined;
  }

  await staff.save();

  return staff;
};

export const deleteStaff = async (id: string): Promise<UserDoc | null> => {
  const staff = await User.findById(id);

  if (!staff) {
    throw { status: 404, message: "Staff member not found" };
  }

  if (!isStaffRole(staff.role)) {
    throw { status: 400, message: "User is not a staff member" };
  }

  await User.findByIdAndDelete(id);
  return staff;
};

export const getStaffAttendance = async (id: string) => {
  return null;
};
