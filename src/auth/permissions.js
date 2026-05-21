/**
 * RBAC — single source of truth for roles and permissions.
 *
 * How it works:
 *   1.  ROLES         — role string constants (must match backend values)
 *   2.  PERMISSIONS   — fine-grained action keys
 *   3.  ROLE_PERMISSIONS — which permissions each role owns
 *   4.  hasRole / hasPermission — pure helper functions (used by hook + component)
 */

// ─── Roles ─────────────────────────────────────────────────────────────────────
export const ROLES = {
  THEATER_ADMIN: "theater-admin",
  SUPER_ADMIN:   "super-admin",
}

// ─── Permission keys ────────────────────────────────────────────────────────────
export const PERMISSIONS = {
  // Theater
  CREATE_THEATER:          "create_theater",
  MANAGE_THEATERS:         "manage_theaters",
  VIEW_OWN_THEATER:        "view_own_theater",
  EDIT_THEATER_SETTINGS:   "edit_theater_settings",

  // Audis
  MANAGE_AUDIS:            "manage_audis",

  // Slots
  MANAGE_SLOTS:            "manage_slots",

  // Services
  MANAGE_SERVICES:         "manage_services",

  // Pricing
  MANAGE_PRICING:          "manage_pricing",

  // Bookings
  VIEW_OWN_BOOKINGS:       "view_own_bookings",
  MANAGE_OWN_BOOKINGS:     "manage_own_bookings",
  CREATE_MANUAL_BOOKING:   "create_manual_booking",
  VIEW_ALL_BOOKINGS:       "view_all_bookings",

  // Blocks
  MANAGE_BLOCKS:           "manage_blocks",

  // Analytics
  VIEW_OWN_ANALYTICS:      "view_own_analytics",
  VIEW_PLATFORM_ANALYTICS: "view_platform_analytics",

  // Notifications
  VIEW_NOTIFICATIONS:      "view_notifications",

  // Admin management (super-admin only)
  MANAGE_ADMINS:           "manage_admins",

  // Activity logs (super-admin only)
  VIEW_ACTIVITY_LOGS:      "view_activity_logs",
}

// ─── Role → Permissions map ─────────────────────────────────────────────────────
export const ROLE_PERMISSIONS = {
  [ROLES.THEATER_ADMIN]: [
    PERMISSIONS.VIEW_OWN_THEATER,
    PERMISSIONS.EDIT_THEATER_SETTINGS,
    PERMISSIONS.MANAGE_AUDIS,
    PERMISSIONS.MANAGE_SLOTS,
    PERMISSIONS.MANAGE_SERVICES,
    PERMISSIONS.MANAGE_PRICING,
    PERMISSIONS.VIEW_OWN_BOOKINGS,
    PERMISSIONS.MANAGE_OWN_BOOKINGS,
    PERMISSIONS.CREATE_MANUAL_BOOKING,
    PERMISSIONS.MANAGE_BLOCKS,
    PERMISSIONS.VIEW_OWN_ANALYTICS,
    PERMISSIONS.VIEW_NOTIFICATIONS,
  ],
  [ROLES.SUPER_ADMIN]: [
    PERMISSIONS.CREATE_THEATER,
    PERMISSIONS.MANAGE_THEATERS,
    PERMISSIONS.VIEW_OWN_THEATER,
    PERMISSIONS.VIEW_ALL_BOOKINGS,
    PERMISSIONS.VIEW_OWN_ANALYTICS,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    PERMISSIONS.MANAGE_ADMINS,
    PERMISSIONS.VIEW_ACTIVITY_LOGS,
  ],
}

// ─── Pure helpers ────────────────────────────────────────────────────────────────

/**
 * Returns true if `currentRole` is in the `allowed` list.
 * Passing no allowed list means "any authenticated role is fine".
 */
export function hasRole(currentRole, allowed) {
  if (!allowed) return true
  const list = Array.isArray(allowed) ? allowed : [allowed]
  if (list.length === 0) return true
  return list.includes(currentRole)
}

/**
 * Returns true if `role` has the given `permission`.
 */
export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
