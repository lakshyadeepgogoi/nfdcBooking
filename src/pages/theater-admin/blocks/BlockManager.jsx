import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isToday, addMonths, subMonths,
} from "date-fns"
import {
  Plus, ChevronLeft, ChevronRight, X, Loader2,
  Shield, Wrench, Star, Tag, AlertTriangle, Clock, CalendarX,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Form } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import FormDatePicker from "@/components/forms/FormDatePicker"
import FormInput from "@/components/forms/FormInput"
import FormTextarea from "@/components/forms/FormTextarea"
import { useAuth } from "@/hooks/useAuth"
import { listAudis } from "@/api/audi"
import { listBlocks, createFullDayBlock, createPartialBlock, deactivateBlock } from "@/api/adminBlocks"
import { parseList } from "@/utils/parseList"
import { toAPIDate } from "@/utils/formatDate"
import { cn } from "@/lib/utils"

// ─── Constants ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

const CATEGORIES = [
  { value: "govt_priority",  label: "Govt. Priority", icon: Shield, color: "text-blue-600",   bg: "bg-blue-50 text-blue-700 border-blue-200"   },
  { value: "maintenance",    label: "Maintenance",    icon: Wrench, color: "text-amber-600",  bg: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "official_event", label: "Official Event", icon: Star,   color: "text-purple-600", bg: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "other",          label: "Other",          icon: Tag,    color: "text-slate-500",  bg: "bg-slate-50 text-slate-600 border-slate-200" },
]

const catByValue = Object.fromEntries(CATEGORIES.map(c => [c.value, c]))

// ─── Helpers ────────────────────────────────────────────────────────────────────

function normalizeBlock(raw) {
  return {
    id:        raw.blockId,
    date:      toAPIDate(new Date(raw.block.date)),
    startTime: raw.block.startTime ?? null,
    endTime:   raw.block.endTime   ?? null,
    reason:    raw.block.reason    ?? "",
    category:  raw.block.category  ?? null,
    isFullDay: raw.block.isFullDay ?? false,
    notes:     raw.block.notes     ?? null,
  }
}

function CategoryBadge({ category }) {
  const cat = catByValue[category]
  if (!cat) return null
  const Icon = cat.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", cat.bg)}>
      <Icon className="h-3 w-3" />
      {cat.label}
    </span>
  )
}

// ─── Schema ─────────────────────────────────────────────────────────────────────

const baseSchema = {
  date:     z.date({ required_error: "Select a date" }),
  category: z.string().optional(),
  reason:   z.string().min(3, "Reason required (min 3 chars)"),
  notes:    z.string().optional(),
}

