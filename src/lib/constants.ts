export const ROLES = ["viewer", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const CATEGORIES = [
  "CANOPY",
  "TRAY_DECK",
  "HEADBOARD",
  "DROP_SIDES",
  "REAR_RACK",
  "CHASSIS_PANEL",
  "CHASSIS_DRAWER",
  "MUDGUARD",
  "UNDERBODY_TOOLBOX",
  "ROOF_RACK",
  "CANOPY_ACCESSORY",
  "SERVICE_BODY",
  "FITTING_KIT",
  "UNISTRUT",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const INVENTORY_LOG_TYPES = [
  "opening_stock",
  "receive_stock",
  "sales_deduction",
  "adjustment_in",
  "adjustment_out",
  "write_off",
  "stocktake_correction",
  "transfer_out",
  "transfer_in",
  "reservation_adjustment",
] as const;
export type InventoryLogType = (typeof INVENTORY_LOG_TYPES)[number];

export const SALES_STATUSES = [
  "quote",
  "deposit_paid",
  "fully_paid",
  "completed",
  "cancelled",
] as const;
export type SalesStatus = (typeof SALES_STATUSES)[number];

export const INCOMING_STATUSES = [
  "pending",
  "shipped",
  "in_transit",
  "arrived",
  "confirmed",
  "cancelled",
] as const;
export type IncomingStatus = (typeof INCOMING_STATUSES)[number];

export const TRANSFER_STATUSES = [
  "pending",
  "in_transit",
  "completed",
  "cancelled",
] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const COMPONENT_ROLES = [
  "main_body",
  "body_attachment",
  "tray_mount",
  "hardware_bracket",
] as const;
export type ComponentRole = (typeof COMPONENT_ROLES)[number];

export const VALID_TRANSITIONS: Record<SalesStatus, SalesStatus[]> = {
  quote: ["deposit_paid", "cancelled"],
  deposit_paid: ["fully_paid", "cancelled"],
  fully_paid: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const INCOMING_TRANSITIONS: Record<IncomingStatus, IncomingStatus[]> = {
  pending: ["shipped", "cancelled"],
  shipped: ["in_transit", "cancelled"],
  in_transit: ["arrived", "cancelled"],
  arrived: ["confirmed", "cancelled"],
  confirmed: [],
  cancelled: [],
};

export const TRANSFER_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  pending: ["in_transit", "cancelled"],
  in_transit: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
