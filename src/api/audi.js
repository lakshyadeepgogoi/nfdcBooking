import api from "./axiosInstance"

export const listAudis = (theaterId) =>
  api.get(`/theaters/${theaterId}/audis`)

export const getAudi = (id) =>
  api.get(`/audis/${id}`)

export const createAudi = (data) =>
  api.post("/admin/audis", data)

export const updateAudi = (id, data) =>
  api.patch(`/admin/audis/${id}`, data)

export const updateAudiStatus = (id, status) =>
  api.patch(`/admin/audis/${id}/status`, { status })

/**
 * Upload / update audi images.
 * `images` IS a top-level key in updateAudiSchema, so existing URLs survive Joi.
 * For new file uploads we also include config:"{}" so the body always has ≥1 key.
 */
export const uploadAudiImages = (id, keepUrls = [], newFiles = []) => {
  if (newFiles.length === 0) {
    return api.patch(`/admin/audis/${id}`, { images: keepUrls })
  }
  const form = new FormData()
  keepUrls.forEach(url => form.append("images", url))
  newFiles.forEach(file => form.append("images", file))
  form.append("config", "{}")   // guarantees ≥1 body key for Joi .min(1)
  return api.patch(`/admin/audis/${id}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
}