const fullDaySchema  = z.object(baseSchema)
const partialSchema  = z.object({
  ...baseSchema,
  startTime: z.string().min(1, "Start time required"),
  endTime:   z.string().min(1, "End time required"),
}).refine(d => d.endTime > d.startTime, { message: "End time must be after start time", path: ["endTime"] })

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function BlockManager() {
  useEffect(() => { document.title = "NFDC Admin — Block Manager" }, [])

  const { user }    = useAuth()
  const theaterId   = user?.theaterId
  const queryClient = useQueryClient()

  const [selectedAudiId, setSelectedAudiId] = useState("")
  const [currentMonth,   setCurrentMonth]   = useState(new Date())
  const [selectedDay,    setSelectedDay]     = useState(null)
  const [addBlockOpen,   setAddBlockOpen]    = useState(false)
  const [blockType,      setBlockType]       = useState("full")
  const [unblockTarget,  setUnblockTarget]   = useState(null)
  const [conflictWarning, setConflictWarning] = useState(null)

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: audis } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn:  () => listAudis(theaterId).then(r => parseList(r.data.data)),
    enabled:  !!theaterId,
  })

  const { data: blocksRaw, isLoading: blocksLoading } = useQuery({
    queryKey: ["blocks", selectedAudiId],
    queryFn:  () => listBlocks(selectedAudiId).then(r => parseList(r.data.data).map(normalizeBlock)),
    enabled:  !!selectedAudiId,
  })

  const blocks = blocksRaw ?? []

  // Map dateStr → [block, …] for O(1) calendar lookups
  const blocksByDate = blocks.reduce((map, b) => {
    if (!map[b.date]) map[b.date] = []
    map[b.date].push(b)
    return map
  }, {})

  // ── Form ─────────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver:      zodResolver(blockType === "full" ? fullDaySchema : partialSchema),
    defaultValues: { date: undefined, reason: "", startTime: "", endTime: "", category: "", notes: "" },
  })

  const categoryValue = useWatch({ control: form.control, name: "category" })

  useEffect(() => {
    form.reset({ date: undefined, reason: "", startTime: "", endTime: "", category: "", notes: "" })
  }, [blockType, form])

  const openAddBlock = () => {
    form.reset({
      date:      selectedDay ?? undefined,
      reason:    "",
      startTime: "",
      endTime:   "",
      category:  "",
      notes:     "",
    })
    setAddBlockOpen(true)
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateBlock(id),
    onSuccess: () => {
      toast.success("Block removed")
      queryClient.invalidateQueries({ queryKey: ["blocks", selectedAudiId] })
      setUnblockTarget(null)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const createMutation = useMutation({
    mutationFn: (values) => {
      const payload = {
        audiId:   selectedAudiId,
        date:     toAPIDate(values.date),
        reason:   values.reason,
        category: values.category || undefined,
        notes:    values.notes    || undefined,
      }
      return blockType === "full"
        ? createFullDayBlock(payload)
        : createPartialBlock({ ...payload, startTime: values.startTime, endTime: values.endTime })
    },
    onSuccess: (res) => {
      toast.success("Block created")
      queryClient.invalidateQueries({ queryKey: ["blocks", selectedAudiId] })
      setAddBlockOpen(false)
      form.reset()
      const conflicts = res?.data?.data?.conflictingBookings ?? []
      if (conflicts.length > 0) setConflictWarning(conflicts)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  // ── Calendar helpers ──────────────────────────────────────────────────────────
  const monthStart   = startOfMonth(currentMonth)
  const monthEnd     = endOfMonth(currentMonth)
  const days         = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart)

  const selectedDayBlocks = selectedDay ? (blocksByDate[toAPIDate(selectedDay)] ?? []) : []

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Block Manager"
        action={{ label: "Add Block", icon: Plus, onClick: openAddBlock, disabled: !selectedAudiId }}
      />

      {/* Audi selector */}
      <Select
        value={selectedAudiId}
        onValueChange={(v) => { setSelectedAudiId(v); setSelectedDay(null) }}
      >
        <SelectTrigger className="w-full sm:w-72">
          <SelectValue placeholder="Select an audi to manage blocks" />
        </SelectTrigger>
        <SelectContent>
          {(audis ?? []).map(a => (
            <SelectItem key={a.audiId ?? a._id} value={a.audiId ?? a._id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Empty state — no audi selected */}
      {!selectedAudiId ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-border rounded-xl text-center">
          <CalendarX className="h-12 w-12 text-muted-foreground/25 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Select an audi to manage blocks</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Blocked dates will be highlighted on the calendar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Calendar (2/3) ─────────────────────────────────────────────── */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">{format(currentMonth, "MMMM yyyy")}</span>
                  {blocksLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_LABELS.map(d => (
                  <div key={d} className="h-8 flex items-center justify-center text-xs text-muted-foreground font-medium">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
                {days.map(day => {
                  const dateStr    = toAPIDate(day)
                  const dayBlocks  = blocksByDate[dateStr] ?? []
                  const hasFullDay = dayBlocks.some(b => b.isFullDay)
                  const hasPartial = dayBlocks.some(b => !b.isFullDay)
                  const count      = dayBlocks.length
                  const isSelected = selectedDay && isSameDay(day, selectedDay)
                  const todayFlag  = isToday(day)

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        "relative h-12 w-full flex flex-col items-center justify-center rounded-lg text-sm transition-colors cursor-pointer",
                        isSelected && "bg-nfdc-primary text-white shadow-sm",
                        !isSelected && hasFullDay && "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
                        !isSelected && !hasFullDay && hasPartial && "bg-amber-50 text-amber-700 dark:bg-amber-900/20",
                        !isSelected && !hasFullDay && !hasPartial && todayFlag && "ring-2 ring-nfdc-accent font-bold",
                        !isSelected && "hover:bg-muted/60",
                      )}
                    >
                      <span className="text-sm font-medium leading-none">{format(day, "d")}</span>

                      {/* Block dot indicator */}
                      {!isSelected && count > 0 && (
                        <span className={cn(
                          "mt-1 h-1.5 w-1.5 rounded-full",
                          hasFullDay ? "bg-red-500" : "bg-amber-500"
                        )} />
                      )}

                      {/* Multi-block count */}
                      {!isSelected && count > 1 && (
                        <span className="absolute top-1 right-1.5 text-[9px] font-bold opacity-60 leading-none">
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-4 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground font-medium">Legend</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-3 w-3 rounded bg-red-100 border border-red-300 shrink-0" />
                  Full day blocked
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-3 w-3 rounded bg-amber-100 border border-amber-300 shrink-0" />
                  Partial block
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-slate-400 ml-0.5 shrink-0" />
                  Multiple blocks
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── Day panel (1/3) ────────────────────────────────────────────── */}
          {selectedDay ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{format(selectedDay, "EEEE")}</p>
                    <p className="text-xs text-muted-foreground">{format(selectedDay, "MMMM d, yyyy")}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 mt-0.5"
                    onClick={() => setSelectedDay(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {selectedDayBlocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Clock className="h-9 w-9 text-muted-foreground/25 mb-2" />
                    <p className="text-sm text-muted-foreground">No blocks on this day</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={openAddBlock}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Block
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDayBlocks.map(block => (
                      <div key={block.id} className="rounded-lg border border-border p-3 space-y-2.5">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant={block.isFullDay ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {block.isFullDay ? "Full Day" : `${block.startTime} – ${block.endTime}`}
                              </Badge>
                              {block.category && <CategoryBadge category={block.category} />}
                            </div>

                            {block.reason && (
                              <p className="text-xs text-foreground/80 leading-snug">{block.reason}</p>
                            )}

                            {block.notes && (
                              <p className="text-xs text-muted-foreground italic leading-snug">
                                {block.notes}
                              </p>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Remove block"
                            onClick={() => setUnblockTarget(block)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Button variant="outline" size="sm" className="w-full" onClick={openAddBlock}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Another Block
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl text-center">
              <p className="text-sm text-muted-foreground">Click a date on the calendar</p>
              <p className="text-xs text-muted-foreground/60 mt-1">to view or manage blocks</p>
            </div>
          )}
        </div>
      )}

      {/* ── Add Block Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Block</DialogTitle>
          </DialogHeader>

          <RadioGroup value={blockType} onValueChange={setBlockType} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="full" id="r-full" />
              <Label htmlFor="r-full">Full Day</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="partial" id="r-partial" />
              <Label htmlFor="r-partial">Partial (time range)</Label>
            </div>
          </RadioGroup>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-4">
              <FormDatePicker control={form.control} name="date" label="Date" />

              {blockType === "partial" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormInput control={form.control} name="startTime" label="Start Time" type="time" />
                  <FormInput control={form.control} name="endTime"   label="End Time"   type="time" />
                </div>
              )}

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Category <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select
                  value={categoryValue}
                  onValueChange={v => form.setValue("category", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => {
                      const Icon = cat.icon
                      return (
                        <SelectItem key={cat.value} value={cat.value}>
                          <span className="flex items-center gap-2">
                            <Icon className={cn("h-3.5 w-3.5", cat.color)} />
                            {cat.label}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <FormTextarea
                control={form.control}
                name="reason"
                label="Reason"
                placeholder="Why is this audi being blocked?"
                rows={2}
              />
              <FormTextarea
                control={form.control}
                name="notes"
                label="Internal Notes"
                placeholder="Any additional notes… (optional)"
                rows={2}
              />

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setAddBlockOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-nfdc-primary hover:bg-nfdc-primary/90"
                >
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Block
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Conflict warning ──────────────────────────────────────────────────── */}
      <AlertDialog open={!!conflictWarning} onOpenChange={o => !o && setConflictWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              {conflictWarning?.length} Conflicting Booking{conflictWarning?.length !== 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>The block was created, but it overlaps with existing active bookings:</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {(conflictWarning ?? []).map(b => (
                    <div key={b.bookingId} className="flex items-center justify-between px-3 py-2">
                      <span className="font-mono text-xs text-muted-foreground truncate">{b.bookingId}</span>
                      <Badge variant="outline" className="text-xs capitalize shrink-0 ml-2">{b.status}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  You may need to reach out to the affected users to reschedule or cancel their bookings.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setConflictWarning(null)}>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Unblock confirm ───────────────────────────────────────────────────── */}
      <AlertDialog open={!!unblockTarget} onOpenChange={o => !o && setUnblockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this block?</AlertDialogTitle>
            <AlertDialogDescription>
              {unblockTarget?.isFullDay
                ? "The full day block will be removed. This date will become available for booking again."
                : `The partial block (${unblockTarget?.startTime} – ${unblockTarget?.endTime}) will be removed.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateMutation.mutate(unblockTarget.id)}
              disabled={deactivateMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
