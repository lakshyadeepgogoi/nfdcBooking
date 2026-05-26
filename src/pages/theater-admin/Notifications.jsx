import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import {
  Bell, CheckCircle2, XCircle, Clock, ChevronsLeft, ChevronsRight,
  Mail, User, ShieldCheck, ChevronDown, ChevronUp, Search, X,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import PageHeader from "@/components/common/PageHeader"
import EmptyState from "@/components/common/EmptyState"
import { listNotifications } from "@/api/notifications"

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE = {
  confirmation: { label: "Confirmation", icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50",  badge: "bg-green-100 text-green-700" },
  cancellation: { label: "Cancellation", icon: XCircle,      color: "text-red-600",    bg: "bg-red-50",    badge: "bg-red-100 text-red-700"   },
  postpone:     { label: "Postponed",    icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50",  badge: "bg-amber-100 text-amber-700" },
  prepone:      { label: "Preponed",     icon: ChevronsLeft,  color: "text-blue-600",   bg: "bg-blue-50",   badge: "bg-blue-100 text-blue-700"  },
  reminder:     { label: "Reminder",     icon: Bell,          color: "text-purple-600", bg: "bg-purple-50", badge: "bg-purple-100 text-purple-700" },
}

const DEFAULT_TYPE = { label: "Notification", icon: Bell, color: "text-muted-foreground", bg: "bg-muted", badge: "bg-muted text-muted-foreground" }

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  sent:   { label: "Sent",   className: "bg-green-100 text-green-700 border-green-200" },
  queued: { label: "Queued", className: "bg-amber-100 text-amber-700 border-amber-200" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700 border-red-200"       },
}

// ── Single notification card ──────────────────────────────────────────────────
function NotificationCard({ n }) {
  const [expanded, setExpanded] = useState(false)

  const type        = n.details?.type ?? ""
  const typeCfg     = TYPE[type] ?? DEFAULT_TYPE
  const TypeIcon    = typeCfg.icon
  const status      = n.lifecycle?.status ?? ""
  const statusCfg   = STATUS[status] ?? { label: status, className: "bg-muted text-muted-foreground" }
  const bookingId   = n.relationships?.bookingId
  const recipient   = n.details?.recipientType
  const subject     = n.details?.subject ?? typeCfg.label
  const email       = n.details?.recipientEmail
  const timeAgo     = n.createdAt
    ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })
    : ""

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-sm">
      <CardContent className="p-0">
        {/* Main row */}
        <div className="flex items-start gap-3 p-4">
          {/* Type icon */}
          <div className={`mt-0.5 h-9 w-9 rounded-full ${typeCfg.bg} flex items-center justify-center shrink-0`}>
            <TypeIcon className={`h-4 w-4 ${typeCfg.color}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground truncate">{subject}</span>
              {/* Type badge */}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${typeCfg.badge}`}>
                {typeCfg.label}
              </span>
              {/* Status badge */}
              <Badge variant="outline" className={`text-[11px] h-5 px-2 ${statusCfg.className}`}>
                {statusCfg.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {/* Recipient */}
              {recipient && (
                <span className="flex items-center gap-1">
                  {recipient === "admin" ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  {recipient === "admin" ? "Admin" : "User"}
                </span>
              )}
              {/* Email */}
              {email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span className="truncate max-w-[180px]">{email}</span>
                </span>
              )}
              {/* Booking link */}
              {bookingId && (
                <Link
                  to={`/admin/bookings/${bookingId}`}
                  className="flex items-center gap-1 text-nfdc-accent hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  #{String(bookingId).slice(-8)}
                </Link>
              )}
              {/* Time */}
              {timeAgo && <span>{timeAgo}</span>}
            </div>
          </div>

          {/* Expand toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <>
            <Separator />
            <div className="px-4 py-3 bg-muted/30 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <DetailCell label="Notification ID" value={n.notificationId} mono />
                <DetailCell label="Booking ID"      value={bookingId}        mono />
                <DetailCell label="Recipient Type"  value={recipient} />
                <DetailCell label="Email"           value={email} />
                <DetailCell label="Status"          value={statusCfg.label} />
                <DetailCell label="Type"            value={typeCfg.label} />
              </div>

              {/* Status history */}
              {Array.isArray(n.lifecycle?.statusHistory) && n.lifecycle.statusHistory.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Status History</p>
                  <div className="flex flex-wrap gap-2">
                    {n.lifecycle.statusHistory.map((h, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs">
                        <span className="font-medium capitalize">{h.status}</span>
                        {h.timestamp && (
                          <span className="text-muted-foreground">
                            · {formatDistanceToNow(new Date(h.timestamp), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function DetailCell({ label, value, mono }) {
  if (!value) return null
  return (
    <div className="rounded-md bg-card border border-border px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xs text-foreground break-all ${mono ? "font-mono" : "font-medium"}`}>{value}</p>
    </div>
  )
}

// ── Page skeleton ─────────────────────────────────────────────────────────────
function NotificationSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

export default function Notifications() {
  useEffect(() => { document.title = "NFDC Admin — Notifications" }, [])

  const [search, setSearch]     = useState("")
  const [applied, setApplied]   = useState("")
  const [page, setPage]         = useState(1)

  const { data: raw, isLoading } = useQuery({
    queryKey: ["notifications", applied, page],
    queryFn: () => listNotifications({ page, limit: PAGE_SIZE, bookingId: applied || undefined }).then(r => r.data.data),
    keepPreviousData: true,
  })

  const notifications = Array.isArray(raw?.data) ? raw.data : []
  const pagination    = raw?.pagination ?? {}
  const totalPages    = pagination.totalPages ?? 1

  const applySearch = () => {
    setApplied(search.trim())
    setPage(1)
  }

  const clearSearch = () => {
    setSearch("")
    setApplied("")
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" />

      {/* Search bar */}
      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter by Booking ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applySearch()}
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button size="sm" onClick={applySearch} className="h-9">Search</Button>
      </div>

      {/* Active filter tag */}
      {applied && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Showing notifications for booking</span>
          <Badge variant="secondary" className="font-mono text-xs gap-1">
            #{applied.slice(-8)}
            <button onClick={clearSearch} className="ml-1 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <NotificationSkeleton />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={applied ? "No notifications for this booking" : "No notifications yet"}
          message={applied ? "Try searching for a different booking ID." : "Notifications for your theater's bookings will appear here."}
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {notifications.map((n, i) => (
              <NotificationCard key={n.notificationId ?? n._id ?? i} n={n} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {totalPages} · {pagination.total} total
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronsRight className="h-3.5 w-3.5 rotate-180" />
                  Prev
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
