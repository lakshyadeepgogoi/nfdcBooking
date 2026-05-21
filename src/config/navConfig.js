/**
 * Unified navigation config.
 *
 * Every nav item declares which `roles` can see it.
 * Sidebar / AppLayout filters this array by the current user's role at render time —
 * no need to maintain separate nav arrays per layout.
 *
 * Fields:
 *   label   — display text
 *   path    — react-router path
 *   icon    — lucide icon component
 *   roles   — which roles see this item (omit = visible to all authenticated roles)
 *   badge   — optional number/string rendered as a badge next to the label
 */
import {
  LayoutDashboard,
  Settings,
  Building2,
  Clock,
  ListChecks,
  Tag,
  CalendarCheck,
  Ban,
  BarChart3,
  Bell,
  Users,
  ScrollText,
} from "lucide-react"
import { ROLES } from "@/auth/permissions"

export const NAV_ITEMS = [
  // ── Theater Admin ─────────────────────────────────────────────────────────────
  {
    label: "Dashboard",
    path:  "/admin/dashboard",
    icon:  LayoutDashboard,
    roles: [ROLES.THEATER_ADMIN],
  },
  {
    label: "Theater Settings",
    path:  "/admin/theater-settings",
    icon:  Settings,
    roles: [ROLES.THEATER_ADMIN],
  },
  {
    label: "Audis",
    path:  "/admin/audis",
    icon:  Building2,
    roles: [ROLES.THEATER_ADMIN],
  },
  {
    label: "Slots",
    path:  "/admin/slots",
    icon:  Clock,
    roles: [ROLES.THEATER_ADMIN],
  },
  {
    label: "Services",
    path:  "/admin/services",
    icon:  ListChecks,
    roles: [ROLES.THEATER_ADMIN],
  },
  {
    label: "Price Config",
    path:  "/admin/pricing",
    icon:  Tag,
    roles: [ROLES.THEATER_ADMIN],
  },
  {
    label: "Bookings",
    path:  "/admin/bookings",
    icon:  CalendarCheck,
    roles: [ROLES.THEATER_ADMIN],
  },
  {
    label: "Block Manager",
    path:  "/admin/blocks",
    icon:  Ban,
    roles: [ROLES.THEATER_ADMIN],
  },
  {
    label: "Analytics",
    path:  "/admin/analytics",
    icon:  BarChart3,
    roles: [ROLES.THEATER_ADMIN],
  },
  {
    label: "Notifications",
    path:  "/admin/notifications",
    icon:  Bell,
    roles: [ROLES.THEATER_ADMIN],
  },

  // ── Super Admin ───────────────────────────────────────────────────────────────
  {
    label: "Platform Dashboard",
    path:  "/super/dashboard",
    icon:  LayoutDashboard,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    label: "Theaters",
    path:  "/super/theaters",
    icon:  Building2,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    label: "Admin Management",
    path:  "/super/admins",
    icon:  Users,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    label: "Cross-Theater Bookings",
    path:  "/super/bookings",
    icon:  CalendarCheck,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    label: "Platform Analytics",
    path:  "/super/analytics",
    icon:  BarChart3,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    label: "Activity Logs",
    path:  "/super/logs",
    icon:  ScrollText,
    roles: [ROLES.SUPER_ADMIN],
  },
]
