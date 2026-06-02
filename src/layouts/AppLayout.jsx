/**
 * AppLayout — single unified layout for all authenticated roles.
 *
 * Pass `requiredRole` to lock a route tree to one role.
 * The Sidebar receives only the nav items that belong to the current user's role
 * — derived from the central navConfig, not hardcoded here.
 */
import { useState } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import Sidebar from "@/components/common/Sidebar"
import Topbar from "@/components/common/Topbar"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import ErrorBoundary from "@/components/common/ErrorBoundary"
import HelpGuide from "@/components/common/HelpGuide"
import { useAuth } from "@/hooks/useAuth"
import { getTheaterProfile } from "@/api/theaters"
import { NAV_ITEMS } from "@/config/navConfig"
import { ROLES } from "@/auth/permissions"

const ROLE_TITLES = {
  [ROLES.THEATER_ADMIN]: "NFDC Admin",
  [ROLES.SUPER_ADMIN]:   "NFDC Super Admin",
}

export default function AppLayout({ requiredRole }) {
  const { isLoading, isAuthenticated, role, user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isTheaterAdmin = role === ROLES.THEATER_ADMIN

  const { data: theaterRaw } = useQuery({
    queryKey: ["theater-profile", user?.theaterId],
    queryFn:  () => getTheaterProfile(user?.theaterId).then(r => r.data.data),
    enabled:  isTheaterAdmin && !!user?.theaterId,
    staleTime: 5 * 60_000,
  })
  const allowUserReschedule = theaterRaw?.config?.allowUserReschedule ?? false

  if (isLoading) return <LoadingSpinner fullPage />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (requiredRole && role !== requiredRole) return <Navigate to="/login" replace />

  // Filter nav items by role, and by feature flags
  const navItems = NAV_ITEMS.filter(item => {
    if (item.roles && !item.roles.includes(role)) return false
    if (item.requiresReschedule && !allowUserReschedule) return false
    return true
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        navItems={navItems}
        isMobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 lg:ml-60 overflow-hidden">
        <Topbar
          title={ROLE_TITLES[role] ?? "NFDC Adminn"}
          onMobileMenuToggle={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 bg-gray-50 overflow-auto min-w-0 overflow-x-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      {isTheaterAdmin && <HelpGuide />}
    </div>
  )
}
