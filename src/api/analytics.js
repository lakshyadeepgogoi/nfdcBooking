import api from "./axiosInstance"

export const getAdminDashboard = (date) =>
  api.get("/admin/analytics/dashboard", { params: { date } })

export const getAudiAnalytics = (date) =>
  api.get("/admin/analytics/audis", { params: { date } })

export const getRevenueDaily = ({ from, to }) =>
  api.get("/admin/analytics/revenue", { params: { period: "daily", start: from, end: to } })

export const getRevenueMonthly = ({ from, to }) =>
  api.get("/admin/analytics/revenue", { params: { period: "monthly", start: from, end: to } })
