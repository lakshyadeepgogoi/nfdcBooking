/**
 * usePermissions — programmatic RBAC hook.
 *
 * Use this when you need role/permission logic in JS (not JSX),
 * e.g. building dynamic columns, disabling API calls, computing
 * redirect targets, etc.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *  const { isSuperAdmin, can, canAny } = usePermissions()
 *
 *  // Boolean checks
 *  isSuperAdmin          → true/false
 *  isTheaterAdmin        → true/false
 *
 *  // Role check
 *  hasRole("super-admin")                    → true/false
 *  hasRole(["theater-admin","super-admin"])   → true if EITHER matches
 *
 *  // Permission checks
 *  can(PERMISSIONS.MANAGE_ADMINS)                          → true/false
 *  canAny([PERMISSIONS.CREATE_THEATER, PERMISSIONS.MANAGE_THEATERS]) → any match
 *  canAll([PERMISSIONS.MANAGE_AUDIS, PERMISSIONS.MANAGE_SLOTS])      → all match
 */
import { useAuth } from "@/hooks/useAuth"
import { ROLES, hasRole as _hasRole, hasPermission } from "@/auth/permissions"

export function usePermissions() {
  const { role, isAuthenticated, isLoading, user } = useAuth()

  return {
    role,
    user,
    isAuthenticated,
    isLoading,

    isTheaterAdmin: role === ROLES.THEATER_ADMIN,
    isSuperAdmin:   role === ROLES.SUPER_ADMIN,

    /**
     * Check whether the current role is in the allowed list.
     * @param {string | string[]} roles
     */
    hasRole: (roles) => _hasRole(role, roles),

    /**
     * Check whether the current role has a single permission.
     * @param {string} permission — one of PERMISSIONS.*
     */
    can: (permission) => hasPermission(role, permission),

    /**
     * True if the current role has ANY of the listed permissions.
     * @param {string[]} permissions
     */
    canAny: (permissions) => {
      const list = Array.isArray(permissions) ? permissions : [permissions]
      return list.some((p) => hasPermission(role, p))
    },

    /**
     * True if the current role has ALL of the listed permissions.
     * @param {string[]} permissions
     */
    canAll: (permissions) => {
      const list = Array.isArray(permissions) ? permissions : [permissions]
      return list.every((p) => hasPermission(role, p))
    },
  }
}
