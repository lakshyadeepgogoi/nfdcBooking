import { useEffect, useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts"
import { format } from "date-fns"
import {
  DollarSign, CalendarCheck, XCircle, Clock, TrendingUp, FileText,
  RefreshCw, Building2, Download, LayoutDashboard, BarChart2, GitCompare, Layers,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import PageHeader from "@/components/common/PageHeader"
import { downloadCSV } from "@/utils/exportCsv"
import {
  getPlatformDashboard, getPlatformRevenue, getTheaterComparison,
  getSuperAudiAnalytics, listAllTheaters,
} from "@/api/superAdmin"
import { formatINR } from "@/utils/formatCurrency"
import { toAPIDate, subDays } from "@/utils/formatDate"
import { parseList } from "@/utils/parseList"
import { cn } from "@/lib/utils"

// ── Shared primitives ─────────────────────────────────────────────────────────
function ProgressBar({ value = 0, color = "#1A6FC4" }) {
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: color }} />
    </div>
  )
}

function KpiCard({ title, icon: Icon, iconBg, iconColor, value, sub, isLoading }) {
  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{title}</CardTitle>
        <div className={`p-1.5 rounded-lg ${iconBg}`}><Icon className={`h-3.5 w-3.5 ${iconColor}`} /></div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function DatePicker({ label, value, onChange, className }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline"
          className={cn("justify-start text-left font-normal h-8 text-sm", !value && "text-muted-foreground", className)}>
          {value ? format(value, "dd MMM yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
      </PopoverContent>
    </Popover>
  )
}

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

function SectionHeading({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

// ── Theater summary cards ─────────────────────────────────────────────────────
function TheaterStatCard({ name, stats }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-nfdc-pale rounded-lg">
            <Building2 className="h-3.5 w-3.5 text-nfdc-accent" />
          </div>
          <CardTitle className="text-sm font-semibold truncate">{name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Revenue</p>
            <p className="font-bold text-sm mt-0.5">{formatINR(stats?.totalRevenue ?? 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Confirmed</p>
            <p className="font-bold text-sm mt-0.5">{stats?.confirmedBookings ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Net Revenue</p>
            <p className="font-semibold text-emerald-600 mt-0.5">{formatINR(stats?.netRevenue ?? 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Hours</p>
            <p className="font-semibold mt-0.5">{stats?.totalHoursBooked ?? 0}h</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function PlatformAnalytics() {
  useEffect(() => { document.title = "NFDC Admin — Platform Analytics" }, [])

  const today = new Date()

  // Tab 1: Overview
  const [dashDate, setDashDate]     = useState(today)

  // Tab 2: Revenue
  const [revPeriod, setRevPeriod]   = useState("monthly")
  const [revFrom, setRevFrom]       = useState(subDays(today, 30))
  const [revTo, setRevTo]           = useState(today)
  const [appliedRev, setAppliedRev] = useState({ period: "monthly", from: subDays(today, 30), to: today })

  // Tab 4: Audis
  const [audiDate, setAudiDate]     = useState(today)
  const [audiTheater, setAudiTheater] = useState("")

  // ── Queries ─────────────────────────────────────────────────────────────────
  const dashDateStr = toAPIDate(dashDate)
  const audiDateStr = toAPIDate(audiDate)

  const { data: dashRaw, isLoading: dashLoading } = useQuery({
    queryKey: ["super", "dashboard", dashDateStr],
    queryFn: () => getPlatformDashboard(dashDateStr).then(r => r.data.data),
    enabled: !!dashDateStr,
  })

  const { data: revRaw, isLoading: revLoading } = useQuery({
    queryKey: ["super", "revenue", appliedRev.period, toAPIDate(appliedRev.from), toAPIDate(appliedRev.to)],
    queryFn: () => getPlatformRevenue({
      period: appliedRev.period,
      start: toAPIDate(appliedRev.from),
      end: toAPIDate(appliedRev.to),
    }).then(r => r.data.data),
  })

  const { data: compRaw, isLoading: compLoading } = useQuery({
    queryKey: ["super", "comparison"],
    queryFn: () => getTheaterComparison().then(r => r.data.data),
  })

  const { data: audiRaw, isLoading: audiLoading } = useQuery({
    queryKey: ["super", "audi", audiDateStr, audiTheater],
    queryFn: () => getSuperAudiAnalytics({
      date: audiDateStr,
      ...(audiTheater ? { theaterId: audiTheater } : {}),
    }).then(r => r.data.data),
    enabled: !!audiDateStr,
  })

  const { data: theatersRaw } = useQuery({
    queryKey: ["theaters"],
    queryFn: () => listAllTheaters().then(r => parseList(r.data.data)),
  })

  // ── Derived data ──────────────────────────────────────────────────────────
  const theaterNameMap = useMemo(() => {
    const map = {}
    ;(Array.isArray(theatersRaw) ? theatersRaw : []).forEach(t => {
      const key = t.theaterId ?? t.id ?? t._id
      map[key] = t.name ?? t.details?.name ?? key
    })
    return map
  }, [theatersRaw])

  // Simple inline (not used as memo deps)
  const platDash = dashRaw?.platform?.stats ?? dashRaw?.stats ?? {}
  const platRev  = revRaw?.platform?.stats  ?? revRaw?.stats  ?? {}

  // Theater comparison — group & sum by theaterId
  const theaterCompData = useMemo(() => {
    const agg = {}
    ;(Array.isArray(compRaw) ? compRaw : []).forEach(r => {
      const tid = r.relationships?.theaterId
      if (!tid) return
      if (!agg[tid]) {
        agg[tid] = {
          name: theaterNameMap[tid] ?? `Theater…${tid.slice(-4)}`,
          totalBookings: 0, confirmedBookings: 0, cancelledBookings: 0,
          totalRevenue: 0, netRevenue: 0, totalHoursBooked: 0, days: 0,
        }
      }
      const s = r.stats ?? {}
      agg[tid].totalBookings     += s.totalBookings     ?? 0
      agg[tid].confirmedBookings += s.confirmedBookings ?? 0
      agg[tid].cancelledBookings += s.cancelledBookings ?? 0
      agg[tid].totalRevenue      += s.totalRevenue      ?? 0
      agg[tid].netRevenue        += s.netRevenue        ?? 0
      agg[tid].totalHoursBooked  += s.totalHoursBooked  ?? 0
      agg[tid].days              += 1
    })
    return Object.values(agg)
  }, [compRaw, theaterNameMap])

  // Per-theater revenue for current period
  const theaterRevData = useMemo(() =>
    (Array.isArray(revRaw?.theaters) ? revRaw.theaters : []).map(r => ({
      name:         theaterNameMap[r.relationships?.theaterId] ?? `…${r.relationships?.theaterId?.slice(-4) ?? "?"}`,
      totalRevenue: r.stats?.totalRevenue    ?? 0,
      netRevenue:   r.stats?.netRevenue      ?? 0,
      govtRevenue:  r.stats?.govtRevenue     ?? 0,
      nonGovt:      r.stats?.nonGovtRevenue  ?? 0,
      bookings:     r.stats?.totalBookings   ?? 0,
    })), [revRaw, theaterNameMap])

  // Per-theater daily overview chart
  const theaterDashData = useMemo(() =>
    (Array.isArray(dashRaw?.theaters) ? dashRaw.theaters : []).map(r => ({
      name:      theaterNameMap[r.relationships?.theaterId] ?? `…${r.relationships?.theaterId?.slice(-4) ?? "?"}`,
      confirmed: r.stats?.confirmedBookings ?? 0,
      cancelled: r.stats?.cancelledBookings ?? 0,
      revenue:   r.stats?.totalRevenue      ?? 0,
    })), [dashRaw, theaterNameMap])

  // Audi list
  const audiList = Array.isArray(audiRaw) ? audiRaw : []
  const audiChartData = audiList.map(a => ({
    name:      a.audiName ?? a.audiId,
    bookings:  a.stats?.confirmedBookings ?? 0,
    revenue:   a.stats?.totalRevenue      ?? 0,
    occupancy: a.stats?.occupancyRate     ?? 0,
  }))

  // Donut data — platform booking status
  const bookingStatusData = [
    { name: "Confirmed", value: platDash.confirmedBookings ?? 0, color: "#22c55e" },
    { name: "Pending",   value: platDash.pendingBookings   ?? 0, color: "#f59e0b" },
    { name: "Cancelled", value: platDash.cancelledBookings ?? 0, color: "#ef4444" },
    { name: "Postponed", value: platDash.postponedBookings ?? 0, color: "#8b5cf6" },
  ].filter(d => d.value > 0)

  const revBreakdown = [
    { name: "Govt",     value: platRev.govtRevenue    ?? 0, color: "#1A6FC4" },
    { name: "Non-Govt", value: platRev.nonGovtRevenue ?? 0, color: "#06b6d4" },
    { name: "Refunds",  value: platRev.refundAmount   ?? 0, color: "#ef4444" },
  ].filter(d => d.value > 0)

  const totalRevStatus = (platRev.govtRevenue ?? 0) + (platRev.nonGovtRevenue ?? 0) + (platRev.refundAmount ?? 0)

  // ── Shared tooltip style ──────────────────────────────────────────────────
  const tooltipStyle = {
    borderRadius: 8,
    border: "1px solid hsl(var(--border))",
    fontSize: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
  }

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Platform Analytics" />

      <Tabs defaultValue="overview" className="w-full">
        <div className="flex flex-col gap-6 w-full">
          <TabsList className="h-auto w-full rounded-xl border border-border bg-card p-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1 shadow-sm">
            {[
              { value: "overview",  label: "Overview",   fullLabel: "Overview",           icon: LayoutDashboard },
              { value: "revenue",   label: "Revenue",    fullLabel: "Revenue Analysis",   icon: BarChart2       },
              { value: "theaters",  label: "Theaters",   fullLabel: "Theater Comparison", icon: GitCompare      },
              { value: "audis",     label: "Audis",      fullLabel: "Audi Analytics",     icon: Layers          },
            ].map(({ value, label, fullLabel, icon: Icon }) => (
              <TabsTrigger key={value} value={value}
                className="flex items-center justify-center gap-2 rounded-lg px-2 py-3 text-sm font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-all w-full">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="sm:hidden font-medium">{label}</span>
                <span className="hidden sm:inline font-medium">{fullLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="w-full space-y-0">

            {/* ─────────────── Tab 1: Platform Overview ─────────────────────── */}
            <TabsContent value="overview" className="mt-0 space-y-5">
              <SectionHeading
                title="Platform Overview"
                description={`Platform-wide metrics for ${format(dashDate, "dd MMM yyyy")}`}
              >
                <DatePicker label="Select date" value={dashDate} onChange={v => v && setDashDate(v)} />
              </SectionHeading>

              {/* Platform KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard title="Total Revenue"   icon={DollarSign}    iconBg="bg-green-50"   iconColor="text-green-600"   value={formatINR(platDash.totalRevenue ?? 0)}      isLoading={dashLoading} />
                <KpiCard title="Net Revenue"     icon={TrendingUp}    iconBg="bg-emerald-50" iconColor="text-emerald-600" value={formatINR(platDash.netRevenue ?? 0)}        isLoading={dashLoading} />
                <KpiCard title="Confirmed"       icon={CalendarCheck} iconBg="bg-blue-50"    iconColor="text-blue-600"    value={platDash.confirmedBookings ?? 0}            isLoading={dashLoading} />
                <KpiCard title="Pending"         icon={FileText}      iconBg="bg-amber-50"   iconColor="text-amber-600"   value={platDash.pendingBookings ?? 0}              isLoading={dashLoading} />
                <KpiCard title="Cancelled"       icon={XCircle}       iconBg="bg-red-50"     iconColor="text-red-600"     value={platDash.cancelledBookings ?? 0}            isLoading={dashLoading} />
                <KpiCard title="Hours Booked"    icon={Clock}         iconBg="bg-purple-50"  iconColor="text-purple-600"  value={`${platDash.totalHoursBooked ?? 0}h`}       isLoading={dashLoading} />
              </div>

              {/* Booking status donut + Revenue split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Booking Status Distribution</CardTitle>
                    <CardDescription>Platform-wide for {format(dashDate, "dd MMM yyyy")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashLoading ? <Skeleton className="h-[180px]" /> : bookingStatusData.length === 0 ? (
                      <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No bookings on this date</div>
                    ) : (
                      <div className="flex items-center gap-6">
                        <div className="shrink-0">
                          <PieChart width={160} height={160}>
                            <Pie data={bookingStatusData} cx={80} cy={80} innerRadius={46} outerRadius={72} paddingAngle={3} dataKey="value" strokeWidth={0}>
                              {bookingStatusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <Tooltip content={<DonutTooltip />} />
                          </PieChart>
                        </div>
                        <DonutLegend items={bookingStatusData} total={platDash.totalBookings} totalLabel="Total" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Revenue Breakdown</CardTitle>
                    <CardDescription>Govt · Non-Govt · Refunds</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashLoading ? <Skeleton className="h-[180px]" /> : (
                      <div className="space-y-3 pt-1">
                        {[
                          { label: "Govt Revenue",     value: platDash.govtRevenue    ?? 0, color: "#1A6FC4" },
                          { label: "Non-Govt Revenue", value: platDash.nonGovtRevenue ?? 0, color: "#06b6d4" },
                        ].map(item => (
                          <div key={item.label} className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="font-semibold">{formatINR(item.value)}</span>
                            </div>
                            <ProgressBar value={platDash.totalRevenue > 0 ? (item.value / platDash.totalRevenue) * 100 : 0} color={item.color} />
                          </div>
                        ))}
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Refunds</span>
                          <span className="font-semibold text-red-600">{formatINR(platDash.refundAmount ?? 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2">
                          <span className="font-medium">Net Revenue</span>
                          <span className="font-bold text-emerald-600">{formatINR(platDash.netRevenue ?? 0)}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Per-theater daily performance */}
              {(dashLoading || theaterDashData.length > 0) && (
                <>
                  <SectionHeading title="Theater Performance" description={`Individual theater stats for ${format(dashDate, "dd MMM yyyy")}`} />
                  {dashLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
                    </div>
                  ) : theaterDashData.length === 0 ? null : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(Array.isArray(dashRaw?.theaters) ? dashRaw.theaters : []).map((r, i) => (
                          <TheaterStatCard
                            key={r.analyticsId ?? i}
                            name={theaterNameMap[r.relationships?.theaterId] ?? `Theater ${i + 1}`}
                            stats={r.stats}
                          />
                        ))}
                      </div>
                      {theaterDashData.length > 0 && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Confirmed Bookings by Theater</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={theaterDashData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="confirmed" name="Confirmed" fill="#1A6FC4" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={60} />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </>
              )}
            </TabsContent>

            {/* ─────────────── Tab 2: Revenue Analysis ──────────────────────── */}
            <TabsContent value="revenue" className="mt-0 space-y-5">
              <SectionHeading title="Revenue Analysis" description="Platform-wide and per-theater revenue metrics">
                <Button size="sm" variant="outline"
                  disabled={revBreakdown.length === 0}
                  onClick={() => downloadCSV("platform-revenue.csv",
                    ["Metric", "Amount (₹)"],
                    [
                      ["Total Revenue",    platRev.totalRevenue    ?? 0],
                      ["Govt Revenue",     platRev.govtRevenue     ?? 0],
                      ["Non-Govt Revenue", platRev.nonGovtRevenue  ?? 0],
                      ["Refund Amount",    platRev.refundAmount    ?? 0],
                      ["Net Revenue",      platRev.netRevenue      ?? 0],
                      ["Total Bookings",   platRev.totalBookings   ?? 0],
                    ])}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />Export CSV
                </Button>
              </SectionHeading>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {["daily", "monthly"].map(p => (
                  <Button key={p} size="sm" variant={revPeriod === p ? "default" : "outline"} className="capitalize h-8"
                    onClick={() => setRevPeriod(p)}>{p}</Button>
                ))}
                <Separator orientation="vertical" className="h-6 mx-1" />
                <DatePicker label="From" value={revFrom} onChange={v => v && setRevFrom(v)} />
                <DatePicker label="To"   value={revTo}   onChange={v => v && setRevTo(v)} />
                <Button size="sm" className="h-8 bg-nfdc-primary hover:bg-nfdc-primary/90"
                  onClick={() => setAppliedRev({ period: revPeriod, from: revFrom, to: revTo })}>
                  Apply
                </Button>
              </div>

              {/* Platform revenue KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard title="Total Revenue"    icon={DollarSign}    iconBg="bg-green-50"   iconColor="text-green-600"   value={formatINR(platRev.totalRevenue ?? 0)}   isLoading={revLoading} />
                <KpiCard title="Net Revenue"      icon={TrendingUp}    iconBg="bg-emerald-50" iconColor="text-emerald-600" value={formatINR(platRev.netRevenue ?? 0)}     isLoading={revLoading} />
                <KpiCard title="Govt Revenue"     icon={Building2}     iconBg="bg-blue-50"    iconColor="text-blue-600"    value={formatINR(platRev.govtRevenue ?? 0)}    isLoading={revLoading} />
                <KpiCard title="Non-Govt"         icon={Building2}     iconBg="bg-cyan-50"    iconColor="text-cyan-600"    value={formatINR(platRev.nonGovtRevenue ?? 0)} isLoading={revLoading} />
                <KpiCard title="Refunds"          icon={RefreshCw}     iconBg="bg-red-50"     iconColor="text-red-600"     value={formatINR(platRev.refundAmount ?? 0)}   isLoading={revLoading} />
                <KpiCard title="Total Bookings"   icon={CalendarCheck} iconBg="bg-purple-50"  iconColor="text-purple-600"  value={platRev.totalBookings ?? 0}             isLoading={revLoading} />
              </div>

              {/* Revenue donut */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Platform Revenue Split</CardTitle>
                  <CardDescription>
                    {format(appliedRev.from, "dd MMM yyyy")} – {format(appliedRev.to, "dd MMM yyyy")}
                    {" · "}<span className="capitalize">{appliedRev.period}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {revLoading ? <Skeleton className="h-[200px]" /> : revBreakdown.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No revenue data for this period</div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-8">
                      <div className="shrink-0">
                        <PieChart width={200} height={200}>
                          <Pie data={revBreakdown} cx={100} cy={100} innerRadius={58} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                            {revBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip content={<DonutTooltip formatter={formatINR} />} />
                        </PieChart>
                      </div>
                      <DonutLegend items={revBreakdown} total={totalRevStatus} totalLabel="Total" formatter={formatINR} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Per-theater revenue comparison */}
              {theaterRevData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">Revenue by Theater</CardTitle>
                        <CardDescription>Grouped by Govt and Non-Govt for selected period</CardDescription>
                      </div>
                      <Button size="sm" variant="outline"
                        onClick={() => downloadCSV("theater-revenue.csv",
                          ["Theater", "Total Revenue", "Net Revenue", "Govt", "Non-Govt", "Bookings"],
                          theaterRevData.map(r => [r.name, r.totalRevenue, r.netRevenue, r.govtRevenue, r.nonGovt, r.bookings]))}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={theaterRevData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={v => "₹" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)}
                          tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                        <Tooltip formatter={v => formatINR(v)} contentStyle={tooltipStyle} />
                        <Legend iconType="circle" iconSize={8} />
                        <Bar dataKey="govtRevenue" name="Govt" fill="#1A6FC4" radius={[4, 4, 0, 0]} maxBarSize={40} stackId="a" />
                        <Bar dataKey="nonGovt"     name="Non-Govt" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={40} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ─────────────── Tab 3: Theater Comparison ────────────────────── */}
            <TabsContent value="theaters" className="mt-0 space-y-5">
              <SectionHeading
                title="Theater Comparison"
                description="Cumulative all-time performance aggregated across all stored analytics records"
              >
                <Button size="sm" variant="outline"
                  disabled={theaterCompData.length === 0}
                  onClick={() => downloadCSV("theater-comparison.csv",
                    ["Theater", "Total Bookings", "Confirmed", "Cancelled", "Total Revenue (₹)", "Net Revenue (₹)", "Hours"],
                    theaterCompData.map(r => [r.name, r.totalBookings, r.confirmedBookings, r.cancelledBookings, r.totalRevenue, r.netRevenue, r.totalHoursBooked]))}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />Export CSV
                </Button>
              </SectionHeading>

              {compLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-[280px] w-full" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
                  </div>
                </div>
              ) : theaterCompData.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                  No theater comparison data available yet.
                </div>
              ) : (
                <>
                  {/* Grouped bar: bookings + revenue */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Bookings by Theater</CardTitle>
                        <CardDescription>Confirmed vs Cancelled (cumulative)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={theaterCompData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend iconType="circle" iconSize={8} />
                            <Bar dataKey="confirmedBookings" name="Confirmed" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            <Bar dataKey="cancelledBookings" name="Cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Revenue by Theater</CardTitle>
                        <CardDescription>Total vs Net (cumulative)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={theaterCompData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis tickFormatter={v => "₹" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)}
                              tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                            <Tooltip formatter={v => formatINR(v)} contentStyle={tooltipStyle} />
                            <Legend iconType="circle" iconSize={8} />
                            <Bar dataKey="totalRevenue" name="Total Revenue" fill="#1A6FC4" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            <Bar dataKey="netRevenue"   name="Net Revenue"   fill="#0B2E5C" radius={[4, 4, 0, 0]} maxBarSize={50} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Theater summary cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {theaterCompData.map(t => (
                      <Card key={t.name} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2 pt-4 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-nfdc-pale rounded-lg">
                                <Building2 className="h-3.5 w-3.5 text-nfdc-accent" />
                              </div>
                              <CardTitle className="text-sm font-semibold truncate">{t.name}</CardTitle>
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0">{t.days}d</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-muted rounded-lg p-2">
                              <p className="text-muted-foreground">Total Revenue</p>
                              <p className="font-bold text-sm mt-0.5">{formatINR(t.totalRevenue)}</p>
                            </div>
                            <div className="bg-muted rounded-lg p-2">
                              <p className="text-muted-foreground">Net Revenue</p>
                              <p className="font-semibold text-emerald-600 text-sm mt-0.5">{formatINR(t.netRevenue)}</p>
                            </div>
                            <div className="bg-muted rounded-lg p-2">
                              <p className="text-muted-foreground">Confirmed</p>
                              <p className="font-semibold text-sm mt-0.5">{t.confirmedBookings}</p>
                            </div>
                            <div className="bg-muted rounded-lg p-2">
                              <p className="text-muted-foreground">Hours Booked</p>
                              <p className="font-semibold text-sm mt-0.5">{t.totalHoursBooked}h</p>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Cancellation rate</span>
                              <span className="font-medium">
                                {t.totalBookings > 0 ? Math.round((t.cancelledBookings / t.totalBookings) * 100) : 0}%
                              </span>
                            </div>
                            <ProgressBar
                              value={t.totalBookings > 0 ? (t.cancelledBookings / t.totalBookings) * 100 : 0}
                              color="#ef4444"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ─────────────── Tab 4: Audi Analytics ───────────────────────── */}
            <TabsContent value="audis" className="mt-0 space-y-5">
              <SectionHeading title="Audi Analytics" description="Per-audi performance across all theaters">
                <div className="flex items-center gap-2">
                  <DatePicker label="Date" value={audiDate} onChange={v => v && setAudiDate(v)} />
                  <Select value={audiTheater} onValueChange={v => setAudiTheater(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-8 w-44 text-sm">
                      <SelectValue placeholder="All Theaters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Theaters</SelectItem>
                      {(Array.isArray(theatersRaw) ? theatersRaw : []).map(t => (
                        <SelectItem key={t.theaterId ?? t.id ?? t._id} value={t.theaterId ?? t.id ?? t._id}>
                          {t.name ?? t.details?.name ?? t.theaterId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </SectionHeading>

              {audiLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-[240px] w-full" />
                  <Skeleton className="h-[240px] w-full" />
                </div>
              ) : audiChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                  No audi data for {format(audiDate, "dd MMM yyyy")}
                  {audiTheater ? " in the selected theater" : ""}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Bookings chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Confirmed Bookings by Audi</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={audiChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="bookings" name="Bookings" fill="#1A6FC4" radius={[4, 4, 0, 0]} maxBarSize={56} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Revenue chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Revenue by Audi</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={audiChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                            <YAxis tickFormatter={v => "₹" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)}
                              tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                            <Tooltip formatter={v => formatINR(v)} contentStyle={tooltipStyle} />
                            <Bar dataKey="revenue" name="Revenue" fill="#0B2E5C" radius={[4, 4, 0, 0]} maxBarSize={56} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Occupancy rate bars */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Audi Occupancy Rate</CardTitle>
                      <CardDescription>% of available operational hours booked for {format(audiDate, "dd MMM yyyy")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {audiChartData.map((a, i) => (
                          <div key={a.name ?? i} className="space-y-1.5">
                            <div className="flex justify-between items-center text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-medium truncate">{a.name}</span>
                                <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                                  {a.bookings} bookings
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-3">
                                <span className="text-xs text-muted-foreground">{formatINR(a.revenue)}</span>
                                <span className="text-xs font-semibold w-10 text-right">{a.occupancy}%</span>
                              </div>
                            </div>
                            <ProgressBar
                              value={a.occupancy}
                              color={a.occupancy >= 75 ? "#22c55e" : a.occupancy >= 40 ? "#f59e0b" : "#1A6FC4"}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Export */}
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline"
                      onClick={() => downloadCSV(`audi-analytics-${audiDateStr}.csv`,
                        ["Audi", "Bookings", "Revenue (₹)", "Occupancy %"],
                        audiChartData.map(a => [a.name, a.bookings, a.revenue, a.occupancy]))}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />Export CSV
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

          </div>
        </div>
      </Tabs>
    </div>
  )
}
