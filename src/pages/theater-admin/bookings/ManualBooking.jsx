import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, Info } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import PageHeader from "@/components/common/PageHeader"
import FormSelect from "@/components/forms/FormSelect"
import FormTextarea from "@/components/forms/FormTextarea"
import FormDatePicker from "@/components/forms/FormDatePicker"
import { useAuth } from "@/hooks/useAuth"
import { listAudis } from "@/api/audi"
import { listSlots } from "@/api/slots"
import { listServicesGrouped } from "@/api/services"
import { manualBookingOffline, manualBookingWaived } from "@/api/bookings"
import { lookupUser } from "@/api/users"
import { parseList } from "@/utils/parseList"
import { toAPIDate } from "@/utils/formatDate"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const today   = new Date(); today.setHours(0, 0, 0, 0)

const toMins   = (t) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m }
const fromMins = (m) => { const h = Math.floor(m / 60); const min = m % 60; return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}` }

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
  }, [isFetching, isValidUUID, data])

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

  if (!audi) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-muted-foreground bg-muted/30">
        <Info className="h-3.5 w-3.5 shrink-0" /> Select an audi first
      </div>
    )
  }

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
// Mandatory service auto-selection is handled by BookingForm (parent), not here.
// This component is purely presentational: render services from the cached query.

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
    // Mandatory services are always visually checked; no form-state side-effect needed.
    // Mandatory IDs are injected into the payload at submit time (formatPayload).
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

// ─── BookingForm ──────────────────────────────────────────────────────────────

function BookingForm({ schema, onSubmit, isPending, audiList, submitLabel }) {
  const [userVerified, setUserVerified] = useState(false)

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: "", audiId: "", slotIds: [], startTime: "", endTime: "",
      bookingType: "govt", selectedServices: [], notes: "",
      paymentReference: "", waiverReason: "",
    },
  })

  const audiId      = useWatch({ control: form.control, name: "audiId" })
  const bookingType = useWatch({ control: form.control, name: "bookingType" })
  const selectedAudi = audiList.find(a => (a.audiId ?? a.id ?? a._id) === audiId) ?? null

  // Reset slot/time/service fields when audi changes.
  // GUARD: only call setValue when the field is non-empty — RHF uses reference
  // equality for arrays, so setValue([], []) still broadcasts a "changed"
  // notification ([] !== []), which re-renders Radix Checkbox components and
  // triggers their internal ref→setState callbacks, causing an infinite loop.
  useEffect(() => {
    const v = form.getValues()
    if (v.slotIds?.length          > 0) form.setValue("slotIds",          [],  { shouldValidate: false })
    if (v.startTime)                    form.setValue("startTime",         "",   { shouldValidate: false })
    if (v.endTime)                      form.setValue("endTime",           "",   { shouldValidate: false })
    if (v.selectedServices?.length > 0) form.setValue("selectedServices",  [],  { shouldValidate: false })
  }, [audiId])

  const audiOptions = audiList.map(a => ({
    value: a.audiId ?? a.id ?? a._id,
    label: `${a.name}${a.config?.slotMode ? ` (${a.config.slotMode})` : ""}`,
  }))

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        <UserIdField control={form.control} onVerifiedChange={setUserVerified} />

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

        <FormDatePicker control={form.control} name="date" label="Date" />

        <TimeFields control={form.control} setValue={form.setValue} audi={selectedAudi} />

        <ServicesField
          control={form.control}
          audiId={audiId || null}
          bookingType={bookingType}
        />

        <FormTextarea control={form.control} name="notes" label="Notes (optional)" rows={2} />

        {schema === offlineSchema ? (
          <FormField control={form.control} name="paymentReference" render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Reference</FormLabel>
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

        <Button
          type="submit"
          disabled={isPending || !userVerified}
          className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>

        {!userVerified && (
          <p className="text-xs text-center text-muted-foreground -mt-1">
            Verify a valid User ID above to enable booking creation
          </p>
        )}
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
    // Inject mandatory service IDs from the cached query — no form-state effect needed.
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
      slotIds:          Array.isArray(values.slotIds) && values.slotIds.length > 0
                          ? values.slotIds
                          : undefined,
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
        </TabsContent>

        <TabsContent value="waived" className="mt-4">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
