export function parseList(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    const arr = Object.values(data).find(Array.isArray)
    if (arr) return arr
  }
  return []
}
