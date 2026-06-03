import { format, subDays } from "date-fns"

const toDate = (d) => { const dt = new Date(d); return isNaN(dt.getTime()) ? null : dt }
export const formatDate     = (d) => { const dt = toDate(d); return dt ? format(dt, "dd MMM yyyy")          : "—" }
export const formatDateTime = (d) => { const dt = toDate(d); return dt ? format(dt, "dd MMM yyyy, hh:mm a") : "—" }
export const formatTime     = (d) => { const dt = toDate(d); return dt ? format(dt, "hh:mm a")              : "—" }
export const toAPIDate      = (d) => { const dt = toDate(d); return dt ? format(dt, "yyyy-MM-dd")           : "" }

/** Convert "HH:MM" 24-hr string → "H:MM AM/PM"  e.g. "13:30" → "1:30 PM" */
export const fmt12 = (t) => {
  if (!t) return "—"
  const [hh, mm] = t.split(":").map(Number)
  if (isNaN(hh) || isNaN(mm)) return t
  const period = hh < 12 ? "AM" : "PM"
  const h = hh % 12 || 12
  return `${h}:${String(mm).padStart(2, "0")} ${period}`
}

/** Range of two "HH:MM" strings → "H:MM AM – H:MM PM" */
export const fmt12Range = (s, e) => {
  if (!s && !e) return "—"
  return `${fmt12(s)} – ${fmt12(e)}`
}

export { subDays }
