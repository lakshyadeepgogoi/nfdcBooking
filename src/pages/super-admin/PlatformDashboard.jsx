import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import {
  DollarSign, CalendarCheck, TrendingUp, Clock, XCircle, FileText,
  ArrowRight, Building2, Users, BarChart2, RefreshCw,
  CheckCircle2, Activity,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import PageHeader from "@/components/common/PageHeader"
import EmptyState from "@/components/common/EmptyState"
import {
  getPlatformDashboard, getPlatformRevenue, listAllTheaters,
  getActivityLogs, getCrossTheaterBookings,
} from "@/api/superAdmin"
import { formatINR } from "@/utils/formatCurrency"
import { toAPIDate, subDays, formatDateTime } from "@/utils/formatDate"
import { parseList } from "@/utils/parseList"

// ── KPI Card ──────────────────────────────────────────────────────────────────
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

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value = 0, color = "#1A6FC4" }) {
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: color }} />
    </div>
  )
}

// ── Booking status badge ──────────────────────────────────────────────────────
const STATUS_CFG = {
  confirmed:  { label: "Confirmed",  cls: "bg-green-100 text-green-700 border-green-200"  },
  pending:    { label: "Pending",    cls: "bg-amber-100 text-amber-700 border-amber-200"  },
  cancelled:  { label: "Cancelled",  cls: "bg-red-100 text-red-700 border-red-200"        },
  postponed:  { label: "Postponed",  cls: "bg-purple-100 text-purple-700 border-purple-200"},
  preponed:   { label: "Preponed",   cls: "bg-blue-100 text-blue-700 border-blue-200"     },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status?.toLowerCase()] ?? { label: status ?? "—", cls: "bg-muted text-muted-foreground" }
  return <Badge variant="outline" className={`text-[10px] h-5 px-2 ${cfg.cls}`}>{cfg.label}</Badge>
}

// ── Theater status badge ──────────────────────────────────────────────────────
function TheaterBadge({ status }) {
  const isActive = status === "active"
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-gray-400"}`} />
      {isActive ? "Active" : status ?? "Unknown"}
    </span>
  )
}

// ── Activity action display ───────────────────────────────────────────────────
const ACTION_CFG = {
  create_theater_admin: { label: "Admin Created",   icon: Users,        cls: "bg-green-50 text-green-600"  },
  update_theater_admin: { label: "Admin Updated",   icon: Users,        cls: "bg-blue-50 text-blue-600"    },
  accepted:             { label: "Booking Accepted",icon: CheckCircle2, cls: "bg-green-50 text-green-600"  },
  cancelled:            { label: "Booking Cancelled",icon: XCircle,     cls: "bg-red-50 text-red-600"      },
  postponed:            { label: "Booking Postponed",icon: Clock,       cls: "bg-amber-50 text-amber-600"  },
  payment_received:     { label: "Payment Received",icon: DollarSign,   cls: "bg-purple-50 text-purple-600"},
  created_theater:      { label: "Theater Created", icon: Building2,    cls: "bg-blue-50 text-blue-600"    },
}

function ActivityItem({ log }) {
  const action  = log.activity?.action ?? ""
  const cfg     = ACTION_CFG[action] ?? { label: action.replace(/_/g, " "), icon: Activity, cls: "bg-muted text-muted-foreground" }
  const Icon    = cfg.icon
  const who     = log.adminName?.name ?? log.adminName ?? "System"
  const theater = log.theaterName ?? null
  const entity  = log.entityName ?? log.activity?.description ?? null
  const timeAgo = log.createdAt ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : ""

  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cfg.cls}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium capitalize leading-tight">{cfg.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {who}
          {theater ? ` · ${theater}` : ""}
          {entity ? ` · ${entity}` : ""}
        </p>
      </div>
      <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo}</span>
    </div>
  )
}

