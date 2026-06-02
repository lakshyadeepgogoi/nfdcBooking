import { Routes, Route, Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import TheaterAdminLayout from "@/layouts/TheaterAdminLayout"
import NotFound from "@/pages/NotFound"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import { useAuth } from "@/hooks/useAuth"
import { getTheaterProfile } from "@/api/theaters"
import Dashboard from "@/pages/theater-admin/Dashboard"
import TheaterSettings from "@/pages/theater-admin/TheaterSettings"
import AudiList from "@/pages/theater-admin/audi/AudiList"
import AudiCreate from "@/pages/theater-admin/audi/AudiCreate"
import AudiDetail from "@/pages/theater-admin/audi/AudiDetail"
import SlotList from "@/pages/theater-admin/slots/SlotList"
import ServiceList from "@/pages/theater-admin/services/ServiceList"
import PriceConfigList from "@/pages/theater-admin/pricing/PriceConfigList"
import BookingList from "@/pages/theater-admin/bookings/BookingList"
import BookingDetail from "@/pages/theater-admin/bookings/BookingDetail"
import ManualBooking from "@/pages/theater-admin/bookings/ManualBooking"
import RescheduleList from "@/pages/theater-admin/reschedule/RescheduleList"
import BlockManager from "@/pages/theater-admin/blocks/BlockManager"
import AnalyticsDashboard from "@/pages/theater-admin/analytics/AnalyticsDashboard"
import Notifications from "@/pages/theater-admin/Notifications"
import Profile from "@/pages/Profile"

function RescheduleGuard() {
  const { user } = useAuth()
  const { data: theaterRaw, isLoading } = useQuery({
    queryKey: ["theater-profile", user?.theaterId],
    queryFn:  () => getTheaterProfile(user?.theaterId).then(r => r.data.data),
    enabled:  !!user?.theaterId,
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <LoadingSpinner />
  if (!theaterRaw?.config?.allowUserReschedule) return <Navigate to="/admin/dashboard" replace />
  return <RescheduleList />
}

const ComingSoon = ({ label }) => (
  <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
    {label} — Coming soon
  </div>
)

export default function TheaterAdminRoutes() {
  return (
    <Routes>
      <Route element={<TheaterAdminLayout />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="theater-settings" element={<TheaterSettings />} />
        <Route path="audis" element={<AudiList />} />
        <Route path="audis/create" element={<AudiCreate />} />
        <Route path="audis/:audiId" element={<AudiDetail />} />
        <Route path="slots" element={<SlotList />} />
        <Route path="services" element={<ServiceList />} />
        <Route path="pricing" element={<PriceConfigList />} />
        <Route path="bookings" element={<BookingList />} />
        <Route path="bookings/manual" element={<ManualBooking />} />
        <Route path="bookings/:bookingId" element={<BookingDetail />} />
        <Route path="reschedule" element={<RescheduleGuard />} />
        <Route path="blocks" element={<BlockManager />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
