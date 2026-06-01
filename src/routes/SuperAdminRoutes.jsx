import { Routes, Route, Navigate } from "react-router-dom"
import SuperAdminLayout from "@/layouts/SuperAdminLayout"
import NotFound from "@/pages/NotFound"
import PlatformDashboard from "@/pages/super-admin/PlatformDashboard"
import TheaterList from "@/pages/super-admin/theaters/TheaterList"
import TheaterDetail from "@/pages/super-admin/theaters/TheaterDetail"
import AdminList from "@/pages/super-admin/admins/AdminList"
import CrossTheaterBookings from "@/pages/super-admin/bookings/CrossTheaterBookings"
import BookingDetail from "@/pages/theater-admin/bookings/BookingDetail"
import PlatformAnalytics from "@/pages/super-admin/analytics/PlatformAnalytics"
import ActivityLogs from "@/pages/super-admin/activity-logs/ActivityLogs"
import Profile from "@/pages/Profile"

export default function SuperAdminRoutes() {
  return (
    <Routes>
      <Route element={<SuperAdminLayout />}>
        <Route index element={<Navigate to="/super/dashboard" replace />} />
        <Route path="dashboard" element={<PlatformDashboard />} />
        <Route path="theaters" element={<TheaterList />} />
        <Route path="theaters/:theaterId" element={<TheaterDetail />} />
        <Route path="admins" element={<AdminList />} />
        <Route path="bookings" element={<CrossTheaterBookings />} />
        <Route path="bookings/:bookingId" element={<BookingDetail />} />
        <Route path="analytics" element={<PlatformAnalytics />} />
        <Route path="logs" element={<ActivityLogs />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
