/**
 * RoleGuard — universal role-based conditional renderer.
 *
 * Use it to wrap ANY piece of UI: nav items, buttons, sections, entire pages.
 * It reads the current user's role from AuthContext and decides what to render.
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 *  roles        string | string[]   — allowed roles. Omit = any role passes.
 *  permissions  string | string[]   — required permissions.
 *  requireAll   boolean (false)     — true: user must have EVERY permission listed.
 *                                     false (default): ANY one permission passes.
 *  fallback     ReactNode (null)    — rendered when access is denied.
 *  redirect     string              — navigate here instead of rendering fallback.
 *  children     ReactNode           — rendered when access is granted.
 *
 * ─── Examples ─────────────────────────────────────────────────────────────────
 *
 *  // Show only to super-admins
 *  <RoleGuard roles="super-admin">
 *    <DeleteButton />
 *  </RoleGuard>
 *
 *  // Show a fallback message when denied
 *  <RoleGuard roles={["super-admin"]} fallback={<p>Not authorized</p>}>
 *    <AdminPanel />
 *  </RoleGuard>
 *
 *  // Redirect to login when denied
 *  <RoleGuard roles="theater-admin" redirect="/login">
 *    <TheaterPage />
 *  </RoleGuard>
 *
 *  // Permission-based (any of the listed permissions)
 *  <RoleGuard permissions={[PERMISSIONS.MANAGE_ADMINS, PERMISSIONS.CREATE_THEATER]}>
 *    <SuperActions />
 *  </RoleGuard>
 *
 *  // Permission-based (must have ALL permissions)
 *  <RoleGuard permissions={[PERMISSIONS.MANAGE_AUDIS, PERMISSIONS.MANAGE_SLOTS]} requireAll>
 *    <FullManagerView />
 *  </RoleGuard>
 *
 *  // Combine both — role AND permission must pass
 *  <RoleGuard roles="super-admin" permissions={PERMISSIONS.VIEW_ACTIVITY_LOGS}>
 *    <AuditSection />
 *  </RoleGuard>
 */
import { Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { hasRole, hasPermission } from "@/auth/permissions"

export default function RoleGuard({
  roles,
  permissions,
  requireAll = false,
  fallback = null,
  redirect,
  children,
}) {
  const { role, isAuthenticated, isLoading } = useAuth()

  // Still resolving session — render nothing to avoid flash
  if (isLoading) return null

  // Not logged in
  if (!isAuthenticated) {
    return redirect ? <Navigate to={redirect} replace /> : fallback
  }

  // ── Role check ────────────────────────────────────────────────────────────────
  const roleOk = !roles || hasRole(role, roles)

  // ── Permission check ──────────────────────────────────────────────────────────
  let permOk = true
  if (permissions) {
    const list = Array.isArray(permissions) ? permissions : [permissions]
    permOk = requireAll
      ? list.every((p) => hasPermission(role, p))
      : list.some((p) => hasPermission(role, p))
  }

  const allowed = roleOk && permOk

  if (!allowed) {
    return redirect ? <Navigate to={redirect} replace /> : fallback
  }

  return children
}
