import api from "./axiosInstance"

export const listServicesGrouped = (audiId) =>
  api.get("/services", { params: { audiId } })

export const createService = (data) =>
  api.post("/admin/services", data)

export const updateService = (id, data) =>
  api.patch(`/admin/services/${id}`, data)

export const moveService = (id, sectionId) =>
  api.patch(`/admin/services/${id}/move-section`, { sectionId })

export const updateServiceStatus = (id, status) =>
  api.patch(`/admin/services/${id}/status`, { status })

export const listSections = (audiId) =>
  api.get("/service-sections", { params: { audiId } })

export const createSection = (data) =>
  api.post("/admin/service-sections", data)

export const updateSection = (id, data) =>
  api.patch(`/admin/service-sections/${id}`, data)

export const reorderSections = (id, newOrder) =>
  api.patch(`/admin/service-sections/${id}/reorder`, { newOrder })

export const updateSectionStatus = (id, status) =>
  api.patch(`/admin/service-sections/${id}/status`, { status })
