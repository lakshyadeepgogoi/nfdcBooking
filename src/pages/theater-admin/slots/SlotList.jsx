import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Plus, MoreHorizontal, Pencil, Power, Clock, Loader2, Info,
  AlertTriangle, CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import EmptyState from "@/components/common/EmptyState"
import FormInput from "@/components/forms/FormInput"
import { useAuth } from "@/hooks/useAuth"
import { listAdminAudis } from "@/api/audi"
import { listSlots, createSlot, updateSlot, updateSlotStatus } from "@/api/slots"

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
  const opStartMins = opStart ? toMins(opStart) : 0
  const opEndMins   = opEnd   ? toMins(opEnd)   : 24 * 60

  const editingId = editingSlot?.slotId ?? editingSlot?.id ?? editingSlot?._id

  // Occupied windows from ACTIVE slots (excluding the one being edited)
  const occupied = useMemo(() =>
    existingSlots
      .filter(s => (s.slotId ?? s.id ?? s._id) !== editingId && s.lifecycle?.status !== "inactive")
      .map(s => ({
        start: toMins(s.config?.startTime ?? "00:00"),
        end:   toMins(s.config?.endTime   ?? "00:00"),
        name:  s.name,
      }))
      .sort((a, b) => a.start - b.start),
  [existingSlots, editingId])

  // Free gaps within operational hours
  const freeGaps = useMemo(() => {
    const gaps = []
    let cursor = opStartMins
    for (const slot of occupied) {
      if (cursor < slot.start) gaps.push({ start: cursor, end: slot.start })
      cursor = Math.max(cursor, slot.end)
    }
    if (cursor < opEndMins) gaps.push({ start: cursor, end: opEndMins })
    return gaps
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

  // Overlap detection (realtime)
  const overlaps = useMemo(() =>
    (startMins !== null && endMins !== null && endMins > startMins)
      ? occupied.filter(s => startMins < s.end && endMins > s.start)
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
      toast.error(`Slot must be within operational hours (${opStart}–${opEnd})`)
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
                        {fromMins(g.start)} – {fromMins(g.end)}
                        <span className="ml-1 opacity-70">({calcDuration(fromMins(g.start), fromMins(g.end))})</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {freeGaps.length === 0 && opStart && opEnd && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                No free windows remaining within {opStart}–{opEnd}
              </div>
            )}

            {/* Time inputs */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startTime" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">
                    Start Time
                    {opStart && <span className="font-normal text-muted-foreground text-xs ml-1">(from {opStart})</span>}
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
                    {opEnd && <span className="font-normal text-muted-foreground text-xs ml-1">(until {opEnd})</span>}
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

            {/* Inline feedback */}
            {overlaps.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Overlaps with: <strong>{overlaps.map(s => s.name).join(", ")}</strong></span>
              </div>
            )}
            {outsideHours && overlaps.length === 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Outside operational hours ({opStart}–{opEnd})
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
    queryFn:  () => listSlots(selectedAudiId).then(r => r.data.data),
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

  const columns = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    {
      id: "time",
      header: "Time",
      cell: ({ row }) => {
        const s = row.original.config?.startTime
        const e = row.original.config?.endTime
        return s && e ? (
          <span className="tabular-nums text-sm">{s} – {e}</span>
        ) : "—"
      },
    },
    {
      id: "duration",
      header: "Duration",
      cell: ({ row }) => {
        const s = row.original.config?.startTime
        const e = row.original.config?.endTime
        return calcDuration(s, e) ?? "—"
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.lifecycle?.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const slot     = row.original
        const id       = slot.slotId ?? slot.id ?? slot._id
        const isActive = slot.lifecycle?.status === "active"
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingSlot(slot)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setStatusTarget({ id, name: slot.name, isActive })}
                className={isActive ? "text-destructive focus:text-destructive" : ""}
              >
                <Power className="mr-2 h-4 w-4" />
                {isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

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
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Operational hours: <strong className="text-foreground">{opStart} – {opEnd}</strong>
          </span>
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
          <div>
            <p className="font-medium text-sm">Flexible mode audi</p>
            <p className="text-sm mt-0.5">
              Flexible-mode audis don&apos;t use time slots. Customers book any start/end time within
              the valid <strong>Booking Durations</strong> set in Audi settings.
            </p>
          </div>
        </div>
      )}

      {/* Fixed mode — show slots */}
      {selectedAudiId && selectedMode !== "flexible" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3 text-sm">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <p className="text-muted-foreground leading-snug">
              Slots define the <span className="font-medium text-foreground">time windows users can book</span>.
              Pricing is set in <span className="font-medium text-foreground">Price Configuration → Audi</span>.
              {activeSlots.length > 0 && (
                <span className="ml-1">{activeSlots.length} active slot{activeSlots.length > 1 ? "s" : ""}.</span>
              )}
            </p>
          </div>
          <DataTable
            columns={columns}
            data={slots}
            isLoading={isLoading}
            emptyMessage="No slots yet — click Add Slot to create one"
            emptyIcon={Clock}
          />
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
