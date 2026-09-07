export type Role = "owner" | "cashier" | "waiter" | "staff" | "barman";
export const ROLES: Role[] = ["owner", "cashier", "waiter", "staff", "barman"];
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  cashier: "Cashier",
  waiter: "Waiter",
  staff: "Staff",
  barman: "BarMan",
};
