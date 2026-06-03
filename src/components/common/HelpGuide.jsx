import { useState, useMemo } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Building2, Tag, CalendarCheck, CheckCircle2, Clock,
  CalendarClock, Ban, HelpCircle, BookOpen, Lightbulb,
  Search, AlertTriangle, ArrowRight, CreditCard, Settings2,
  BarChart3, Users, ScrollText, Globe, ShieldCheck, X,
  Zap, FileText, Power, RefreshCw, Receipt, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"

// ─── Theater Admin content ─────────────────────────────────────────────────────

const THEATER_SECTIONS = [
  {
    id:      "quickstart",
    icon:    Zap,
    color:   "text-nfdc-primary",
    bg:      "bg-nfdc-primary/10",
    title:   "Quick Start",
    badge:   "Start Here",
    flow: [
      { icon: Building2,    label: "Create Audi",    color: "bg-blue-500"   },
      { icon: Clock,        label: "Add Slots",      color: "bg-purple-500" },
      { icon: Tag,          label: "Set Pricing",    color: "bg-amber-500"  },
      { icon: Power,        label: "Activate",       color: "bg-green-500"  },
    ],
    items: [
      {
        icon: Building2, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Step 1", title: "Create an Audi",
        desc: "Go to Audis → Add Audi. Choose your booking mode:",
        tags: ["Fixed Slots", "Flexible Hours"],
        note: "Fixed = admin sets time windows (e.g. 9 AM–1 PM). Flexible = customer picks start time within your hours.",
        tip: "You cannot change the mode later — choose carefully.",
      },
      {
        icon: Clock, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "Step 2", title: "Add Slots (Fixed only)",
        desc: "Go to Slots → select audi → Add Slot. Define time windows:",
        tags: ["08:00–12:00", "13:00–17:00", "18:00–22:00"],
        note: "Slots must not overlap. The form shows free windows as clickable chips — just select one.",
        tip: "Overlapping times are highlighted red in real time before you save.",
      },
      {
        icon: Tag, iconBg: "bg-amber-50", iconColor: "text-amber-600",
        step: "Step 3", title: "Configure Pricing",
        desc: "Go to Price Config → Audi tab → Edit. Add rate rows:",
        tags: ["4h → ₹12,000 Govt", "4h → ₹18,000 Non-Govt"],
        note: "The duration in the rate must match your slot duration exactly.",
        tip: "If duration doesn't match a slot, the fee preview will show ₹0.",
      },
      {
        icon: Power, iconBg: "bg-green-50", iconColor: "text-green-600",
        step: "Step 4", title: "Activate",
        desc: "Go to Audis → open audi → Setup tab. When all items are green:",
        tags: ["✓ Slots", "✓ Price Config", "✓ All complete"],
        note: "The Activate button is greyed out until every checklist item is done.",
        tip: "Deactivating doesn't cancel existing confirmed bookings.",
      },
    ],
  },
  {
    id:    "bookings",
    icon:  CalendarCheck,
    color: "text-green-600",
    bg:    "bg-green-50",
    title: "Bookings",
    items: [
      {
        icon: CalendarCheck, iconBg: "bg-green-50", iconColor: "text-green-600",
        step: "Review",
        title: "Accept a booking",
        desc:  "Bookings arrive as Pending. Open one and click Accept.",
        outcome: { label: "Result", value: "Customer gets payment email • Deadline timer starts" },
        tip:   "Accepting doesn't collect payment — it triggers the deadline.",
      },
      {
        icon: CheckCircle2, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "After event",
        title: "Mark as Completed",
        desc:  "Open the booking → Mark Completed to close the record.",
        outcome: { label: "Then", value: "Use Finance panel → Refund Deposit if deposit was taken" },
      },
      {
        icon: CreditCard, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "Walk-in",
        title: "Manual Booking",
        desc:  "Go to Bookings → Manual Booking. Verify customer's User ID first.",
        tags: ["Offline Payment (cheque/DD)", "Fee Waived (with reason)"],
      },
      {
        icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-600",
        step: "Cancel",
        title: "Cancelling a booking",
        desc:  "Open booking → Cancel Booking. Cancellation charges apply per your policy.",
        tip:  "Cancellation cannot be undone — confirm before clicking.",
      },
    ],
  },
  {
    id:    "pricing",
    icon:  Tag,
    color: "text-purple-600",
    bg:    "bg-purple-50",
    title: "Pricing",
    items: [
      {
        icon: Tag, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "Audi",
        title: "Hourly rate table",
        desc:  "Price Config → Audi tab → Edit. One row per slot duration:",
        tags: ["Hours: 4", "Govt: ₹12,000", "Non-Govt: ₹18,000"],
        tip:  "GST is added automatically. Don't include it in the rate.",
      },
      {
        icon: Receipt, iconBg: "bg-amber-50", iconColor: "text-amber-600",
        step: "Deposit",
        title: "Security deposit",
        desc:  "Inside each rate row, enable a deposit — Fixed amount or % of total.",
        outcome: { label: "Flow", value: "Customer pays upfront → deposit held → refunded after event" },
      },
      {
        icon: Settings2, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Services",
        title: "Service pricing",
        desc:  "Price Config → Service tab. Set flat rate per service per booking type.",
        tags: ["Govt rate", "Non-Govt rate", "Mandatory = always included"],
      },
      {
        icon: Ban, iconBg: "bg-red-50", iconColor: "text-red-600",
        step: "Policy",
        title: "Cancellation charges",
        desc:  "Price Config → Cancellation tab. Closer to event = higher charge.",
        tags: ["Day 0–3 = 50%", "Day 4–7 = 25%", "Day 8+ = 0%"],
        tip:  "Only visible when allowUserReschedule is ON for your theater.",
      },
    ],
  },
  {
    id:    "reschedule",
    icon:  CalendarClock,
    color: "text-indigo-600",
    bg:    "bg-indigo-50",
    title: "Reschedule",
    items: [
      {
        icon: CalendarClock, iconBg: "bg-indigo-50", iconColor: "text-indigo-600",
        step: "Incoming",
        title: "Customer requests (Pending Review)",
        desc:  "Customer asks to reschedule → appears in Reschedule → Pending Review.",
        tags: ["Approve → sends payment link if extra cost", "Reject → original dates kept"],
      },
      {
        icon: RefreshCw, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "Admin",
        title: "Propose new dates",
        desc:  "Click Propose New Dates → enter Booking ID → pick Postpone or Prepone → select date from calendar.",
        outcome: { label: "Calendar", value: "🟢 Free  🟡 Partial  🔴 Fully booked" },
        tip:  "Customer must Accept or Reject your proposal.",
      },
    ],
  },
  {
    id:    "blocks",
    icon:  Ban,
    color: "text-red-600",
    bg:    "bg-red-50",
    title: "Block Manager",
    items: [
      {
        icon: Ban, iconBg: "bg-red-50", iconColor: "text-red-600",
        step: "Create",
        title: "Block a date or time",
        desc:  "Block Manager → select audi → Add Block → pick date → choose scope:",
        tags: ["Full Day", "Partial (e.g. 10:00–14:00)"],
        tip:  "Add a reason — it appears in the admin booking form.",
      },
      {
        icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-600",
        step: "Remove",
        title: "Remove a block",
        desc:  "Find block in list → ⋯ menu → Remove → slot immediately becomes bookable.",
        outcome: { label: "Note", value: "Existing confirmed bookings are NOT affected by blocks" },
      },
    ],
  },
  {
    id:    "issues",
    icon:  Lightbulb,
    color: "text-amber-600",
    bg:    "bg-amber-50",
    title: "Common Issues",
    items: [
      {
        icon: AlertTriangle, iconBg: "bg-amber-50", iconColor: "text-amber-600",
        step: "Issue",
        title: "Activate button is greyed out",
        desc:  "Audi → Setup tab → fix every amber ✗ item. Common causes:",
        tags: ["No Price Config", "No active slots", "Missing booking durations"],
      },
      {
        icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-600",
        step: "Issue",
        title: "Fee preview shows ₹0",
        desc:  "Price Config → Audi → Edit → the rate duration doesn't match the slot.",
        outcome: { label: "Fix", value: "Add a 4h row if your slot is 4h long" },
      },
      {
        icon: AlertTriangle, iconBg: "bg-orange-50", iconColor: "text-orange-600",
        step: "Issue",
        title: "Can only select 2 slots (Manual Booking)",
        desc:  "Slots have a time gap. With 'Gap between slots = Not allowed', only truly consecutive slots can be multi-selected.",
        outcome: { label: "Check", value: "Slot 2 ends at 12:00, Slot 3 starts at 13:00 → 1h gap → blocked" },
      },
      {
        icon: AlertTriangle, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Issue",
        title: "Reschedule tab missing",
        desc:  "allowUserReschedule is OFF for your theater.",
        outcome: { label: "Fix", value: "Contact your Super Admin to enable it in Theater Settings → Config" },
      },
    ],
  },
]

