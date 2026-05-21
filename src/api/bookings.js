import api from "./axiosInstance"

export const listBookings = (params) =>
  api.get("/admin/bookings", { params })

export const getBooking = (id) =>
  api.get(`/admin/bookings/${id}`)

export const manualBookingOffline = (data) =>
  api.post("/admin/bookings", { ...data, paymentMode: "offline" })

export const manualBookingWaived = (data) =>
  api.post("/admin/bookings", { ...data, paymentMode: "waived" })

export const updateBookingStatus = (id, data) =>
  api.patch(`/admin/bookings/${id}/status`, data)

export const markDocsSubmitted = (id) =>
  api.patch(`/admin/bookings/${id}/documents`, { action: "submitted" })

export const markDocsVerified = (id) =>
  api.patch(`/admin/bookings/${id}/documents`, { action: "verified" })

export const addOvertimeCharge = (id, data) =>
  api.patch(`/admin/bookings/${id}/add-overtime`, data)

export const extendDeadline = (id, data) =>
  api.patch(`/admin/bookings/${id}/extend-deadline`, data)

export const refundDeposit = (id) =>
  api.patch(`/admin/bookings/${id}/refund-deposit`)
