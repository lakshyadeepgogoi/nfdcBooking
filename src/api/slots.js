import api from "./axiosInstance"

// Public — active only (used by fee calculator, availability, etc.)
export const listSlots = (audiId) =>
  api.get(`/audis/${audiId}/slots`)

// Admin — all slots regardless of status (active + inactive)
export const listAdminSlots = (audiId) =>
  api.get(`/admin/slots/audi/${audiId}`)

export const createSlot = (data) =>
  api.post("/admin/slots", data)

export const updateSlot = (id, data) =>
  api.patch(`/admin/slots/${id}`, data)

export const updateSlotStatus = (id, status) =>
  api.patch(`/admin/slots/${id}/status`, { status })
