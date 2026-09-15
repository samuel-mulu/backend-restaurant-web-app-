import { hashPassword, verifyPassword } from "../../common/utils/password";
import { RestaurantSettings, RestaurantSettingsDoc } from "./settings.model";

export type SecurityPinType = "void" | "expense";
export type CashierResource = "menus" | "categories" | "inventory";

/** Legacy default PIN used before owner config existed */
const DEFAULT_PIN = "1219";

export interface CashierStatusVisibility {
  cashierShowOpen: boolean;
  cashierShowPaidToWaiter: boolean;
  cashierShowPaidToCashier: boolean;
  cashierShowWithoutPrint: boolean;
  cashierShowVoided: boolean;
  cashierShowDisputed: boolean;
  cashierShowConfirmed: boolean;
}

export type CashierHistoryDefaultTab = "waiter" | "owner";

export interface CashierPermissions {
  cashierCanEditMenus: boolean;
  cashierCanEditCategories: boolean;
  cashierCanEditInventory: boolean;
}

export interface PublicSettings
  extends CashierPermissions,
    CashierStatusVisibility {
  voidPinConfigured: boolean;
  expensePinConfigured: boolean;
  cashierHistoryDefaultTab: CashierHistoryDefaultTab;
}

function flag(value: boolean | undefined, defaultTrue = true): boolean {
  if (value === undefined || value === null) return defaultTrue;
  return value !== false;
}

function permissionsFromDoc(settings: RestaurantSettingsDoc): CashierPermissions {
  return {
    cashierCanEditMenus: flag(settings.cashierCanEditMenus),
    cashierCanEditCategories: flag(settings.cashierCanEditCategories),
    cashierCanEditInventory: flag(settings.cashierCanEditInventory),
  };
}

function statusVisibilityFromDoc(
  settings: RestaurantSettingsDoc
): CashierStatusVisibility {
  return {
    cashierShowOpen: flag(settings.cashierShowOpen),
    cashierShowPaidToWaiter: flag(settings.cashierShowPaidToWaiter),
    cashierShowPaidToCashier: flag(settings.cashierShowPaidToCashier),
    cashierShowWithoutPrint: flag(settings.cashierShowWithoutPrint),
    cashierShowVoided: flag(settings.cashierShowVoided),
    cashierShowDisputed: flag(settings.cashierShowDisputed),
    cashierShowConfirmed: flag(settings.cashierShowConfirmed),
  };
}

function publicFromDoc(settings: RestaurantSettingsDoc): PublicSettings {
  return {
    voidPinConfigured: Boolean(settings.voidPinHash),
    expensePinConfigured: Boolean(settings.expensePinHash),
    ...permissionsFromDoc(settings),
    ...statusVisibilityFromDoc(settings),
    cashierHistoryDefaultTab:
      settings.cashierHistoryDefaultTab === "owner" ? "owner" : "waiter",
  };
}

export async function getOrCreateSettings(): Promise<RestaurantSettingsDoc> {
  let settings = await RestaurantSettings.findOne({ key: "default" });
  if (!settings) {
    const [voidPinHash, expensePinHash] = await Promise.all([
      hashPassword(DEFAULT_PIN),
      hashPassword(DEFAULT_PIN),
    ]);
    settings = await RestaurantSettings.create({
      key: "default",
      voidPinHash,
      expensePinHash,
      cashierCanEditMenus: true,
      cashierCanEditCategories: true,
      cashierCanEditInventory: true,
      cashierShowOpen: true,
      cashierShowPaidToWaiter: true,
      cashierShowPaidToCashier: true,
      cashierShowWithoutPrint: true,
      cashierShowVoided: true,
      cashierShowDisputed: true,
      cashierShowConfirmed: true,
      cashierHistoryDefaultTab: "waiter",
    });
  }
  return settings;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const settings = await getOrCreateSettings();
  return publicFromDoc(settings);
}

export async function getSecurityPinStatus(): Promise<{
  voidPinConfigured: boolean;
  expensePinConfigured: boolean;
}> {
  const settings = await getOrCreateSettings();
  return {
    voidPinConfigured: Boolean(settings.voidPinHash),
    expensePinConfigured: Boolean(settings.expensePinHash),
  };
}

