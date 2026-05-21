import api from "./axiosInstance"

export const login = (email, password) =>
  api.post("/admin/auth/login", { email, password })

export const logout = (refreshToken) =>
  api.post("/admin/auth/logout", { refreshToken })

export const getProfile = (config) =>
  api.get("/admin/auth/me", config)