// ── Quick action card ─────────────────────────────────────────────────────────
function QuickAction({ label, description, icon: Icon, path, color, navigate }) {
  return (
    <Card
      className="hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5 group"
      onClick={() => navigate(path)}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color} shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function PlatformDashboard() {
  useEffect(() => { document.title = "NFDC Admin — Platform Dashboard" }, [])
  const navigate = useNavigate()

  const today    = new Date()
  const todayStr = toAPIDate(today)
  const from30   = toAPIDate(subDays(today, 30))

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: dashRaw, isLoading: dashLoading } = useQuery({
    queryKey: ["super", "dashboard", todayStr],
    queryFn: () => getPlatformDashboard(todayStr).then(r => r.data.data),
  })

  const { data: revRaw, isLoading: revLoading } = useQuery({
    queryKey: ["super", "revenue", "daily", from30, todayStr],
    queryFn: () => getPlatformRevenue({ period: "daily", start: from30, end: todayStr }).then(r => r.data.data),
  })

  const { data: theatersRaw, isLoading: theatersLoading } = useQuery({
    queryKey: ["theaters"],
    queryFn: () => listAllTheaters().then(r => parseList(r.data.data)),
  })

  const { data: logsRaw, isLoading: logsLoading } = useQuery({
    queryKey: ["super", "activity-logs", "recent"],
    queryFn: () => getActivityLogs({ page: 1, limit: 8 }).then(r => r.data.data),
  })

  const { data: bookingsRaw, isLoading: bookingsLoading } = useQuery({
    queryKey: ["super", "bookings", "recent"],
    queryFn: () => getCrossTheaterBookings({ page: 1, limit: 6 }).then(r => r.data.data),
  })

  // ── Derived data ─────────────────────────────────────────────────────────────
  const platDash    = dashRaw?.platform?.stats ?? dashRaw?.stats ?? {}
  const platRev     = revRaw?.platform?.stats  ?? revRaw?.stats  ?? {}
  const theaters    = Array.isArray(theatersRaw) ? theatersRaw : []
  const logs        = Array.isArray(logsRaw?.data) ? logsRaw.data : parseList(logsRaw)
  const bookings    = Array.isArray(bookingsRaw?.data) ? bookingsRaw.data : parseList(bookingsRaw)

  const totalRevenue   = platRev.totalRevenue    ?? 0
  const govtRevenue    = platRev.govtRevenue     ?? 0
  const nonGovtRevenue = platRev.nonGovtRevenue  ?? 0
  const refundAmount   = platRev.refundAmount    ?? 0
  const netRevenue     = platRev.netRevenue      ?? 0

  const activeTheaters = theaters.filter(t => t.lifecycle?.status === "active").length

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Platform Dashboard" subtitle={`Today — ${formatDateTime(today)}`} />

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Today's Revenue"  icon={DollarSign}    iconBg="bg-green-50"   iconColor="text-green-600"   value={formatINR(platDash.totalRevenue ?? 0)}      isLoading={dashLoading} />
        <KpiCard title="Net Revenue"      icon={TrendingUp}    iconBg="bg-emerald-50" iconColor="text-emerald-600" value={formatINR(platDash.netRevenue ?? 0)}        isLoading={dashLoading} />
        <KpiCard title="Confirmed"        icon={CalendarCheck} iconBg="bg-blue-50"    iconColor="text-blue-600"    value={platDash.confirmedBookings ?? 0}            isLoading={dashLoading} />
        <KpiCard title="Pending"          icon={FileText}      iconBg="bg-amber-50"   iconColor="text-amber-600"   value={platDash.pendingBookings ?? 0}              isLoading={dashLoading} />
        <KpiCard title="Cancelled"        icon={XCircle}       iconBg="bg-red-50"     iconColor="text-red-600"     value={platDash.cancelledBookings ?? 0}            isLoading={dashLoading} />
        <KpiCard title="Hours Booked"     icon={Clock}         iconBg="bg-purple-50"  iconColor="text-purple-600"  value={`${platDash.totalHoursBooked ?? 0}h`}       isLoading={dashLoading} />
      </div>

      {/* ── Revenue Summary + Activity Feed ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Revenue summary (last 30 days) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Revenue Summary</CardTitle>
                <CardDescription>Last 30 days · aggregate breakdown</CardDescription>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-nfdc-accent px-2"
                onClick={() => navigate("/super/analytics")}>
                Full analytics <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {revLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Govt Revenue",     value: govtRevenue,    color: "#1A6FC4", pct: totalRevenue > 0 ? (govtRevenue / totalRevenue) * 100 : 0 },
                  { label: "Non-Govt Revenue", value: nonGovtRevenue, color: "#06b6d4", pct: totalRevenue > 0 ? (nonGovtRevenue / totalRevenue) * 100 : 0 },
                  { label: "Refunds",          value: refundAmount,   color: "#ef4444", pct: totalRevenue > 0 ? (refundAmount / totalRevenue) * 100 : 0 },
                ].map(item => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold">{formatINR(item.value)}</span>
                    </div>
                    <ProgressBar value={item.pct} color={item.color} />
                  </div>
                ))}
                <Separator className="my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Revenue</span>
                  <span className="font-semibold">{formatINR(totalRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-sm font-medium">Net Revenue</span>
                  </div>
                  <span className="font-bold text-emerald-600">{formatINR(netRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Bookings</span>
                  </div>
                  <span className="font-semibold">{platRev.totalBookings ?? 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Recent Activity</CardTitle>
                <CardDescription>Latest admin actions across the platform</CardDescription>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-nfdc-accent px-2"
                onClick={() => navigate("/super/activity")}>
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3"><Skeleton className="h-8 w-8 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>
              ))}</div>
            ) : logs.length === 0 ? (
              <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">No activity yet</div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map((log, i) => <ActivityItem key={log.logId ?? i} log={log} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Theaters + Recent Bookings ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Theater overview */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Theaters</CardTitle>
                <CardDescription>
                  {theaters.length} total · {activeTheaters} active
                </CardDescription>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-nfdc-accent px-2"
                onClick={() => navigate("/super/theaters")}>
                Manage <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {theatersLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : theaters.length === 0 ? (
              <EmptyState icon={Building2} title="No theaters" message="No theaters registered yet." />
            ) : (
              <div className="space-y-2">
                {theaters.slice(0, 6).map((t, i) => (
                  <div
                    key={t.theaterId ?? t.id ?? i}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/super/theaters/${t.theaterId ?? t.id}`)}
                  >
                    <div className="h-8 w-8 rounded-lg bg-nfdc-pale flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-nfdc-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name ?? t.details?.name ?? "Unnamed"}</p>
                      {(t.details?.city || t.details?.location) && (
                        <p className="text-xs text-muted-foreground truncate">{t.details.city ?? t.details.location}</p>
                      )}
                    </div>
                    <TheaterBadge status={t.lifecycle?.status} />
                  </div>
                ))}
                {theaters.length > 6 && (
                  <button
                    className="w-full text-xs text-nfdc-accent hover:underline text-center pt-1"
                    onClick={() => navigate("/super/theaters")}
                  >
                    +{theaters.length - 6} more theaters
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent bookings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Recent Bookings</CardTitle>
                <CardDescription>Latest cross-theater bookings</CardDescription>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-nfdc-accent px-2"
                onClick={() => navigate("/super/bookings")}>
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
            ) : bookings.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No bookings" message="No bookings found." />
            ) : (
              <div className="space-y-2">
                {bookings.map((b, i) => {
                  const id     = b.bookingId ?? b._id ?? i
                  const status = b.lifecycle?.status ?? b.status
                  const amount = b.pricing?.totalAmount ?? 0
                  const type   = b.bookingDetails?.bookingType
                  const date   = b.bookingDetails?.date
                    ? formatDateTime(b.bookingDetails.date).split(",")[0]
                    : "—"
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/super/bookings/${id}`)}
                    >
                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <CalendarCheck className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-mono text-muted-foreground">#{String(id).slice(-8)}</p>
                          {type && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 capitalize">{type}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{date} · {formatINR(amount)}</p>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction label="Platform Analytics" description="Revenue, audi & theater stats" icon={BarChart2}     color="bg-blue-50 text-blue-600"    path="/super/analytics" navigate={navigate} />
          <QuickAction label="Manage Theaters"    description="Add, edit or archive theaters"  icon={Building2}    color="bg-purple-50 text-purple-600" path="/super/theaters"  navigate={navigate} />
          <QuickAction label="Manage Admins"      description="Create and reassign theater admins" icon={Users}    color="bg-amber-50 text-amber-600"   path="/super/admins"    navigate={navigate} />
          <QuickAction label="All Bookings"       description="Browse cross-theater bookings"  icon={CalendarCheck} color="bg-green-50 text-green-600"  path="/super/bookings"  navigate={navigate} />
        </div>
      </div>
    </div>
  )
}
