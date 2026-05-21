import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_MAP = {
  confirmed: {
    variant: "default",
    className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100",
  },
  active: {
    variant: "default",
    className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100",
  },
  verified: {
    variant: "default",
    className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100",
  },
  pending: {
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  processing: {
    variant: "secondary",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  cancelled: { variant: "destructive", className: "" },
  inactive: { variant: "destructive", className: "" },
  rejected: { variant: "destructive", className: "" },
  completed: {
    variant: "outline",
    className: "text-blue-700 border-blue-300",
  },
  waived: {
    variant: "outline",
    className: "text-purple-700 border-purple-300",
  },
}

export default function StatusBadge({ status }) {
  const config = STATUS_MAP[status?.toLowerCase()] ?? { variant: "secondary", className: "" }

  return (
    <Badge variant={config.variant} className={cn("capitalize", config.className)}>
      {status}
    </Badge>
  )
}
