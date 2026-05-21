export const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  WAIVED: "waived",
}

// ROLES is now the authoritative copy in src/auth/permissions.js
// Re-exported here so existing imports still work without changes.
export { ROLES } from "@/auth/permissions"

export const ACTION_TYPES = [
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "status_change",
  "publish",
]

export const PRICE_CONFIG_TYPES = {
  HOURLY: "hourly",
  FLAT: "flat",
  CANCELLATION: "cancellation",
}
