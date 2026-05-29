import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_MAP = {
  // ── booking / entity lifecycle ────────────────────────────────────────────────
  confirmed:  { variant: "default",      className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" },
  active:     { variant: "default",      className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" },
  verified:   { variant: "default",      className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" },
  accepted:   { variant: "default",      className: "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100" },
  pending:    { variant: "secondary",    className: "bg-amber-100 text-amber-800 border-amber-200" },
  processing: { variant: "secondary",    className: "bg-amber-100 text-amber-800 border-amber-200" },
  cancelled:  { variant: "destructive",  className: "" },
  inactive:   { variant: "destructive",  className: "" },
  rejected:   { variant: "destructive",  className: "" },
  completed:  { variant: "outline",      className: "text-blue-700 border-blue-300" },
  waived:     { variant: "outline",      className: "text-purple-700 border-purple-300" },
  superseded: { variant: "secondary",    className: "text-slate-500" },

  // ── reschedule statuses ───────────────────────────────────────────────────────
  reschedule_requested: {
    variant:   "secondary",
    className: "bg-orange-100 text-orange-800 border-orange-200",
    label:     "Reschedule Requested",
  },
  awaiting_reschedule_payment: {
    variant:   "secondary",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    label:     "Awaiting Payment",
  },
  postponed: {
    variant:   "outline",
    className: "text-indigo-700 border-indigo-300",
  },
  preponed: {
    variant:   "outline",
    className: "text-indigo-700 border-indigo-300",
  },
}

function humanize(s) {
  return s?.replace(/_/g, " ") ?? ""
}

export default function StatusBadge({ status }) {
  const key    = status?.toLowerCase()
  const config = STATUS_MAP[key] ?? { variant: "secondary", className: "" }
  const label  = config.label ?? humanize(status)

  return (
    <Badge variant={config.variant} className={cn("capitalize text-xs", config.className)}>
      {label}
    </Badge>
  )
}
