import api from "./axiosInstance"

export const getAudiCalendar = (audiId, month) =>
  api.get(`/audis/${audiId}/calendar`, { params: { month } })

export const getAdminAvailabilityCalendar = (audiId, month) =>
  api.get(`/admin/availability/${audiId}`, { params: { month } })
