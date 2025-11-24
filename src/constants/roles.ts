export type Role = "owner" | "cashier" | "waiter" | "staff";
export const ROLES: Role[] = ["owner", "cashier", "waiter", "staff"];
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  cashier: "Cashier",
  waiter: "Waiter",
  staff: "Staff",
};
