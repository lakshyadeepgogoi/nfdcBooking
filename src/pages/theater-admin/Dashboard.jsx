import { useEffect } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { DollarSign, CalendarCheck, FileText, Building2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import PageHeader from "@/components/common/PageHeader"
import StatusBadge from "@/components/common/StatusBadge"
import EmptyState from "@/components/common/EmptyState"
import { getAdminDashboard, getRevenueDaily } from "@/api/analytics"
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
    queryKey: ["analytics", "revenue", "daily"],
    queryFn: () =>
      getRevenueDaily({
        from: toAPIDate(subDays(new Date(), 7)),
        to: today,
      }).then((r) => r.data.data),
  })

  const revenue = Array.isArray(revenueRaw)
    ? revenueRaw
    : Array.isArray(revenueRaw?.revenue)
      ? revenueRaw.revenue
      : Array.isArray(revenueRaw?.data)
        ? revenueRaw.data
        : []

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
          value={formatINR(dashboard?.todayRevenue ?? 0)}
          isLoading={dashLoading}
        />
        <KpiCard
          title="Today's Bookings"
          icon={CalendarCheck}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          value={dashboard?.todayBookings ?? 0}
          isLoading={dashLoading}
        />
        <KpiCard
          title="Pending Documents"
          icon={FileText}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          value={dashboard?.pendingDocuments ?? 0}
          isLoading={dashLoading}
        />
        <KpiCard
          title="Active Audis"
          icon={Building2}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          value={dashboard?.activeAudis ?? 0}
          isLoading={dashLoading}
        />
      </div>

      {/* Chart + Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue (Last 7 Days)</CardTitle>
            <CardDescription>Daily breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenue ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => "₹" + v}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                  />
                  <Tooltip formatter={(v) => formatINR(v)} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    fill="#D6E8FA"
                    stroke="#1A6FC4"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
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
                      <p className="text-sm font-medium">{booking.customerName ?? booking.user?.name}</p>
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
