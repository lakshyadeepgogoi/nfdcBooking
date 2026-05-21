/**
 * AppLayout — single unified layout for all authenticated roles.
 *
 * Pass `requiredRole` to lock a route tree to one role.
 * The Sidebar receives only the nav items that belong to the current user's role
 * — derived from the central navConfig, not hardcoded here.
 */
import { useState } from "react"
import { Navigate, Outlet } from "react-router-dom"
import Sidebar from "@/components/common/Sidebar"
import Topbar from "@/components/common/Topbar"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import ErrorBoundary from "@/components/common/ErrorBoundary"
import { useAuth } from "@/hooks/useAuth"
import { NAV_ITEMS } from "@/config/navConfig"
import { ROLES } from "@/auth/permissions"

const ROLE_TITLES = {
  [ROLES.THEATER_ADMIN]: "NFDC Admin",
  [ROLES.SUPER_ADMIN]:   "NFDC Super Admin",
}

export default function AppLayout({ requiredRole }) {
  const { isLoading, isAuthenticated, role } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (isLoading) return <LoadingSpinner fullPage />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (requiredRole && role !== requiredRole) return <Navigate to="/login" replace />

  // Filter nav items to only those the current role may see
  const navItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        navItems={navItems}
        isMobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 lg:ml-60 overflow-hidden">
        <Topbar
          title={ROLE_TITLES[role] ?? "NFDC Admin"}
          onMobileMenuToggle={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 bg-gray-50 overflow-auto min-w-0 overflow-x-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
