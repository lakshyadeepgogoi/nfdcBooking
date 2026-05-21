import AppLayout from "@/layouts/AppLayout"
import { ROLES } from "@/auth/permissions"

/** Super-admin route guard — delegates all rendering to AppLayout. */
export default function SuperAdminLayout() {
  return <AppLayout requiredRole={ROLES.SUPER_ADMIN} />
}
