import { Routes, Route, Navigate } from "react-router-dom"
import AdminLogin from "@/pages/auth/AdminLogin"
import NotFound from "@/pages/NotFound"
import TheaterAdminRoutes from "./TheaterAdminRoutes"
import SuperAdminRoutes from "./SuperAdminRoutes"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import { useAuth } from "@/hooks/useAuth"

function RootRedirect() {
  const { isAuthenticated, role, isLoading } = useAuth()
  if (isLoading) return <LoadingSpinner fullPage />
  if (isAuthenticated) {
    if (role === "theater-admin") return <Navigate to="/admin/dashboard" replace />
    if (role === "super-admin") return <Navigate to="/super/dashboard" replace />
  }
  return <Navigate to="/login" replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/admin/*" element={<TheaterAdminRoutes />} />
      <Route path="/super/*" element={<SuperAdminRoutes />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
