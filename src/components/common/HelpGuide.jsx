import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Building2, Tag, CalendarCheck, CheckCircle2, Clock,
  CalendarClock, Ban, HelpCircle, BookOpen, Lightbulb,
  Search, AlertTriangle, ArrowRight, CreditCard, Settings2,
  BarChart3, Users, ScrollText, Globe, ShieldCheck, X,
  Zap, FileText, Power, ChevronRight, ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"

// ─── Theater Admin content ─────────────────────────────────────────────────────

const THEATER_SECTIONS = [
  {
    id:    "quickstart",
    icon:  Zap,
    color: "text-nfdc-primary",
    bg:    "bg-nfdc-primary/10",
    title: "Quick Start",
    badge: "Start Here",
    flow: [
      { icon: Building2, label: "Create Audi",  color: "bg-blue-500"   },
      { icon: Clock,     label: "Add Slots",    color: "bg-purple-500" },
      { icon: Tag,       label: "Set Pricing",  color: "bg-amber-500"  },
      { icon: Power,     label: "Activate",     color: "bg-green-500"  },
    ],
    items: [
      {
        icon: Building2, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Step 1", title: "Create an Audi",
        desc: "Add an audi and choose Fixed Slots (admin-defined time windows) or Flexible Hours (customer picks any start time).",
        tags: ["Fixed Slots", "Flexible Hours"],
        tip: "You cannot change the mode after creation.",
        link: "/admin/audis/create", linkLabel: "Create Audi",
      },
      {
        icon: Clock, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "Step 2", title: "Add Slots (Fixed only)",
        desc: "Add time windows for the audi. The form auto-suggests the next free slot and warns you of overlaps in real-time.",
        tags: ["08:00–12:00", "13:00–17:00"],
        tip: "Buffer time is automatically factored into free window suggestions.",
        link: "/admin/slots", linkLabel: "Manage Slots",
      },
      {
        icon: Tag, iconBg: "bg-amber-50", iconColor: "text-amber-600",
        step: "Step 3", title: "Configure Pricing",
        desc: "Add one hourly-rate row per slot duration (e.g. 4h → ₹12,000 Govt / ₹18,000 Non-Govt). Duration must match your slot exactly.",
        tags: ["4h → ₹12,000 Govt", "4h → ₹18,000 Non-Govt"],
        tip: "If the duration doesn't match, the fee preview shows ₹0.",
        link: "/admin/pricing", linkLabel: "Price Config",
      },
      {
        icon: Power, iconBg: "bg-green-50", iconColor: "text-green-600",
        step: "Step 4", title: "Activate the Audi",
        desc: "Open the audi → Setup tab. When all checklist items are green the Activate button becomes available.",
        tip: "Deactivating doesn't cancel existing confirmed bookings.",
        link: "/admin/audis", linkLabel: "Go to Audis",
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
        desc:  "New bookings arrive as Pending. Open one → Accept. The customer receives a payment email and the deadline timer starts.",
        tip:   "Accepting doesn't collect payment — it only starts the payment clock.",
        link: "/admin/bookings", linkLabel: "View Bookings",
      },
      {
        icon: CheckCircle2, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "After event",
        title: "Mark as Completed",
        desc:  "Open the booking → Mark Completed. Then use Finance panel → Refund Deposit if a deposit was collected.",
        link: "/admin/bookings", linkLabel: "View Bookings",
      },
      {
        icon: CreditCard, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "Walk-in",
        title: "Manual Booking",
        desc:  "For walk-in customers go to Manual Booking. Verify User ID first, then choose Offline Payment or Fee Waived.",
        link: "/admin/bookings/manual", linkLabel: "Manual Booking",
      },
      {
        icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-600",
        step: "Cancel",
        title: "Cancel a booking",
        desc:  "Open booking → Cancel Booking. Cancellation charges apply per your policy. Cannot be undone.",
        tip:  "Confirm carefully — cancellation is permanent.",
        link: "/admin/bookings", linkLabel: "View Bookings",
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
        desc:  "Price Config → Audi tab → Edit. Add one row per slot duration with Govt and Non-Govt rates.",
        tip:  "GST is added automatically — don't include it in the rate.",
        link: "/admin/pricing", linkLabel: "Audi Pricing",
      },
      {
        icon: FileText, iconBg: "bg-amber-50", iconColor: "text-amber-600",
        step: "Security deposit",
        title: "Add a security deposit",
        desc:  "Inside each rate row, enable a deposit — Fixed amount or % of total. Customer pays upfront, refunded after event.",
        link: "/admin/pricing", linkLabel: "Price Config",
      },
      {
        icon: Settings2, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Services",
        title: "Service pricing",
        desc:  "Price Config → Service tab. Services appear once created. Set flat rate. Mark Mandatory to always include.",
        link: "/admin/pricing", linkLabel: "Service Pricing",
      },
      {
        icon: Ban, iconBg: "bg-red-50", iconColor: "text-red-600",
        step: "Policy",
        title: "Cancellation charges",
        desc:  "Price Config → Cancellation tab. Add slabs: e.g. 0–3 days = 50%, 4–7 days = 25%. Only visible when reschedule is ON.",
        link: "/admin/pricing", linkLabel: "Cancellation Policy",
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
        title: "Customer reschedule requests",
        desc:  "Reschedule → Pending Review. Approve (sends payment link if extra cost) or Reject (original dates kept).",
        link: "/admin/reschedule", linkLabel: "Reschedule Tab",
      },
      {
        icon: ArrowRight, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "Admin",
        title: "Propose new dates",
        desc:  "Click Propose New Dates → enter Booking ID → pick Postpone or Prepone → select from the availability calendar.",
        tip:  "🟢 Free · 🟡 Partial · 🔴 Full. Customer must Accept or Reject.",
        link: "/admin/reschedule", linkLabel: "Reschedule Tab",
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
        desc:  "Block Manager → select audi → Add Block → Full Day or Partial (e.g. 10:00–14:00). Add an optional reason.",
        tip:  "Blocks don't affect existing confirmed bookings.",
        link: "/admin/blocks", linkLabel: "Block Manager",
      },
      {
        icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-600",
        step: "Remove",
        title: "Remove a block",
        desc:  "Find the block → ⋯ → Remove. The slot becomes bookable immediately.",
        link: "/admin/blocks", linkLabel: "Block Manager",
      },
    ],
  },
  {
    id:    "services",
    icon:  Settings2,
    color: "text-teal-600",
    bg:    "bg-teal-50",
    title: "Services",
    items: [
      {
        icon: Settings2, iconBg: "bg-teal-50", iconColor: "text-teal-600",
        step: "Create",
        title: "Add a service",
        desc:  "Services → select scope (theater-wide or specific audi) → Add Service. Services start inactive — set pricing first.",
        link: "/admin/services", linkLabel: "Services Page",
      },
      {
        icon: Tag, iconBg: "bg-amber-50", iconColor: "text-amber-600",
        step: "Pricing",
        title: "Set service pricing then activate",
        desc:  "Go to Price Config → Service tab → Edit the service. Once pricing is set, go back and activate the service.",
        link: "/admin/pricing", linkLabel: "Service Pricing",
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
        title: "Activate button greyed out",
        desc:  "Audi → Setup tab. Fix every amber ✗ item. Most common: no Price Config or no active slots.",
        link: "/admin/audis", linkLabel: "Check Audis",
      },
      {
        icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-600",
        step: "Issue",
        title: "Fee preview shows ₹0",
        desc:  "Price Config → Audi → Edit → add a rate row whose duration matches your slot exactly (e.g. slot is 4h → add 4h row).",
        link: "/admin/pricing", linkLabel: "Fix Pricing",
      },
      {
        icon: AlertTriangle, iconBg: "bg-orange-50", iconColor: "text-orange-600",
        step: "Issue",
        title: "Can only select 2 slots in Manual Booking",
        desc:  "Slots have a time gap. With 'Consecutive only' setting, slots must be adjacent. Select slot 1 then the slot directly after it.",
        link: "/admin/bookings/manual", linkLabel: "Manual Booking",
      },
      {
        icon: AlertTriangle, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Issue",
        title: "Reschedule tab missing",
        desc:  "allowUserReschedule is OFF. Contact your Super Admin to enable it in Theater Settings → Config.",
        link: "/admin/theater-settings", linkLabel: "Theater Settings",
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
      { icon: Building2, label: "Create Theater", color: "bg-blue-500"   },
      { icon: Users,     label: "Assign Admin",  color: "bg-purple-500" },
      { icon: Settings2, label: "Configure",     color: "bg-amber-500"  },
      { icon: BarChart3, label: "Monitor",       color: "bg-green-500"  },
    ],
    items: [
      {
        icon: Globe, iconBg: "bg-nfdc-primary/10", iconColor: "text-nfdc-primary",
        step: "Role",
        title: "Super Admin can",
        desc:  "Create and manage all theaters, assign theater admins, view bookings across all theaters, and access platform analytics.",
        link: "/super/dashboard", linkLabel: "Platform Dashboard",
      },
      {
        icon: Building2, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Step 1",
        title: "Create a Theater",
        desc:  "Go to Theaters → Add Theater. Fill Info (name, address, MID), Facilities, Images, T&C, then Config tab.",
        link: "/super/theaters", linkLabel: "Manage Theaters",
      },
      {
        icon: Users, iconBg: "bg-purple-50", iconColor: "text-purple-600",
        step: "Step 2",
        title: "Assign an Admin",
        desc:  "Admin Management → Add Admin → Theater Admin role → link to theater. One theater can have multiple admins.",
        tip:  "Roles cannot be changed after creation.",
        link: "/super/admins", linkLabel: "Admin Management",
      },
      {
        icon: ShieldCheck, iconBg: "bg-green-50", iconColor: "text-green-600",
        step: "Config",
        title: "Enable Reschedule",
        desc:  "Theater Detail → Config tab → toggle User-initiated Reschedule ON. This unlocks the Reschedule tab and cancellation policies.",
        link: "/super/theaters", linkLabel: "Theater Config",
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
        step: "Setup",
        title: "Theater detail tabs",
        desc:  "Info · Facilities · Images · T&C · Config — save each tab separately. Config holds allowUserReschedule toggle.",
        link: "/super/theaters", linkLabel: "Theaters",
      },
      {
        icon: FileText, iconBg: "bg-amber-50", iconColor: "text-amber-600",
        step: "T&C",
        title: "Publish T&C",
        desc:  "T&C tab → write in the rich editor → Save Draft → Publish. Each publish increments the version.",
        link: "/super/theaters", linkLabel: "Theaters",
      },
      {
        icon: BarChart3, iconBg: "bg-green-50", iconColor: "text-green-600",
        step: "Analytics",
        title: "Per-audi performance",
        desc:  "Theater Detail → select a date → see bookings, revenue, occupancy bar charts per audi. Export CSV available.",
        link: "/super/theaters", linkLabel: "Theaters",
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
        desc:  "Admin Management → Add Admin → fill details → Theater Admin role → link to theater.",
        link: "/super/admins", linkLabel: "Manage Admins",
      },
      {
        icon: ShieldCheck, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Roles",
        title: "Theater Admin vs Super Admin",
        desc:  "Theater Admin manages one theater. Super Admin manages the entire platform. Roles cannot change after creation.",
        link: "/super/admins", linkLabel: "Manage Admins",
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
        desc:  "Filter by theater, audi, status, date. Click a row to open the full booking detail page.",
        link: "/super/bookings", linkLabel: "Cross-Theater Bookings",
      },
      {
        icon: BarChart3, iconBg: "bg-blue-50", iconColor: "text-blue-600",
        step: "Analytics",
        title: "Platform Analytics",
        desc:  "Compare revenue, bookings and occupancy across all theaters by date range.",
        link: "/super/analytics", linkLabel: "Platform Analytics",
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
        desc:  "Every change (audi created, slot changed, booking accepted) is logged here. Filter by action type, admin, or date.",
        link: "/super/logs", linkLabel: "Activity Logs",
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

function StepCard({ item, onNavigate }) {
  const Icon = item.icon
  return (
    <div className="rounded-xl border bg-card overflow-hidden hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4 p-4">
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", item.iconBg)}>
            <Icon className={cn("h-5 w-5", item.iconColor)} />
          </div>
          {item.step && (
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{item.step}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <p className="font-semibold text-sm leading-snug">{item.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
          {item.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {item.note && (
            <p className="text-xs text-muted-foreground italic">{item.note}</p>
          )}
          {item.outcome && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 border px-3 py-2">
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs"><span className="font-medium text-muted-foreground">{item.outcome.label}: </span>{item.outcome.value}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: tip + navigate */}
      <div className={cn(
        "flex items-center justify-between gap-2 px-4 py-2 border-t",
        item.tip ? "bg-amber-50/50" : "bg-muted/10"
      )}>
        <div className="flex-1 min-w-0">
          {item.tip && (
            <p className="text-xs text-amber-700 flex items-start gap-1.5">
              <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" />
              {item.tip}
            </p>
          )}
        </div>
        {item.link && (
          <Button size="sm" variant="outline"
            className="h-7 text-[11px] px-2.5 shrink-0 gap-1 hover:bg-nfdc-primary/5 hover:border-nfdc-primary/40 hover:text-nfdc-primary"
            onClick={() => onNavigate(item.link)}
          >
            {item.linkLabel ?? "Go there"}
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
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
  const navigate  = useNavigate()
  const isSuperAdmin = role === "super-admin"
  const sections = isSuperAdmin ? SUPER_SECTIONS : THEATER_SECTIONS

  const [open,     setOpen]     = useState(false)
  const [query,    setQuery]    = useState("")
  const [activeId, setActiveId] = useState(sections[0]?.id)

  const allItems = useMemo(() =>
    sections.flatMap(s => s.items.map(item => ({ ...item, sectionId: s.id, sectionTitle: s.title, sectionColor: s.color }))),
  [sections])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allItems.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.desc?.toLowerCase().includes(q)  ||
      i.sectionTitle.toLowerCase().includes(q) ||
      i.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [query, allItems])

  const isSearching = !!query.trim()
  const selected    = sections.find(s => s.id === activeId) ?? sections[0]
  const selectedIdx = sections.findIndex(s => s.id === (selected?.id))

  const handleOpen = () => { setOpen(true); setQuery(""); setActiveId(sections[0]?.id) }

  const handleNavigate = (path) => {
    setOpen(false)
    setQuery("")
    navigate(path)
  }

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
          className="w-full h-full max-w-[98vw] max-h-[98vh] sm:max-w-[90vw] sm:max-h-[90vh] lg:max-w-5xl xl:max-w-6xl p-0 gap-0 flex flex-col overflow-hidden rounded-none sm:rounded-2xl"
          aria-describedby={undefined}
        >
          {/* Top bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b bg-background shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-nfdc-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5 text-nfdc-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-none">Help Center</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {isSuperAdmin ? "Super Admin — platform management" : "Theater Admin — click any step to go there"}
                </p>
              </div>
              <Badge variant="outline" className="hidden sm:flex text-[10px] capitalize shrink-0">
                {isSuperAdmin ? "Super Admin" : "Theater Admin"}
              </Badge>
            </div>
            <div className="relative w-full sm:w-56 lg:w-72 shrink-0">
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

          {/* Body */}
          <div className="flex flex-1 min-h-0">

            {/* Left nav */}
            <nav className={cn(
              "w-12 sm:w-48 lg:w-56 xl:w-60 shrink-0 border-r flex flex-col py-2 overflow-y-auto bg-muted/20",
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

              {/* Search results */}
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
                        <div key={i} className="rounded-xl border bg-card overflow-hidden">
                          <div className="px-4 pt-3 pb-2">
                            <p className={cn("text-[10px] font-semibold uppercase tracking-wide mb-1", item.sectionColor)}>
                              {item.sectionTitle}
                            </p>
                            <p className="text-sm font-semibold">{hl(item.title, query)}</p>
                            {item.desc && <p className="text-xs text-muted-foreground leading-relaxed mt-1">{hl(item.desc, query)}</p>}
                          </div>
                          {item.link && (
                            <div className="px-4 py-2 border-t bg-muted/10">
                              <Button size="sm" variant="outline"
                                className="h-7 text-[11px] px-2.5 gap-1 hover:bg-nfdc-primary/5 hover:border-nfdc-primary/40 hover:text-nfdc-primary"
                                onClick={() => handleNavigate(item.link)}>
                                {item.linkLabel ?? "Go there"}
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Section content */}
              {!isSearching && selected && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", selected.bg)}>
                      <selected.icon className={cn("h-5 w-5", selected.color)} />
                    </div>
                    <div>
                      <h2 className="font-bold text-base">{selected.title}</h2>
                      {selected.badge && (
                        <Badge className="mt-1 text-[10px] px-1.5 bg-nfdc-primary text-white">{selected.badge}</Badge>
                      )}
                    </div>
                  </div>

                  {selected.flow && <FlowDiagram flow={selected.flow} />}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {selected.items.map((item, i) => (
                      <StepCard key={i} item={item} onNavigate={handleNavigate} />
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button type="button"
                      onClick={() => selectedIdx > 0 && setActiveId(sections[selectedIdx - 1].id)}
                      disabled={selectedIdx === 0}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-opacity">
                      ← Previous
                    </button>
                    <p className="text-xs text-muted-foreground">{selectedIdx + 1} / {sections.length}</p>
                    <button type="button"
                      onClick={() => selectedIdx < sections.length - 1 && setActiveId(sections[selectedIdx + 1].id)}
                      disabled={selectedIdx === sections.length - 1}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-opacity">
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t px-5 py-2.5 shrink-0 flex items-center justify-between bg-muted/10">
            <p className="text-[11px] text-muted-foreground">
              Click <strong className="text-foreground">Go there</strong> on any step to navigate directly.
            </p>
            <p className="text-[10px] text-muted-foreground hidden sm:block">NFDC Admin Help</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
