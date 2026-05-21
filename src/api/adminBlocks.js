import api from "./axiosInstance"

export const listBlocks = (audiId) =>
  api.get("/admin/audi-blocks", { params: { audiId } })

export const createFullDayBlock = (data) =>
  api.post("/admin/audi-blocks", { ...data, isFullDay: true })

export const createPartialBlock = (data) =>
  api.post("/admin/audi-blocks", { ...data, isFullDay: false })

export const deactivateBlock = (id) =>
  api.patch(`/admin/audi-blocks/${id}/deactivate`)
