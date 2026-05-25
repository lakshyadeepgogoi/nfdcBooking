import { format, subDays } from "date-fns"

const toDate = (d) => { const dt = new Date(d); return isNaN(dt.getTime()) ? null : dt }
export const formatDate     = (d) => { const dt = toDate(d); return dt ? format(dt, "dd MMM yyyy")          : "—" }
export const formatDateTime = (d) => { const dt = toDate(d); return dt ? format(dt, "dd MMM yyyy, hh:mm a") : "—" }
export const formatTime     = (d) => { const dt = toDate(d); return dt ? format(dt, "hh:mm a")              : "—" }
export const toAPIDate      = (d) => { const dt = toDate(d); return dt ? format(dt, "yyyy-MM-dd")           : "" }
export { subDays }
