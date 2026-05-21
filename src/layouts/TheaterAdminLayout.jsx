import { useState } from "react"
import { Navigate, Outlet } from "react-router-dom"
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
} from "lucide-react"
import Sidebar from "@/components/common/Sidebar"
import Topbar from "@/components/common/Topbar"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import ErrorBoundary from "@/components/common/ErrorBoundary"
import { useAuth } from "@/hooks/useAuth"

const NAV_ITEMS = [
  { label: "Dashboard",        path: "/admin/dashboard",        icon: LayoutDashboard },
  { label: "Theater Settings", path: "/admin/theater-settings", icon: Settings },
  { label: "Audis",            path: "/admin/audis",            icon: Building2 },
  { label: "Slots",            path: "/admin/slots",            icon: Clock },
  { label: "Services",         path: "/admin/services",         icon: ListChecks },
  { label: "Price Config",     path: "/admin/pricing",          icon: Tag },
  { label: "Bookings",         path: "/admin/bookings",         icon: CalendarCheck },
  { label: "Block Manager",    path: "/admin/blocks",           icon: Ban },
  { label: "Analytics",        path: "/admin/analytics",        icon: BarChart3 },
  { label: "Notifications",    path: "/admin/notifications",    icon: Bell },
]

export default function TheaterAdminLayout() {
  const { isLoading, isAuthenticated, role } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (isLoading) return <LoadingSpinner fullPage />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role !== "theater-admin") return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        navItems={NAV_ITEMS}
        isMobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 lg:ml-60 overflow-hidden">
        <Topbar
          title="NFDC Admin"
          onMobileMenuToggle={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-6 bg-gray-50 overflow-auto min-w-0 overflow-x-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
