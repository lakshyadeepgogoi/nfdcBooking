import api from "./axiosInstance"

export const listAudis = (theaterId) =>
  api.get(`/theaters/${theaterId}/audis`)

export const getAudi = (id) =>
  api.get(`/audis/${id}`)

export const createFixedAudi = (data) =>
  api.post("/admin/audis", data)

export const createFlexibleAudi = (data) =>
  api.post("/admin/audis", data)

export const updateAudi = (id, data) =>
  api.patch(`/admin/audis/${id}`, data)

export const updateAudiStatus = (id, status) =>
  api.patch(`/admin/audis/${id}/status`, { status })
