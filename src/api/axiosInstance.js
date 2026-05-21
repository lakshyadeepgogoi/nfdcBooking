import axios from "axios"
import { toast } from "sonner"
import { getAccessToken, clearTokens, refreshAccessToken } from "./tokenManager"

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL })

// Attach current access token to every request
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 — try to refresh once, then give up
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config

    if (!error.response) {
      if (!config._silent) toast.error("Network error. Check your connection.")
      return Promise.reject(error)
    }

    if (error.response.status === 401 && !config._retry) {
      config._retry = true
      try {
        const newToken = await refreshAccessToken()
        config.headers.Authorization = `Bearer ${newToken}`
        return api(config)
      } catch {
        // Refresh token is also expired — force logout
        clearTokens()
        window.location.href = "/login"
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api
