import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  CheckCircle2, XCircle, CalendarClock, ArrowRight, Loader2,
  User, Building2, Clock, Info,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Form } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import EmptyState from "@/components/common/EmptyState"
import StatusBadge from "@/components/common/StatusBadge"
import FormInput from "@/components/forms/FormInput"
import FormDatePicker from "@/components/forms/FormDatePicker"
import FormTextarea from "@/components/forms/FormTextarea"
import { listBookings, getBooking, updateBookingStatus } from "@/api/bookings"
import { parseList } from "@/utils/parseList"
import { toAPIDate } from "@/utils/formatDate"
import { formatINR } from "@/utils/formatCurrency"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—"
  try { return format(new Date(d), "dd MMM yyyy") } catch { return String(d) }
}

function fmtRange(s, e) {
  if (!s && !e) return "—"
  return `${s ?? "?"} – ${e ?? "?"}`
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
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-semibold truncate ${highlight ? "text-nfdc-primary" : "text-foreground"}`}>
        {fmtDate(date)}
      </p>
      <p className="text-xs text-muted-foreground">{fmtRange(startTime, endTime)}</p>
    </div>
  )
}

// ─── RescheduleCard (user-initiated, pending admin action) ─────────────────────

function RescheduleCard({ booking, onApprove, onReject }) {
  const proposed  = booking?.proposedChange
  const priceDiff = proposed?.priceDiff ?? 0
  const user      = booking?.user
  const audi      = booking?.audi

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={booking?.lifecycle?.status} />
              {priceDiff > 0 && (
                <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                  +{formatINR(priceDiff)} extra
                </Badge>
              )}
            </div>
            <p className="font-mono text-xs text-muted-foreground">{booking?.bookingId}</p>
          </div>
          <div className="text-xs text-right space-y-1 shrink-0">
            <div className="flex items-center gap-1.5 text-muted-foreground justify-end">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[140px]">{user?.name ?? user?.email ?? "—"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground justify-end">
              <Building2 className="h-3 w-3" />
              <span className="truncate max-w-[140px]">{audi?.name ?? "—"}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Schedule comparison */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <ScheduleBlock
            label="Current"
            date={booking?.date}
            startTime={booking?.startTime}
            endTime={booking?.endTime}
          />
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2 border border-amber-100">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Approval will prompt user to pay an additional {formatINR(priceDiff)}.
          </div>
        )}

        {/* User's note */}
        {(booking?.note || proposed?.note) && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2.5">
            &quot;{booking?.note ?? proposed?.note}&quot;
          </p>
        )}

        <Separator />

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
            onClick={() => onReject(booking)}
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
          </Button>
          <Button
            size="sm"
            className="bg-nfdc-primary hover:bg-nfdc-primary/90"
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

function InProgressCard({ booking }) {
  const status   = booking?.lifecycle?.status
  const proposed = booking?.proposedChange
  const user     = booking?.user
  const audi     = booking?.audi

  const waitMsg = {
    postponed:                   "Waiting for user to accept or reject the proposed dates.",
    preponed:                    "Waiting for user to accept or reject the proposed dates.",
    awaiting_reschedule_payment: `Waiting for user to pay ${formatINR(booking?.pricing?.rescheduleAmount ?? 0)} reschedule fee.`,
  }[status] ?? "Pending action."

  return (
    <Card className="opacity-90">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-1">
            <StatusBadge status={status} />
            <p className="font-mono text-xs text-muted-foreground">{booking?.bookingId}</p>
          </div>
          <div className="text-xs text-right space-y-1 shrink-0">
            <div className="flex items-center gap-1.5 text-muted-foreground justify-end">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[140px]">{user?.name ?? user?.email ?? "—"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground justify-end">
              <Building2 className="h-3 w-3" />
              <span className="truncate max-w-[140px]">{audi?.name ?? "—"}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3 grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <ScheduleBlock
            label="Original"
            date={booking?.date}
            startTime={booking?.startTime}
            endTime={booking?.endTime}
          />
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <ScheduleBlock
            label="Proposed"
            date={proposed?.date}
            startTime={proposed?.startTime}
            endTime={proposed?.endTime}
            highlight
          />
        </div>

        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2 border border-amber-100">
          <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {waitMsg}
        </div>
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

// ─── PostponeDialog ────────────────────────────────────────────────────────────

function PostponeDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient()
  const [rawId,   setRawId]   = useState("")
  const [booking, setBooking] = useState(null)
  const [fetching, setFetching] = useState(false)

  const form = useForm({
    resolver:      zodResolver(postponeSchema),
    defaultValues: { action: "postpone", date: undefined, startTime: "", endTime: "", note: "" },
  })

  const handleClose = () => {
    setRawId("")
    setBooking(null)
    form.reset()
    onOpenChange(false)
  }

  const handleFetch = async () => {
    const id = rawId.trim()
    if (!id) return
    setFetching(true)
    setBooking(null)
    try {
      const r = await getBooking(id)
      setBooking(r.data.data ?? r.data)
      form.reset({ action: "postpone", date: undefined, startTime: "", endTime: "", note: "" })
    } catch {
      toast.error("Booking not found or access denied")
    } finally {
      setFetching(false)
    }
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

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col" aria-describedby={undefined}>
        <DialogHeader className="shrink-0">
          <DialogTitle>Propose New Dates</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Booking ID lookup */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Booking ID</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. NFDC-2026-001"
                value={rawId}
                onChange={e => setRawId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleFetch()}
                className="h-9"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFetch}
                disabled={!rawId.trim() || fetching}
                className="shrink-0"
              >
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
              </Button>
            </div>
          </div>

          {/* Booking summary */}
          {booking && (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium">{booking.bookingId}</span>
                  <StatusBadge status={booking.lifecycle?.status} />
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    {booking.user?.name ?? booking.user?.email ?? "—"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" />
                    {booking.audi?.name ?? "—"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="h-3 w-3" />
                    {fmtDate(booking.date)} · {fmtRange(booking.startTime, booking.endTime)}
                  </div>
                </div>
              </div>

              <Separator />

              <Form {...form}>
                <form id="postpone-form" onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Action</Label>
                    <RadioGroup
                      value={form.watch("action")}
                      onValueChange={v => form.setValue("action", v, { shouldValidate: true })}
                      className="flex gap-5"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="postpone" id="r-postpone" />
                        <Label htmlFor="r-postpone" className="font-normal text-sm cursor-pointer">
                          Postpone (later date)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="prepone" id="r-prepone" />
                        <Label htmlFor="r-prepone" className="font-normal text-sm cursor-pointer">
                          Prepone (earlier date)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <FormDatePicker control={form.control} name="date" label="New Date" />

                  <div className="grid grid-cols-2 gap-4">
                    <FormInput control={form.control} name="startTime" label="Start Time" type="time" />
                    <FormInput control={form.control} name="endTime"   label="End Time"   type="time" />
                  </div>

                  <FormTextarea
                    control={form.control}
                    name="note"
                    label="Note"
                    placeholder="Reason for the reschedule (optional)"
                    rows={2}
                  />
                </form>
              </Form>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          {booking && (
            <Button
              type="submit"
              form="postpone-form"
              disabled={mutation.isPending}
              className="bg-nfdc-primary hover:bg-nfdc-primary/90"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Propose Dates
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const inProgressList    = [
    ...parseList(postponedRaw),
    ...parseList(preponedRaw),
    ...parseList(awaitingRaw),
  ]

  const pendingCount    = pendingList.length
  const inProgressCount = inProgressList.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reschedule Management"
        action={{ label: "Propose New Dates", icon: CalendarClock, onClick: () => setPostponeOpen(true) }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Tab bar — underline style matching the rest of the app */}
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
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <Card key={i}><CardContent className="h-52 animate-pulse bg-muted/30 pt-6" /></Card>
                ))}
              </div>
            ) : pendingList.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No pending requests"
                message="All user reschedule requests have been reviewed."
              />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
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
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <Card key={i}><CardContent className="h-40 animate-pulse bg-muted/30 pt-6" /></Card>
                ))}
              </div>
            ) : inProgressList.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nothing in progress"
                message="No bookings are currently awaiting user response or payment."
              />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
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
