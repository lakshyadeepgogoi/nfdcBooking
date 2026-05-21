import { createContext, useContext, useState, useEffect } from "react"
import { login as apiLogin, logout as apiLogout, getProfile } from "@/api/auth"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (!token) {
      setIsLoading(false)
      return
    }

    getProfile({ _silent: true })
      .then((res) => {
        const payload = res.data?.data ?? res.data
        const profile = payload?.user ?? payload?.admin ?? payload
        setUser(profile)
        setRole(profile.role)
        setIsAuthenticated(true)
      })
      .catch(() => {
        setUser(null)
        setRole(null)
        setIsAuthenticated(false)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = async (email, password) => {
    try {
      const res = await apiLogin(email, password)
      const payload = res.data?.data ?? res.data
      const { accessToken, refreshToken } = payload.tokens ?? payload
      const userData = payload.admin ?? payload.user
      localStorage.setItem("accessToken", accessToken)
      localStorage.setItem("refreshToken", refreshToken)
      setUser(userData)
      setRole(userData.role)
      setIsAuthenticated(true)
      return { success: true, role: userData.role }
    } catch (err) {
      const message =
        err.isAxiosError && !err.response
          ? "Cannot connect to server. Check your connection and try again."
          : err.response?.data?.message || "Login failed. Please try again."
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await apiLogout()
    } catch {
      // ignore errors on logout
    }
    localStorage.clear()
    setUser(null)
    setRole(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
