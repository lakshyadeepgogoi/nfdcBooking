import api from "./axiosInstance"

export const listSlots = (audiId) =>
  api.get(`/audis/${audiId}/slots`)

export const createSlot = (data) =>
  api.post("/admin/slots", data)

export const updateSlot = (id, data) =>
  api.patch(`/admin/slots/${id}`, data)

export const updateSlotStatus = (id, status) =>
  api.patch(`/admin/slots/${id}/status`, { status })
