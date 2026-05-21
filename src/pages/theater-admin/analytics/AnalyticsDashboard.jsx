import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { format } from "date-fns"
import { DollarSign, CalendarCheck, FileText, Building2, Download } from "lucide-react"
import { downloadCSV } from "@/utils/exportCsv"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import PageHeader from "@/components/common/PageHeader"
import { getAdminDashboard, getAudiAnalytics, getRevenueDaily, getRevenueMonthly } from "@/api/analytics"
import { formatINR } from "@/utils/formatCurrency"
import { toAPIDate, subDays } from "@/utils/formatDate"
import { cn } from "@/lib/utils"

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

function DatePicker({ label, value, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal", !value && "text-muted-foreground")}>
          {value ? format(value, "dd MMM yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
      </PopoverContent>
    </Popover>
  )
}


export default function AnalyticsDashboard() {
  useEffect(() => { document.title = "NFDC Admin — Analytics" }, [])

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [revenueMode, setRevenueMode] = useState("daily")
  const [revenueFrom, setRevenueFrom] = useState(subDays(new Date(), 7))
  const [revenueTo, setRevenueTo] = useState(new Date())
  const [appliedRange, setAppliedRange] = useState({ from: subDays(new Date(), 7), to: new Date() })

  const { data: dashRaw, isLoading: dashLoading } = useQuery({
    queryKey: ["analytics", "dashboard", toAPIDate(selectedDate)],
    queryFn: () => getAdminDashboard(toAPIDate(selectedDate)).then(r => r.data.data),
  })
  const dash = dashRaw?.dashboard ?? dashRaw

  const { data: audiRaw, isLoading: audiLoading } = useQuery({
    queryKey: ["analytics", "audi"],
    queryFn: () => getAudiAnalytics().then(r => r.data.data),
  })
  const audiData = Array.isArray(audiRaw) ? audiRaw : Object.values(audiRaw ?? {}).find(Array.isArray) ?? []

  const revenueQuery = revenueMode === "daily"
    ? { fn: getRevenueDaily, key: "daily" }
    : { fn: getRevenueMonthly, key: "monthly" }

  const { data: revenueRaw, isLoading: revenueLoading } = useQuery({
    queryKey: ["analytics", "revenue", revenueMode, toAPIDate(appliedRange.from), toAPIDate(appliedRange.to)],
    queryFn: () => revenueQuery.fn({
      from: toAPIDate(appliedRange.from),
      to: toAPIDate(appliedRange.to),
    }).then(r => r.data.data),
  })

  const revenueData = Array.isArray(revenueRaw)
    ? revenueRaw
    : Array.isArray(revenueRaw?.revenue) ? revenueRaw.revenue
    : Array.isArray(revenueRaw?.data) ? revenueRaw.data : []

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" />

      {/* Date Dashboard */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium text-muted-foreground">Date</span>
          <DatePicker label="Select date" value={selectedDate} onChange={setSelectedDate} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Today's Revenue" icon={DollarSign} iconBg="bg-green-100" iconColor="text-green-600"
            value={formatINR(dash?.todayRevenue ?? 0)} isLoading={dashLoading} />
          <KpiCard title="Today's Bookings" icon={CalendarCheck} iconBg="bg-blue-100" iconColor="text-blue-600"
            value={dash?.todayBookings ?? 0} isLoading={dashLoading} />
          <KpiCard title="Pending Documents" icon={FileText} iconBg="bg-amber-100" iconColor="text-amber-600"
            value={dash?.pendingDocuments ?? 0} isLoading={dashLoading} />
          <KpiCard title="Active Audis" icon={Building2} iconBg="bg-purple-100" iconColor="text-purple-600"
            value={dash?.activeAudis ?? 0} isLoading={dashLoading} />
        </div>
      </div>

      {/* Audi Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Audi Occupancy</CardTitle>
          <CardDescription>Bookings per audi</CardDescription>
        </CardHeader>
        <CardContent>
          {audiLoading ? <Skeleton className="h-[250px] w-full" /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={audiData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="audiName" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="bookings" fill="#1A6FC4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Revenue</CardTitle>
              <CardDescription>{revenueMode === "daily" ? "Daily" : "Monthly"} breakdown</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={revenueMode === "daily" ? "default" : "outline"}
                onClick={() => setRevenueMode("daily")}
              >Daily</Button>
              <Button
                size="sm"
                variant={revenueMode === "monthly" ? "default" : "outline"}
                onClick={() => setRevenueMode("monthly")}
              >Monthly</Button>
              <Button size="sm" variant="outline" onClick={() => downloadCSV(`revenue-${revenueMode}.csv`, ["Date", "Revenue"], revenueData.map(r => [r.date ?? r.month, r.revenue]))}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <DatePicker label="From" value={revenueFrom} onChange={setRevenueFrom} />
            <DatePicker label="To" value={revenueTo} onChange={setRevenueTo} />
            <Button size="sm" className="bg-nfdc-primary hover:bg-nfdc-primary/90"
              onClick={() => setAppliedRange({ from: revenueFrom, to: revenueTo })}>
              Apply
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {revenueLoading ? <Skeleton className="h-[280px] w-full" /> : (
            <ResponsiveContainer width="100%" height={280}>
              {revenueMode === "daily" ? (
                <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => "₹" + v} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip formatter={v => formatINR(v)} />
                  <Area type="monotone" dataKey="revenue" fill="#D6E8FA" stroke="#1A6FC4" strokeWidth={2} />
                </AreaChart>
              ) : (
                <BarChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => "₹" + v} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip formatter={v => formatINR(v)} />
                  <Bar dataKey="revenue" fill="#1A6FC4" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
