import { Routes, Route, Navigate } from "react-router-dom"
import TheaterAdminLayout from "@/layouts/TheaterAdminLayout"
import Dashboard from "@/pages/theater-admin/Dashboard"
import TheaterSettings from "@/pages/theater-admin/TheaterSettings"
import AudiList from "@/pages/theater-admin/audi/AudiList"
import AudiCreate from "@/pages/theater-admin/audi/AudiCreate"
import SlotList from "@/pages/theater-admin/slots/SlotList"
import ServiceList from "@/pages/theater-admin/services/ServiceList"
import PriceConfigList from "@/pages/theater-admin/pricing/PriceConfigList"

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
        <Route
          path="audis/:audiId"
          element={<div className="p-6">Audi Detail — coming Day 3</div>}
        />
        <Route path="slots" element={<SlotList />} />
        <Route path="services" element={<ServiceList />} />
        <Route path="pricing" element={<PriceConfigList />} />
        <Route path="bookings" element={<ComingSoon label="Bookings" />} />
        <Route path="blocks" element={<ComingSoon label="Block Manager" />} />
        <Route path="analytics" element={<ComingSoon label="Analytics" />} />
        <Route path="notifications" element={<ComingSoon label="Notifications" />} />
      </Route>
    </Routes>
  )
}
