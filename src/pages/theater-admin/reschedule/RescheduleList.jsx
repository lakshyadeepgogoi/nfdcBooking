import { useEffect, useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  CheckCircle2, XCircle, CalendarClock, ArrowRight, Loader2,
  Building2, Clock, Info, AlertCircle, ChevronLeft, ChevronRight,
} from "lucide-react"
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isBefore, isAfter, addMonths, subMonths, startOfDay,
} from "date-fns"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Form, FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import EmptyState from "@/components/common/EmptyState"
import StatusBadge from "@/components/common/StatusBadge"
import FormInput from "@/components/forms/FormInput"
import FormTextarea from "@/components/forms/FormTextarea"
import { listBookings, getBooking, updateBookingStatus } from "@/api/bookings"
import { getAdminAudi } from "@/api/audi"
import { getAudiCalendar } from "@/api/availability"
import { listSlots } from "@/api/slots"
import { parseList } from "@/utils/parseList"
import { toAPIDate } from "@/utils/formatDate"
import { formatINR } from "@/utils/formatCurrency"
import { cn } from "@/lib/utils"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—"
  try { return format(new Date(d), "dd MMM yyyy") } catch { return String(d) }
}

function fmtRange(s, e) {
  if (!s && !e) return "—"
  return `${s ?? "?"} – ${e ?? "?"}`
}

function getInitials(name) {
  if (!name) return "?"
  return name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?"
}

// ─── Schema ────────────────────────────────────────────────────────────────────

const postponeSchema = z.object({
  action:    z.enum(["postpone", "prepone"]),
  date:      z.date({ required_error: "Select a date" }),
  startTime: z.string().min(1, "Required"),
  endTime:   z.string().min(1, "Required"),
  note:      z.string().optional(),
})

// ─── ScheduleBlock ─────────────────────────────────────────────────────────────

function ScheduleBlock({ label, date, startTime, endTime, highlight }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold truncate ${highlight ? "text-nfdc-primary" : "text-foreground"}`}>
        {fmtDate(date)}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">{fmtRange(startTime, endTime)}</p>
    </div>
  )
}

// ─── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, colorClass = "bg-nfdc-primary/10 text-nfdc-primary" }) {
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${colorClass}`}>
      {getInitials(name)}
    </div>
  )
}

// ─── RescheduleCard (user-initiated, pending admin action) ─────────────────────

