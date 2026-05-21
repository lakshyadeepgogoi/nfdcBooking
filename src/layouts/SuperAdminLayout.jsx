import { useState } from "react"
import { Navigate, Outlet } from "react-router-dom"
import {
  LayoutDashboard, Building2, Users, CalendarCheck, BarChart3, ScrollText,
} from "lucide-react"
import Sidebar from "@/components/common/Sidebar"
import Topbar from "@/components/common/Topbar"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import ErrorBoundary from "@/components/common/ErrorBoundary"
import { useAuth } from "@/hooks/useAuth"

const NAV_ITEMS = [
  { label: "Platform Dashboard",     path: "/super/dashboard",  icon: LayoutDashboard },
  { label: "Theaters",               path: "/super/theaters",   icon: Building2 },
  { label: "Admin Management",       path: "/super/admins",     icon: Users },
  { label: "Cross-Theater Bookings", path: "/super/bookings",   icon: CalendarCheck },
  { label: "Platform Analytics",     path: "/super/analytics",  icon: BarChart3 },
  { label: "Activity Logs",          path: "/super/logs",       icon: ScrollText },
]

export default function SuperAdminLayout() {
  const { isLoading, isAuthenticated, role } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (isLoading) return <LoadingSpinner fullPage />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role !== "super-admin") return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        navItems={NAV_ITEMS}
        isMobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 lg:ml-60 overflow-hidden">
        <Topbar title="NFDC Super Admin" onMobileMenuToggle={() => setMobileOpen(true)} />
        <main className="flex-1 p-6 bg-gray-50 overflow-auto min-w-0 overflow-x-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
