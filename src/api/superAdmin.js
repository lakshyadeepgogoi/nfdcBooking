import api from "./axiosInstance"

export const getPlatformDashboard = (date) =>
  api.get("/super/analytics/dashboard", { params: { date } })

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

export const updateSuperTheater = (id, data) =>
  api.patch(`/super/theaters/${id}`, data)

/**
 * Upload / update theater images.
 * keepUrls — existing image URLs to preserve in the final array
 * newFiles — File objects to upload
 *
 * Why details JSON instead of bare `images` text fields:
 *   The backend validate middleware uses stripUnknown:true. `images` is not
 *   a key in updateTheaterSchema, so bare `images` text fields get stripped
 *   before the controller runs. Embedding keepUrls inside `details.images`
 *   (a known schema key) survives Joi and lets the controller append new URLs.
 */
export const updateTheaterImages = (id, keepUrls = [], newFiles = []) => {
  if (newFiles.length === 0) {
    return api.patch(`/super/theaters/${id}`, { details: { images: keepUrls } })
  }
  const form = new FormData()
  // Existing URLs go inside details.images JSON — survives Joi stripUnknown
  form.append("details", JSON.stringify({ images: keepUrls }))
  // New files go as multipart file fields
  newFiles.forEach(file => form.append("images", file))
  return api.patch(`/super/theaters/${id}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
}

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
