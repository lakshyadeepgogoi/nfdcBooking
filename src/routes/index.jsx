import { Routes, Route, Navigate } from "react-router-dom"
import AdminLogin from "@/pages/auth/AdminLogin"
import TheaterAdminRoutes from "./TheaterAdminRoutes"

function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen text-muted-foreground">
      404 | Page not found
    </div>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/admin/*" element={<TheaterAdminRoutes />} />
      <Route
        path="/super/*"
        element={
          <div className="flex items-center justify-center min-h-screen text-muted-foreground">
            Super Admin — coming Day 3
          </div>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
