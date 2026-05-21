import { format, subDays } from "date-fns"

export const formatDate = (d) => format(new Date(d), "dd MMM yyyy")
export const formatDateTime = (d) => format(new Date(d), "dd MMM yyyy, hh:mm a")
export const formatTime = (d) => format(new Date(d), "hh:mm a")
export const toAPIDate = (d) => format(new Date(d), "yyyy-MM-dd")
export { subDays }
