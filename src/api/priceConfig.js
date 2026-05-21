import api from "./axiosInstance"

export const listPriceConfigs = (params) =>
  api.get("/admin/price-config", { params })

export const createPriceConfig = (data) =>
  api.post("/admin/price-config", data)

export const updatePriceConfig = (id, data) =>
  api.patch(`/admin/price-config/${id}`, data)

export const updatePriceConfigStatus = (id, status) =>
  api.patch(`/admin/price-config/${id}/status`, { status })