function RescheduleCard({ booking, onApprove, onReject }) {
  const proposed  = booking?.proposedChange
  const priceDiff = proposed?.priceDiff ?? 0
  const bd        = booking?.bookingDetails ?? {}
  const userName  = booking?.relationships?.userName ?? booking?.user?.name ?? booking?.user?.email
  const audiName  = booking?.relationships?.audiName  ?? booking?.audi?.name
  const note      = booking?.note ?? proposed?.note

  return (
    <Card className="border-l-4 border-l-orange-400 hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5 space-y-4">

        {/* Header — avatar + meta */}
        <div className="flex items-start gap-3">
          <Avatar name={userName} colorClass="bg-orange-100 text-orange-700" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{userName ?? "—"}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">{audiName ?? "—"}</span>
                </div>
              </div>
              <StatusBadge status={booking?.lifecycle?.status} />
            </div>
            <p className="font-mono text-[11px] text-muted-foreground/70 mt-1">{booking?.bookingId}</p>
          </div>
        </div>

        {/* Schedule comparison */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 grid grid-cols-[1fr_32px_1fr] gap-2 items-center">
          <ScheduleBlock
            label="Current"
            date={bd.date ?? booking?.date}
            startTime={bd.startTime ?? booking?.startTime}
            endTime={bd.endTime ?? booking?.endTime}
          />
          <div className="flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <ScheduleBlock
            label="Proposed"
            date={proposed?.date}
            startTime={proposed?.startTime}
            endTime={proposed?.endTime}
            highlight
          />
        </div>

        {/* Price diff notice */}
        {priceDiff > 0 && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-200">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Approval requires <strong>{formatINR(priceDiff)}</strong> additional payment from user.</span>
          </div>
        )}

        {/* User note */}
        {note && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border">
            <span className="italic">&quot;{note}&quot;</span>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/50"
            onClick={() => onReject(booking)}
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-nfdc-primary hover:bg-nfdc-primary/90"
            onClick={() => onApprove(booking)}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
          </Button>
        </div>

      </CardContent>
    </Card>
  )
}

// ─── InProgressCard (admin-initiated or awaiting payment) ──────────────────────

const IN_PROGRESS_CONFIG = {
  postponed: {
    border:    "border-l-indigo-400",
    avatar:    "bg-indigo-100 text-indigo-700",
    msgIcon:   Clock,
    msgClass:  "bg-indigo-50 text-indigo-700 border-indigo-200",
    msg:       "Waiting for user to accept or reject the proposed dates.",
  },
  preponed: {
    border:    "border-l-indigo-400",
    avatar:    "bg-indigo-100 text-indigo-700",
    msgIcon:   Clock,
    msgClass:  "bg-indigo-50 text-indigo-700 border-indigo-200",
    msg:       "Waiting for user to accept or reject the proposed dates.",
  },
  awaiting_reschedule_payment: {
    border:    "border-l-amber-400",
    avatar:    "bg-amber-100 text-amber-700",
    msgIcon:   AlertCircle,
    msgClass:  "bg-amber-50 text-amber-700 border-amber-200",
    msg:       null,
  },
}

function InProgressCard({ booking }) {
  const status    = booking?.lifecycle?.status
  const proposed  = booking?.proposedChange
  const bd        = booking?.bookingDetails ?? {}
  const userName  = booking?.relationships?.userName ?? booking?.user?.name ?? booking?.user?.email
  const audiName  = booking?.relationships?.audiName  ?? booking?.audi?.name

  const cfg = IN_PROGRESS_CONFIG[status] ?? {
    border: "border-l-slate-300",
    avatar: "bg-slate-100 text-slate-600",
    msgIcon: Clock,
    msgClass: "bg-muted text-muted-foreground border-border",
    msg: "Pending action.",
  }

  const waitMsg = cfg.msg
    ?? `Waiting for user to pay ${formatINR(booking?.pricing?.rescheduleAmount ?? 0)} reschedule fee.`

  const MsgIcon = cfg.msgIcon

  return (
    <Card className={`border-l-4 ${cfg.border} hover:shadow-md transition-shadow duration-200`}>
      <CardContent className="p-5 space-y-4">

        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar name={userName} colorClass={cfg.avatar} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{userName ?? "—"}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">{audiName ?? "—"}</span>
                </div>
              </div>
              <StatusBadge status={status} />
            </div>
            <p className="font-mono text-[11px] text-muted-foreground/70 mt-1">{booking?.bookingId}</p>
          </div>
        </div>

        {/* Schedule comparison */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 grid grid-cols-[1fr_32px_1fr] gap-2 items-center">
          <ScheduleBlock
            label="Original"
            date={bd.date ?? booking?.date}
            startTime={bd.startTime ?? booking?.startTime}
            endTime={bd.endTime ?? booking?.endTime}
          />
          <div className="flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <ScheduleBlock
            label="Proposed"
            date={proposed?.date}
            startTime={proposed?.startTime}
            endTime={proposed?.endTime}
            highlight
          />
        </div>

        {/* Wait message */}
        <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 border ${cfg.msgClass}`}>
          <MsgIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{waitMsg}</span>
        </div>

      </CardContent>
    </Card>
  )
}

// ─── Card skeleton ─────────────────────────────────────────────────────────────

function CardSkeleton({ rows = 3 }) {
  return (
    <Card className="border-l-4 border-l-border">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
        {rows > 2 && <Skeleton className="h-9 w-full rounded-md" />}
      </CardContent>
    </Card>
  )
}

// ─── ApproveDialog ─────────────────────────────────────────────────────────────

function ApproveDialog({ target, onClose }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState("")
  const priceDiff = target?.proposedChange?.priceDiff ?? 0

  useEffect(() => { if (!target) setNote("") }, [target])

  const mutation = useMutation({
    mutationFn: () => updateBookingStatus(target.bookingId, {
      action: "approve_reschedule",
      note:   note.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success(priceDiff > 0
        ? "Approved — user will be prompted to pay the difference"
        : "Reschedule approved and dates updated"
      )
      queryClient.invalidateQueries({ queryKey: ["reschedule"] })
      onClose()
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Approve Reschedule Request?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {priceDiff > 0 ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
              <p className="text-sm font-semibold text-amber-800">Payment required</p>
              <p className="text-xs text-amber-700">
                User will need to pay <strong>{formatINR(priceDiff)}</strong> to confirm the new dates.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              The booking will be updated to the proposed dates immediately. No extra payment needed.
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="Message to the user…"
              rows={2}
              className="resize-none text-sm"
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-nfdc-primary hover:bg-nfdc-primary/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── RejectDialog ──────────────────────────────────────────────────────────────

function RejectDialog({ target, onClose }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState("")

  useEffect(() => { if (!target) setNote("") }, [target])

  const mutation = useMutation({
    mutationFn: () => updateBookingStatus(target.bookingId, {
      action: "reject_reschedule",
      note:   note.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success("Reschedule request rejected — booking stays on original dates")
      queryClient.invalidateQueries({ queryKey: ["reschedule"] })
      onClose()
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Reject Reschedule Request?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            The booking will remain on its original dates. The user will be notified.
          </p>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Reason <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="Why is this request being rejected?"
              rows={3}
              className="resize-none text-sm"
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reject Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Availability calendar constants ──────────────────────────────────────────

const DAY_LABELS    = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const toMins   = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
const fromMins = m => `${String(Math.floor(m / 60)).padStart(2,"0")}:${String(m % 60).padStart(2,"0")}`

const CAL_CELL = {
  available:    "hover:bg-emerald-50",
  partial:      "bg-amber-50/80 hover:bg-amber-100",
  fully_booked: "bg-red-50",
  blocked:      "bg-red-100",
  locked:       "bg-slate-100",
}
const CAL_DOT = {
  available:    "bg-emerald-500",
  partial:      "bg-amber-500",
  fully_booked: "bg-red-500",
  blocked:      "bg-red-700",
  locked:       "bg-slate-400",
}
const SLOT_COLORS = {
  available: { text: "text-emerald-700", label: "Available"   },
  booked:    { text: "text-red-700",     label: "Booked"      },
  blocked:   { text: "text-orange-700",  label: "Blocked"     },
  locked:    { text: "text-slate-500",   label: "Locked"      },
}

// ─── PostponeDialog ────────────────────────────────────────────────────────────

function PostponeDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient()

  const [rawId,         setRawId]         = useState("")
  const [booking,       setBooking]       = useState(null)
  const [fetching,      setFetching]      = useState(false)
  const [currentMonth,  setCurrentMonth]  = useState(new Date())
  const [selectedDate,  setSelectedDate]  = useState(null)
  const [selectedSlotId, setSelectedSlotId] = useState(null)

  const form = useForm({
    resolver:      zodResolver(postponeSchema),
    defaultValues: { action: "postpone", date: undefined, startTime: "", endTime: "", note: "" },
  })

  const watchedAction    = form.watch("action")
  const watchedStartTime = form.watch("startTime") ?? ""
  const watchedEndTime   = form.watch("endTime")   ?? ""

  // Derived booking fields
  const audiId  = booking?.relationships?.audiId
  const monthStr = format(currentMonth, "yyyy-MM")
  const dateStr  = selectedDate ? toAPIDate(selectedDate) : null

  // ── Audi config ────────────────────────────────────────────────────────────
  const { data: audiRaw } = useQuery({
    queryKey: ["audi-admin", audiId],
    queryFn:  () => getAdminAudi(audiId).then(r => r.data.data),
    enabled:  !!audiId,
    staleTime: 60_000,
  })
  const audi      = audiRaw?.audi ?? audiRaw
  const mode      = audi?.config?.slotMode
  const opStart   = audi?.config?.operationalHours?.start ?? ""
  const opEnd     = audi?.config?.operationalHours?.end   ?? ""
  const durations = audi?.config?.bookingDurations ?? []
  const opStartMins = opStart ? toMins(opStart) : 0
  const opEndMins   = opEnd   ? toMins(opEnd)   : 24 * 60

  // ── Calendar availability ──────────────────────────────────────────────────
  const { data: calData } = useQuery({
    queryKey: ["audi-calendar", audiId, monthStr],
    queryFn:  () => getAudiCalendar(audiId, monthStr).then(r => r.data.data),
    enabled:  !!audiId,
    staleTime: 60_000,
  })
  const calendar = calData?.calendar ?? {}
  const dayData  = dateStr ? (calendar[dateStr] ?? null) : null

  // ── Slots (fixed mode) ─────────────────────────────────────────────────────
  const { data: slotsRaw } = useQuery({
    queryKey: ["slots", audiId],
    queryFn:  () => listSlots(audiId).then(r => {
      const raw = r.data.data
      return Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
    }),
    enabled:  !!audiId && mode === "fixed",
    staleTime: 60_000,
  })
  const activeSlots = (Array.isArray(slotsRaw?.data) ? slotsRaw.data : Array.isArray(slotsRaw) ? slotsRaw : [])
    .filter(s => s.lifecycle?.status === "active")

  // ── Booked windows + free windows (flexible mode) ─────────────────────────
  const bookedWindows = useMemo(() => {
    const bw = dayData?.bookedWindows ?? []
    return bw.map(w => ({ start: toMins(w.startTime), end: toMins(w.endTime) }))
              .sort((a, b) => a.start - b.start)
  }, [dayData])

  const availableWindows = useMemo(() => {
    if (!dateStr) return []
    const windows = []; let cursor = opStartMins
    for (const bw of bookedWindows) {
      if (cursor < bw.start) windows.push({ start: cursor, end: bw.start })
      cursor = Math.max(cursor, bw.end)
    }
    if (cursor < opEndMins) windows.push({ start: cursor, end: opEndMins })
    return windows
  }, [dateStr, bookedWindows, opStartMins, opEndMins])

  const isSlotFree = (startT, durationH) => {
    if (!startT) return false
    const sMin = toMins(startT), eMin = sMin + durationH * 60
    if (eMin > opEndMins) return false
    return !bookedWindows.some(bw => sMin < bw.end && eMin > bw.start)
  }

  const activeDuration = durations.find(d =>
    watchedStartTime && watchedEndTime &&
    toMins(watchedStartTime) + d * 60 === toMins(watchedEndTime)
  ) ?? null

  // ── Auto-set start time when date changes (flexible) ──────────────────────
  useEffect(() => {
    if (mode !== "flexible" || !dateStr || !availableWindows.length) return
    if (!form.getValues("startTime") && availableWindows[0]) {
      form.setValue("startTime", fromMins(availableWindows[0].start), { shouldValidate: false })
    }
  }, [dateStr, availableWindows, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calendar display ───────────────────────────────────────────────────────
  const monthStart   = startOfMonth(currentMonth)
  const monthEnd     = endOfMonth(currentMonth)
  const days         = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart)
  const todayStart  = startOfDay(new Date())
  const bookingDate = booking?.bookingDetails?.date
    ? startOfDay(new Date(booking.bookingDetails.date))
    : null

  // Direction-specific guard: postpone → must be after booking date
  //                           prepone  → must be >= today AND before booking date
  const isDayDisabled = (day) => {
    if (isBefore(day, todayStart)) return true
    if (!bookingDate) return false
    if (watchedAction === "postpone") return !isAfter(day, bookingDate)
    if (watchedAction === "prepone")  return !isBefore(day, bookingDate)
    return false
  }

  const handleDayClick = (day) => {
    if (isDayDisabled(day)) return
    setSelectedDate(day)
    setSelectedSlotId(null)
    form.setValue("date",      day, { shouldValidate: true })
    form.setValue("startTime", "",  { shouldValidate: false })
    form.setValue("endTime",   "",  { shouldValidate: false })
  }

  const handleSlotSelect = (slot) => {
    setSelectedSlotId(slot.slotId ?? slot._id)
    form.setValue("startTime", slot.config?.startTime ?? "", { shouldValidate: true })
    form.setValue("endTime",   slot.config?.endTime   ?? "", { shouldValidate: true })
  }

  const getSlotStatus = (slot) => {
    if (!dayData?.slots) return null
    return dayData.slots.find(ds => ds.slotId === (slot.slotId ?? slot._id))?.status ?? null
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleClose = () => {
    setRawId(""); setBooking(null); setSelectedDate(null)
    setSelectedSlotId(null); setCurrentMonth(new Date())
    form.reset(); onOpenChange(false)
  }

  const handleFetch = async () => {
    const id = rawId.trim()
    if (!id) return
    setFetching(true); setBooking(null)
    try {
      const r = await getBooking(id)
      const raw = r.data.data ?? r.data
      setBooking(raw?.booking ?? raw)
      form.reset({ action: "postpone", date: undefined, startTime: "", endTime: "", note: "" })
    } catch { toast.error("Booking not found or access denied") }
    finally { setFetching(false) }
  }

  const mutation = useMutation({
    mutationFn: (values) => updateBookingStatus(booking.bookingId, {
      action:    values.action,
      date:      toAPIDate(values.date),
      startTime: values.startTime,
      endTime:   values.endTime,
      note:      values.note || undefined,
    }),
    onSuccess: () => {
      toast.success("New dates proposed — user will be notified")
      queryClient.invalidateQueries({ queryKey: ["reschedule"] })
      handleClose()
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  const bUserName = booking?.relationships?.userName ?? booking?.user?.name ?? booking?.user?.email
  const bAudiName = booking?.relationships?.audiName ?? booking?.audi?.name

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] flex flex-col" aria-describedby={undefined}>
        <DialogHeader className="shrink-0">
          <DialogTitle>Propose New Dates</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">

          {/* Booking ID lookup */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Booking ID</Label>
            <div className="flex gap-2">
              <Input placeholder="e.g. NFDC-2026-001" value={rawId}
                onChange={e => setRawId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleFetch()} className="h-9" />
              <Button type="button" variant="outline" size="sm" onClick={handleFetch}
                disabled={!rawId.trim() || fetching} className="shrink-0">
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
              </Button>
            </div>
          </div>

          {booking && (
            <>
              {/* Booking summary */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium text-muted-foreground">{booking.bookingId}</span>
                  <StatusBadge status={booking.lifecycle?.status} />
                </div>
                <div className="flex items-center gap-3">
                  <Avatar name={bUserName} colorClass="bg-nfdc-primary/10 text-nfdc-primary" />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium truncate">{bUserName ?? "—"}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{bAudiName ?? "—"}</span>
                      <span className="text-border">·</span>
                      <CalendarClock className="h-3 w-3 shrink-0" />
                      <span className="tabular-nums">
                        {fmtDate(booking.bookingDetails?.date ?? booking.date)}{" "}
                        {fmtRange(booking.bookingDetails?.startTime ?? booking.startTime, booking.bookingDetails?.endTime ?? booking.endTime)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <Form {...form}>
                <form id="postpone-form" onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-5">

                  {/* Action */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Action</Label>
                    <RadioGroup value={watchedAction}
                      onValueChange={v => {
                        form.setValue("action", v, { shouldValidate: true })
                        // Clear selected date — it may be invalid for the new direction
                        setSelectedDate(null); setSelectedSlotId(null)
                        form.setValue("date", undefined, { shouldValidate: false })
                        form.setValue("startTime", "", { shouldValidate: false })
                        form.setValue("endTime",   "", { shouldValidate: false })
                      }}
                      className="grid grid-cols-2 gap-2">
                      {[
                        { value: "postpone", label: "Postpone", desc: "Move to later date" },
                        { value: "prepone",  label: "Prepone",  desc: "Move to earlier date" },
                      ].map(opt => (
                        <label key={opt.value} className={cn(
                          "flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors",
                          watchedAction === opt.value ? "border-blue-600 bg-blue-50" : "border-border hover:bg-muted/40"
                        )}>
                          <RadioGroupItem value={opt.value} id={`r-${opt.value}`} className="mt-0.5" />
                          <div>
                            <p className="text-sm font-medium leading-none">{opt.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Availability Calendar */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Select New Date
                      {selectedDate && (
                        <span className="ml-2 text-xs font-normal text-nfdc-primary">
                          {format(selectedDate, "dd MMM yyyy")} selected
                        </span>
                      )}
                    </Label>
                    <Card className="overflow-hidden">
                      {/* Month nav */}
                      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="p-2">
                        <div className="grid grid-cols-7 mb-1">
                          {DAY_LABELS.map(d => (
                            <div key={d} className="h-6 flex items-center justify-center text-[10px] text-muted-foreground font-medium">{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-0.5">
                          {Array.from({ length: startPadding }).map((_, i) => <div key={`p-${i}`} />)}
                          {days.map(day => {
                            const ds            = toAPIDate(day)
                            const status        = calendar[ds]?.status
                            const isDisabled    = isDayDisabled(day)
                            const isSel         = selectedDate && isSameDay(day, selectedDate)
                            const isBookingDay  = bookingDate && isSameDay(day, bookingDate)
                            return (
                              <button key={ds} type="button" disabled={isDisabled}
                                onClick={() => handleDayClick(day)}
                                className={cn(
                                  "relative h-8 w-full flex flex-col items-center justify-center rounded-md text-xs transition-colors",
                                  isDisabled   && "opacity-30 cursor-not-allowed",
                                  !isDisabled && !isSel && !isBookingDay && (CAL_CELL[status] ?? "hover:bg-muted/60 cursor-pointer"),
                                  isBookingDay && !isSel && "ring-2 ring-amber-400 ring-inset font-semibold text-amber-700 bg-amber-50",
                                  isSel        && "bg-nfdc-primary text-white shadow-sm font-semibold",
                                )}
                              >
                                <span>{format(day, "d")}</span>
                                {!isSel && !isBookingDay && status && status !== "available" && (
                                  <span className={cn("mt-0.5 h-1 w-1 rounded-full", CAL_DOT[status])} />
                                )}
                                {isBookingDay && !isSel && (
                                  <span className="mt-0.5 h-1 w-1 rounded-full bg-amber-400" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 pt-2 border-t">
                          {[["Available","bg-emerald-500"],["Partial","bg-amber-500"],["Fully Booked","bg-red-500"],["Blocked","bg-red-700"]].map(([l,d]) => (
                            <span key={l} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", d)} />{l}
                            </span>
                          ))}
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="h-3 w-3 rounded-sm ring-2 ring-amber-400 shrink-0" /> Current Booking
                          </span>
                        </div>
                      </div>
                    </Card>
                    {form.formState.errors.date && (
                      <p className="text-sm text-destructive">{String(form.formState.errors.date.message)}</p>
                    )}
                  </div>

                  {/* Slot / time selection — only when a date is chosen */}
                  {selectedDate && (
                    mode === "fixed" ? (
                      /* ── Fixed mode: slot list ── */
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Select Slot</Label>
                        {activeSlots.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No active slots for this audi</p>
                        ) : (
                          <div className="border rounded-md divide-y">
                            {activeSlots.map(slot => {
                              const slotId    = slot.slotId ?? slot._id
                              const slotSt    = getSlotStatus(slot)
                              const available = !slotSt || slotSt === "available"
                              const isSelected= selectedSlotId === slotId
                              const cfg       = SLOT_COLORS[slotSt] ?? SLOT_COLORS.available
                              return (
                                <button key={slotId} type="button" disabled={!available}
                                  onClick={() => handleSlotSelect(slot)}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                                    "disabled:opacity-40 disabled:cursor-not-allowed",
                                    isSelected ? "bg-nfdc-primary/10 border-l-2 border-l-nfdc-primary" : "hover:bg-muted/40"
                                  )}
                                >
                                  <span className="flex-1 font-medium">{slot.name}</span>
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {slot.config?.startTime}–{slot.config?.endTime}
                                  </span>
                                  {slotSt && (
                                    <span className={cn("text-[11px] font-medium capitalize", cfg.text)}>{cfg.label}</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        {/* Hidden time fields managed by slot click */}
                        <FormField control={form.control} name="startTime" render={({ field }) => <input type="hidden" {...field} />} />
                        <FormField control={form.control} name="endTime"   render={({ field }) => <input type="hidden" {...field} />} />
                        {(form.formState.errors.startTime || form.formState.errors.endTime) && (
                          <p className="text-sm text-destructive">Please select a slot</p>
                        )}
                      </div>
                    ) : (
                      /* ── Flexible mode: start time + duration chips ── */
                      <div className="space-y-3">
                        {/* Available windows hint */}
                        {availableWindows.length > 0 && bookedWindows.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Free:{" "}
                            {availableWindows.map((w, i) => (
                              <span key={i} className="font-medium text-foreground">
                                {i > 0 && " · "}{fromMins(w.start)}–{fromMins(w.end)}
                              </span>
                            ))}
                          </p>
                        )}
                        {availableWindows.length === 0 && dateStr && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <Info className="h-3 w-3 shrink-0" /> No available time on this date
                          </p>
                        )}

                        <FormInput control={form.control} name="startTime" label="Start Time" type="time" />

                        {durations.length > 0 ? (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Duration</Label>
                            <div className="flex flex-wrap gap-2">
                              {durations.map(d => {
                                const base      = watchedStartTime || opStart
                                const endMins   = base ? toMins(base) + d * 60 : null
                                const exceeds   = endMins !== null && endMins > opEndMins
                                const conflicts = !!base && !!dateStr && !isSlotFree(base, d)
                                const isActive  = activeDuration === d
                                return (
                                  <button key={d} type="button"
                                    disabled={exceeds || conflicts}
                                    title={conflicts ? "Conflicts with an existing booking" : exceeds ? "Exceeds closing time" : undefined}
                                    onClick={() => {
                                      const base = watchedStartTime || opStart
                                      if (!base) { toast.error("Set start time first"); return }
                                      const computedEnd = toMins(base) + d * 60
                                      if (!watchedStartTime && opStart) form.setValue("startTime", opStart, { shouldValidate: true })
                                      form.setValue("endTime", fromMins(computedEnd), { shouldValidate: true })
                                    }}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                                      isActive
                                        ? "bg-nfdc-primary text-white border-nfdc-primary"
                                        : "bg-background border-border hover:border-nfdc-primary hover:text-nfdc-primary"
                                    )}
                                  >{d}h</button>
                                )
                              })}
                            </div>
                            {activeDuration && watchedEndTime && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                {activeDuration}h · ends at <span className="font-medium text-foreground ml-1">{watchedEndTime}</span>
                              </p>
                            )}
                            {/* Hidden end time managed by chip */}
                            <FormField control={form.control} name="endTime" render={({ field }) => <input type="hidden" {...field} />} />
                          </div>
                        ) : (
                          <FormInput control={form.control} name="endTime" label="End Time" type="time" />
                        )}
                      </div>
                    )
                  )}

                  {/* Note */}
                  <FormTextarea control={form.control} name="note" label="Note"
                    placeholder="Reason for the reschedule (optional)" rows={2} />
                </form>
              </Form>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          {booking && (
            <Button type="submit" form="postpone-form" disabled={mutation.isPending}
              className="bg-nfdc-primary hover:bg-nfdc-primary/90">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Propose Dates
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, count, colorClass }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 shadow-sm">
      <span className={`h-2 w-2 rounded-full shrink-0 ${colorClass}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="ml-auto text-sm font-semibold tabular-nums">{count}</span>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RescheduleList() {
  useEffect(() => { document.title = "NFDC Admin — Reschedule" }, [])

  const [activeTab,     setActiveTab]     = useState("pending")
  const [approveTarget, setApproveTarget] = useState(null)
  const [rejectTarget,  setRejectTarget]  = useState(null)
  const [postponeOpen,  setPostponeOpen]  = useState(false)

  // ── Pending review: user-requested reschedules ─────────────────────────────
  const { data: pendingRaw, isLoading: pendingLoading } = useQuery({
    queryKey: ["reschedule", "reschedule_requested"],
    queryFn:  () => listBookings({ status: "reschedule_requested", limit: 50 }).then(r => r.data.data),
  })
  const pendingList = parseList(pendingRaw)

  // ── In progress: postponed / preponed / awaiting payment ───────────────────
  const { data: postponedRaw,  isLoading: l1 } = useQuery({
    queryKey: ["reschedule", "postponed"],
    queryFn:  () => listBookings({ status: "postponed", limit: 50 }).then(r => r.data.data),
  })
  const { data: preponedRaw, isLoading: l2 } = useQuery({
    queryKey: ["reschedule", "preponed"],
    queryFn:  () => listBookings({ status: "preponed", limit: 50 }).then(r => r.data.data),
  })
  const { data: awaitingRaw, isLoading: l3 } = useQuery({
    queryKey: ["reschedule", "awaiting_reschedule_payment"],
    queryFn:  () => listBookings({ status: "awaiting_reschedule_payment", limit: 50 }).then(r => r.data.data),
  })

  const inProgressLoading = l1 || l2 || l3
  const postponedList     = parseList(postponedRaw)
  const preponedList      = parseList(preponedRaw)
  const awaitingList      = parseList(awaitingRaw)
  const inProgressList    = [...postponedList, ...preponedList, ...awaitingList]

  const pendingCount    = pendingList.length
  const inProgressCount = inProgressList.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reschedule Management"
        action={{ label: "Propose New Dates", icon: CalendarClock, onClick: () => setPostponeOpen(true) }}
      />

      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatChip label="Pending Review"     count={pendingCount}          colorClass="bg-orange-400" />
        <StatChip label="Awaiting Response"  count={postponedList.length + preponedList.length} colorClass="bg-indigo-400" />
        <StatChip label="Awaiting Payment"   count={awaitingList.length}   colorClass="bg-amber-400" />
        <StatChip label="Total Active"       count={pendingCount + inProgressCount} colorClass="bg-nfdc-primary" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
        {/* Tab bar */}
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="flex h-auto gap-0 rounded-none bg-transparent p-0">
            {[
              { value: "pending",     label: "Pending Review",    count: pendingCount    },
              { value: "in-progress", label: "Awaiting Response", count: inProgressCount },
            ].map(({ value, label, count }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent -mb-px bg-transparent px-5 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-nfdc-primary data-[state=active]:bg-transparent data-[state=active]:text-nfdc-primary data-[state=active]:shadow-none"
              >
                {label}
                {count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-nfdc-primary px-1.5 text-[10px] font-semibold text-white tabular-nums">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">

          {/* ── Pending Review ── */}
          <TabsContent value="pending" className="mt-0">
            {pendingLoading ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <CardSkeleton key={i} rows={3} />)}
              </div>
            ) : pendingList.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No pending requests"
                message="All user reschedule requests have been reviewed."
              />
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingList.map(bk => (
                  <RescheduleCard
                    key={bk.bookingId ?? bk._id}
                    booking={bk}
                    onApprove={setApproveTarget}
                    onReject={setRejectTarget}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── In Progress ── */}
          <TabsContent value="in-progress" className="mt-0">
            {inProgressLoading ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <CardSkeleton key={i} rows={2} />)}
              </div>
            ) : inProgressList.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nothing in progress"
                message="No bookings are currently awaiting user response or payment."
              />
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {inProgressList.map(bk => (
                  <InProgressCard key={bk.bookingId ?? bk._id} booking={bk} />
                ))}
              </div>
            )}
          </TabsContent>

        </div>
      </Tabs>

      {/* ── Dialogs ── */}
      <ApproveDialog  target={approveTarget} onClose={() => setApproveTarget(null)} />
      <RejectDialog   target={rejectTarget}  onClose={() => setRejectTarget(null)} />
      <PostponeDialog open={postponeOpen}    onOpenChange={setPostponeOpen} />
    </div>
  )
}
