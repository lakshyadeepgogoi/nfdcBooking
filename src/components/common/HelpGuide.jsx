import { useState, useMemo } from "react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Building2, Tag, CalendarCheck, CheckCircle2,
  Clock, CalendarClock, Ban, HelpCircle, BookOpen,
  Lightbulb, Search, ChevronDown, ChevronRight,
  AlertTriangle, ArrowRight, Users, CreditCard,
  Settings2, Info,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Guide content ─────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id:    "setup",
    icon:  Building2,
    color: "text-blue-600",
    bg:    "bg-blue-50",
    border:"border-blue-200",
    label: "Getting Started",
    title: "Setting Up Your First Audi",
    summary:"Follow these 4 steps to make an audi ready for bookings.",
    steps: [
      {
        icon: Building2,
        title: "Create the Audi",
        desc:  "Go to Audis → Add Audi. Choose Fixed Slots (admin defines time windows like 'Morning 9–12') or Flexible Hours (customers pick start & end within your opening hours). You can change this later only by recreating the audi.",
        tip:   "Fixed mode is recommended for most theaters — it's easier for customers.",
      },
      {
        icon: Clock,
        title: "Add Time Slots (Fixed mode only)",
        desc:  "Go to Slots → select your audi → Add Slot. Each slot is a bookable time window (e.g. 08:00–12:00). Slots must not overlap and must fall within your audi's operational hours.",
        tip:   "The slot form auto-suggests the next free window. Overlapping slots are highlighted in red.",
      },
      {
        icon: Tag,
        title: "Set Up Pricing",
        desc:  "Go to Price Config → Audi tab → click Edit on your audi. Add an hourly-rate entry for each slot duration (e.g. 4 hours → ₹12,000 Govt / ₹18,000 Non-Govt). For services, go to the Service tab.",
        tip:   "The rate's duration must exactly match the slot's duration — otherwise the system charges ₹0.",
      },
      {
        icon: CheckCircle2,
        title: "Activate the Audi",
        desc:  "Go to Audis → open the audi → Setup tab. When all checklist items are green, click Activate. The audi now appears to customers. If the button is greyed out, the checklist has incomplete items.",
        tip:   "You can deactivate an audi at any time — existing confirmed bookings are not affected.",
      },
    ],
  },
  {
    id:    "bookings",
    icon:  CalendarCheck,
    color: "text-green-600",
    bg:    "bg-green-50",
    border:"border-green-200",
    label: "Daily Operations",
    title: "Managing Bookings",
    summary:"How to review, confirm and complete customer bookings.",
    steps: [
      {
        icon: CalendarCheck,
        title: "Review new bookings",
        desc:  "Go to Bookings. New bookings arrive with status Pending. Filter by Status = Pending to see what needs action. Click any row to open booking details.",
      },
      {
        icon: CheckCircle2,
        title: "Accept a booking",
        desc:  "Open a booking → Actions panel → Accept Booking. The customer receives an email with a payment link. The booking moves to Accepted until payment is confirmed.",
        tip:   "Accepting does not collect payment — it triggers the payment deadline timer.",
      },
      {
        icon: CalendarCheck,
        title: "Mark as Completed",
        desc:  "After the event finishes, open the booking → Mark Completed. This closes the booking record. If a security deposit was collected, use Refund Deposit to return it.",
        tip:   "Deposit refund is only available for Confirmed bookings via the Finance panel.",
      },
      {
        icon: CreditCard,
        title: "Create a Manual Booking",
        desc:  "For walk-in or cash customers, go to Bookings → Manual Booking. Select Offline Payment (enter cheque/DD reference) or Fee Waived (explain reason). Verify the customer's User ID first.",
      },
    ],
  },
  {
    id:    "pricing",
    icon:  Tag,
    color: "text-purple-600",
    bg:    "bg-purple-50",
    border:"border-purple-200",
    label: "Configuration",
    title: "Pricing & Policies",
    summary:"Configure rates, services and cancellation charges.",
    steps: [
      {
        icon: Tag,
        title: "Hourly rate table (Audi pricing)",
        desc:  "Go to Price Config → Audi tab. Each row = one duration with Govt and Non-Govt rates. For a 4-hour slot, add a row with Hours = 4. You can also add a security deposit per duration.",
        tip:   "All rates are in INR. GST is applied automatically based on the system tax rate.",
      },
      {
        icon: Settings2,
        title: "Service pricing",
        desc:  "Go to Price Config → Service tab. Services appear automatically once you've created them in the Services page. Set a flat rate for each. Mark services as Mandatory to always include them.",
      },
      {
        icon: Ban,
        title: "Cancellation charges",
        desc:  "Go to Price Config → Cancellation tab. Add slabs by day: e.g. Day 0–3 = 50% charge, Day 4–7 = 25% charge. The closer to the event, the higher the charge percentage.",
        tip:   "Cancellation & Postponement tabs are only visible when your theater has allowUserReschedule = ON.",
      },
    ],
  },
  {
    id:    "reschedule",
    icon:  CalendarClock,
    color: "text-indigo-600",
    bg:    "bg-indigo-50",
    border:"border-indigo-200",
    label: "Daily Operations",
    title: "Reschedule Management",
    summary:"Handle customer reschedule requests and propose date changes.",
    steps: [
      {
        icon: CalendarClock,
        title: "Customer reschedule requests",
        desc:  "When a customer requests a reschedule, it appears in Reschedule → Pending Review. Click Approve (the system prompts for extra payment if the new slot is pricier) or Reject (booking stays on original dates).",
      },
      {
        icon: ArrowRight,
        title: "Admin-initiated date change",
        desc:  "Click Propose New Dates → enter a Booking ID → search for the booking → choose Postpone or Prepone → pick a new date and slot from the availability calendar → submit. The customer is notified and must accept or reject.",
        tip:   "The calendar shows green (available), amber (partial) and red (fully booked) days automatically.",
      },
    ],
  },
  {
    id:    "blocks",
    icon:  Ban,
    color: "text-red-600",
    bg:    "bg-red-50",
    border:"border-red-200",
    label: "Configuration",
    title: "Blocking Dates & Times",
    summary:"Temporarily prevent bookings for maintenance, events or holidays.",
    steps: [
      {
        icon: Ban,
        title: "Create a block",
        desc:  "Go to Block Manager → select an audi → Add Block. Choose a date, then either Full Day (blocks all slots) or Partial (block a specific time window like 10:00–14:00). Add an optional reason — it's shown to admins in the booking form.",
      },
      {
        icon: CheckCircle2,
        title: "Remove a block",
        desc:  "Find the block in the list → ⋯ menu → Remove. The time window immediately becomes bookable again. Active bookings on that date are not affected.",
        tip:   "Blocks only affect NEW bookings. Existing confirmed bookings remain unchanged.",
      },
    ],
  },
  {
    id:    "services",
    icon:  Settings2,
    color: "text-teal-600",
    bg:    "bg-teal-50",
    border:"border-teal-200",
    label: "Configuration",
    title: "Services",
    summary:"Add additional services customers can select when booking.",
    steps: [
      {
        icon: Settings2,
        title: "Create a service",
        desc:  "Go to Services → select scope (specific audi or all audis) → Add Service. Give it a name and mark it Mandatory if it must always be included (e.g. Security Staff).",
      },
      {
        icon: Tag,
        title: "Set service pricing",
        desc:  "After creating the service, go to Price Config → Service tab. The service appears automatically. Click Edit and add a flat rate for Govt and Non-Govt customers.",
      },
    ],
  },
  {
    id:    "tips",
    icon:  Lightbulb,
    color: "text-amber-600",
    bg:    "bg-amber-50",
    border:"border-amber-200",
    label: "Tips",
    title: "Common Mistakes & Tips",
    summary:"Quick answers to the most frequent problems.",
    steps: [
      {
        icon: AlertTriangle,
        title: "The audi Activate button is greyed out",
        desc:  "Open the audi → Setup tab. Any red ✗ item must be completed first. Most common: missing Price Config or no active slots. Fix each item then try again.",
      },
      {
        icon: AlertTriangle,
        title: "Fee preview shows ₹0",
        desc:  "The hourly-rate table has no entry matching the slot's duration. Example: slot is 4h but the price config only has a 2h row. Add a 4h row with the correct rate.",
      },
      {
        icon: AlertTriangle,
        title: "Can only select 2 slots in Manual Booking",
        desc:  "Check the audi's Booking Rules → Multi-slot → Gap Between Slots. If it's 'Not allowed', slots must be consecutive with no time gap. Slots 1 & 2 may be consecutive but Slot 3 starts later (a gap exists).",
      },
      {
        icon: AlertTriangle,
        title: "Cancellation / Postponement tabs missing in Price Config",
        desc:  "These tabs only appear when your theater has allowUserReschedule turned ON. A Super Admin can enable this in the Theater settings.",
      },
      {
        icon: Lightbulb,
        title: "Check the inline hints (ℹ icons)",
        desc:  "Most pages have ℹ icons and yellow warning banners that explain exactly what's wrong or missing. Look for them before reaching out for support.",
      },
    ],
  },
]

