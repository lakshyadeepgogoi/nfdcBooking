import { useEffect, useState } from "react"
import { pick } from "@/utils/pick"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Copy, Loader2 } from "lucide-react"
import RoleGuard from "@/components/common/RoleGuard"
import { PERMISSIONS } from "@/auth/permissions"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import FormDatePicker from "@/components/forms/FormDatePicker"
import {
  getBooking, updateBookingStatus, markDocsSubmitted, markDocsVerified,
  addOvertimeCharge, extendDeadline, refundDeposit,
} from "@/api/bookings"
import { formatDate, formatDateTime, toAPIDate } from "@/utils/formatDate"
import { formatINR } from "@/utils/formatCurrency"

function InfoRow({ label, value }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  )
}

export default function BookingDetail() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [confirmAction, setConfirmAction] = useState(null)
  const [docsAction, setDocsAction] = useState(null)
  const [overtimeOpen, setOvertimeOpen] = useState(false)
  const [deadlineOpen, setDeadlineOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

  const { data: raw, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => getBooking(bookingId).then(r => r.data.data),
    enabled: !!bookingId,
  })

  const booking = raw?.booking ?? raw
  const id = booking?.id ?? booking?.bookingId ?? bookingId
  const status = booking?.status

  useEffect(() => {
    const shortId = id ? String(id).slice(-8) : null
    document.title = shortId
      ? `NFDC Admin — Booking #${shortId}`
      : "NFDC Admin — Booking Detail"
  }, [id])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })

  const statusMutation = useMutation({
    mutationFn: (data) => updateBookingStatus(bookingId, data),
    onSuccess: () => {
      toast.success(`Status updated`)
      invalidate()
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      setConfirmAction(null)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const docsMutation = useMutation({
    mutationFn: (action) => action === "submitted" ? markDocsSubmitted(bookingId) : markDocsVerified(bookingId),
    onSuccess: (_, action) => {
      toast.success(`Documents marked as ${action}`)
      invalidate()
      setDocsAction(null)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const overtimeForm = useForm({
    resolver: zodResolver(z.object({
      amount: z.coerce.number().positive("Must be positive"),
      reason: z.string().min(1, "Reason required"),
    })),
    defaultValues: { amount: "", reason: "" },
  })

  const overtimeMutation = useMutation({
    mutationFn: (data) => addOvertimeCharge(bookingId, data),
    onSuccess: () => {
      toast.success("Overtime charge added")
      invalidate()
      setOvertimeOpen(false)
      overtimeForm.reset()
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const deadlineForm = useForm({
    resolver: zodResolver(z.object({
      newDeadline: z.date({ required_error: "Select a date" }),
    })),
    defaultValues: { newDeadline: undefined },
  })

  const deadlineMutation = useMutation({
    mutationFn: (data) => extendDeadline(bookingId, { newDeadline: toAPIDate(data.newDeadline) }),
    onSuccess: () => {
      toast.success("Deadline extended")
      invalidate()
      setDeadlineOpen(false)
      deadlineForm.reset()
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const refundMutation = useMutation({
    mutationFn: () => refundDeposit(bookingId),
    onSuccess: () => {
      toast.success("Refund initiated")
      invalidate()
      setRefundOpen(false)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <PageHeader
            title={`Booking #${id ? String(id).slice(-8) : "..."}`}
            action={{ label: "Back to Bookings", icon: ArrowLeft, onClick: () => navigate("/admin/bookings") }}
          />
        </div>
        {booking && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => { navigator.clipboard.writeText(id); toast.success("Booking ID copied") }}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy ID
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Booking Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Booking Information</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-32 w-full" /> : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <InfoRow label="Customer Name" value={pick(booking?.user?.name, booking?.customerName, booking?.user)} />
                  <InfoRow label="Phone" value={pick(booking?.user?.phone, booking?.phone)} />
                  <InfoRow label="Email" value={pick(booking?.user?.email, booking?.email)} />
                  <InfoRow label="Audi" value={pick(booking?.audi?.name, booking?.audiName, booking?.audi)} />
                  <InfoRow label="Date" value={booking?.date ? formatDate(booking.date) : null} />
                  <InfoRow label="Time" value={booking?.startTime && booking?.endTime ? `${booking.startTime}–${booking.endTime}` : null} />
                  <InfoRow label="Booking Type" value={booking?.bookingType} />
                  <InfoRow label="Created At" value={booking?.createdAt ? formatDateTime(booking.createdAt) : null} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader><CardTitle className="text-base">Payment Details</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-24 w-full" /> : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="text-xl font-bold">{formatINR(booking?.totalAmount ?? booking?.amount ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deposit Paid</p>
                    <p className="text-sm font-medium">{formatINR(booking?.depositPaid ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="text-sm font-medium">{formatINR(booking?.balance ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Payment Status</p>
                    <div className="mt-0.5"><StatusBadge status={booking?.paymentStatus ?? "pending"} /></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Status Card */}
          <Card>
            <CardHeader><CardTitle className="text-base">Booking Status</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-20 w-full" /> : (
                <>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={status} />
                    <span className="text-sm capitalize">{status}</span>
                  </div>
                  <div className="flex flex-col gap-2 mt-3">
                    {status === "pending" && (
                      <>
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => setConfirmAction({ action: "accept", label: "Confirm this booking?" })}
                        >Confirm Booking</Button>
                        <Button
                          variant="destructive"
                          onClick={() => setConfirmAction({ action: "cancel", label: "Cancel this booking? This cannot be undone." })}
                        >Cancel</Button>
                      </>
                    )}
                    {status === "confirmed" && (
                      <>
                        <Button
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => setConfirmAction({ action: "complete", label: "Mark this booking as completed?" })}
                        >Mark Completed</Button>
                        <Button
                          variant="destructive"
                          onClick={() => setConfirmAction({ action: "cancel", label: "Cancel this booking? This cannot be undone." })}
                        >Cancel</Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader><CardTitle className="text-base">Document Verification</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? <Skeleton className="h-16 w-full" /> : (
                <>
                  <div className="text-sm mb-2">
                    <StatusBadge status={booking?.documentsStatus ?? "pending"} />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={booking?.documentsStatus === "submitted" || booking?.documentsStatus === "verified"}
                    onClick={() => setDocsAction("submitted")}
                  >Mark Submitted</Button>
                  <Button
                    variant="outline"
                    className="w-full border-green-400 text-green-700 hover:bg-green-50"
                    disabled={booking?.documentsStatus === "verified"}
                    onClick={() => setDocsAction("verified")}
                  >Mark Verified</Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Extra Actions — theater admins only */}
          <RoleGuard permissions={PERMISSIONS.MANAGE_OWN_BOOKINGS}>
            <Card>
              <CardHeader><CardTitle className="text-base">Additional Actions</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => setOvertimeOpen(true)}>Add Overtime Charge</Button>
                <Button variant="outline" onClick={() => setDeadlineOpen(true)}>Extend Payment Deadline</Button>
                <Button
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => setRefundOpen(true)}
                >Refund Deposit</Button>
              </CardContent>
            </Card>
          </RoleGuard>
        </div>
      </div>

      {/* Status confirm dialog */}
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

      {/* Docs confirm dialog */}
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

      {/* Overtime dialog */}
      <Dialog open={overtimeOpen} onOpenChange={setOvertimeOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Add Overtime Charge</DialogTitle></DialogHeader>
          <Form {...overtimeForm}>
            <form onSubmit={overtimeForm.handleSubmit(v => overtimeMutation.mutate(v))} className="space-y-4">
              <FormInput control={overtimeForm.control} name="amount" label="Amount (₹)" type="number" />
              <FormInput control={overtimeForm.control} name="reason" label="Reason" placeholder="Overtime reason..." />
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

      {/* Deadline dialog */}
      <Dialog open={deadlineOpen} onOpenChange={setDeadlineOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Extend Payment Deadline</DialogTitle></DialogHeader>
          <Form {...deadlineForm}>
            <form onSubmit={deadlineForm.handleSubmit(v => deadlineMutation.mutate(v))} className="space-y-4">
              <FormDatePicker control={deadlineForm.control} name="newDeadline" label="New Deadline" />
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

      {/* Refund alert */}
      <AlertDialog open={refundOpen} onOpenChange={setRefundOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trigger Deposit Refund?</AlertDialogTitle>
            <AlertDialogDescription>
              This will initiate the refund process and cannot be undone.
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
