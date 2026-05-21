import api from "./axiosInstance"

export const getTheaterProfile = (id) =>
  api.get(`/theaters/${id}`)

export const updateTheater = (id, data) =>
  api.patch(`/admin/theaters/${id}`, data)

export const getTnC = (id) =>
  api.get(`/theaters/${id}/tnc`)

export const updateTnCDraft = (id, data) =>
  api.patch(`/admin/theaters/${id}/tnc`, data)

export const publishTnC = (id) =>
  api.patch(`/admin/theaters/${id}/tnc/publish`)
