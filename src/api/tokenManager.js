import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_BASE_URL

/**
 * Token storage strategy
 *
 * Access token  → localStorage   (short-lived: 30 min, survives page refresh)
 * Refresh token → memory only    (long-lived: 30 days, never written to any
 *                                  browser storage — invisible to XSS attacks)
 *
 * Consequence: if the access token has expired AND the user hard-refreshes
 * the tab (clearing memory), they must re-login. This is the correct security
 * behaviour for an admin panel.
 */

// ─── In-memory refresh token ──────────────────────────────────────────────────
let _refreshToken = null

// ─── Access token (localStorage) ─────────────────────────────────────────────
export const getAccessToken  = () => localStorage.getItem("accessToken")
export const getRefreshToken = () => _refreshToken

export function setTokens(accessToken, refreshToken) {
  localStorage.setItem("accessToken", accessToken)
  if (refreshToken) _refreshToken = refreshToken   // memory only — never stored
}

export function clearTokens() {
  localStorage.removeItem("accessToken")
  _refreshToken = null
}

// ─── Refresh singleton ────────────────────────────────────────────────────────
// One in-flight refresh at a time. Concurrent 401s queue on the same promise
// instead of racing and invalidating each other's tokens.

let _refreshPromise = null

export async function refreshAccessToken() {
  if (_refreshPromise) return _refreshPromise

  const token = getRefreshToken()
  if (!token) return Promise.reject(new Error("No refresh token in memory"))

  // Plain axios (not the intercepted `api` instance) to avoid infinite loops.
  // Normalise base URL to always have a trailing slash before appending path.
  const url = BASE_URL.replace(/\/?$/, "/") + "admin/auth/refresh"

  _refreshPromise = axios
    .post(url, { refreshToken: token })
    .then(({ data }) => {
      const payload    = data?.data ?? data
      const newAccess  = payload?.accessToken
      const newRefresh = payload?.refreshToken

      if (!newAccess) throw new Error("Refresh response missing access token")

      // Store new access token; update in-memory refresh token (rotation)
      setTokens(newAccess, newRefresh ?? token)
      return newAccess
    })
    .finally(() => {
      _refreshPromise = null
    })

  return _refreshPromise
}
