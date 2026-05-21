import api from "./axiosInstance"

export const login = (email, password) =>
  api.post("/admin/auth/login", { email, password })

export const logout = () =>
  api.post("/admin/auth/logout")

export const refreshToken = (token) =>
  api.post("/admin/auth/refresh", { refreshToken: token })

export const getProfile = (config) =>
  api.get("/admin/auth/me", config)
