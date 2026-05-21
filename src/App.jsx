import { BrowserRouter } from "react-router-dom"
import AppRoutes from "@/routes/index"

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
