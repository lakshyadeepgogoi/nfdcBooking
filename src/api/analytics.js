import api from "./axiosInstance"

export const getAdminDashboard = (date) =>
  api.get("/admin/analytics/dashboard", { params: { date } })

export const getAudiAnalytics = (date) =>
  api.get("/admin/analytics/audis", { params: { date } })

export const getRevenueAnalytics = ({ period, from, to }) =>
  api.get("/admin/analytics/revenue", { params: { period, start: from, end: to } })

// Triggers backend aggregation for a specific date (queued via BullMQ)
export const triggerAnalyticsSync = (date) =>
  api.post("/admin/analytics/sync", { date })