const SUPER_SECTIONS = [
  {
    id:    "overview",
    icon:  Globe,
    color: "text-nfdc-primary",
    bg:    "bg-nfdc-primary/10",
    title: "Platform Overview",
    badge: "Start Here",
    flow: [
      { icon: Building2, label: "Create Theater",  color: "bg-blue-500"   },
      { icon: Users,     label: "Assign Admin",    color: "bg-purple-500" },
      { icon: Settings2, label: "Configure",       color: "bg-amber-500"  },
      { icon: BarChart3, label: "Monitor",         color: "bg-green-500"  },
    ],
    items: [
      {
        icon: Globe, iconBg: "bg-nfdc-primary/10", iconColor: "text-nfdc-primary",
        step: "Role",
        title: "What Super Admin can do",
        desc:  "You manage the entire NFDC platform:",
        tags: ["Create & manage theaters", "Assign admins", "View all bookings", "Platform analytics"],
      },
      {
        icon: Building2, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Step 1",
        title: "Create a Theater",
        desc:  "Go to Theaters → Add Theater. Fill in name, address, payment MID and T&C.",
        outcome: { label: "Tabs to fill", value: "Info → Facilities → Images → T&C → Config" },
      },
      {
        icon: Users, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "Step 2",
        title: "Assign an Admin",
        desc:  "Admin Management → create account → Theater Admin role → link to theater.",
        tip:  "One theater can have multiple admins. Roles cannot be changed after creation.",
      },
      {
        icon: ShieldCheck, iconBg: "bg-green-50", iconColor: "text-green-600",
        step: "Config",
        title: "Enable Reschedule",
        desc:  "Theater Detail → Config tab → toggle User-initiated Reschedule ON.",
        outcome: { label: "Effect", value: "Theater admin sees Reschedule tab • Cancellation policy tabs unlock" },
      },
    ],
  },
  {
    id:    "theaters",
    icon:  Building2,
    color: "text-blue-600",
    bg:    "bg-blue-50",
    title: "Theater Management",
    items: [
      {
        icon: Building2, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Info",
        title: "Filling theater details",
        desc:  "Theater Detail has tabs — save each section separately:",
        tags: ["Info (name, address)", "Facilities (amenities, parking)", "Images", "T&C"],
      },
      {
        icon: FileText, iconBg: "bg-amber-50", iconColor: "text-amber-600",
        step: "T&C",
        title: "Publishing T&C",
        desc:  "T&C tab → write content → Save Draft → Publish. Each publish creates a new version.",
        outcome: { label: "Versions", value: "v1 → v2 → v3 with full history preserved" },
      },
      {
        icon: CreditCard, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "Payment",
        title: "Payment MID",
        desc:  "Set the BillDesk MID in Theater Info. This links the theater to its payment account.",
        tip:  "Without a MID, online payments cannot be processed for that theater.",
      },
      {
        icon: BarChart3, iconBg: "bg-green-50", iconColor: "text-green-600",
        step: "Analytics",
        title: "Audi performance",
        desc:  "Theater Detail → select a date → see bookings, revenue and occupancy per audi as bar charts.",
        outcome: { label: "Export", value: "Download CSV using the Export button" },
      },
    ],
  },
  {
    id:    "admins",
    icon:  Users,
    color: "text-green-600",
    bg:    "bg-green-50",
    title: "Admin Management",
    items: [
      {
        icon: Users, iconBg: "bg-green-50", iconColor: "text-green-600",
        step: "Create",
        title: "Add a theater admin",
        desc:  "Admin Management → Add Admin → fill details → assign Theater Admin role → link to theater.",
        tags: ["Name", "Email", "Temp password", "Theater"],
      },
      {
        icon: ShieldCheck, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Roles",
        title: "Roles explained",
        tags: [
          "Theater Admin: manages 1 theater",
          "Super Admin: manages all theaters",
        ],
        desc: "Roles cannot be changed after creation. Create a new account if needed.",
      },
    ],
  },
  {
    id:    "crossbookings",
    icon:  CalendarCheck,
    color: "text-purple-600",
    bg:    "bg-purple-50",
    title: "Cross-Theater Bookings",
    items: [
      {
        icon: CalendarCheck, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "View",
        title: "All bookings across theaters",
        desc:  "Cross-Theater Bookings — filter by theater, audi, status, date.",
        outcome: { label: "Action", value: "Click a row to open the full booking detail page" },
      },
      {
        icon: BarChart3, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Analytics",
        title: "Platform Analytics",
        desc:  "Platform Analytics — compare revenue, bookings and occupancy across all theaters by date range.",
      },
    ],
  },
  {
    id:    "logs",
    icon:  ScrollText,
    color: "text-slate-600",
    bg:    "bg-slate-50",
    title: "Activity Logs",
    items: [
      {
        icon: ScrollText, iconBg: "bg-slate-50", iconColor: "text-slate-600",
        step: "Audit",
        title: "Track every admin action",
        desc:  "Activity Logs records every change — audi created, slot changed, booking accepted.",
        tags: ["Filter by admin", "Filter by action type", "Filter by date"],
      },
      {
        icon: AlertTriangle, iconBg: "bg-amber-50", iconColor: "text-amber-600",
        step: "Investigate",
        title: "Tracing an incident",
        desc:  "If a booking was wrongly cancelled or a price changed — find it here. Each entry shows: admin name, action, timestamp.",
        outcome: { label: "Use case", value: "Slot deleted unexpectedly → filter by 'slot' action to find who" },
      },
    ],
  },
]

