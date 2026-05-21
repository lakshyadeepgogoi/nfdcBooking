import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { DollarSign, CalendarCheck, Building2, Users, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import PageHeader from "@/components/common/PageHeader"
import { getPlatformDashboard, getPlatformRevenue } from "@/api/superAdmin"
import { formatINR } from "@/utils/formatCurrency"
import { parseList } from "@/utils/parseList"

function KpiCard({ title, icon: Icon, iconBg, iconColor, value, isLoading }) {
  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-full ${iconBg}`}><Icon className={`h-4 w-4 ${iconColor}`} /></div>
      </CardHeader>
      <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
    </Card>
  )
}

export default function PlatformDashboard() {
  useEffect(() => { document.title = "NFDC Admin — Platform Dashboard" }, [])
  const navigate = useNavigate()

  const { data: dashRaw, isLoading: dashLoading } = useQuery({
    queryKey: ["super", "dashboard"],
    queryFn: () => getPlatformDashboard().then(r => r.data.data),
  })

  const { data: revenueRaw, isLoading: revenueLoading } = useQuery({
    queryKey: ["super", "revenue", "monthly"],
    queryFn: () => getPlatformRevenue({ period: "monthly" }).then(r => r.data.data),
  })

  const dash = dashRaw?.dashboard ?? dashRaw
  const revenue = Array.isArray(revenueRaw) ? revenueRaw
    : Array.isArray(revenueRaw?.revenue) ? revenueRaw.revenue
    : Array.isArray(revenueRaw?.data) ? revenueRaw.data : []

  const quickLinks = [
    { label: "Manage Theaters", icon: Building2, path: "/super/theaters" },
    { label: "Manage Admins", icon: Users, path: "/super/admins" },
    { label: "View All Bookings", icon: CalendarCheck, path: "/super/bookings" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Dashboard" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Revenue" icon={DollarSign} iconBg="bg-green-100" iconColor="text-green-600"
          value={formatINR(dash?.totalRevenue ?? 0)} isLoading={dashLoading} />
        <KpiCard title="Total Bookings" icon={CalendarCheck} iconBg="bg-blue-100" iconColor="text-blue-600"
          value={dash?.totalBookings ?? 0} isLoading={dashLoading} />
        <KpiCard title="Total Theaters" icon={Building2} iconBg="bg-purple-100" iconColor="text-purple-600"
          value={dash?.totalTheaters ?? 0} isLoading={dashLoading} />
        <KpiCard title="Active Admins" icon={Users} iconBg="bg-amber-100" iconColor="text-amber-600"
          value={dash?.activeAdmins ?? 0} isLoading={dashLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform Revenue</CardTitle>
          <CardDescription>Monthly breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueLoading ? <Skeleton className="h-[280px] w-full" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={v => "₹" + v} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={70} />
                <Tooltip formatter={v => formatINR(v)} />
                <Area type="monotone" dataKey="revenue" fill="#D6E8FA" stroke="#1A6FC4" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {quickLinks.map(({ label, icon: Icon, path }) => (
          <Card
            key={path}
            className="hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => navigate(path)}
          >
            <CardContent className="flex flex-col items-center justify-center py-6 gap-3">
              <Icon className="h-8 w-8 text-nfdc-accent" />
              <div className="flex items-center gap-1 text-sm font-medium">
                {label}
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
