import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { format } from "date-fns"
import {
  DollarSign, CalendarCheck, XCircle, Clock,
  Building2, TrendingUp, RefreshCw, FileText, Download,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import PageHeader from "@/components/common/PageHeader"
import { getAdminDashboard, getAudiAnalytics, getRevenueAnalytics } from "@/api/analytics"
import { downloadCSV } from "@/utils/exportCsv"
import { formatINR } from "@/utils/formatCurrency"
import { toAPIDate, subDays } from "@/utils/formatDate"
import { cn } from "@/lib/utils"

// ── Small inline progress bar (no shadcn Progress needed) ────────────────────
function ProgressBar({ value = 0, color = "#1A6FC4" }) {
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, icon: Icon, iconBg, iconColor, value, sub, isLoading }) {
  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{title}</CardTitle>
        <div className={`p-1.5 rounded-lg ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ── Date picker popover ───────────────────────────────────────────────────────
function DatePicker({ label, value, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start text-left font-normal h-8 text-sm", !value && "text-muted-foreground")}
        >
          {value ? format(value, "dd MMM yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
      </PopoverContent>
    </Popover>
  )
}

// ── Custom donut tooltip ──────────────────────────────────────────────────────
function DonutTooltip({ active, payload, formatter }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{name}</p>
      <p className="text-muted-foreground">{formatter ? formatter(value) : value}</p>
    </div>
  )
}

// ── Donut legend list ─────────────────────────────────────────────────────────
function DonutLegend({ items, total, totalLabel = "Total", formatter }) {
  return (
    <div className="space-y-2.5 flex-1 min-w-0">
      {items.map(d => (
        <div key={d.name} className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
          <span className="text-sm text-muted-foreground flex-1 truncate">{d.name}</span>
          <span className="text-sm font-semibold shrink-0">{formatter ? formatter(d.value) : d.value}</span>
          {total > 0 && (
            <span className="text-xs text-muted-foreground w-9 text-right shrink-0">
              {Math.round((d.value / total) * 100)}%
            </span>
          )}
        </div>
      ))}
      {total !== undefined && (
        <>
          <Separator />
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 shrink-0" />
            <span className="text-sm font-medium flex-1">{totalLabel}</span>
            <span className="text-sm font-bold shrink-0">{formatter ? formatter(total) : total}</span>
            <span className="text-xs w-9 shrink-0" />
          </div>
        </>
      )}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  useEffect(() => { document.title = "NFDC Admin — Analytics" }, [])

  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(today)

  const [revPeriod, setRevPeriod] = useState("monthly")
  const [revFrom, setRevFrom]     = useState(subDays(today, 30))
  const [revTo, setRevTo]         = useState(today)
  const [applied, setApplied]     = useState({ period: "monthly", from: subDays(today, 30), to: today })

  // ── Queries ─────────────────────────────────────────────────────────────────
  const dateStr = toAPIDate(selectedDate)

  const { data: dashRaw, isLoading: dashLoading } = useQuery({
    queryKey: ["analytics", "dashboard", dateStr],
    queryFn: () => getAdminDashboard(dateStr).then(r => r.data.data),
    enabled: !!dateStr,
  })
  const dash = dashRaw?.stats ?? {}

  const { data: audiRaw, isLoading: audiLoading } = useQuery({
    queryKey: ["analytics", "audi", dateStr],
    queryFn: () => getAudiAnalytics(dateStr).then(r => r.data.data),
    enabled: !!dateStr,
  })
  const audiList = Array.isArray(audiRaw) ? audiRaw : []

  const { data: revRaw, isLoading: revLoading } = useQuery({
    queryKey: ["analytics", "revenue", applied.period, toAPIDate(applied.from), toAPIDate(applied.to)],
    queryFn: () => getRevenueAnalytics({
      period: applied.period,
      from: toAPIDate(applied.from),
      to: toAPIDate(applied.to),
    }).then(r => r.data.data),
  })
  const rev = revRaw?.stats ?? {}

  // ── Derived chart data ───────────────────────────────────────────────────────
  const bookingStatus = [
    { name: "Confirmed", value: dash.confirmedBookings ?? 0, color: "#22c55e" },
    { name: "Pending",   value: dash.pendingBookings   ?? 0, color: "#f59e0b" },
    { name: "Cancelled", value: dash.cancelledBookings ?? 0, color: "#ef4444" },
    { name: "Postponed", value: dash.postponedBookings ?? 0, color: "#8b5cf6" },
  ].filter(d => d.value > 0)

  const audiChartData = audiList.map(a => ({
    name:      a.audiName ?? a.audiId,
    bookings:  a.stats?.confirmedBookings ?? 0,
    revenue:   a.stats?.totalRevenue      ?? 0,
    occupancy: a.stats?.occupancyRate     ?? 0,
  }))

  const revenueBreakdown = [
    { name: "Govt",     value: rev.govtRevenue    ?? 0, color: "#1A6FC4" },
    { name: "Non-Govt", value: rev.nonGovtRevenue ?? 0, color: "#06b6d4" },
    { name: "Refunds",  value: rev.refundAmount   ?? 0, color: "#ef4444" },
  ].filter(d => d.value > 0)

  const totalRevStatus = (rev.govtRevenue ?? 0) + (rev.nonGovtRevenue ?? 0) + (rev.refundAmount ?? 0)

  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" />

      {/* ── Section 1: Daily Overview ────────────────────────────────────────── */}
      <section>
        <SectionHeading
          title="Daily Overview"
          description={`Bookings and revenue for ${format(selectedDate, "dd MMM yyyy")}`}
        >
          <DatePicker label="Select date" value={selectedDate} onChange={v => v && setSelectedDate(v)} />
        </SectionHeading>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <KpiCard title="Total Revenue"    icon={DollarSign}    iconBg="bg-green-50"    iconColor="text-green-600"
            value={formatINR(dash.totalRevenue ?? 0)} isLoading={dashLoading} />
          <KpiCard title="Net Revenue"      icon={TrendingUp}    iconBg="bg-emerald-50"  iconColor="text-emerald-600"
            value={formatINR(dash.netRevenue ?? 0)}   isLoading={dashLoading} />
          <KpiCard title="Confirmed"        icon={CalendarCheck} iconBg="bg-blue-50"     iconColor="text-blue-600"
            value={dash.confirmedBookings ?? 0}        isLoading={dashLoading} />
          <KpiCard title="Pending"          icon={FileText}      iconBg="bg-amber-50"    iconColor="text-amber-600"
            value={dash.pendingBookings ?? 0}          isLoading={dashLoading} />
          <KpiCard title="Cancelled"        icon={XCircle}       iconBg="bg-red-50"      iconColor="text-red-600"
            value={dash.cancelledBookings ?? 0}        isLoading={dashLoading} />
          <KpiCard title="Hours Booked"     icon={Clock}         iconBg="bg-purple-50"   iconColor="text-purple-600"
            value={`${dash.totalHoursBooked ?? 0}h`}  isLoading={dashLoading} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Booking status donut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Booking Status</CardTitle>
              <CardDescription>Distribution for {format(selectedDate, "dd MMM yyyy")}</CardDescription>
            </CardHeader>
            <CardContent>
              {dashLoading ? (
                <Skeleton className="h-[180px] w-full" />
              ) : bookingStatus.length === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                  No bookings on this date
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <div className="shrink-0">
                    <PieChart width={160} height={160}>
                      <Pie
                        data={bookingStatus} cx={80} cy={80}
                        innerRadius={46} outerRadius={72}
                        paddingAngle={3} dataKey="value" strokeWidth={0}
                      >
                        {bookingStatus.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<DonutTooltip />} />
                    </PieChart>
                  </div>
                  <DonutLegend
                    items={bookingStatus}
                    total={dash.totalBookings}
                    totalLabel="Total"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue split */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Revenue Breakdown</CardTitle>
              <CardDescription>Govt · Non-Govt · Refunds</CardDescription>
            </CardHeader>
            <CardContent>
              {dashLoading ? (
                <Skeleton className="h-[180px] w-full" />
              ) : (
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Govt Revenue</span>
                      <span className="font-semibold">{formatINR(dash.govtRevenue ?? 0)}</span>
                    </div>
                    <ProgressBar
                      value={dash.totalRevenue > 0 ? ((dash.govtRevenue ?? 0) / dash.totalRevenue) * 100 : 0}
                      color="#1A6FC4"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Non-Govt Revenue</span>
                      <span className="font-semibold">{formatINR(dash.nonGovtRevenue ?? 0)}</span>
                    </div>
                    <ProgressBar
                      value={dash.totalRevenue > 0 ? ((dash.nonGovtRevenue ?? 0) / dash.totalRevenue) * 100 : 0}
                      color="#06b6d4"
                    />
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Refunds</span>
                    <span className="font-semibold text-red-600">{formatINR(dash.refundAmount ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="font-medium">Net Revenue</span>
                    <span className="font-bold text-emerald-600">{formatINR(dash.netRevenue ?? 0)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Section 2: Audi Performance ──────────────────────────────────────── */}
      <section>
        <SectionHeading
          title="Audi Performance"
          description={`Per-audi breakdown for ${format(selectedDate, "dd MMM yyyy")}`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Confirmed bookings per audi */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Confirmed Bookings by Audi</CardTitle>
            </CardHeader>
            <CardContent>
              {audiLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : audiChartData.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  No audi data for this date
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={audiChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v) => [v, "Bookings"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    />
                    <Bar dataKey="bookings" name="Bookings" fill="#1A6FC4" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Occupancy rate per audi */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Audi Occupancy Rate</CardTitle>
              <CardDescription>% of available hours booked</CardDescription>
            </CardHeader>
            <CardContent>
              {audiLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : audiChartData.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  No audi data for this date
                </div>
              ) : (
                <div className="space-y-5 pt-1">
                  {audiChartData.map((a, i) => (
                    <div key={a.name ?? i} className="space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium truncate pr-2">{a.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs font-normal">
                            {a.bookings} bookings
                          </Badge>
                          <span className="font-semibold text-xs w-10 text-right">{a.occupancy}%</span>
                        </div>
                      </div>
                      <ProgressBar value={a.occupancy} color={a.occupancy >= 75 ? "#22c55e" : a.occupancy >= 40 ? "#f59e0b" : "#1A6FC4"} />
                      <p className="text-xs text-muted-foreground">{formatINR(a.revenue)} revenue</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Revenue per audi bar chart */}
        {audiChartData.length > 0 && (
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Revenue by Audi</CardTitle>
            </CardHeader>
            <CardContent>
              {audiLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={audiChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={v => "₹" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)}
                      tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52}
                    />
                    <Tooltip
                      formatter={v => [formatINR(v), "Revenue"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" name="Revenue" fill="#0B2E5C" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Section 3: Revenue Period Analysis ───────────────────────────────── */}
      <section>
        <SectionHeading
          title="Revenue Analysis"
          description="Aggregate metrics for a custom date range"
        >
          <Button
            size="sm" variant="outline"
            disabled={revLoading || revenueBreakdown.length === 0}
            onClick={() => downloadCSV(
              `revenue-${applied.period}.csv`,
              ["Metric", "Amount (₹)"],
              [
                ["Total Revenue",    rev.totalRevenue    ?? 0],
                ["Govt Revenue",     rev.govtRevenue     ?? 0],
                ["Non-Govt Revenue", rev.nonGovtRevenue  ?? 0],
                ["Refund Amount",    rev.refundAmount    ?? 0],
                ["Net Revenue",      rev.netRevenue      ?? 0],
                ["Total Bookings",   rev.totalBookings   ?? 0],
              ]
            )}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </SectionHeading>

        {/* Period + range controls */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {["daily", "monthly"].map(p => (
            <Button
              key={p} size="sm"
              variant={revPeriod === p ? "default" : "outline"}
              className="capitalize h-8"
              onClick={() => setRevPeriod(p)}
            >
              {p}
            </Button>
          ))}
          <Separator orientation="vertical" className="h-6 mx-1" />
          <DatePicker label="From" value={revFrom} onChange={v => v && setRevFrom(v)} />
          <DatePicker label="To"   value={revTo}   onChange={v => v && setRevTo(v)} />
          <Button
            size="sm" className="h-8 bg-nfdc-primary hover:bg-nfdc-primary/90"
            onClick={() => setApplied({ period: revPeriod, from: revFrom, to: revTo })}
          >
            Apply
          </Button>
        </div>

        {/* Revenue KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <KpiCard title="Total Revenue"    icon={DollarSign}    iconBg="bg-green-50"   iconColor="text-green-600"
            value={formatINR(rev.totalRevenue ?? 0)}   isLoading={revLoading} />
          <KpiCard title="Net Revenue"      icon={TrendingUp}    iconBg="bg-emerald-50" iconColor="text-emerald-600"
            value={formatINR(rev.netRevenue ?? 0)}     isLoading={revLoading} />
          <KpiCard title="Govt Revenue"     icon={Building2}     iconBg="bg-blue-50"    iconColor="text-blue-600"
            value={formatINR(rev.govtRevenue ?? 0)}    isLoading={revLoading} />
          <KpiCard title="Non-Govt Revenue" icon={Building2}     iconBg="bg-cyan-50"    iconColor="text-cyan-600"
            value={formatINR(rev.nonGovtRevenue ?? 0)} isLoading={revLoading} />
          <KpiCard title="Refunds"          icon={RefreshCw}     iconBg="bg-red-50"     iconColor="text-red-600"
            value={formatINR(rev.refundAmount ?? 0)}   isLoading={revLoading} />
          <KpiCard title="Total Bookings"   icon={CalendarCheck} iconBg="bg-purple-50"  iconColor="text-purple-600"
            value={rev.totalBookings ?? 0}             isLoading={revLoading} />
        </div>

        {/* Revenue breakdown donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue Split</CardTitle>
            <CardDescription>
              {format(applied.from, "dd MMM yyyy")} – {format(applied.to, "dd MMM yyyy")}
              {" · "}
              <span className="capitalize">{applied.period}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {revLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : revenueBreakdown.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                No revenue data for this period
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="shrink-0">
                  <PieChart width={200} height={200}>
                    <Pie
                      data={revenueBreakdown} cx={100} cy={100}
                      innerRadius={58} outerRadius={90}
                      paddingAngle={3} dataKey="value" strokeWidth={0}
                    >
                      {revenueBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<DonutTooltip formatter={formatINR} />} />
                  </PieChart>
                </div>
                <DonutLegend
                  items={revenueBreakdown}
                  total={totalRevStatus}
                  totalLabel="Total"
                  formatter={formatINR}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
