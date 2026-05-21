/**
 * Safely extract a display string from a value that might be a nested object
 * (e.g. the API returns `user: {name, email}` rather than `customerName: "..."`)
 */
export function pick(...values) {
  for (const v of values) {
    if (v == null) continue
    if (typeof v === "string" && v.trim()) return v
    if (typeof v === "number") return String(v)
    if (typeof v === "object") {
      const s = v.name ?? v.label ?? v.title ?? v.email ?? v.text
      if (s && typeof s === "string") return s
    }
  }
  return "—"
}
