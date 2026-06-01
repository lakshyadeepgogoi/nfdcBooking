import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  ArrowLeft, Copy, Loader2, Clapperboard,
  CalendarDays, Clock, CreditCard, FileCheck, History,
  CheckCircle2, XCircle, AlertCircle, Timer, MapPin, Banknote,
} from "lucide-react"
import RoleGuard from "@/components/common/RoleGuard"
import { PERMISSIONS } from "@/auth/permissions"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import StatusBadge from "@/components/common/StatusBadge"
import FormInput from "@/components/forms/FormInput"
import {
  getBooking, updateBookingStatus, markDocsSubmitted, markDocsVerified,
  addOvertimeCharge, extendDeadline, refundDeposit,
} from "@/api/bookings"
import { formatDate, formatDateTime } from "@/utils/formatDate"
import { formatINR } from "@/utils/formatCurrency"

// ─── helpers ──────────────────────────────────────────────────────────────────

function duration(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function getInitials(name) {
  if (!name) return "?"
  return name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?"
}

function AmountRow({ label, value, bold, muted, positive }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground text-xs" : "text-sm"} ${positive ? "text-green-600" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function MetaChip({ label, value }) {
  return (
    <span className="text-xs text-muted-foreground">
      {label}: <span className="font-medium text-foreground">{value}</span>
    </span>
  )
}

const STATUS_DOT_COLORS = {
  confirmed: "bg-green-500", accepted: "bg-green-500",
  pending:   "bg-yellow-500",
  cancelled: "bg-red-500", rejected: "bg-red-500",
  postponed: "bg-orange-400", preponed: "bg-blue-400",
  completed: "bg-purple-500", paid: "bg-green-500",
}

// ─── main component ────────────────────────────────────────────────────────────

export default function BookingDetail() {
  const { bookingId } = useParams()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()

  const [confirmAction, setConfirmAction] = useState(null)
  const [docsAction,    setDocsAction]    = useState(null)
  const [overtimeOpen,  setOvertimeOpen]  = useState(false)
  const [deadlineOpen,  setDeadlineOpen]  = useState(false)
  const [refundOpen,    setRefundOpen]    = useState(false)

  const { data: raw, isLoading, isFetching } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn:  () => getBooking(bookingId).then(r => r.data.data),
    enabled:  !!bookingId,
  })

  const booking   = raw?.booking ?? raw
  const id        = booking?.bookingId ?? booking?.id ?? bookingId
  const status    = booking?.lifecycle?.status ?? booking?.status
  const docStatus = booking?.bookingDetails?.documentStatus ?? "not_required"
  const bd        = booking?.bookingDetails ?? {}
  const pricing   = booking?.pricing ?? {}
  const rel       = booking?.relationships ?? {}
  const dur       = duration(bd.startTime, bd.endTime)
  const shortId   = id ? String(id).slice(-8).toUpperCase() : null

  useEffect(() => {
    document.title = shortId ? `NFDC Admin — Booking #${shortId}` : "NFDC Admin — Booking"
  }, [shortId])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })

  const statusMutation = useMutation({
    mutationFn: (data) => updateBookingStatus(bookingId, data),
    onSuccess: () => {
      toast.success("Status updated")
      invalidate()
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Something went wrong."),
  })

  const docsMutation = useMutation({
    mutationFn: (action) => action === "submitted" ? markDocsSubmitted(bookingId) : markDocsVerified(bookingId),
    onSuccess: (_, action) => {
      toast.success(`Documents marked as ${action}`)
      invalidate()
      setDocsAction(null)
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Something went wrong."),
  })

  const overtimeForm = useForm({
    resolver: zodResolver(z.object({ overtimeHours: z.coerce.number().positive("Must be positive") })),
    defaultValues: { overtimeHours: "" },
  })
  const overtimeMutation = useMutation({
    mutationFn: (d) => addOvertimeCharge(bookingId, { overtimeHours: Number(d.overtimeHours) }),
    onSuccess: () => { toast.success("Overtime charge added"); invalidate(); setOvertimeOpen(false); overtimeForm.reset() },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Something went wrong."),
  })

  const deadlineForm = useForm({
    resolver: zodResolver(z.object({ additionalHours: z.coerce.number().positive("Must be positive") })),
    defaultValues: { additionalHours: "" },
  })
  const deadlineMutation = useMutation({
    mutationFn: (d) => extendDeadline(bookingId, { additionalHours: Number(d.additionalHours) }),
    onSuccess: () => { toast.success("Deadline extended"); invalidate(); setDeadlineOpen(false); deadlineForm.reset() },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Something went wrong."),
  })

  const refundMutation = useMutation({
    mutationFn: () => refundDeposit(bookingId),
    onSuccess: () => { toast.success("Refund initiated"); invalidate(); setRefundOpen(false) },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Something went wrong."),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Loading…" action={{ label: "Back", icon: ArrowLeft, onClick: () => navigate(-1) }} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={`Booking #${shortId ?? "—"}`}
          action={{ label: "Back", icon: ArrowLeft, onClick: () => navigate(-1) }}
        />
        {booking && (
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={status} />
            <Button
              variant="outline" size="sm"
              onClick={() => { navigator.clipboard.writeText(id); toast.success("ID copied") }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy ID
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Booking Info ─────────────────────────────────────────── */}
          <Card className="overflow-hidden">
            {/* Hero header */}
            <div className="bg-muted/40 border-b px-6 py-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Booking Reference</p>
                  <p className="text-2xl font-bold font-mono tracking-tight">#{shortId}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-[260px]">{id}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={status} />
                  {bd.bookingType && (
                    <Badge variant="outline" className="capitalize text-xs">{bd.bookingType}</Badge>
                  )}
                </div>
              </div>
            </div>

            <CardContent className="p-6 space-y-5">

              {/* Customer & Venue ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Customer with avatar */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-nfdc-primary/10 text-nfdc-primary flex items-center justify-center text-sm font-semibold shrink-0">
                    {getInitials(rel.userName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Customer</p>
                    <p className="text-sm font-semibold truncate">{rel.userName ?? "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Theater</p>
                    <p className="text-sm font-semibold truncate">{rel.theaterName ?? "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Clapperboard className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Audi</p>
                    <p className="text-sm font-semibold truncate">{rel.audiName ?? "—"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Date & Time block ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 rounded-lg border overflow-hidden">
                {[
                  { label: "Date",       value: formatDate(bd.date) ?? "—",                       icon: CalendarDays },
                  { label: "Start",      value: bd.startTime ?? "—",                              icon: Clock        },
                  { label: "End",        value: bd.endTime   ?? "—",                              icon: Clock        },
                  { label: "Duration",   value: dur ?? "—",                                       icon: Timer        },
                ].map(({ label, value, icon: Icon }, i) => (
                  <div key={label} className={`p-4 space-y-1 ${i < 3 ? "border-r last:border-r-0" : ""} border-b sm:border-b-0`}>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
                      <Icon className="h-3 w-3" />
                      {label}
                    </div>
                    <p className="text-sm font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              {/* Meta footer ── */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                <MetaChip label="Placed by" value={<span className="capitalize">{bd.placedBy ?? "—"}</span>} />
                <MetaChip label="Created"   value={formatDateTime(booking?.createdAt)} />
                {booking?.updatedAt && booking.updatedAt !== booking.createdAt && (
                  <MetaChip label="Updated" value={formatDateTime(booking.updatedAt)} />
                )}
              </div>

              {/* Cancellation ── */}
              {status === "cancelled" && (bd.cancellationReason || bd.cancellationCategory) && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-red-700">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-semibold">Cancellation Details</p>
                  </div>
                  {bd.cancellationCategory && (
                    <p className="text-sm text-red-700">
                      <span className="text-red-600/70">Category: </span>
                      <span className="font-medium capitalize">{bd.cancellationCategory.replace(/_/g, " ")}</span>
                    </p>
                  )}
                  {bd.cancellationReason && (
                    <p className="text-sm text-red-700">
                      <span className="text-red-600/70">Reason: </span>
                      <span className="font-medium">{bd.cancellationReason}</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  Payment Summary
                </CardTitle>
                <StatusBadge status={booking?.paymentStage?.status ?? "pending"} />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-0.5">
                <AmountRow label="Audi (Base)"  value={formatINR(pricing.baseAmount ?? 0)} />
                {(pricing.serviceAmount ?? 0) > 0 && (
                  <AmountRow label="Services"   value={formatINR(pricing.serviceAmount)} />
                )}
                <AmountRow
                  label={`GST (${pricing.breakdown?.tax?.rate != null ? `${(pricing.breakdown.tax.rate * 100).toFixed(0)}%` : "—"})`}
                  value={formatINR(pricing.taxAmount ?? 0)}
                  muted
                />
                {(pricing.overtimeCharge ?? 0) > 0 && (
                  <AmountRow
                    label={`Overtime (${pricing.overtimeHours}h)`}
                    value={formatINR(pricing.overtimeCharge)}
                  />
                )}
                <Separator className="my-2" />
                <AmountRow label="Booking Cost" value={formatINR(pricing.totalAmount ?? 0)} bold />

                {(pricing.depositAmount ?? 0) > 0 && (
                  <>
                    <AmountRow
                      label={`Security Deposit${pricing.depositType === "percentage"
                        ? ` (${pricing.breakdown?.deposit?.percentage ?? ""}%)`
                        : pricing.depositType === "fixed" ? " (Fixed)" : ""
                      }`}
                      value={`+ ${formatINR(pricing.depositAmount)}`}
                    />
                    <Separator className="my-2" />
                    <AmountRow
                      label="Amount Charged"
                      value={formatINR(pricing.amountCharged ?? ((pricing.totalAmount ?? 0) + (pricing.depositAmount ?? 0)))}
                      bold
                    />
                  </>
                )}
              </div>

              {/* Deposit status banner */}
              {(pricing.depositAmount ?? 0) > 0 && (
                <div className="mt-3">
                  {pricing.depositRefunded ? (
                    <div className="flex items-start gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium">Deposit refunded</span>
                        {pricing.depositRefundedAt && (
                          <span className="text-green-600/70 ml-1">· {formatDateTime(pricing.depositRefundedAt)}</span>
                        )}
                        {pricing.depositRefundNote && (
                          <p className="text-green-600/70 mt-0.5 italic">"{pricing.depositRefundNote}"</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <Banknote className="h-3.5 w-3.5 shrink-0" />
                      <span>Security deposit held · refundable after event</span>
                    </div>
                  )}
                </div>
              )}
              {booking?.paymentDeadline && booking?.paymentStage?.status !== "paid" && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                  Payment deadline:{" "}
                  <span className="font-medium text-foreground">{formatDateTime(booking.paymentDeadline)}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Status History ────────────────────────────────────────── */}
          {booking?.lifecycle?.statusHistory?.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Status History
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="relative pl-4 space-y-4">
                  {/* vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                  {[...booking.lifecycle.statusHistory].reverse().map((h, i) => (
                    <div key={i} className="relative flex items-start gap-3">
                      <span className={`relative z-10 mt-1 h-3 w-3 rounded-full border-2 border-background shrink-0 ${STATUS_DOT_COLORS[h.status] ?? "bg-muted-foreground"}`} />
                      <div className="flex-1 min-w-0 -mt-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold capitalize">{h.status?.replace(/_/g, " ")}</span>
                          {h.note && <span className="text-xs text-muted-foreground italic">"{h.note}"</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(h.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Actions ── */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {status === "pending" && (
                  <>
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white justify-start"
                      disabled={statusMutation.isPending || isFetching}
                      onClick={() => setConfirmAction({ action: "accept", label: "Accept this booking and notify the customer?" })}
                    >
                      {statusMutation.isPending
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="mr-2 h-4 w-4" />
                      }
                      Accept Booking
                    </Button>
                    <Button
                      className="w-full justify-start" variant="destructive"
                      disabled={statusMutation.isPending || isFetching}
                      onClick={() => setConfirmAction({ action: "cancel", label: "Cancel this booking? This cannot be undone." })}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Cancel Booking
                    </Button>
                  </>
                )}
                {(status === "accepted" || status === "confirmed") && (
                  <>
                    <Button
                      className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90 justify-start"
                      disabled={statusMutation.isPending || isFetching}
                      onClick={() => setConfirmAction({ action: "complete", label: "Mark this booking as completed?" })}
                    >
                      {statusMutation.isPending
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="mr-2 h-4 w-4" />
                      }
                      Mark Completed
                    </Button>
                    <Button
                      className="w-full justify-start" variant="destructive"
                      disabled={statusMutation.isPending || isFetching}
                      onClick={() => setConfirmAction({ action: "cancel", label: "Cancel this booking? This cannot be undone." })}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Cancel Booking
                    </Button>
                  </>
                )}
                {["cancelled", "completed", "superseded"].includes(status) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                    No further actions available
                  </div>
                )}
                {!status && <p className="text-sm text-muted-foreground text-center py-3">—</p>}
              </div>
            </CardContent>
          </Card>

          {/* Documents ── */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                  Documents
                </CardTitle>
                <StatusBadge status={docStatus} />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {bd.documentSubmittedAt && (
                <p className="text-xs text-muted-foreground pb-1">
                  Submitted: <span className="font-medium text-foreground">{formatDateTime(bd.documentSubmittedAt)}</span>
                </p>
              )}
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={["submitted", "verified"].includes(docStatus)}
                onClick={() => setDocsAction("submitted")}
              >
                <FileCheck className="mr-2 h-4 w-4" /> Mark Submitted
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40"
                disabled={docStatus !== "submitted"}
                onClick={() => setDocsAction("verified")}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Verified
              </Button>
            </CardContent>
          </Card>

          {/* Finance ── */}
          <RoleGuard permissions={PERMISSIONS.MANAGE_OWN_BOOKINGS}>
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Finance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => setOvertimeOpen(true)}>
                  <Timer className="mr-2 h-4 w-4" /> Add Overtime Charge
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => setDeadlineOpen(true)}>
                  <Clock className="mr-2 h-4 w-4" /> Extend Payment Deadline
                </Button>
                {(pricing.depositAmount ?? 0) > 0 && (
                  <Button
                    variant="outline"
                    className="w-full justify-start border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                    disabled={
                      pricing.depositRefunded ||
                      status !== "confirmed"
                    }
                    title={pricing.depositRefunded
                      ? "Already refunded"
                      : status !== "confirmed"
                      ? "Refund only available for confirmed bookings"
                      : undefined
                    }
                    onClick={() => setRefundOpen(true)}
                  >
                    <Banknote className="mr-2 h-4 w-4" />
                    {pricing.depositRefunded ? "Deposit Refunded" : "Refund Deposit"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </RoleGuard>

        </div>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Capture and clear immediately so a second click is impossible
                const pending = confirmAction
                setConfirmAction(null)
                statusMutation.mutate({
                  action: pending.action,
                  ...(pending.action === "cancel" ? { reason: "Admin cancelled", cancellationCategory: "admin_policy" } : {}),
                })
              }}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!docsAction} onOpenChange={(o) => !o && setDocsAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark documents as {docsAction}?</AlertDialogTitle>
            <AlertDialogDescription>This will update the document verification status.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => docsMutation.mutate(docsAction)} disabled={docsMutation.isPending}>
              {docsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={overtimeOpen} onOpenChange={setOvertimeOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Add Overtime Charge</DialogTitle></DialogHeader>
          <Form {...overtimeForm}>
            <form onSubmit={overtimeForm.handleSubmit(v => overtimeMutation.mutate(v))} className="space-y-4">
              <FormInput control={overtimeForm.control} name="overtimeHours" label="Overtime Hours" type="number" placeholder="e.g. 2" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOvertimeOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={overtimeMutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                  {overtimeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Charge
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deadlineOpen} onOpenChange={setDeadlineOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Extend Payment Deadline</DialogTitle></DialogHeader>
          <Form {...deadlineForm}>
            <form onSubmit={deadlineForm.handleSubmit(v => deadlineMutation.mutate(v))} className="space-y-4">
              <FormInput control={deadlineForm.control} name="additionalHours" label="Additional Hours" type="number" placeholder="e.g. 24" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeadlineOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={deadlineMutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                  {deadlineMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Extend
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={refundOpen} onOpenChange={setRefundOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund Security Deposit?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>This will initiate a refund of <strong className="text-foreground">{formatINR(pricing.depositAmount ?? 0)}</strong> to the customer and cannot be undone.</p>
                {pricing.amountCharged && (
                  <p className="text-xs">Customer paid {formatINR(pricing.amountCharged)} total ({formatINR(pricing.totalAmount ?? 0)} booking cost + {formatINR(pricing.depositAmount ?? 0)} deposit).</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => refundMutation.mutate()} disabled={refundMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white">
              {refundMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
