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
            const bookingId = n.bookingId ?? n.booking?.id
            return (
              <Card key={id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="h-9 w-9 rounded-full bg-nfdc-pale flex items-center justify-center shrink-0">
                    <Bell className="h-4 w-4 text-nfdc-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {n.createdAt ? formatDateTime(n.createdAt) : ""}
                    </p>
                    {bookingId && (
                      <Link to={`/admin/bookings/${bookingId}`} className="mt-1 inline-block">
                        <Badge variant="outline" className="text-xs">
                          #{String(bookingId).slice(-8)}
                        </Badge>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
