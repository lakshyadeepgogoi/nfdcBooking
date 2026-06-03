import api from "./axiosInstance"



// Admin endpoint — no status filter, returns full theater including config
export const getAdminTheaterProfile = (id) =>
  api.get(`/admin/theaters/${id}`)

// Theater-admin general info update (name + details)
export const updateTheaterInfo = (id, data) =>
  api.patch(`/admin/theaters/${id}`, data)

// Theater-admin image upload — same Joi-safe pattern as super-admin
export const uploadTheaterImages = (id, keepUrls = [], newFiles = []) => {
  if (newFiles.length === 0) {
    return api.patch(`/admin/theaters/${id}`, { details: { images: keepUrls } })
  }
  const form = new FormData()
  form.append("details", JSON.stringify({ images: keepUrls }))
  newFiles.forEach(file => form.append("images", file))
  return api.patch(`/admin/theaters/${id}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
}

export const updateTnCDraft = (id, data) =>
  api.patch(`/admin/theaters/${id}/tnc`, data)

export const publishTnC = (id) =>
  api.patch(`/admin/theaters/${id}/tnc/publish`)
