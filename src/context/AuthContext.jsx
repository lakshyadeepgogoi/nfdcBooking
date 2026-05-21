import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { login as apiLogin, logout as apiLogout, getProfile } from "@/api/auth"
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "@/api/tokenManager"

const AuthContext = createContext(null)

/**
 * Normalise the admin object regardless of which endpoint returned it.
 *
 * Login response  → { adminId, name, email, role, theaterId }
 * /me   response  → { adminId, name, email,
 *                     profile: { role, … },
 *                     relationships: { theaterId } }
 */
function normaliseProfile(raw) {
  return {
    ...raw,
    role:      raw.role      ?? raw.profile?.role,
    theaterId: raw.theaterId ?? raw.relationships?.theaterId ?? null,
  }
}

export function AuthProvider({ children }) {
  const [user,            setUser]            = useState(null)
  const [role,            setRole]            = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading,       setIsLoading]       = useState(true)

  const applyProfile = useCallback((raw) => {
    const profile = normaliseProfile(raw)
    setUser(profile)
    setRole(profile.role)
    setIsAuthenticated(true)
  }, [])

  const clearSession = useCallback(() => {
    setUser(null)
    setRole(null)
    setIsAuthenticated(false)
  }, [])
  useEffect(() => {
    const restore = async () => {
      const accessToken = getAccessToken()

      if (!accessToken) {
        // Nothing in storage — definitely not logged in
        setIsLoading(false)
        return
      }

      try {
        const res     = await getProfile({ _silent: true })
        const payload = res.data?.data ?? res.data
        const raw     = payload?.admin ?? payload?.user ?? payload
        applyProfile(raw)
      } catch (err) {
        if (err?.response?.status === 401) {
          clearTokens()
          clearSession()
        } else {
          // Network error / server error — tokens may still be valid.
          // Clear React state but keep the access token in localStorage so
          // a future page load can retry.
          clearSession()
        }
      } finally {
        setIsLoading(false)
      }
    }

    restore()
  }, [applyProfile, clearSession])

  // ── Login ──────────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    try {
      const res     = await apiLogin(email, password)
      const payload = res.data?.data ?? res.data

      const { accessToken, refreshToken } = payload.tokens ?? payload
      const userData = payload.admin ?? payload.user
      setTokens(accessToken, refreshToken)
      applyProfile(userData)

      return { success: true, role: normaliseProfile(userData).role }
    } catch (err) {
      const message =
        err.isAxiosError && !err.response
          ? "Cannot connect to server. Check your connection and try again."
          : err.response?.data?.message || "Login failed. Please try again."
      return { success: false, error: message }
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────────
  const logout = async () => {
    try { await apiLogout(getRefreshToken()) } catch { /* best-effort */ }
    clearTokens()   
    clearSession()
  }

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
