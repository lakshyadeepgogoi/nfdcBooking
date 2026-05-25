import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import PageHeader from "@/components/common/PageHeader"
import EmptyState from "@/components/common/EmptyState"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import { listNotifications, filterByBooking } from "@/api/notifications"
import { formatDateTime } from "@/utils/formatDate"
import { parseList } from "@/utils/parseList"

const humanizeLabel = (value) =>
  String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const renderDetailValue = (value) => {
  if (value == null) return "—"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderDetailValue(item)).join(", ")
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${humanizeLabel(key)}: ${renderDetailValue(nestedValue)}`)
      .join(", ")
  }
  return String(value)
}

export default function Notifications() {
  useEffect(() => { document.title = "NFDC Admin — Notifications" }, [])

  const queryClient = useQueryClient()
  const [bookingIdFilter, setBookingIdFilter] = useState("")
  const [appliedFilter, setAppliedFilter] = useState("")

  const { data: raw, isLoading } = useQuery({
    queryKey: ["notifications", appliedFilter],
    queryFn: () => appliedFilter
      ? filterByBooking(appliedFilter).then(r => r.data.data)
      : listNotifications().then(r => r.data.data),
  })

  const notifications = parseList(raw)

  const handleFilter = () => {
    setAppliedFilter(bookingIdFilter)
    queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  const handleClear = () => {
    setBookingIdFilter("")
    setAppliedFilter("")
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" />

      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter by Booking ID..."
          value={bookingIdFilter}
          onChange={e => setBookingIdFilter(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleFilter()}
          className="max-w-xs"
        />
        <Button variant="outline" onClick={handleFilter}>Filter</Button>
        {(bookingIdFilter || appliedFilter) && (
          <Button variant="ghost" onClick={handleClear}>Clear</Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" message="You're all caught up." />
      ) : (
        <div className="space-y-3">
          {notifications.map((n, i) => {
            const id = n.id ?? n._id ?? i
            const bookingId = n.bookingId ?? n.booking?.id ?? n.relationships?.bookingId
            const userId = n.relationships?.userId
            const adminId = n.relationships?.adminId
            const notificationType = n.type ?? n.category ?? n.event ?? n.name ?? n.details?.type
            const details = n.details ?? n.description ?? n.body ?? n.payload ?? n.data
            const lifecycleStatus = n.lifecycle?.status
            const statusHistory = Array.isArray(n.lifecycle?.statusHistory) ? n.lifecycle.statusHistory : []
            const title = n.message ?? details?.subject ?? notificationType ?? "Notification"

            const extraFields = [
              { label: "Notification ID", value: n.notificationId ?? id },
              { label: "Record ID", value: id !== n.notificationId ? id : undefined },
              { label: "Booking ID", value: bookingId ? `#${String(bookingId).slice(-8)}` : undefined },
              { label: "User ID", value: userId },
              { label: "Admin ID", value: adminId },
              { label: "Status", value: lifecycleStatus ?? n.status },
              { label: "Archived", value: typeof n.isArchived === "boolean" ? (n.isArchived ? "Yes" : "No") : undefined },
            ].filter((item) => item.value !== undefined && item.value !== null && item.value !== "")

            const detailRows =
              details && typeof details === "object" && !Array.isArray(details)
                ? Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== "")
                : []

            return (
              <Card key={id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-nfdc-pale flex items-center justify-center shrink-0">
                      <Bell className="h-4 w-4 text-nfdc-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {n.createdAt ? formatDateTime(n.createdAt) : ""}
                      </p>
                    </div>
                  </div>

                  {extraFields.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
                      {extraFields.map((field) => (
                        <div key={field.label} className="rounded-md bg-slate-50 p-2">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                            {field.label}
                          </p>
                          <p className="mt-1 text-sm text-slate-800 break-all">{field.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {bookingId && (
                    <div>
                      <Link to={`/admin/bookings/${bookingId}`} className="inline-flex items-center gap-2 text-sm text-nfdc-accent hover:underline">
                        <Badge variant="outline" className="text-xs">#{String(bookingId).slice(-8)}</Badge>
                        View booking details
                      </Link>
                    </div>
                  )}

                  {details && (
                    <div className="rounded-md bg-slate-950/5 border border-slate-200 p-3 text-sm text-slate-800">
                      <strong className="block text-xs uppercase tracking-[0.2em] text-slate-500">Details</strong>
                      {typeof details === "string" ? (
                        <p className="mt-2 text-sm text-slate-800">{details}</p>
                      ) : detailRows.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2 mt-2">
                          {detailRows.map(([key, value]) => (
                            <div key={key} className="rounded-md bg-white p-2 border border-slate-200">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                {humanizeLabel(key)}
                              </p>
                              <p className="mt-1 text-sm text-slate-800 break-all">
                                {renderDetailValue(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-800">{renderDetailValue(details)}</p>
                      )}
                    </div>
                  )}

                  {statusHistory.length > 0 && (
                    <div className="rounded-md bg-slate-950/5 border border-slate-200 p-3 text-sm text-slate-800">
                      <strong className="block text-xs uppercase tracking-[0.2em] text-slate-500">Lifecycle History</strong>
                      <div className="mt-2 space-y-2">
                        {statusHistory.map((item) => (
                          <div key={item._id ?? item.timestamp} className="rounded-md bg-white p-2 border border-slate-200">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{humanizeLabel(item.status)}</p>
                            <p className="mt-1 text-sm text-slate-800">{item.timestamp ? formatDateTime(item.timestamp) : "—"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
