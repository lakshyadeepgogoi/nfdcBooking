import { Routes, Route, Navigate } from "react-router-dom"
import TheaterAdminLayout from "@/layouts/TheaterAdminLayout"
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
import BlockManager from "@/pages/theater-admin/blocks/BlockManager"
import AnalyticsDashboard from "@/pages/theater-admin/analytics/AnalyticsDashboard"
import Notifications from "@/pages/theater-admin/Notifications"

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
        <Route path="blocks" element={<BlockManager />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Routes>
  )
}
