import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isToday, addMonths, subMonths, isBefore, startOfDay,
} from "date-fns"
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, Info,
  ChevronLeft, ChevronRight, CalendarDays, CreditCard, BadgePercent,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import PageHeader from "@/components/common/PageHeader"
import FormSelect from "@/components/forms/FormSelect"
import FormTextarea from "@/components/forms/FormTextarea"
import { useAuth } from "@/hooks/useAuth"
import { listAudis } from "@/api/audi"
import { listSlots } from "@/api/slots"
import { listServicesGrouped } from "@/api/services"
import { manualBookingOffline, manualBookingWaived } from "@/api/bookings"
import { lookupUser } from "@/api/users"
import { getAudiCalendar } from "@/api/availability"
import { parseList } from "@/utils/parseList"
import { toAPIDate } from "@/utils/formatDate"
import { cn } from "@/lib/utils"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const today   = new Date(); today.setHours(0, 0, 0, 0)

const toMins   = (t) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m }
const fromMins = (m) => { const h = Math.floor(m / 60); const min = m % 60; return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}` }

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

// ── Availability status appearance ────────────────────────────────────────────
const STATUS = {
  available:    { cell: "hover:bg-emerald-50",             dot: "bg-emerald-500",  label: "Available",    badge: "bg-emerald-50 text-emerald-700 border-emerald-200"  },
  partial:      { cell: "bg-amber-50/80 hover:bg-amber-100", dot: "bg-amber-500",  label: "Partially booked", badge: "bg-amber-50 text-amber-700 border-amber-200"  },
  fully_booked: { cell: "bg-red-50",                       dot: "bg-red-500",      label: "Fully booked", badge: "bg-red-50 text-red-700 border-red-200"            },
  blocked:      { cell: "bg-red-100",                      dot: "bg-red-700",      label: "Blocked",      badge: "bg-red-100 text-red-800 border-red-300"           },
  locked:       { cell: "bg-slate-100",                    dot: "bg-slate-400",    label: "Locked",       badge: "bg-slate-100 text-slate-500 border-slate-200"     },
}

const SLOT_STATUS = {
  available: { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "✓" },
  booked:    { color: "text-red-700",     bg: "bg-red-50 border-red-200",         icon: "✗" },
  blocked:   { color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",   icon: "⊘" },
  locked:    { color: "text-slate-500",   bg: "bg-slate-50 border-slate-200",     icon: "⏳" },
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  userId:           z.string().min(1, "User ID required"),
  audiId:           z.string().min(1, "Select an audi"),
  date:             z.date({ required_error: "Select a date" }).refine(d => d >= today, "Date cannot be in the past"),
  slotIds:          z.array(z.string()).optional(),
  startTime:        z.string().optional(),
  endTime:          z.string().optional(),
  bookingType:      z.enum(["govt", "non-govt"]),
  selectedServices: z.array(z.string()).default([]),
  notes:            z.string().optional(),
}).superRefine((v, ctx) => {
  const hasSlots = Array.isArray(v.slotIds) && v.slotIds.length > 0
  if (!hasSlots && (!v.startTime || !v.endTime)) {
    ctx.addIssue({ code: "custom", message: "Select at least one slot or enter start & end time", path: ["slotIds"] })
  }
  if (v.startTime && v.endTime && toMins(v.endTime) <= toMins(v.startTime)) {
    ctx.addIssue({ code: "custom", message: "End time must be after start time", path: ["endTime"] })
  }
})

const offlineSchema = baseSchema.and(z.object({ paymentReference: z.string().min(1, "Payment reference required") }))
const waivedSchema  = baseSchema.and(z.object({ waiverReason: z.string().min(10, "Provide a detailed reason (min 10 chars)") }))

// ─── UserIdField ──────────────────────────────────────────────────────────────

function UserIdField({ control, onVerifiedChange }) {
  const rawValue              = useWatch({ control, name: "userId" }) ?? ""
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const id = setTimeout(() => setDebounced(rawValue.trim()), 400)
    return () => clearTimeout(id)
  }, [rawValue])

  const isValidUUID = UUID_RE.test(debounced)

  const { data, isFetching } = useQuery({
    queryKey:  ["user-lookup", debounced],
    queryFn:   () => lookupUser(debounced).then(r => r.data.data),
    enabled:   isValidUUID,
    staleTime: 30_000,
    retry: false,
  })

  useEffect(() => {
    if (isFetching) { onVerifiedChange(false); return }
    onVerifiedChange(!!(isValidUUID && data?.found === true))
  }, [isFetching, isValidUUID, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const verified = !isFetching && isValidUUID && data?.found === true
  const invalid  = !isFetching && isValidUUID && data?.found === false

  return (
    <FormField control={control} name="userId" render={({ field }) => (
      <FormItem>
        <FormLabel>User ID</FormLabel>
        <FormControl>
          <div className="relative">
            <Input
              {...field}
              placeholder="e.g. e2a353cc-1a27-47bc-8f94-f6d0ba683ed6"
              className={`pr-8 font-mono text-sm transition-colors ${
                verified ? "border-green-500 focus-visible:ring-green-500" :
                invalid  ? "border-red-400 focus-visible:ring-red-400" : ""
              }`}
            />
            {isFetching && <Loader2     className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            {verified  && <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-green-500" />}
            {invalid   && <XCircle      className="absolute right-2.5 top-2.5 h-4 w-4 text-red-500" />}
          </div>
        </FormControl>
        {verified && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <div className="min-w-0">
              <span className="font-medium text-green-800 dark:text-green-300">{data.name}</span>
              {data.email && <span className="text-green-700/70 dark:text-green-400/70 ml-2 text-xs">{data.email}</span>}
              {data.phone && <span className="text-green-700/70 dark:text-green-400/70 ml-2 text-xs">{data.phone}</span>}
            </div>
          </div>
        )}
        {invalid && (
          <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5 shrink-0" /> No user found with this ID
          </p>
        )}
        <FormMessage />
      </FormItem>
    )} />
  )
}

// ─── AvailabilityCalendar — FormField for "date" with colour-coded month view ─
// Uses field.onChange (not setValue) so it never triggers shouldValidate=true,
// which would cascade validation state to every FormField and trigger Radix
// Checkbox setRef→setState in an infinite loop.

function AvailabilityCalendar({ control, audiId }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStr = format(currentMonth, "yyyy-MM")

  const { data: calData, isLoading } = useQuery({
    queryKey:  ["audi-calendar", audiId, monthStr],
    queryFn:   () => getAudiCalendar(audiId, monthStr).then(r => r.data.data),
    enabled:   !!audiId,
    staleTime: 60_000,
  })

  const calendar = calData?.calendar ?? {}
  const slotMode = calData?.slotMode ?? null

  const monthStart   = startOfMonth(currentMonth)
  const monthEnd     = endOfMonth(currentMonth)
  const days         = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart)
  const todayStart   = startOfDay(new Date())

  return (
    <FormField control={control} name="date" render={({ field, fieldState }) => {
      // Derive selectedDate from field.value — no separate useWatch needed.
      const selectedDate    = field.value instanceof Date ? field.value : null
      const selectedDateStr = selectedDate ? toAPIDate(selectedDate) : null
      const selectedDayData = selectedDateStr ? calendar[selectedDateStr] : null

      const handleDayClick = (day) => {
        if (isBefore(day, todayStart)) return
        field.onChange(day)   // standard RHF update — no shouldValidate cascade
      }

      return (
        <FormItem>
          <div className="flex items-center justify-between">
            <FormLabel>Select Date</FormLabel>
            {isLoading && audiId && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading availability…
              </span>
            )}
          </div>

          {!audiId ? (
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-muted-foreground bg-muted/30">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" /> Select an audi to view availability
            </div>
          ) : (
            <Card className="overflow-hidden">
              {/* Month navigation */}
              <CardHeader className="py-2 px-3 border-b">
                <div className="flex items-center justify-between">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-semibold text-sm">{format(currentMonth, "MMMM yyyy")}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-3">
                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {DAY_LABELS.map(d => (
                    <div key={d} className="h-7 flex items-center justify-center text-[11px] text-muted-foreground font-medium">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: startPadding }).map((_, i) => <div key={`p-${i}`} />)}
                  {days.map(day => {
                    const dateStr     = toAPIDate(day)
                    const dayData     = calendar[dateStr]
                    const status      = dayData?.status
                    const style       = STATUS[status]
                    const isPast      = isBefore(day, todayStart)
                    const isSelected  = selectedDate !== null && isSameDay(day, selectedDate)
                    const isTodayCell = isToday(day)

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        disabled={isPast}
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "relative h-9 w-full flex flex-col items-center justify-center rounded-md text-xs transition-colors",
                          isPast     && "opacity-30 cursor-not-allowed",
                          !isPast && !isSelected && (style?.cell ?? "hover:bg-muted/60 cursor-pointer"),
                          isSelected && "bg-nfdc-primary text-white shadow-sm font-semibold",
                          !isSelected && isTodayCell && "ring-2 ring-nfdc-accent font-semibold",
                        )}
                      >
                        <span className="leading-none">{format(day, "d")}</span>
                        {!isSelected && status && status !== "available" && (
                          <span className={cn("mt-0.5 h-1 w-1 rounded-full", style?.dot)} />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2.5 border-t border-border">
                  {Object.entries(STATUS).map(([key, val]) => (
                    <span key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", val.dot)} />
                      {val.label}
                    </span>
                  ))}
                </div>
              </CardContent>

              {/* Selected day details */}
              {selectedDate !== null && selectedDateStr && (
                <>
                  <Separator />
                  <div className="p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">
                        {format(selectedDate, "EEEE, MMMM d")}
                      </p>
                      {selectedDayData?.status && STATUS[selectedDayData.status] ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border",
                          STATUS[selectedDayData.status].badge
                        )}>
                          {STATUS[selectedDayData.status].label}
                        </span>
                      ) : !isLoading && (
                        <span className="text-[11px] text-muted-foreground">No data</span>
                      )}
                    </div>

                    {/* Fixed mode: per-slot breakdown */}
                    {slotMode === "fixed" && selectedDayData?.slots?.length > 0 && (
                      <div className="space-y-1">
                        {selectedDayData.slots.map(slot => {
                          const s = SLOT_STATUS[slot.status] ?? SLOT_STATUS.available
                          return (
                            <div key={slot.slotId} className={cn("flex items-center justify-between px-2.5 py-1.5 rounded border text-xs", s.bg)}>
                              <span className={cn("font-medium", s.color)}>{slot.name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-muted-foreground text-[11px]">{slot.startTime}–{slot.endTime}</span>
                                <span className={cn("font-bold", s.color)}>{s.icon}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Flexible mode: booked windows */}
                    {slotMode === "flexible" && selectedDayData?.bookedWindows?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground font-medium">Booked windows:</p>
                        {selectedDayData.bookedWindows.map((w, i) => (
                          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded border bg-red-50 border-red-200 text-xs">
                            <span className="text-red-700 font-medium">{w.startTime} – {w.endTime}</span>
                            <Badge variant="outline" className="text-[10px] capitalize ml-auto">{w.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Flexible: fully clear day */}
                    {slotMode === "flexible" && selectedDayData?.status === "available" && (
                      <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Fully available — no bookings yet
                      </p>
                    )}

                    {/* No availability data */}
                    {!selectedDayData && !isLoading && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3" /> No booking data for this date
                      </p>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

          {fieldState.error && (
            <p className="text-sm font-medium text-destructive">{fieldState.error.message}</p>
          )}
        </FormItem>
      )
    }} />
  )
}

// ─── TimeFields — adapts to audi mode ─────────────────────────────────────────

function TimeFields({ control, setValue, audi }) {
  const mode    = audi?.config?.slotMode
  const audiId  = audi?.audiId ?? audi?.id ?? audi?._id
  const opStart = audi?.config?.operationalHours?.start ?? ""
  const opEnd   = audi?.config?.operationalHours?.end   ?? ""
  const durations = audi?.config?.bookingDurations ?? []

  const { data: slotsRaw, isLoading: slotsLoading } = useQuery({
    queryKey: ["slots", audiId],
    queryFn:  () => listSlots(audiId).then(r => {
      const raw = r.data.data
      return Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
    }),
    enabled:   !!audiId && mode === "fixed",
    staleTime: 60_000,
  })
  const activeSlots = (slotsRaw ?? []).filter(s => s.lifecycle?.status === "active")

  const startTime = useWatch({ control, name: "startTime" }) ?? ""

  if (!audi) return null

  // ── Fixed mode: checkbox multi-slot selector ──────────────────────────────
  if (mode === "fixed") {
    return (
      <FormField control={control} name="slotIds" render={({ field }) => {
        const selectedIds = Array.isArray(field.value) ? field.value : []

        const toggle = (id) => {
          const next = selectedIds.includes(id)
            ? selectedIds.filter(x => x !== id)
            : [...selectedIds, id]
          field.onChange(next)
        }

        return (
          <FormItem>
            <FormLabel>
              Select Slot(s)
              {selectedIds.length > 1 && (
                <Badge variant="secondary" className="ml-2 text-xs">Multi-slot booking</Badge>
              )}
            </FormLabel>
            <FormControl>
              {slotsLoading ? (
                <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading slots…
                </div>
              ) : activeSlots.length === 0 ? (
                <div className="flex items-center h-10 px-3 border rounded-md text-sm text-muted-foreground bg-muted/30">
                  No active slots available for this audi
                </div>
              ) : (
                <div className="space-y-1 border rounded-md p-2">
                  {activeSlots.map(s => {
                    const id      = s.slotId ?? s._id
                    const checked = selectedIds.includes(id)
                    const hours   = s.config?.hours
                    return (
                      <div
                        key={id}
                        className={`flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors hover:bg-accent/10 ${
                          checked ? "bg-nfdc-accent/5 border border-nfdc-accent/30" : ""
                        }`}
                        onClick={() => toggle(id)}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(id)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">{s.name}</span>
                          <span className="text-muted-foreground text-xs ml-2">
                            {s.config?.startTime}–{s.config?.endTime}
                            {hours ? ` (${hours}h)` : ""}
                          </span>
                        </div>
                        {checked && <Badge variant="secondary" className="text-xs shrink-0">✓</Badge>}
                      </div>
                    )
                  })}
                </div>
              )}
            </FormControl>
            {selectedIds.length > 1 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {selectedIds.length} slots selected — booking will cover all selected time ranges
              </p>
            )}
            <FormMessage />
          </FormItem>
        )
      }} />
    )
  }

  // ── Flexible mode: time inputs + duration shortcuts ───────────────────────
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control} name="startTime" render={({ field }) => (
          <FormItem>
            <FormLabel>
              Start Time
              {opStart && <span className="text-muted-foreground font-normal ml-1">(from {opStart})</span>}
            </FormLabel>
            <FormControl>
              <Input type="time" min={opStart || undefined} max={opEnd || undefined} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name="endTime" render={({ field }) => (
          <FormItem>
            <FormLabel>
              End Time
              {opEnd && <span className="text-muted-foreground font-normal ml-1">(until {opEnd})</span>}
            </FormLabel>
            <FormControl>
              <Input type="time" min={startTime || opStart || undefined} max={opEnd || undefined} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      {durations.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Quick duration — set start time first, then click:
          </p>
          <div className="flex flex-wrap gap-2">
            {durations.map(d => (
              <Badge
                key={d}
                variant="outline"
                className="cursor-pointer hover:bg-nfdc-accent/10 hover:border-nfdc-accent select-none"
                onClick={() => {
                  if (!startTime) { toast.error("Set start time first"); return }
                  const end        = toMins(startTime) + d * 60
                  const opEndMins  = opEnd ? toMins(opEnd) : Infinity
                  if (end > opEndMins) { toast.error(`${d}h exceeds closing time (${opEnd})`); return }
                  setValue("endTime", fromMins(end), { shouldValidate: true })
                }}
              >
                {d}h
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ServicesField — grouped by section, mandatory auto-selected ──────────────

function ServicesField({ control, audiId, bookingType }) {
  const { data: grouped, isLoading } = useQuery({
    queryKey:  ["services-grouped", audiId],
    queryFn:   () => listServicesGrouped({ audiId, status: "active" }).then(r => r.data.data),
    enabled:   !!audiId,
    staleTime: 60_000,
  })

  const sections  = grouped?.sections  ?? []
  const ungrouped = grouped?.ungrouped ?? { services: [] }
  const allServices = [
    ...sections.flatMap(s => s.services ?? []),
    ...(ungrouped.services ?? []),
  ]

  if (!audiId || isLoading || allServices.length === 0) return null

  const priceKey = bookingType === "govt" ? "govt" : "nonGovt"

  const renderServiceRow = (svc, field) => {
    const isMandatory = svc.config?.isMandatory ?? false
    const checked     = isMandatory || (field.value ?? []).includes(svc.serviceId)
    const price       = svc.config?.pricing?.[priceKey]

    return (
      <div
        key={svc.serviceId}
        className={`flex items-center gap-3 px-2 py-2 rounded-md transition-colors ${
          isMandatory ? "opacity-75" : "cursor-pointer hover:bg-accent/5"
        } ${checked && !isMandatory ? "bg-nfdc-accent/5" : ""}`}
        onClick={!isMandatory ? () => {
          const next = checked
            ? field.value.filter(id => id !== svc.serviceId)
            : [...field.value, svc.serviceId]
          field.onChange(next)
        } : undefined}
      >
        <Checkbox
          checked={checked}
          disabled={isMandatory}
          onCheckedChange={!isMandatory ? (ch) => {
            const next = ch
              ? [...field.value, svc.serviceId]
              : field.value.filter(id => id !== svc.serviceId)
            field.onChange(next)
          } : undefined}
          onClick={e => e.stopPropagation()}
        />
        <span className="flex-1 text-sm">{svc.name}</span>
        {isMandatory && (
          <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">Mandatory</Badge>
        )}
        {price != null && (
          <span className="text-xs text-muted-foreground shrink-0">₹{price}</span>
        )}
      </div>
    )
  }

  return (
    <FormField control={control} name="selectedServices" render={({ field }) => (
      <FormItem>
        <FormLabel>Services</FormLabel>
        <FormControl>
          <Card className="border">
            <CardContent className="p-3 space-y-3">
              {sections.map(section =>
                section.services?.length > 0 ? (
                  <div key={section.sectionId}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {section.name}
                    </p>
                    <div className="space-y-0.5">
                      {section.services.map(svc => renderServiceRow(svc, field))}
                    </div>
                  </div>
                ) : null
              )}
              {ungrouped.services?.length > 0 && (
                <div>
                  {sections.some(s => s.services?.length > 0) && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Other Services
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {ungrouped.services.map(svc => renderServiceRow(svc, field))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  )
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">{label}</p>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

// ─── BookingForm ──────────────────────────────────────────────────────────────

function BookingForm({ schema, onSubmit, isPending, audiList, submitLabel }) {
  const [userVerified, setUserVerified] = useState(false)

  const form = useForm({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      userId: "", audiId: "", slotIds: [], startTime: "", endTime: "",
      bookingType: "govt", selectedServices: [], notes: "",
      paymentReference: "", waiverReason: "",
    },
  })

  const audiId      = useWatch({ control: form.control, name: "audiId" })
  const bookingType = useWatch({ control: form.control, name: "bookingType" })
  const selectedAudi = audiList.find(a => (a.audiId ?? a.id ?? a._id) === audiId) ?? null

  // Reset slot/time/service fields when audi changes (guarded to avoid infinite loop).
  // form is a stable ref from useForm — safe to omit from deps.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const v = form.getValues()
    if (v.slotIds?.length          > 0) form.setValue("slotIds",          [],  { shouldValidate: false })
    if (v.startTime)                    form.setValue("startTime",         "",   { shouldValidate: false })
    if (v.endTime)                      form.setValue("endTime",           "",   { shouldValidate: false })
    if (v.selectedServices?.length > 0) form.setValue("selectedServices",  [],  { shouldValidate: false })
  }, [audiId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const audiOptions = audiList.map(a => ({
    value: a.audiId ?? a.id ?? a._id,
    label: `${a.name}${a.config?.slotMode ? ` (${a.config.slotMode})` : ""}`,
  }))

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        <SectionHeader label="Customer" />
        <UserIdField control={form.control} onVerifiedChange={setUserVerified} />

        <SectionHeader label="Booking Details" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect
            control={form.control}
            name="audiId"
            label="Audi"
            placeholder="Select an audi"
            options={audiOptions}
          />
          <FormSelect
            control={form.control}
            name="bookingType"
            label="Booking Type"
            options={[{ value: "govt", label: "Government" }, { value: "non-govt", label: "Non-Government" }]}
          />
        </div>

        <AvailabilityCalendar
          control={form.control}
          setValue={form.setValue}
          audiId={audiId || null}
        />

        <TimeFields control={form.control} setValue={form.setValue} audi={selectedAudi} />

        <ServicesField
          control={form.control}
          audiId={audiId || null}
          bookingType={bookingType}
        />

        <SectionHeader label="Payment & Notes" />
        <FormTextarea control={form.control} name="notes" label="Notes (optional)" rows={2} />

        {schema === offlineSchema ? (
          <FormField control={form.control} name="paymentReference" render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Reference <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Cheque / DD number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        ) : (
          <FormTextarea
            control={form.control}
            name="waiverReason"
            label="Waiver Reason"
            placeholder="Detailed reason for waiving the fee…"
            rows={3}
          />
        )}

        <div className="pt-2">
          <Button
            type="submit"
            disabled={isPending || !userVerified}
            className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90 h-11 text-base"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
          {!userVerified && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Verify a valid User ID above to enable booking creation
            </p>
          )}
        </div>

      </form>
    </Form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManualBooking() {
  useEffect(() => { document.title = "NFDC Admin — Manual Booking" }, [])

  const navigate    = useNavigate()
  const { user }    = useAuth()
  const theaterId   = user?.theaterId
  const queryClient = useQueryClient()

  const { data: audis } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn:  () => listAudis(theaterId).then(r => parseList(r.data.data)),
    enabled:  !!theaterId,
  })

  const audiList = Array.isArray(audis?.data) ? audis.data : Array.isArray(audis) ? audis : []

  const formatPayload = (values) => {
    const svcsCache   = queryClient.getQueryData(["services-grouped", values.audiId])
    const mandatoryIds = [
      ...(svcsCache?.sections?.flatMap(s => s.services ?? []) ?? []),
      ...(svcsCache?.ungrouped?.services ?? []),
    ].filter(s => s.config?.isMandatory).map(s => s.serviceId)
    const selectedServices = [...new Set([...(values.selectedServices ?? []), ...mandatoryIds])]

    return {
      theaterId,
      audiId:           values.audiId,
      userId:           values.userId,
      date:             toAPIDate(values.date),
      slotIds:          Array.isArray(values.slotIds) && values.slotIds.length > 0 ? values.slotIds : undefined,
      startTime:        values.startTime || undefined,
      endTime:          values.endTime   || undefined,
      bookingType:      values.bookingType,
      selectedServices,
      note:             values.notes || undefined,
    }
  }

  const offlineMutation = useMutation({
    mutationFn: (v) => manualBookingOffline({ ...formatPayload(v), paymentReference: v.paymentReference }),
    onSuccess:  () => {
      toast.success("Booking created successfully")
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      navigate("/admin/bookings")
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Something went wrong."),
  })

  const waivedMutation = useMutation({
    mutationFn: (v) => manualBookingWaived({ ...formatPayload(v), waiverReason: v.waiverReason }),
    onSuccess:  () => {
      toast.success("Booking created successfully")
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      navigate("/admin/bookings")
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manual Booking"
        action={{ label: "Back", icon: ArrowLeft, onClick: () => navigate("/admin/bookings") }}
      />

      <Tabs defaultValue="offline" className="flex flex-col">
        {/* Underline tab bar */}
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="flex h-auto gap-0 rounded-none bg-transparent p-0">
            {[
              { value: "offline", label: "Offline Payment", icon: CreditCard },
              { value: "waived",  label: "Fee Waived",      icon: BadgePercent },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent -mb-px bg-transparent px-5 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-nfdc-primary data-[state=active]:bg-transparent data-[state=active]:text-nfdc-primary data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="offline" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form */}
              <div className="lg:col-span-2">
                <Card>
                  <CardContent className="pt-6">
                    <BookingForm
                      schema={offlineSchema}
                      onSubmit={(v) => offlineMutation.mutate(v)}
                      isPending={offlineMutation.isPending}
                      audiList={audiList}
                      submitLabel="Create Booking (Offline)"
                    />
                  </CardContent>
                </Card>
              </div>
              {/* Info panel */}
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-800">
                    <CreditCard className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-semibold">Offline Payment</p>
                  </div>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Use this when the customer has already paid via cheque, demand draft, or cash. Provide the payment reference number for audit records.
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How it works</p>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-nfdc-primary font-bold mt-0.5">1.</span> Verify the customer's User ID</li>
                    <li className="flex items-start gap-2"><span className="text-nfdc-primary font-bold mt-0.5">2.</span> Select audi, date &amp; time</li>
                    <li className="flex items-start gap-2"><span className="text-nfdc-primary font-bold mt-0.5">3.</span> Add services if needed</li>
                    <li className="flex items-start gap-2"><span className="text-nfdc-primary font-bold mt-0.5">4.</span> Enter payment reference &amp; submit</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="waived" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form */}
              <div className="lg:col-span-2">
                <Card>
                  <CardContent className="pt-6">
                    <BookingForm
                      schema={waivedSchema}
                      onSubmit={(v) => waivedMutation.mutate(v)}
                      isPending={waivedMutation.isPending}
                      audiList={audiList}
                      submitLabel="Create Booking (Waived)"
                    />
                  </CardContent>
                </Card>
              </div>
              {/* Info panel */}
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800">
                    <BadgePercent className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-semibold">Fee Waived</p>
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Use this when the booking fee is being waived — no payment is collected. A detailed written reason is required for audit and compliance purposes.
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Requirements</p>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-amber-600 font-bold mt-0.5">•</span> Waiver reason must be at least 10 characters</li>
                    <li className="flex items-start gap-2"><span className="text-amber-600 font-bold mt-0.5">•</span> Must include justification for audit trail</li>
                    <li className="flex items-start gap-2"><span className="text-amber-600 font-bold mt-0.5">•</span> Booking will be created in waived status</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
