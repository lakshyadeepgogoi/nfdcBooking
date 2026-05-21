import AppLayout from "@/layouts/AppLayout"
import { ROLES } from "@/auth/permissions"

/** Theater-admin route guard — delegates all rendering to AppLayout. */
export default function TheaterAdminLayout() {
  return <AppLayout requiredRole={ROLES.THEATER_ADMIN} />
}