const ALL_STEPS = SECTIONS.flatMap(s =>
  s.steps.map(step => ({ ...step, sectionId: s.id, sectionTitle: s.title, sectionColor: s.color, sectionBg: s.bg }))
)

// ─── Section component ─────────────────────────────────────────────────────────

function GuideSection({ section, defaultExpanded = false }) {
  const [open, setOpen] = useState(defaultExpanded)
  const Icon = section.icon

  return (
    <div className={cn("border rounded-xl overflow-hidden", section.border)}>
      {/* Header */}
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", section.bg)}>
          <Icon className={cn("h-4 w-4", section.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize font-normal">
              {section.label}
            </Badge>
          </div>
          <p className="font-semibold text-sm mt-0.5">{section.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{section.summary}</p>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
        }
      </button>

      {/* Steps */}
      {open && (
        <div className="border-t divide-y">
          {section.steps.map((step, i) => {
            const StepIcon = step.icon
            return (
              <div key={i} className="px-4 py-3.5 space-y-2">
                <div className="flex items-start gap-3">
                  <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", section.bg)}>
                    <StepIcon className={cn("h-3.5 w-3.5", section.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">{step.desc}</p>
                  </div>
                </div>
                {step.tip && (
                  <div className="ml-9 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                    <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" />
                    {step.tip}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Search result card ────────────────────────────────────────────────────────

function SearchResult({ step, query }) {
  const highlight = (text) => {
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <div className={cn("border rounded-xl p-4 space-y-1.5", step.sectionBg, "border-border")}>
      <p className={cn("text-[10px] font-semibold uppercase tracking-wide", step.sectionColor)}>
        {step.sectionTitle}
      </p>
      <p className="text-sm font-semibold">{highlight(step.title)}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{highlight(step.desc)}</p>
    </div>
  )
}

// ─── HelpGuide ────────────────────────────────────────────────────────────────

export default function HelpGuide() {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState("")

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return ALL_STEPS.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q)  ||
      s.sectionTitle.toLowerCase().includes(q)
    )
  }, [query])

  const showSearch = !!query.trim()

  return (
    <>
      {/* Floating help button */}
      <button type="button" onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-nfdc-primary text-white text-sm font-medium shadow-lg hover:bg-nfdc-primary/90 transition-all hover:scale-105"
        aria-label="Open help guide">
        <HelpCircle className="h-4 w-4" />
        Help
      </button>

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery("") }}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col p-0 gap-0">

          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0 space-y-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-nfdc-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5 text-nfdc-primary" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold">Admin Help Guide</SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Everything you need to run your theater</p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search — e.g. activate audi, pricing, slots..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
                autoComplete="off"
              />
            </div>
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

            {/* Search results */}
            {showSearch && (
              <>
                <p className="text-xs text-muted-foreground font-medium">
                  {results.length} result{results.length !== 1 ? "s" : ""} for &quot;{query}&quot;
                </p>
                {results.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <Search className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                    <p className="text-sm text-muted-foreground">No results found</p>
                    <p className="text-xs text-muted-foreground">Try different keywords like &quot;slot&quot;, &quot;pricing&quot; or &quot;activate&quot;</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {results.map((step, i) => (
                      <SearchResult key={i} step={step} query={query} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Full guide */}
            {!showSearch && (
              <>
                {/* Quick start banner */}
                <div className="rounded-xl border border-nfdc-primary/20 bg-nfdc-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-nfdc-primary shrink-0" />
                    <p className="text-sm font-semibold text-nfdc-primary">First time here?</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Start with <strong>Setting Up Your First Audi</strong> below. Once an audi is active, go to <strong>Managing Bookings</strong> for daily operations.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["Audi → Slots → Pricing → Activate → Accept bookings"].map((flow, i) => (
                      <span key={i} className="text-[11px] text-nfdc-primary font-medium flex items-center gap-1">
                        {flow.split(" → ").map((item, j, arr) => (
                          <span key={j} className="flex items-center gap-1">
                            <span className="px-2 py-0.5 rounded-md bg-nfdc-primary/10">{item}</span>
                            {j < arr.length - 1 && <ArrowRight className="h-3 w-3 opacity-50" />}
                          </span>
                        ))}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Category chips */}
                <div className="flex flex-wrap gap-1.5">
                  {["Getting Started", "Daily Operations", "Configuration", "Tips"].map(cat => (
                    <span key={cat} className="text-xs px-2.5 py-1 rounded-full border bg-background text-muted-foreground">
                      {cat}
                    </span>
                  ))}
                </div>

                {/* Sections */}
                {SECTIONS.map((s, i) => (
                  <GuideSection key={s.id} section={s} defaultExpanded={i === 0} />
                ))}

                <Separator />

                <div className="rounded-xl border bg-muted/30 p-4 text-center space-y-1">
                  <p className="text-xs font-medium">Still stuck?</p>
                  <p className="text-xs text-muted-foreground">
                    Check inline <strong>ℹ</strong> icons on any page, or visit the audi&apos;s <strong>Setup tab</strong> for a per-audi checklist.
                  </p>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