export async function updateSecurityPins(data: {
  voidPin?: string;
  expensePin?: string;
}): Promise<PublicSettings> {
  if (!data.voidPin && !data.expensePin) {
    throw { status: 400, message: "Provide voidPin and/or expensePin to update" };
  }

  const settings = await getOrCreateSettings();

  if (data.voidPin !== undefined) {
    const pin = String(data.voidPin).trim();
    if (!/^\d{4}$/.test(pin)) {
      throw { status: 400, message: "Void PIN must be exactly 4 digits" };
    }
    settings.voidPinHash = await hashPassword(pin);
  }

  if (data.expensePin !== undefined) {
    const pin = String(data.expensePin).trim();
    if (!/^\d{4}$/.test(pin)) {
      throw { status: 400, message: "Expense PIN must be exactly 4 digits" };
    }
    settings.expensePinHash = await hashPassword(pin);
  }

  await settings.save();
  return getPublicSettings();
}

export type CashierSettingsUpdate = Partial<
  CashierPermissions &
    CashierStatusVisibility & {
      cashierHistoryDefaultTab: CashierHistoryDefaultTab;
    }
>;

export async function updateCashierPermissions(
  data: CashierSettingsUpdate
): Promise<PublicSettings> {
  const settings = await getOrCreateSettings();

  const boolKeys: (keyof CashierSettingsUpdate)[] = [
    "cashierCanEditMenus",
    "cashierCanEditCategories",
    "cashierCanEditInventory",
    "cashierShowOpen",
    "cashierShowPaidToWaiter",
    "cashierShowPaidToCashier",
    "cashierShowWithoutPrint",
    "cashierShowVoided",
    "cashierShowDisputed",
    "cashierShowConfirmed",
  ];

  let touched = false;
  for (const key of boolKeys) {
    if (typeof data[key] === "boolean") {
      (settings as any)[key] = data[key];
      touched = true;
    }
  }

  if (
    data.cashierHistoryDefaultTab === "waiter" ||
    data.cashierHistoryDefaultTab === "owner"
  ) {
    settings.cashierHistoryDefaultTab = data.cashierHistoryDefaultTab;
    touched = true;
  }

  if (!touched) {
    throw {
      status: 400,
      message: "Provide at least one cashier setting to update",
    };
  }

  // At least one create-order path must remain on
  const nextOpen = flag(
    typeof data.cashierShowOpen === "boolean"
      ? data.cashierShowOpen
      : settings.cashierShowOpen
  );
  const nextWaiter = flag(
    typeof data.cashierShowPaidToWaiter === "boolean"
      ? data.cashierShowPaidToWaiter
      : settings.cashierShowPaidToWaiter
  );
  const nextCashier = flag(
    typeof data.cashierShowPaidToCashier === "boolean"
      ? data.cashierShowPaidToCashier
      : settings.cashierShowPaidToCashier
  );

  if (!nextOpen && !nextWaiter && !nextCashier) {
    throw {
      status: 400,
      message:
        "At least one of Open, Paid to Waiter, or Paid to Cashier must stay on",
    };
  }

  await settings.save();
  return publicFromDoc(settings);
}

export async function cashierCanEditResource(
  resource: CashierResource
): Promise<boolean> {
  const settings = await getOrCreateSettings();
  const perms = permissionsFromDoc(settings);
  if (resource === "menus") return perms.cashierCanEditMenus;
  if (resource === "categories") return perms.cashierCanEditCategories;
  return perms.cashierCanEditInventory;
}

export async function assertCashierCanEdit(
  role: string | undefined,
  resource: CashierResource
): Promise<void> {
  if (role === "owner") return;

  if (role !== "cashier") {
    throw {
      status: 403,
      message: "You do not have permission to modify this resource",
    };
  }

  const allowed = await cashierCanEditResource(resource);
  if (!allowed) {
    throw {
      status: 403,
      message: `Cashier ${resource} edit/delete is disabled by owner`,
    };
  }
}

export async function verifySecurityPin(
  type: SecurityPinType,
  pin: string
): Promise<boolean> {
  if (!pin || typeof pin !== "string") {
    return false;
  }

  const settings = await getOrCreateSettings();
  const hash =
    type === "void" ? settings.voidPinHash : settings.expensePinHash;

  if (!hash) {
    return false;
  }

  return verifyPassword(String(pin).trim(), hash);
}

export async function assertSecurityPin(
  type: SecurityPinType,
  pin: unknown
): Promise<void> {
  if (pin === undefined || pin === null || String(pin).trim() === "") {
    throw {
      status: 403,
      message:
        type === "void"
          ? "Security PIN is required to void an order"
          : "Security PIN is required to record an expense",
    };
  }

  const ok = await verifySecurityPin(type, String(pin));
  if (!ok) {
    throw { status: 403, message: "Invalid security PIN" };
  }
}
