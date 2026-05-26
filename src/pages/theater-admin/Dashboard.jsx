import { useEffect } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { pick } from "@/utils/pick"
import { DollarSign, CalendarCheck, FileText, TrendingUp, Clock, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import PageHeader from "@/components/common/PageHeader"
import StatusBadge from "@/components/common/StatusBadge"
import EmptyState from "@/components/common/EmptyState"
import { getAdminDashboard, getRevenueAnalytics } from "@/api/analytics"
import { formatINR } from "@/utils/formatCurrency"
import { toAPIDate, subDays } from "@/utils/formatDate"

function KpiCard({ title, icon: Icon, iconBg, iconColor, value, isLoading }) {
  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-full ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  useEffect(() => {
    document.title = "NFDC Admin — Dashboard"
  }, [])

  const today = toAPIDate(new Date())

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["analytics", "dashboard", today],
    queryFn: () => getAdminDashboard(today).then((r) => r.data.data),
  })

  const { data: revenueRaw, isLoading: revenueLoading } = useQuery({
    queryKey: ["analytics", "revenue", "daily", toAPIDate(subDays(new Date(), 7)), today],
    queryFn: () =>
      getRevenueAnalytics({
        period: "daily",
        from: toAPIDate(subDays(new Date(), 7)),
        to: today,
      }).then((r) => r.data.data),
  })

  const rev = revenueRaw?.stats ?? {}
  const dash = dashboard?.stats ?? {}
  const recentBookings = dashboard?.recentBookings ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Today's overview" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Today's Revenue"
          icon={DollarSign}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          value={formatINR(dash.totalRevenue ?? 0)}
          isLoading={dashLoading}
        />
        <KpiCard
          title="Confirmed Bookings"
          icon={CalendarCheck}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          value={dash.confirmedBookings ?? 0}
          isLoading={dashLoading}
        />
        <KpiCard
          title="Pending Bookings"
          icon={FileText}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          value={dash.pendingBookings ?? 0}
          isLoading={dashLoading}
        />
        <KpiCard
          title="Cancelled"
          icon={XCircle}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          value={dash.cancelledBookings ?? 0}
          isLoading={dashLoading}
        />
      </div>

      {/* Chart + Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Summary (last 7 days) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue (Last 7 Days)</CardTitle>
            <CardDescription>Aggregate breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-green-50"><DollarSign className="h-4 w-4 text-green-600" /></div>
                    <span className="text-sm text-muted-foreground">Total Revenue</span>
                  </div>
                  <span className="font-semibold">{formatINR(rev.totalRevenue ?? 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground pl-8">Govt Revenue</span>
                  <span className="text-sm font-medium">{formatINR(rev.govtRevenue ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground pl-8">Non-Govt Revenue</span>
                  <span className="text-sm font-medium">{formatINR(rev.nonGovtRevenue ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground pl-8">Refunds</span>
                  <span className="text-sm font-medium text-red-600">−{formatINR(rev.refundAmount ?? 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center py-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50"><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
                    <span className="text-sm font-medium">Net Revenue</span>
                  </div>
                  <span className="font-bold text-emerald-600">{formatINR(rev.netRevenue ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-50"><Clock className="h-4 w-4 text-purple-600" /></div>
                    <span className="text-sm text-muted-foreground">Hours Booked</span>
                  </div>
                  <span className="font-semibold">{rev.totalHoursBooked ?? 0}h</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Bookings</CardTitle>
            <Link
              to="/admin/bookings"
              className="text-sm text-nfdc-accent hover:underline"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {dashLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentBookings.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No bookings today"
                message="Recent bookings will appear here."
              />
            ) : (
              <div>
                {recentBookings.map((booking) => (
                  <div
                    key={booking.id ?? booking._id}
                    className="flex justify-between items-center py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        #{booking.id ?? booking._id}
                      </p>
                      <p className="text-sm font-medium">{pick(booking.customerName, booking.user?.name, booking.user)}</p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
