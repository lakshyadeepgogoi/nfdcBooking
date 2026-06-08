import api from "./axiosInstance"

export const lookupUser = (userId) =>
  api.get("/users/lookup", { params: { userId } })

// User auth — password reset (public endpoints, no auth header needed)
export const userForgotPassword = (email) =>
  api.post("/auth/forgot-password", { email })

export const userResetPassword = (token, password) =>
  api.post("/auth/reset-password", { token, password })
