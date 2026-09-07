import { Schema, model, Document } from "mongoose";

export interface RestaurantSettingsDoc extends Document {
  key: string;
  voidPinHash: string;
  expensePinHash: string;
  /** When true, cashiers can edit/delete menu items */
  cashierCanEditMenus: boolean;
  /** When true, cashiers can edit/delete categories */
  cashierCanEditCategories: boolean;
  /** When true, cashiers can edit/delete inventory */
  cashierCanEditInventory: boolean;
  /** Cashier UI: show/use Open create path + history filter/change */
  cashierShowOpen: boolean;
  /** Cashier UI: Paid to Waiter (PAID_TO_CASHIER) */
  cashierShowPaidToWaiter: boolean;
  /** Cashier UI: Paid to Cashier (TRANSFERRED_TO_OWNER) */
  cashierShowPaidToCashier: boolean;
  /** Cashier UI: Without Print option */
  cashierShowWithoutPrint: boolean;
  /** Cashier UI: Voided in history filter/change */
  cashierShowVoided: boolean;
  /** Cashier UI: Disputed in history filter/change */
  cashierShowDisputed: boolean;
  /** Cashier UI: Confirmed in history filter */
  cashierShowConfirmed: boolean;
  /** Cashier History default tab: From Waiters | To Owner */
  cashierHistoryDefaultTab: "waiter" | "owner";
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSettingsSchema = new Schema<RestaurantSettingsDoc>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    voidPinHash: {
      type: String,
      required: true,
    },
    expensePinHash: {
      type: String,
      required: true,
    },
    cashierCanEditMenus: {
      type: Boolean,
      default: true,
    },
    cashierCanEditCategories: {
      type: Boolean,
      default: true,
    },
    cashierCanEditInventory: {
      type: Boolean,
      default: true,
    },
    cashierShowOpen: { type: Boolean, default: true },
    cashierShowPaidToWaiter: { type: Boolean, default: true },
    cashierShowPaidToCashier: { type: Boolean, default: true },
    cashierShowWithoutPrint: { type: Boolean, default: true },
    cashierShowVoided: { type: Boolean, default: true },
    cashierShowDisputed: { type: Boolean, default: true },
    cashierShowConfirmed: { type: Boolean, default: true },
    cashierHistoryDefaultTab: {
      type: String,
      enum: ["waiter", "owner"],
      default: "waiter",
    },
  },
  { timestamps: true }
);

export const RestaurantSettings = model<RestaurantSettingsDoc>(
  "RestaurantSettings",
  RestaurantSettingsSchema
);
