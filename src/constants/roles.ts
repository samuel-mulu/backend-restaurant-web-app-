export type Role = "owner" | "cashier" | "waiter";
export const ROLES: Role[] = ["owner", "cashier", "waiter"];
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  cashier: "Cashier",
  waiter: "Waiter",
};
