import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  ArrowLeft, Copy, Loader2, User, Building2, Clapperboard,
  CalendarDays, Clock, Tag, CreditCard, FileCheck, History,
  CheckCircle2, XCircle, AlertCircle, Timer,
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

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value ?? "—"}</p>
      </div>
    </div>
  )
}

function AmountRow({ label, value, bold, muted }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground text-xs" : "text-sm"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function StatusDot({ status }) {
  const colors = {
    confirmed: "bg-green-500", accepted: "bg-green-500",
    pending: "bg-yellow-500",
    cancelled: "bg-red-500", rejected: "bg-red-500",
    postponed: "bg-orange-400", preponed: "bg-blue-400",
    completed: "bg-purple-500",
    paid: "bg-green-500",
  }
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 mt-1.5 ${colors[status] ?? "bg-muted-foreground"}`} />
}

// ─── main component ────────────────────────────────────────────────────────────

export default function BookingDetail() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [confirmAction, setConfirmAction] = useState(null)
  const [docsAction,    setDocsAction]    = useState(null)
  const [overtimeOpen,  setOvertimeOpen]  = useState(false)
  const [deadlineOpen,  setDeadlineOpen]  = useState(false)
  const [refundOpen,    setRefundOpen]    = useState(false)

  const { data: raw, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => getBooking(bookingId).then(r => r.data.data),
    enabled: !!bookingId,
  })

  const booking   = raw?.booking ?? raw
  const id        = booking?.bookingId ?? booking?.id ?? bookingId
  const status    = booking?.lifecycle?.status ?? booking?.status
  const docStatus = booking?.bookingDetails?.documentStatus ?? "not_required"
  const bd        = booking?.bookingDetails ?? {}
  const pricing   = booking?.pricing ?? {}
  const rel       = booking?.relationships ?? {}

  useEffect(() => {
    const shortId = id ? String(id).slice(-8) : null
    document.title = shortId ? `NFDC Admin — Booking #${shortId}` : "NFDC Admin — Booking"
  }, [id])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })

  const statusMutation = useMutation({
    mutationFn: (data) => updateBookingStatus(bookingId, data),
    onSuccess: () => {
      toast.success("Status updated")
      invalidate()
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      setConfirmAction(null)
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

  const dur = duration(bd.startTime, bd.endTime)

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <PageHeader
            title={isLoading ? "Loading…" : `Booking #${String(id ?? "").slice(-8).toUpperCase()}`}
            action={{ label: "Back", icon: ArrowLeft, onClick: () => navigate("/admin/bookings") }}
          />
          {!isLoading && id && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5 ml-px">{id}</p>
          )}
        </div>
        {!isLoading && booking && (
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={status} />
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(id); toast.success("ID copied") }}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy ID
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Booking Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Booking Details</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-36 w-full" /> : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InfoItem icon={User}        label="Customer"    value={rel.userName} />
                    <InfoItem icon={Building2}   label="Theater"     value={rel.theaterName} />
                    <InfoItem icon={Clapperboard} label="Audi"       value={rel.audiName} />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <InfoItem icon={CalendarDays} label="Date"
                      value={formatDate(bd.date)} />
                    <InfoItem icon={Clock} label="Time"
                      value={bd.startTime && bd.endTime ? `${bd.startTime} – ${bd.endTime}` : null} />
                    {dur && (
                      <InfoItem icon={Timer} label="Duration" value={dur} />
                    )}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Booking Type</p>
                        <Badge variant="outline" className="mt-0.5 capitalize text-xs">
                          {bd.bookingType ?? "—"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
                    <span>Placed by: <span className="font-medium text-foreground capitalize">{bd.placedBy ?? "—"}</span></span>
                    <span>·</span>
                    <span>Created: <span className="font-medium text-foreground">{formatDateTime(booking?.createdAt)}</span></span>
                    {booking?.updatedAt && booking.updatedAt !== booking.createdAt && (
                      <>
                        <span>·</span>
                        <span>Updated: <span className="font-medium text-foreground">{formatDateTime(booking.updatedAt)}</span></span>
                      </>
                    )}
                  </div>

                  {/* Cancellation info — only when cancelled */}
                  {status === "cancelled" && (bd.cancellationReason || bd.cancellationCategory) && (
                    <>
                      <Separator />
                      <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 space-y-1">
                        <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">Cancellation</p>
                        {bd.cancellationCategory && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Category: </span>
                            <span className="font-medium capitalize">{bd.cancellationCategory.replace(/_/g, " ")}</span>
                          </p>
                        )}
                        {bd.cancellationReason && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Reason: </span>
                            <span className="font-medium">{bd.cancellationReason}</span>
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Payment</CardTitle>
                {!isLoading && <StatusBadge status={booking?.paymentStage?.status ?? "pending"} />}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-28 w-full" /> : (
                <div className="space-y-1">
                  <AmountRow label="Base (Audi)"      value={formatINR(pricing.baseAmount ?? 0)} />
                  {(pricing.serviceAmount ?? 0) > 0 && (
                    <AmountRow label="Services"        value={formatINR(pricing.serviceAmount)} />
                  )}
                  <AmountRow
                    label={`Tax (${pricing.breakdown?.tax?.rate != null ? `${(pricing.breakdown.tax.rate * 100).toFixed(0)}%` : "GST"})`}
                    value={formatINR(pricing.taxAmount ?? 0)}
                    muted
                  />
                  <Separator className="my-2" />
                  <AmountRow label="Total Amount"     value={formatINR(pricing.totalAmount ?? 0)} bold />
                  {(pricing.depositAmount ?? 0) > 0 && (
                    <AmountRow label="Security Deposit" value={formatINR(pricing.depositAmount)} />
                  )}
                  {(pricing.overtimeCharge ?? 0) > 0 && (
                    <AmountRow
                      label={`Overtime (${pricing.overtimeHours}h)`}
                      value={formatINR(pricing.overtimeCharge)}
                    />
                  )}
                  {pricing.depositRefunded && (
                    <p className="text-xs text-green-600 font-medium pt-1">Deposit refunded</p>
                  )}
                  {booking?.paymentDeadline && booking?.paymentStage?.status !== "paid" && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Payment deadline: <span className="font-medium text-foreground">{formatDateTime(booking.paymentDeadline)}</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status History */}
          {!isLoading && booking?.lifecycle?.statusHistory?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <History className="h-4 w-4" /> Status History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...booking.lifecycle.statusHistory].reverse().map((h, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <StatusDot status={h.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium capitalize">{h.status}</span>
                          {h.note && <span className="text-muted-foreground text-xs">— {h.note}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDateTime(h.timestamp)}</p>
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

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-20 w-full" /> : (
                <div className="space-y-2">
                  {status === "pending" && (
                    <>
                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => setConfirmAction({ action: "accept", label: "Accept this booking and notify the customer?" })}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Accept Booking
                      </Button>
                      <Button className="w-full" variant="destructive"
                        onClick={() => setConfirmAction({ action: "cancel", label: "Cancel this booking? This cannot be undone." })}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                    </>
                  )}
                  {status === "accepted" && (
                    <>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setConfirmAction({ action: "complete", label: "Mark this booking as completed?" })}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Completed
                      </Button>
                      <Button className="w-full" variant="destructive"
                        onClick={() => setConfirmAction({ action: "cancel", label: "Cancel this booking? This cannot be undone." })}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                    </>
                  )}
                  {status === "confirmed" && (
                    <>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setConfirmAction({ action: "complete", label: "Mark this booking as completed?" })}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Completed
                      </Button>
                      <Button className="w-full" variant="destructive"
                        onClick={() => setConfirmAction({ action: "cancel", label: "Cancel this booking? This cannot be undone." })}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                    </>
                  )}
                  {["cancelled", "completed", "superseded"].includes(status) && (
                    <p className="text-sm text-muted-foreground text-center py-2">No actions available</p>
                  )}
                  {!status && <p className="text-sm text-muted-foreground text-center py-2">—</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Verification */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <FileCheck className="h-4 w-4" /> Documents
                </CardTitle>
                {!isLoading && <StatusBadge status={docStatus} />}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? <Skeleton className="h-16 w-full" /> : (
                <>
                  {bd.documentSubmittedAt && (
                    <p className="text-xs text-muted-foreground pb-1">
                      Submitted: <span className="font-medium text-foreground">{formatDateTime(bd.documentSubmittedAt)}</span>
                    </p>
                  )}
                  <Button variant="outline" className="w-full"
                    disabled={["submitted", "verified"].includes(docStatus)}
                    onClick={() => setDocsAction("submitted")}>
                    Mark Submitted
                  </Button>
                  <Button variant="outline" className="w-full border-green-400 text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                    disabled={docStatus !== "submitted"}
                    onClick={() => setDocsAction("verified")}>
                    Mark Verified
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Additional Actions */}
          <RoleGuard permissions={PERMISSIONS.MANAGE_OWN_BOOKINGS}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Finance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full" onClick={() => setOvertimeOpen(true)}>
                  Add Overtime Charge
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setDeadlineOpen(true)}>
                  Extend Payment Deadline
                </Button>
                <Button variant="outline"
                  className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
                  disabled={!pricing.depositAmount || pricing.depositRefunded}
                  onClick={() => setRefundOpen(true)}>
                  {pricing.depositRefunded ? "Deposit Refunded" : "Refund Deposit"}
                </Button>
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
              onClick={() => statusMutation.mutate({
                action: confirmAction.action,
                ...(confirmAction.action === "cancel" ? { reason: "Admin cancelled", cancellationCategory: "admin_policy" } : {}),
              })}
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
            <AlertDialogTitle>Trigger Deposit Refund?</AlertDialogTitle>
            <AlertDialogDescription>
              This will initiate a refund of {formatINR(pricing.depositAmount ?? 0)} and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => refundMutation.mutate()} disabled={refundMutation.isPending}>
              {refundMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Initiate Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
