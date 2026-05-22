import api from "./axiosInstance"

// ── Services ──────────────────────────────────────────────────────────────────
// GET /services returns { sections:[...], ungrouped:{...} }
// Pass audiId OR theaterId; omit status to get all (active + inactive) for admin.

export const listServicesGrouped = (params) =>
  api.get("/services", { params })

export const createService = (data) =>
  api.post("/admin/services", data)

export const updateService = (id, data) =>
  api.patch(`/admin/services/${id}`, data)

export const moveService = (id, sectionId) =>
  api.patch(`/admin/services/${id}/move-section`, { sectionId })

export const updateServiceStatus = (id, status) =>
  api.patch(`/admin/services/${id}/status`, { status })

// ── Service Sections ──────────────────────────────────────────────────────────

export const listSections = (params) =>
  api.get("/service-sections", { params })

export const createSection = (data) =>
  api.post("/admin/service-sections", data)

export const updateSection = (id, data) =>
  api.patch(`/admin/service-sections/${id}`, data)

export const reorderSection = (id, newOrder) =>
  api.patch(`/admin/service-sections/${id}/reorder`, { newOrder })

export const updateSectionStatus = (id, status) =>
  api.patch(`/admin/service-sections/${id}/status`, { status })
