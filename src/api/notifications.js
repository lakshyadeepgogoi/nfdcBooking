import api from "./axiosInstance"

export const listNotifications = ({ page = 1, limit = 20, bookingId } = {}) =>
  api.get("/admin/notifications", { params: { page, limit, ...(bookingId ? { bookingId } : {}) } })
