import api from "./axiosInstance"

export const listNotifications = () =>
  api.get("/admin/notifications")

export const filterByBooking = (bookingId) =>
  api.get("/admin/notifications", { params: { bookingId } })
