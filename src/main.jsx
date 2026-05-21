import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { AuthProvider } from "@/context/AuthContext"
import App from "./App.jsx"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = error?.response?.status
        if (status >= 400 && status < 500) return false
        return failureCount < 2
      },
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
)
