import api from "./axiosInstance"

export const lookupUser = (userId) =>
  api.get("/users/lookup", { params: { userId } })
