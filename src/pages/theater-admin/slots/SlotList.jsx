import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Plus, Pencil, Power, Clock, Loader2, Info,
  AlertTriangle, CheckCircle2, Timer,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import PageHeader from "@/components/common/PageHeader"
import StatusBadge from "@/components/common/StatusBadge"
import EmptyState from "@/components/common/EmptyState"
import FormInput from "@/components/forms/FormInput"
import { useAuth } from "@/hooks/useAuth"
import { fmt12 } from "@/utils/formatDate"
import { listAdminAudis } from "@/api/audi"
import { listAdminSlots, createSlot, updateSlot, updateSlotStatus } from "@/api/slots"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toMins   = t => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m }
const fromMins = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`

function calcDuration(start, end) {
  if (!start || !end) return null
  const diff = toMins(end) - toMins(start)
  if (diff <= 0) return null
  const h = Math.floor(diff / 60), m = diff % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`
}

// ─── Schema ────────────────────────────────────────────────────────────────────

const slotSchema = z.object({
  name:      z.string().min(1, "Name is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime:   z.string().min(1, "End time is required"),
}).refine(d => d.endTime > d.startTime, {
  message: "End time must be after start time",
  path: ["endTime"],
})

// ─── Slot Dialog ───────────────────────────────────────────────────────────────

function SlotDialog({ open, onOpenChange, audiId, editingSlot, audi, existingSlots = [] }) {
  const queryClient = useQueryClient()
  const opStart     = audi?.config?.operationalHours?.start ?? ""
  const opEnd       = audi?.config?.operationalHours?.end   ?? ""
  const bufferTime  = audi?.config?.bufferTime ?? 0          // minutes gap required between slots
  const opStartMins = opStart ? toMins(opStart) : 0
  const opEndMins   = opEnd   ? toMins(opEnd)   : 24 * 60
  // Detect misconfigured hours (end ≤ start means inverted or not set correctly)
  const hoursInvalid = !!(opStart && opEnd && opEndMins <= opStartMins)

  const editingId = editingSlot?.slotId ?? editingSlot?.id ?? editingSlot?._id

  // Occupied windows — each slot's end is extended by bufferTime so the gap
  // between slots matches what the availability checker enforces at booking time
  const occupied = useMemo(() =>
    existingSlots
      .filter(s => (s.slotId ?? s.id ?? s._id) !== editingId && s.lifecycle?.status !== "inactive")
      .map(s => ({
        start:      toMins(s.config?.startTime ?? "00:00"),
        end:        toMins(s.config?.endTime   ?? "00:00"),
        endBuffered: toMins(s.config?.endTime  ?? "00:00") + bufferTime,
        name:       s.name,
      }))
      .sort((a, b) => a.start - b.start),
  [existingSlots, editingId, bufferTime])

  // Free gaps — the START of each gap respects the buffer after the previous slot.
  // Rule: new slot start >= prevSlot.end + bufferTime
  // (first slot has no constraint — any time within operational hours is fine)
  const freeGaps = useMemo(() => {
    const gaps = []
    let cursor = opStartMins
    for (const slot of occupied) {
      // Gap between cursor and this slot's start (raw, no forward reduction)
      if (cursor < slot.start) gaps.push({ start: cursor, end: slot.start })
      // Next free window starts after this slot's end + buffer
      cursor = Math.max(cursor, slot.endBuffered)
    }
    if (cursor < opEndMins) gaps.push({ start: cursor, end: opEndMins })
    return gaps.filter(g => g.end > g.start)
  }, [occupied, opStartMins, opEndMins])

  const form = useForm({
    resolver:      zodResolver(slotSchema),
    defaultValues: { name: "", startTime: opStart, endTime: opEnd },
  })

  const startTime = form.watch("startTime")
  const endTime   = form.watch("endTime")

  const startMins = startTime ? toMins(startTime) : null
  const endMins   = endTime   ? toMins(endTime)   : null
  const duration  = calcDuration(startTime, endTime)

  // Conflict detection:
  //   — Start is inside another slot or its buffer zone  → hard block
  //   — Slot times overlap an existing slot              → hard block
  const overlaps = useMemo(() =>
    (startMins !== null && endMins !== null && endMins > startMins)
      ? occupied.filter(s =>
          startMins < s.endBuffered &&  // start is within slot + its buffer
          endMins   > s.start           // and we actually reach that slot
        )
      : [],
  [startMins, endMins, occupied])

  const outsideHours =
    !!opStart && !!opEnd &&
    startMins !== null && endMins !== null &&
    (startMins < opStartMins || endMins > opEndMins)

  // ── Auto-fill on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    if (editingSlot) {
      form.reset({
        name:      editingSlot.name ?? "",
        startTime: editingSlot.config?.startTime ?? "",
        endTime:   editingSlot.config?.endTime   ?? "",
      })
    } else {
      const firstGap = freeGaps[0]
      form.reset({
        name:      "",
        startTime: firstGap ? fromMins(firstGap.start) : opStart,
        endTime:   firstGap ? fromMins(firstGap.end)   : opEnd,
      })
    }
  }, [open, editingSlot]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto end time from gap when start changes (new slot only) ────────────────
  // gap.end already accounts for next slot's buffer requirement so we can
  // safely use it as the maximum end time for this new slot.
  useEffect(() => {
    if (!open || editingSlot || !startTime) return
    const sMin = toMins(startTime)
    const gap  = freeGaps.find(g => sMin >= g.start && sMin < g.end)
    if (gap) form.setValue("endTime", fromMins(gap.end), { shouldValidate: true })
  }, [startTime]) // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (v) => {
      const id = editingSlot?.slotId ?? editingSlot?.id ?? editingSlot?._id
      const config = { startTime: v.startTime, endTime: v.endTime }
      return editingSlot
        ? updateSlot(id, { name: v.name, config })
        : createSlot({ name: v.name, audiId, config })
    },
    onSuccess: () => {
      toast.success(editingSlot ? "Slot updated" : "Slot created")
      queryClient.invalidateQueries({ queryKey: ["slots", audiId] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  const handleSubmit = form.handleSubmit((v) => {
    if (overlaps.length > 0) {
      toast.error(`Overlaps with: ${overlaps.map(s => s.name).join(", ")}`)
      return
    }
    if (outsideHours) {
      toast.error(`Slot must be within operational hours (${fmt12(opStart)}–${fmt12(opEnd)})`)
      return
    }
    mutation.mutate(v)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingSlot ? "Edit Slot" : "Add Slot"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormInput control={form.control} name="name" label="Slot Name" placeholder="e.g. Morning Slot" />

            {/* Available gaps — clickable chips */}
            {freeGaps.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Available windows</p>
                <div className="flex flex-wrap gap-1.5">
                  {freeGaps.map((g, i) => {
                    const isSelected = startMins === g.start && endMins === g.end
                    return (
                      <button key={i} type="button"
                        onClick={() => {
                          form.setValue("startTime", fromMins(g.start), { shouldValidate: true })
                          form.setValue("endTime",   fromMins(g.end),   { shouldValidate: true })
                        }}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors",
                          isSelected
                            ? "bg-nfdc-primary text-white border-nfdc-primary"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        )}
                      >
                        {fmt12(fromMins(g.start))} – {fmt12(fromMins(g.end))}
                        <span className="ml-1 opacity-70">({calcDuration(fromMins(g.start), fromMins(g.end))})</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {hoursInvalid && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Operational hours are misconfigured — end time ({fmt12(opEnd)}) is before start ({fmt12(opStart)}). Fix in Audi → Info tab.
              </div>
            )}
            {freeGaps.length === 0 && opStart && opEnd && !hoursInvalid && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                No free windows remaining within {fmt12(opStart)}–{fmt12(opEnd)}
              </div>
            )}

            {/* Time inputs */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startTime" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">
                    Start Time
                    {opStart && <span className="font-normal text-muted-foreground text-xs ml-1">(from {fmt12(opStart)})</span>}
                  </FormLabel>
                  <FormControl>
                    <input type="time"
                      min={opStart || undefined}
                      max={opEnd   || undefined}
                      {...field}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endTime" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">
                    End Time
                    {opEnd && <span className="font-normal text-muted-foreground text-xs ml-1">(until {fmt12(opEnd)})</span>}
                  </FormLabel>
                  <FormControl>
                    <input type="time"
                      min={startTime || opStart || undefined}
                      max={opEnd || undefined}
                      {...field}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Buffer time notice */}
            {bufferTime > 0 && occupied.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border rounded-lg px-3 py-2">
                <Clock className="h-3.5 w-3.5 shrink-0 text-nfdc-primary" />
                <span>
                  <strong>{bufferTime} min buffer</strong> — new slot must start at least {bufferTime} min after the previous slot ends.
                  Available windows already reflect this.
                </span>
              </div>
            )}

            {/* Inline feedback */}
            {overlaps.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Conflicts with: <strong>{overlaps.map(s => s.name).join(", ")}</strong>
                  {bufferTime > 0 && <span className="text-red-600/70 ml-1">(including {bufferTime}min buffer)</span>}
                </span>
              </div>
            )}
            {outsideHours && overlaps.length === 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Outside operational hours ({fmt12(opStart)}–{fmt12(opEnd)})
              </div>
            )}
            {duration && overlaps.length === 0 && !outsideHours && (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Duration: <strong>{duration}</strong> — set the rate in Price Config → Audi
              </div>
            )}

            <Separator />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit"
                disabled={mutation.isPending || overlaps.length > 0 || outsideHours}
                className="bg-nfdc-primary hover:bg-nfdc-primary/90"
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingSlot ? "Save Changes" : "Create Slot"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SlotList() {
  useEffect(() => { document.title = "NFDC Admin — Slots" }, [])

  const { user }    = useAuth()
  const theaterId   = user?.theaterId
  const queryClient = useQueryClient()

  const [selectedAudiId, setSelectedAudiId] = useState("")
  const [createOpen,     setCreateOpen]     = useState(false)
  const [editingSlot,    setEditingSlot]     = useState(null)
  const [statusTarget,   setStatusTarget]   = useState(null)

  const { data: audisRaw } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn:  () => listAdminAudis(theaterId).then(r => r.data.data),
    enabled:  !!theaterId,
  })

  const allAudis = Array.isArray(audisRaw?.data) ? audisRaw.data : Array.isArray(audisRaw) ? audisRaw : []

  const selectedAudi = allAudis.find(a => (a.audiId ?? a.id ?? a._id) === selectedAudiId)
  const selectedMode = selectedAudi?.config?.slotMode
  const opStart      = selectedAudi?.config?.operationalHours?.start ?? ""
  const opEnd        = selectedAudi?.config?.operationalHours?.end   ?? ""

  const { data: slotsRaw, isLoading } = useQuery({
    queryKey: ["slots", selectedAudiId],
    queryFn:  () => listAdminSlots(selectedAudiId).then(r => r.data.data),
    enabled:  !!selectedAudiId,
  })

  const slots = Array.isArray(slotsRaw?.data) ? slotsRaw.data : Array.isArray(slotsRaw) ? slotsRaw : []
  const activeSlots = slots.filter(s => s.lifecycle?.status === "active")

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateSlotStatus(id, status),
    onSuccess: () => {
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: ["slots", selectedAudiId] })
      setStatusTarget(null)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  // ── Slot card ─────────────────────────────────────────────────────────────
  const SlotCard = ({ slot }) => {
    const id        = slot.slotId ?? slot.id ?? slot._id
    const isActive  = slot.lifecycle?.status === "active"
    const start     = slot.config?.startTime
    const end       = slot.config?.endTime
    const duration  = calcDuration(start, end)

    // Timeline bar: position within operational hours
    const opS = opStart ? toMins(opStart) : 0
    const opE = opEnd   ? toMins(opEnd)   : 24 * 60
    const span = opE - opS
    const slotS = start ? toMins(start) : opS
    const slotE = end   ? toMins(end)   : opE
    const leftPct  = span > 0 ? ((slotS - opS) / span) * 100 : 0
    const widthPct = span > 0 ? ((slotE - slotS) / span) * 100 : 100

    return (
      <Card className={cn(
        "overflow-hidden hover:shadow-sm transition-shadow",
        !isActive && "opacity-60"
      )}>
        {/* Timeline bar — slot position within operational hours */}
        {opStart && opEnd && (
          <div className="px-4 pt-3 pb-1 space-y-1"
            title={`${fmt12(start)} – ${fmt12(end)} within ${fmt12(opStart)} – ${fmt12(opEnd)}`}>
            <div className="flex justify-between text-[10px] text-muted-foreground/50 tabular-nums">
              <span>{fmt12(opStart)}</span>
              <span>{fmt12(opEnd)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/40">
              <div
                className={cn("h-full rounded-full", isActive ? "bg-nfdc-primary" : "bg-muted-foreground/40")}
                style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}
              />
            </div>
          </div>
        )}
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate">{slot.name}</p>
                <StatusBadge status={slot.lifecycle?.status} />
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <Clock className="h-3 w-3 shrink-0" />
                  {start && end ? `${fmt12(start)} – ${fmt12(end)}` : "—"}
                </span>
                {duration && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Timer className="h-3 w-3 shrink-0" />
                    {duration}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit"
                onClick={() => setEditingSlot(slot)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon"
                title={isActive ? "Deactivate" : "Activate"}
                onClick={() => setStatusTarget({ id, name: slot.name, isActive })}
                className={cn("h-7 w-7", isActive
                  ? "text-destructive/60 hover:text-destructive hover:bg-destructive/5"
                  : "text-green-600/60 hover:text-green-700 hover:bg-green-50"
                )}>
                <Power className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Slots"
        action={selectedAudiId && selectedMode !== "flexible" ? {
          label: "Add Slot",
          icon:  Plus,
          onClick: () => setCreateOpen(true),
        } : undefined}
      />

      {/* Audi selector */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedAudiId} onValueChange={setSelectedAudiId}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder={allAudis.length === 0 ? "No audis found" : "Select an audi"} />
          </SelectTrigger>
          <SelectContent>
            {allAudis.map(a => {
              const id   = a.audiId ?? a.id ?? a._id
              const mode = a.config?.slotMode
              return (
                <SelectItem key={id} value={id}>
                  <span className="flex items-center gap-2">
                    {a.name}
                    {mode && (
                      <Badge variant={mode === "fixed" ? "outline" : "secondary"} className="text-[10px] px-1 py-0 capitalize">
                        {mode}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {selectedAudiId && opStart && opEnd && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Hours: <strong className="text-foreground">{fmt12(opStart)} – {fmt12(opEnd)}</strong>
            </span>
            {(selectedAudi?.config?.bufferTime ?? 0) > 0 && (
              <span className="text-xs text-nfdc-primary flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5" />
                {selectedAudi.config.bufferTime}min buffer between slots
              </span>
            )}
          </div>
        )}
      </div>

      {/* No audi selected */}
      {!selectedAudiId && (
        <EmptyState icon={Clock} title="Select an audi"
          message="Choose a fixed-mode audi above to manage its time slots." />
      )}

      {/* Flexible mode */}
      {selectedAudiId && selectedMode === "flexible" && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-sm">Flexible mode — no slots needed</p>
            <p className="text-sm text-blue-700">
              Customers pick any start time within your operational hours for a valid booking duration.
              Slots are not required.
            </p>
            {(selectedAudi?.config?.bufferTime ?? 0) > 0 && (
              <p className="text-sm text-blue-700">
                <strong>{selectedAudi.config.bufferTime} min buffer</strong> is enforced between bookings —
                the system automatically blocks that gap after each confirmed booking so no two bookings overlap.
              </p>
            )}
            <p className="text-xs text-blue-600 mt-1">
              Configure valid durations in <strong>Audi → Booking Rules</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Fixed mode — show slots */}
      {selectedAudiId && selectedMode !== "flexible" && (
        <div className="space-y-4">
          {/* Stats + hint row */}
          {slots.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-3 py-1.5 bg-background">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <strong className="text-foreground">{activeSlots.length}</strong> active
                </span>
                {slots.length - activeSlots.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-3 py-1.5 bg-background">
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                    <strong className="text-foreground">{slots.length - activeSlots.length}</strong> inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Pricing via <span className="font-medium text-foreground">Price Config → Audi</span>
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-xl border bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <EmptyState icon={Clock}
              title="No slots yet"
              message="Add your first slot to define bookable time windows for this audi."
              action={{ label: "Add Slot", onClick: () => setCreateOpen(true) }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...slots]
                .sort((a, b) => toMins(a.config?.startTime ?? "00:00") - toMins(b.config?.startTime ?? "00:00"))
                .map(slot => <SlotCard key={slot.slotId ?? slot.id ?? slot._id} slot={slot} />)
              }
            </div>
          )}
        </div>
      )}

      <SlotDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        audiId={selectedAudiId}
        editingSlot={null}
        audi={selectedAudi}
        existingSlots={slots}
      />
      <SlotDialog
        open={!!editingSlot}
        onOpenChange={o => !o && setEditingSlot(null)}
        audiId={selectedAudiId}
        editingSlot={editingSlot}
        audi={selectedAudi}
        existingSlots={slots}
      />

      <AlertDialog open={!!statusTarget} onOpenChange={o => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.isActive ? "Deactivate" : "Activate"} &quot;{statusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.isActive
                ? "This slot will no longer be available for new bookings."
                : "This slot will become available for bookings again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusMutation.mutate({
                id:     statusTarget.id,
                status: statusTarget.isActive ? "inactive" : "active",
              })}
              className={statusTarget?.isActive ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
