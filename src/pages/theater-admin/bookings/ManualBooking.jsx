import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Form } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import FormInput from "@/components/forms/FormInput"
import FormSelect from "@/components/forms/FormSelect"
import FormTextarea from "@/components/forms/FormTextarea"
import FormDatePicker from "@/components/forms/FormDatePicker"
import { useAuth } from "@/hooks/useAuth"
import { listAudis } from "@/api/audi"
import { manualBookingOffline, manualBookingWaived } from "@/api/bookings"
import { parseList } from "@/utils/parseList"
import { toAPIDate } from "@/utils/formatDate"

const today = new Date(); today.setHours(0, 0, 0, 0)

const commonFields = {
  customerName: z.string().min(2, "Min 2 characters"),
  customerPhone: z.string().regex(/^\d{10}$/, "Must be exactly 10 digits"),
  customerEmail: z.string().email("Enter a valid email"),
  audiId: z.string().min(1, "Select an audi"),
  date: z.date({ required_error: "Select a date" }).refine(d => d >= today, "Date cannot be in the past"),
  startTime: z.string().min(1, "Start time required"),
  endTime: z.string().min(1, "End time required"),
  bookingType: z.enum(["govt", "non-govt"]),
  notes: z.string().optional(),
}

const offlineSchema = z.object({
  ...commonFields,
  paymentReference: z.string().min(1, "Payment reference required"),
})

const waivedSchema = z.object({
  ...commonFields,
  waiverReason: z.string().min(10, "Provide a detailed reason (min 10 chars)"),
})

function BookingForm({ schema, onSubmit, isPending, audiOptions, submitLabel }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: "", customerPhone: "", customerEmail: "",
      audiId: "", startTime: "", endTime: "",
      bookingType: "govt", notes: "",
      paymentReference: "", waiverReason: "",
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput control={form.control} name="customerName" label="Customer Name" placeholder="John Doe" />
          <FormInput control={form.control} name="customerPhone" label="Phone" placeholder="9876543210" />
        </div>
        <FormInput control={form.control} name="customerEmail" label="Email" type="email" placeholder="customer@example.com" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect control={form.control} name="audiId" label="Audi" placeholder="Select an audi" options={audiOptions} />
          <FormSelect
            control={form.control}
            name="bookingType"
            label="Booking Type"
            options={[{ value: "govt", label: "Government" }, { value: "non-govt", label: "Non-Government" }]}
          />
        </div>
        <FormDatePicker control={form.control} name="date" label="Date" />
        <div className="grid grid-cols-2 gap-4">
          <FormInput control={form.control} name="startTime" label="Start Time" type="time" />
          <FormInput control={form.control} name="endTime" label="End Time" type="time" />
        </div>
        <FormTextarea control={form.control} name="notes" label="Notes (optional)" rows={2} />
        {schema === offlineSchema ? (
          <FormInput control={form.control} name="paymentReference" label="Payment Reference" placeholder="Cheque/DD number" />
        ) : (
          <FormTextarea control={form.control} name="waiverReason" label="Waiver Reason" placeholder="Detailed reason for waiving the fee..." rows={3} />
        )}
        <Button type="submit" disabled={isPending} className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </form>
    </Form>
  )
}

export default function ManualBooking() {
  useEffect(() => { document.title = "NFDC Admin — Manual Booking" }, [])

  const navigate = useNavigate()
  const { user } = useAuth()
  const theaterId = user?.theaterId
  const queryClient = useQueryClient()

  const { data: audis } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAudis(theaterId).then(r => parseList(r.data.data)),
    enabled: !!theaterId,
  })

  const audiOptions = (audis ?? []).map(a => ({ value: a.id ?? a._id, label: a.name }))

  const formatPayload = (values) => ({
    theaterId,
    audiId: values.audiId,
    date: toAPIDate(values.date),
    startTime: values.startTime,
    endTime: values.endTime,
    bookingType: values.bookingType,
    selectedServices: [],
    note: values.notes,
    customerName: values.customerName,
    customerPhone: values.customerPhone,
    customerEmail: values.customerEmail,
  })

  const offlineMutation = useMutation({
    mutationFn: (values) => manualBookingOffline({
      ...formatPayload(values),
      paymentReference: values.paymentReference,
    }),
    onSuccess: () => {
      toast.success("Booking created successfully")
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      navigate("/admin/bookings")
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const waivedMutation = useMutation({
    mutationFn: (values) => manualBookingWaived({
      ...formatPayload(values),
      waiverReason: values.waiverReason,
    }),
    onSuccess: () => {
      toast.success("Booking created successfully")
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      navigate("/admin/bookings")
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Manual Booking"
        action={{ label: "Back", icon: ArrowLeft, onClick: () => navigate("/admin/bookings") }}
      />

      <Tabs defaultValue="offline">
        <TabsList>
          <TabsTrigger value="offline">Offline Payment</TabsTrigger>
          <TabsTrigger value="waived">Waived</TabsTrigger>
        </TabsList>

        <TabsContent value="offline" className="mt-4">
          <Card><CardContent className="pt-6">
            <BookingForm
              schema={offlineSchema}
              onSubmit={(v) => offlineMutation.mutate(v)}
              isPending={offlineMutation.isPending}
              audiOptions={audiOptions}
              submitLabel="Create Booking (Offline)"
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="waived" className="mt-4">
          <Card><CardContent className="pt-6">
            <BookingForm
              schema={waivedSchema}
              onSubmit={(v) => waivedMutation.mutate(v)}
              isPending={waivedMutation.isPending}
              audiOptions={audiOptions}
              submitLabel="Create Booking (Waived)"
            />
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
