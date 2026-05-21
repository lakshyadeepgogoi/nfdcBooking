import axios from "axios"
import { toast } from "sonner"

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config

    if (!error.response) {
      if (!originalConfig._silent) {
        toast.error("Network error. Check your connection.")
      }
      return Promise.reject(error)
    }

    if (error.response.status === 401 && !originalConfig._retry) {
      originalConfig._retry = true
      try {
        const refreshToken = localStorage.getItem("refreshToken")
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}admin/auth/refresh`,
          { refreshToken }
        )
        const newToken = data.data.tokens?.accessToken ?? data.data.accessToken
        localStorage.setItem("accessToken", newToken)
        originalConfig.headers.Authorization = `Bearer ${newToken}`
        return api(originalConfig)
      } catch {
        localStorage.clear()
        window.location.href = "/login"
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api