// ─── Flow diagram ──────────────────────────────────────────────────────────────

function FlowDiagram({ flow }) {
  return (
    <div className="flex items-center gap-0 flex-wrap justify-center py-2">
      {flow.map((step, i) => {
        const Icon = step.icon
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm", step.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">{step.label}</span>
            </div>
            {i < flow.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-1 mb-4" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step card ─────────────────────────────────────────────────────────────────

function StepCard({ item }) {
  const Icon = item.icon
  return (
    <div className="rounded-xl border bg-card overflow-hidden hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4 p-4">
        {/* Icon + step label */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", item.iconBg)}>
            <Icon className={cn("h-5 w-5", item.iconColor)} />
          </div>
          {item.step && (
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{item.step}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="font-semibold text-sm leading-snug">{item.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>

          {/* Tags */}
          {item.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Outcome */}
          {item.outcome && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 border px-3 py-2">
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-medium text-muted-foreground">{item.outcome.label}: </span>
                <span className="text-foreground">{item.outcome.value}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tip bar */}
      {item.tip && (
        <div className="flex items-start gap-2 bg-amber-50 border-t border-amber-200 px-4 py-2.5 text-xs text-amber-700">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {item.tip}
        </div>
      )}
    </div>
  )
}

// ─── Search result ─────────────────────────────────────────────────────────────

function hl(text, q) {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i === -1) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

// ─── HelpGuide ────────────────────────────────────────────────────────────────

export default function HelpGuide() {
  const { role } = useAuth()
  const isSuperAdmin = role === "super-admin"
  const sections = isSuperAdmin ? SUPER_SECTIONS : THEATER_SECTIONS

  const [open,     setOpen]     = useState(false)
  const [query,    setQuery]    = useState("")
  const [activeId, setActiveId] = useState(sections[0]?.id)

  const allItems = useMemo(() =>
    sections.flatMap(s => s.items.map(item => ({ ...item, sectionTitle: s.title, sectionColor: s.color }))),
  [sections])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allItems.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.desc?.toLowerCase().includes(q) ||
      i.sectionTitle.toLowerCase().includes(q) ||
      i.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [query, allItems])

  const isSearching = !!query.trim()
  const selected = sections.find(s => s.id === activeId) ?? sections[0]
  const selectedIdx = sections.findIndex(s => s.id === (selected?.id))

  const handleOpen = () => { setOpen(true); setQuery(""); setActiveId(sections[0]?.id) }

  return (
    <>
      {/* Floating button */}
      <button type="button" onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-nfdc-primary text-white text-sm font-semibold shadow-lg hover:bg-nfdc-primary/90 active:scale-95 transition-all"
        aria-label="Help">
        <HelpCircle className="h-4 w-4" />
        Help
      </button>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setQuery("") }}>
        <DialogContent
          className="max-w-[98vw] sm:max-w-[92vw] lg:max-w-6xl xl:max-w-7xl w-full h-[95vh] sm:h-[90vh] p-0 gap-0 flex flex-col overflow-hidden rounded-none sm:rounded-2xl"
          aria-describedby={undefined}
        >
          {/* ── Top bar ── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b bg-background shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-nfdc-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5 text-nfdc-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-none">Help Center</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {isSuperAdmin ? "Super Admin — Platform Management" : "Theater Admin — Daily Operations"}
                </p>
              </div>
              <Badge variant="outline" className="hidden sm:flex text-[10px] capitalize shrink-0">
                {isSuperAdmin ? "Super Admin" : "Theater Admin"}
              </Badge>
            </div>
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search…" value={query} onChange={e => setQuery(e.target.value)}
                className="pl-8 h-9 text-sm" autoComplete="off" />
              {query && (
                <button type="button" onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Left nav */}
            <nav className={cn(
              "w-14 sm:w-56 lg:w-64 shrink-0 border-r flex flex-col py-2 overflow-y-auto bg-muted/20",
              isSearching && "pointer-events-none opacity-40"
            )}>
              {sections.map(s => {
                const Icon = s.icon
                const isActive = s.id === selected?.id && !isSearching
                return (
                  <button key={s.id} type="button"
                    onClick={() => { setActiveId(s.id); setQuery("") }}
                    className={cn(
                      "flex items-center gap-2.5 px-2 sm:px-3 py-2.5 mx-1.5 rounded-xl text-left transition-all text-sm",
                      isActive
                        ? "bg-background shadow-sm text-foreground font-medium border"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    )}
                  >
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", isActive ? s.bg : "bg-muted/60")}>
                      <Icon className={cn("h-3.5 w-3.5", isActive ? s.color : "text-muted-foreground")} />
                    </div>
                    <span className="hidden sm:block truncate">{s.title}</span>
                    {s.badge && <Badge className="hidden sm:flex ml-auto text-[9px] px-1 py-0 bg-nfdc-primary text-white shrink-0">{s.badge}</Badge>}
                  </button>
                )
              })}
            </nav>

            {/* Right content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

              {/* ── Search results ── */}
              {isSearching && (
                <>
                  <p className="text-xs text-muted-foreground font-medium">
                    {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
                  </p>
                  {results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                      <Search className="h-10 w-10 text-muted-foreground/20" />
                      <p className="text-sm font-medium">Nothing found</p>
                      <p className="text-xs text-muted-foreground">Try: &quot;slot&quot;, &quot;pricing&quot;, &quot;activate&quot;, &quot;booking&quot;</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {results.map((item, i) => (
                        <div key={i} className="rounded-xl border bg-card p-4 space-y-1.5">
                          <p className={cn("text-[10px] font-semibold uppercase tracking-wide", item.sectionColor)}>
                            {item.sectionTitle}
                          </p>
                          <p className="text-sm font-semibold">{hl(item.title, query)}</p>
                          {item.desc && <p className="text-xs text-muted-foreground leading-relaxed">{hl(item.desc, query)}</p>}
                          {item.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {item.tags.map((t, j) => (
                                <span key={j} className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{hl(t, query)}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Section content ── */}
              {!isSearching && selected && (
                <>
                  {/* Section header */}
                  <div className={cn("rounded-2xl p-4 border", selected.bg, "border-transparent")}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-xl bg-background/80 flex items-center justify-center shrink-0 shadow-sm">
                        <selected.icon className={cn("h-5 w-5", selected.color)} />
                      </div>
                      <div>
                        <p className="font-bold text-base leading-none">{selected.title}</p>
                        {selected.badge && (
                          <Badge className="mt-1 text-[10px] px-1.5 bg-nfdc-primary text-white">{selected.badge}</Badge>
                        )}
                      </div>
                    </div>

                    {/* Flow diagram */}
                    {selected.flow && <FlowDiagram flow={selected.flow} />}
                  </div>

                  {/* Step cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3">
                    {selected.items.map((item, i) => <StepCard key={i} item={item} />)}
                  </div>

                  {/* Prev / Next */}
                  <div className="flex items-center justify-between pt-1">
                    <button type="button"
                      onClick={() => selectedIdx > 0 && setActiveId(sections[selectedIdx - 1].id)}
                      disabled={selectedIdx === 0}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-1 transition-opacity">
                      ← Previous
                    </button>
                    <span className="text-xs text-muted-foreground">{selectedIdx + 1} / {sections.length}</span>
                    <button type="button"
                      onClick={() => selectedIdx < sections.length - 1 && setActiveId(sections[selectedIdx + 1].id)}
                      disabled={selectedIdx === sections.length - 1}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-1 transition-opacity">
                      Next →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="border-t px-5 py-2.5 shrink-0 flex items-center justify-between bg-muted/10">
            <p className="text-[11px] text-muted-foreground">
              Look for <strong>yellow tip boxes</strong> inside each topic for extra context.
            </p>
            <p className="text-[10px] text-muted-foreground hidden sm:block">NFDC Admin Help</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
