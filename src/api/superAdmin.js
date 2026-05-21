import api from "./axiosInstance"

export const getPlatformDashboard = () =>
  api.get("/super/analytics/dashboard")

export const getPlatformRevenue = (params) =>
  api.get("/super/analytics/revenue", { params })

export const getTheaterComparison = () =>
  api.get("/super/analytics/theaters")

export const getSuperAudiAnalytics = (params) =>
  api.get("/super/analytics/audis", { params })

export const listAllTheaters = (params) =>
  api.get("/theaters", { params })

export const getTheaterDetail = (id) =>
  api.get(`/theaters/${id}`)

export const createTheater = (data) =>
  api.post("/super/theaters", data)

export const updateTheaterStatus = (id, status) =>
  api.patch(`/super/theaters/${id}/status`, { status })

export const listAdmins = (theaterId) =>
  api.get("/super/admins", { params: theaterId ? { theaterId } : undefined })

export const createAdmin = (data) =>
  api.post("/super/admins", data)

export const updateAdmin = (id, data) =>
  api.patch(`/super/admins/${id}`, data)

export const deactivateAdmin = (id) =>
  api.patch(`/super/admins/${id}`, { status: "inactive" })

export const reassignAdmin = (id, theaterId) =>
  api.patch(`/super/admins/${id}`, { theaterId })

export const getCrossTheaterBookings = (params) =>
  api.get("/super/bookings", { params })

export const getActivityLogs = (params) =>
  api.get("/super/activity-logs", { params })
