import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft, Loader2, Plus, X, Upload, Image as ImageIcon,
  CheckCircle2, Circle, ExternalLink, AlertTriangle,
  ClipboardList, Settings2, Calendar, Clock, LayoutGrid, Users,
  Timer, Zap, Layers, RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Form } from "@/components/ui/form"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import PageHeader from "@/components/common/PageHeader"
import StatusBadge from "@/components/common/StatusBadge"
import EmptyState from "@/components/common/EmptyState"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import FormInput from "@/components/forms/FormInput"
import FormTextarea from "@/components/forms/FormTextarea"
import { getAdminAudi, updateAudi, updateAudiStatus, uploadAudiImages } from "@/api/audi"
import { getTheaterProfile } from "@/api/theaters"
import { listSlots } from "@/api/slots"
import { listPriceConfigs } from "@/api/priceConfig"
import { cn } from "@/lib/utils"

// ─── Schemas ──────────────────────────────────────────────────────────────────

const infoSchema = z.object({
  name:        z.string().min(2, "Min 2 characters"),
  capacity:    z.coerce.number().int().min(1).max(10000).optional(),
  description: z.string().optional(),
  opStart:     z.string().optional(),
  opEnd:       z.string().optional(),
  paymentMid:  z.string().optional(),
})

const optInt = (min = 0) =>
  z.union([z.coerce.number().int().min(min), z.literal(""), z.null()]).optional()

const rulesSchema = z.object({
  bufferTime:           optInt(0),
  paymentDeadlineHours: optInt(1),
  minDaysInAdvance:     optInt(0),
  maxDaysInAdvance:     optInt(0),
  maxSlotsPerBooking:   optInt(1),
})

// ─── Shared helpers ────────────────────────────────────────────────────────────

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">{label}</p>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-background px-3.5 py-2.5 shadow-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
    </div>
  )
}

// ─── Tab: Info ────────────────────────────────────────────────────────────────

function InfoTab({ audi, audiId, onSaved }) {
  const cfg = audi?.config ?? {}

  const form = useForm({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      name:        audi?.name ?? "",
      capacity:    cfg.capacity ?? "",
      description: cfg.description ?? "",
      opStart:     cfg.operationalHours?.start ?? "",
      opEnd:       cfg.operationalHours?.end ?? "",
      paymentMid:  cfg.paymentMid ?? "",
    },
  })

  useEffect(() => {
    if (audi) form.reset({
      name:        audi.name ?? "",
      capacity:    cfg.capacity ?? "",
      description: cfg.description ?? "",
      opStart:     cfg.operationalHours?.start ?? "",
      opEnd:       cfg.operationalHours?.end ?? "",
      paymentMid:  cfg.paymentMid ?? "",
    })
  }, [audi, form])

  const mutation = useMutation({
    mutationFn: (v) => {
      const config = {
        capacity:    v.capacity    || undefined,
        description: v.description || undefined,
        paymentMid:  v.paymentMid  || undefined,
        ...(v.opStart || v.opEnd
          ? { operationalHours: { start: v.opStart || undefined, end: v.opEnd || undefined } }
          : {}),
      }
      return updateAudi(audiId, {
        name: v.name,
        ...(Object.values(config).some(x => x !== undefined) ? { config } : {}),
      })
    },
    onSuccess: () => { toast.success("Audi updated"); onSaved() },
    onError:   (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-6 max-w-2xl">
        <SectionHeader label="Identity" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput control={form.control} name="name"     label="Audi Name" />
          <FormInput control={form.control} name="capacity" label="Capacity (seats)" type="number" placeholder="100" />
        </div>
        <FormTextarea control={form.control} name="description" label="Description (optional)" rows={3} />

        <SectionHeader label="Operational Hours" />
        <div className="grid grid-cols-2 gap-4">
          <FormInput control={form.control} name="opStart" label="Opens At" type="time" />
          <FormInput control={form.control} name="opEnd"   label="Closes At" type="time" />
        </div>

        <SectionHeader label="Payment" />
        <FormInput control={form.control} name="paymentMid" label="Payment MID (optional)" placeholder="e.g. AUDI_MID" />

        <div className="pt-2">
          <Button type="submit" disabled={mutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Info
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ─── Tab: Booking Rules ────────────────────────────────────────────────────────

function RulesTab({ audi, audiId, onSaved }) {
  const cfg  = audi?.config ?? {}
  const mode = cfg.slotMode

  const [overtimeAllowed, setOvertimeAllowed] = useState(cfg.overtime?.allowed ?? false)
  const [overtimeMult,    setOvertimeMult]    = useState(String(cfg.overtime?.rateMultiplier ?? 2))
  const [multiAllowed,    setMultiAllowed]    = useState(cfg.multiSlot?.allowed ?? true)
  const [multiGap,        setMultiGap]        = useState(cfg.multiSlot?.allowGapBetweenSlots ?? false)
  const [durations,       setDurations]       = useState(cfg.bookingDurations ?? [])
  const [durationInput,   setDurationInput]   = useState("")

  useEffect(() => {
    if (audi) {
      setOvertimeAllowed(cfg.overtime?.allowed ?? false)
      setOvertimeMult(String(cfg.overtime?.rateMultiplier ?? 2))
      setMultiAllowed(cfg.multiSlot?.allowed ?? true)
      setMultiGap(cfg.multiSlot?.allowGapBetweenSlots ?? false)
      setDurations(cfg.bookingDurations ?? [])
    }
  }, [audi])

  const form = useForm({
    resolver: zodResolver(rulesSchema),
    defaultValues: {
      bufferTime:           cfg.bufferTime ?? "",
      paymentDeadlineHours: cfg.paymentDeadlineHours ?? "",
      minDaysInAdvance:     cfg.bookingWindow?.minDaysInAdvance ?? "",
      maxDaysInAdvance:     cfg.bookingWindow?.maxDaysInAdvance ?? "",
      maxSlotsPerBooking:   cfg.multiSlot?.maxSlotsPerBooking ?? "",
    },
  })

  useEffect(() => {
    if (audi) form.reset({
      bufferTime:           cfg.bufferTime ?? "",
      paymentDeadlineHours: cfg.paymentDeadlineHours ?? "",
      minDaysInAdvance:     cfg.bookingWindow?.minDaysInAdvance ?? "",
      maxDaysInAdvance:     cfg.bookingWindow?.maxDaysInAdvance ?? "",
      maxSlotsPerBooking:   cfg.multiSlot?.maxSlotsPerBooking ?? "",
    })
  }, [audi, form])

  const addDuration = () => {
    const v = Number(durationInput)
    if (v > 0 && !durations.includes(v)) {
      setDurations(d => [...d, v].sort((a, b) => a - b))
      setDurationInput("")
    }
  }

  const n = (v) => (v !== "" && v != null) ? Number(v) : undefined

  const mutation = useMutation({
    mutationFn: (v) => updateAudi(audiId, {
      config: {
        bufferTime:           n(v.bufferTime),
        paymentDeadlineHours: n(v.paymentDeadlineHours),
        bookingWindow: {
          minDaysInAdvance: n(v.minDaysInAdvance) ?? 0,
          maxDaysInAdvance: n(v.maxDaysInAdvance) ?? 180,
        },
        overtime: {
          allowed:        overtimeAllowed,
          rateMultiplier: overtimeAllowed ? Number(overtimeMult) || 2 : 2,
        },
        ...(mode === "fixed" ? {
          multiSlot: {
            allowed:              multiAllowed,
            allowGapBetweenSlots: multiGap,
            maxSlotsPerBooking:   n(v.maxSlotsPerBooking),
          },
        } : {}),
        ...(mode === "flexible" ? { bookingDurations: durations } : {}),
      },
    }),
    onSuccess: () => { toast.success("Booking rules updated"); onSaved() },
    onError:   (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-6 max-w-2xl">

        <SectionHeader label="Booking Window" />
        <div className="grid grid-cols-2 gap-4">
          <FormInput control={form.control} name="minDaysInAdvance" label="Min Days in Advance" type="number" placeholder="0" />
          <FormInput control={form.control} name="maxDaysInAdvance" label="Max Days in Advance" type="number" placeholder="180" />
        </div>

        <SectionHeader label="Timing" />
        <div className="grid grid-cols-2 gap-4">
          <FormInput control={form.control} name="bufferTime"           label="Buffer Between Bookings (min)" type="number" placeholder="0" />
          <FormInput control={form.control} name="paymentDeadlineHours" label="Payment Deadline (hours)"      type="number" placeholder="24" />
        </div>

        <SectionHeader label="Overtime" />
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Allow Overtime</p>
              <p className="text-xs text-muted-foreground">Charge extra for bookings that run over</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{overtimeAllowed ? "On" : "Off"}</span>
              <Switch checked={overtimeAllowed} onCheckedChange={setOvertimeAllowed} />
            </div>
          </div>
          {overtimeAllowed && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs text-muted-foreground">Rate Multiplier (e.g. 2 = double rate)</Label>
              <Input type="number" step="0.1" min="1" value={overtimeMult}
                onChange={e => setOvertimeMult(e.target.value)} className="w-32" />
            </div>
          )}
        </div>

        {mode === "fixed" && (
          <>
            <SectionHeader label="Multi-slot Booking" />
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Allow Multi-slot</p>
                  <p className="text-xs text-muted-foreground">Users can book multiple consecutive slots</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{multiAllowed ? "On" : "Off"}</span>
                  <Switch checked={multiAllowed} onCheckedChange={setMultiAllowed} />
                </div>
              </div>
              {multiAllowed && (
                <div className="space-y-3 pt-1 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Allow gap between slots</span>
                    <Switch checked={multiGap} onCheckedChange={setMultiGap} />
                  </div>
                  <FormInput control={form.control} name="maxSlotsPerBooking" label="Max slots per booking (optional)" type="number" placeholder="No limit" />
                </div>
              )}
            </div>
          </>
        )}

        {mode === "flexible" && (
          <>
            <SectionHeader label="Booking Durations" />
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Valid booking durations users can select (in hours)</p>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {durations.length === 0 && <span className="text-sm text-muted-foreground">None added</span>}
                {durations.map(d => (
                  <Badge key={d} variant="secondary" className="gap-1 pr-1">
                    {d}h
                    <button type="button" onClick={() => setDurations(x => x.filter(v => v !== d))}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input type="number" placeholder="e.g. 2" value={durationInput} min={0.5} step={0.5}
                  onChange={e => setDurationInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDuration() } }}
                  className="w-28" />
                <Button type="button" variant="outline" size="sm" onClick={addDuration}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>
          </>
        )}

        <div className="pt-2">
          <Button type="submit" disabled={mutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Rules
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ─── Tab: Images ──────────────────────────────────────────────────────────────

function ImagesTab({ audi, audiId, onSaved }) {
  const queryClient = useQueryClient()

  const [keepUrls, setKeepUrls] = useState(audi?.images ?? [])
  const [newFiles,  setNewFiles]  = useState([])
  const [previews,  setPreviews]  = useState([])

  useEffect(() => {
    setKeepUrls(audi?.images ?? [])
    setNewFiles([])
    setPreviews(prev => { prev.forEach(URL.revokeObjectURL); return [] })
  }, [audi])

  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [])

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setNewFiles(prev => [...prev, ...files])
    setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    e.target.value = ""
  }

  const removeNew = (i) => {
    URL.revokeObjectURL(previews[i])
    setNewFiles(prev => prev.filter((_, x) => x !== i))
    setPreviews(prev => prev.filter((_, x) => x !== i))
  }

  const mutation = useMutation({
    mutationFn: () => uploadAudiImages(audiId, keepUrls, newFiles),
    onSuccess: () => {
      toast.success("Images updated")
      queryClient.invalidateQueries({ queryKey: ["audi", audiId] })
      queryClient.invalidateQueries({ queryKey: ["audis"] })
      onSaved()
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  const hasChanges = keepUrls.length !== (audi?.images?.length ?? 0) || newFiles.length > 0
  const totalCount = keepUrls.length + newFiles.length

  return (
    <div className="space-y-5">
      {totalCount === 0 && (
        <EmptyState icon={ImageIcon} title="No images" message="Upload images using the button below." />
      )}

      {totalCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {keepUrls.map(src => (
            <div key={src} className="relative group aspect-video rounded-lg overflow-hidden border bg-muted">
              <img src={src} alt="Audi" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setKeepUrls(p => p.filter(u => u !== src))}
                className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {previews.map((src, i) => (
            <div key={src} className="relative group aspect-video rounded-lg overflow-hidden border-2 border-dashed border-nfdc-accent bg-muted">
              <img src={src} alt="New" className="w-full h-full object-cover" />
              <div className="absolute top-1.5 left-1.5 bg-nfdc-accent text-white text-[10px] px-1.5 py-0.5 rounded font-medium">New</div>
              <button type="button" onClick={() => removeNew(i)}
                className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer">
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={handleFileChange} />
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium shadow-sm hover:bg-accent transition-colors">
            <Upload className="h-4 w-4" /> Add Images
          </span>
        </label>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !hasChanges}
          className="bg-nfdc-primary hover:bg-nfdc-primary/90">
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Images
        </Button>
        {totalCount > 0 && (
          <span className="text-sm text-muted-foreground">{totalCount} image{totalCount !== 1 ? "s" : ""}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Accepted: JPEG, PNG, WebP · Max 5 MB · Up to 10 images</p>
    </div>
  )
}

// ─── Config tile ──────────────────────────────────────────────────────────────

function ConfigTile({ icon: Icon, label, value, isSet, warn }) {
  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2",
      warn ? "border-amber-200 bg-amber-50/40" : "bg-muted/20"
    )}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", warn ? "text-amber-500" : "text-muted-foreground")} />
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={cn(
        "text-sm font-semibold truncate",
        !isSet ? "text-muted-foreground/60 italic" : "text-foreground"
      )}>
        {value}
      </p>
    </div>
  )
}

// ─── Tab: Setup Checklist ─────────────────────────────────────────────────────

function SetupTab({ audi, audiId, onReadyChange }) {
  const navigate         = useNavigate()
  const cfg              = audi?.config ?? {}
  const mode             = cfg.slotMode
  const bookingDurations = cfg.bookingDurations ?? []
  const theaterId        = audi?.relationships?.theaterId

  // ── Theater config ────────────────────────────────────────────────────────
  const { data: theaterRaw } = useQuery({
    queryKey: ["theater-profile", theaterId],
    queryFn:  () => getTheaterProfile(theaterId).then(r => r.data.data),
    enabled:  !!theaterId,
    staleTime: 60_000,
  })
  const allowUserReschedule = theaterRaw?.config?.allowUserReschedule ?? false

  // ── Slots (fixed mode) ────────────────────────────────────────────────────
  const { data: slotsRaw } = useQuery({
    queryKey: ["slots", audiId],
    queryFn:  () => listSlots(audiId).then(r => {
      const raw = r.data.data
      return Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
    }),
    enabled: !!audiId && mode === "fixed",
  })
  const slotsArr    = Array.isArray(slotsRaw?.data) ? slotsRaw.data : Array.isArray(slotsRaw) ? slotsRaw : []
  const activeSlots = slotsArr.filter(s => s.lifecycle?.status === "active")

  // ── Price configs ─────────────────────────────────────────────────────────
  const { data: audiPriceConfigs }  = useQuery({
    queryKey: ["price-configs", "audi", audiId],
    queryFn:  () => listPriceConfigs({ entityType: "audi" }).then(r =>
      (Array.isArray(r.data.data) ? r.data.data : []).filter(pc => pc.relationships?.entityId === audiId)
    ),
    enabled: !!audiId,
  })
  const { data: cancelConfigs }    = useQuery({
    queryKey: ["price-configs", "cancellation", audiId],
    queryFn:  () => listPriceConfigs({ entityType: "cancellation" }).then(r =>
      (Array.isArray(r.data.data) ? r.data.data : []).filter(pc => pc.relationships?.entityId === audiId)
    ),
    enabled: !!audiId && allowUserReschedule,
  })
  const { data: postponeConfigs }  = useQuery({
    queryKey: ["price-configs", "postponement", audiId],
    queryFn:  () => listPriceConfigs({ entityType: "postponement" }).then(r =>
      (Array.isArray(r.data.data) ? r.data.data : []).filter(pc => pc.relationships?.entityId === audiId)
    ),
    enabled: !!audiId && allowUserReschedule,
  })

  const hasAudiPriceConfig = (audiPriceConfigs ?? []).some(pc => pc.lifecycle?.status === "active")
  const hasCancelConfig    = (cancelConfigs    ?? []).some(pc => pc.lifecycle?.status === "active")
  const hasPostponeConfig  = (postponeConfigs  ?? []).some(pc => pc.lifecycle?.status === "active")

  // ── Required checklist ────────────────────────────────────────────────────
  const items = [
    mode === "fixed" && {
      label:     "Time Slots",
      desc:      activeSlots.length > 0
        ? `${activeSlots.length} active slot${activeSlots.length !== 1 ? "s" : ""} — ${activeSlots.map(s => s.name).join(", ")}`
        : "No active slots — add time windows so users can book this audi",
      done:      activeSlots.length > 0,
      link:      "/admin/slots",
      linkLabel: "Manage Slots",
      optional:  false,
    },
    mode === "flexible" && {
      label:     "Booking Durations",
      desc:      bookingDurations.length > 0
        ? `${bookingDurations.map(d => `${d}h`).join(", ")} — set in Booking Rules tab`
        : "No booking durations set — go to Booking Rules and add valid durations",
      done:      bookingDurations.length > 0,
      link:      null,
      linkLabel: null,
      optional:  false,
    },
    {
      label:     "Price Config (Hourly Table)",
      desc:      hasAudiPriceConfig
        ? "Active pricing configured"
        : "No active price config — bookings cannot be priced without this",
      done:      hasAudiPriceConfig,
      link:      "/admin/pricing",
      linkLabel: "Manage Pricing",
      optional:  false,
    },
    allowUserReschedule && {
      label:     "Cancellation Policy",
      desc:      hasCancelConfig
        ? "Active cancellation policy configured"
        : "No cancellation policy — bookings will have no cancellation charges",
      done:      hasCancelConfig,
      link:      "/admin/pricing",
      linkLabel: "Manage Pricing",
      optional:  false,
    },
    allowUserReschedule && {
      label:     "Postponement Policy",
      desc:      hasPostponeConfig
        ? "Active postponement policy configured"
        : "No postponement policy configured",
      done:      hasPostponeConfig,
      link:      "/admin/pricing",
      linkLabel: "Manage Pricing",
      optional:  true,
    },
  ].filter(Boolean)

  const required          = items.filter(i => !i.optional)
  const completedRequired = required.filter(i => i.done).length
  const allDone           = completedRequired === required.length

  useEffect(() => { onReadyChange?.(allDone) }, [allDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Booking rule derived display values ───────────────────────────────────
  const bw          = cfg.bookingWindow ?? {}
  const hasMinMax   = bw.minDaysInAdvance != null || bw.maxDaysInAdvance != null
  const multiSlot   = cfg.multiSlot ?? {}

  return (
    <div className="space-y-6">

      {/* Progress card */}
      <Card className={`border-l-4 ${allDone ? "border-l-green-500" : "border-l-amber-400"}`}>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center justify-center h-14 w-14 rounded-full shrink-0 border-2 font-bold text-lg",
              allDone ? "border-green-500 text-green-600 bg-green-50" : "border-amber-400 text-amber-600 bg-amber-50"
            )}>
              {completedRequired}/{required.length}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold">{allDone ? "Audi is fully set up" : "Setup in progress"}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {allDone
                  ? "All required steps are complete"
                  : `${required.length - completedRequired} required step${required.length - completedRequired !== 1 ? "s" : ""} remaining`}
              </p>
            </div>
            {allDone
              ? <CheckCircle2 className="h-7 w-7 text-green-500 shrink-0" />
              : <AlertTriangle className="h-7 w-7 text-amber-400 shrink-0" />
            }
          </div>
        </CardContent>
      </Card>

      {!mode && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Audi mode not detected. Recreate this audi if the mode appears missing.</span>
        </div>
      )}

      {/* Required checklist */}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className={cn(
            "flex items-start gap-4 rounded-xl border p-4",
            item.done      ? "border-green-200 bg-green-50/40"
            : item.optional ? "border-dashed border-border bg-muted/20"
            : "border-amber-200 bg-amber-50/30"
          )}>
            <div className={cn(
              "mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
              item.done ? "bg-green-100" : item.optional ? "bg-muted" : "bg-amber-100"
            )}>
              {item.done
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : <Circle className={cn("h-4 w-4", item.optional ? "text-muted-foreground" : "text-amber-500")} />
              }
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{item.label}</span>
                {item.optional && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Optional</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
            {item.link && (
              <Button type="button" size="sm" variant="outline"
                className="h-8 shrink-0 text-xs gap-1.5"
                onClick={() => navigate(item.link)}>
                {item.linkLabel}
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Booking rules overview */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Booking Rules</p>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Booking window */}
          <ConfigTile
            icon={Calendar}
            label="Booking Window"
            isSet={hasMinMax}
            value={hasMinMax
              ? `${bw.minDaysInAdvance ?? 0} – ${bw.maxDaysInAdvance ?? 180} days`
              : "Default (0–180 days)"}
          />

          {/* Payment deadline */}
          <ConfigTile
            icon={Clock}
            label="Payment Deadline"
            isSet={!!cfg.paymentDeadlineHours}
            value={cfg.paymentDeadlineHours ? `${cfg.paymentDeadlineHours}h` : "Default (24h)"}
          />

          {/* Buffer time */}
          <ConfigTile
            icon={Timer}
            label="Buffer Between Bookings"
            isSet={!!cfg.bufferTime}
            value={cfg.bufferTime ? `${cfg.bufferTime} min` : "None"}
          />

          {/* Overtime */}
          <ConfigTile
            icon={Zap}
            label="Overtime"
            isSet={cfg.overtime?.allowed}
            warn={!cfg.overtime?.allowed}
            value={cfg.overtime?.allowed
              ? `Enabled · ${cfg.overtime.rateMultiplier ?? 2}× rate`
              : "Disabled"}
          />

          {/* Multi-slot (fixed mode only) */}
          {mode === "fixed" && (
            <>
              <ConfigTile
                icon={Layers}
                label="Multi-slot Booking"
                isSet={multiSlot.allowed !== false}
                value={multiSlot.allowed !== false ? "Allowed" : "Not allowed"}
              />
              <ConfigTile
                icon={Settings2}
                label="Max Slots / Booking"
                isSet={!!multiSlot.maxSlotsPerBooking}
                value={multiSlot.maxSlotsPerBooking ? `${multiSlot.maxSlotsPerBooking} slots` : "No limit"}
              />
              <ConfigTile
                icon={RefreshCw}
                label="Gap Between Slots"
                isSet={!!multiSlot.allowGapBetweenSlots}
                value={multiSlot.allowGapBetweenSlots ? "Allowed" : "Not allowed"}
              />
            </>
          )}

          {/* Flexible mode: booking durations */}
          {mode === "flexible" && (
            <ConfigTile
              icon={Layers}
              label="Booking Durations"
              isSet={bookingDurations.length > 0}
              warn={bookingDurations.length === 0}
              value={bookingDurations.length > 0
                ? bookingDurations.map(d => `${d}h`).join(", ")
                : "None set"}
            />
          )}
        </div>
      </div>

    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function AudiDetail() {
  const { audiId }  = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [statusConfirm,  setStatusConfirm]  = useState(false)
  const [setupComplete,  setSetupComplete]  = useState(true)

  const { data: raw, isLoading } = useQuery({
    queryKey: ["audi", audiId],
    queryFn:  () => getAdminAudi(audiId).then(r => r.data.data),
    enabled:  !!audiId,
  })

  const audi = raw?.audi ?? raw
  const mode = audi?.config?.slotMode

  useEffect(() => {
    document.title = audi?.name ? `NFDC Admin — ${audi.name}` : "NFDC Admin — Edit Audi"
  }, [audi?.name])

  const isActive = audi?.lifecycle?.status === "active"

  const statusMutation = useMutation({
    mutationFn: () => updateAudiStatus(audiId, isActive ? "inactive" : "active"),
    onSuccess: () => {
      toast.success(`Audi ${isActive ? "deactivated" : "activated"}`)
      queryClient.invalidateQueries({ queryKey: ["audi", audiId] })
      queryClient.invalidateQueries({ queryKey: ["audis"] })
      setStatusConfirm(false)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const onSaved = () => queryClient.invalidateQueries({ queryKey: ["audi", audiId] })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            title={audi?.name ?? "Edit Audi"}
            action={{ label: "Back to Audis", icon: ArrowLeft, onClick: () => navigate("/admin/audis") }}
          />
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={audi?.lifecycle?.status} />
            <Button
              size="sm"
              variant={isActive ? "destructive" : "default"}
              disabled={!isActive && !setupComplete}
              title={!isActive && !setupComplete ? "Complete the Setup checklist before activating" : undefined}
              onClick={() => setStatusConfirm(true)}
            >
              {isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex flex-wrap gap-3">
          {mode && (
            <StatChip icon={LayoutGrid} label="Mode" value={<span className="capitalize">{mode}</span>} />
          )}
          {audi?.config?.capacity && (
            <StatChip icon={Users} label="Capacity" value={`${audi.config.capacity} seats`} />
          )}
          {(audi?.config?.operationalHours?.start || audi?.config?.operationalHours?.end) && (
            <StatChip
              icon={Clock}
              label="Hours"
              value={`${audi.config.operationalHours?.start ?? "—"} – ${audi.config.operationalHours?.end ?? "—"}`}
            />
          )}
          {audi?.config?.paymentDeadlineHours && (
            <StatChip icon={Clock} label="Payment Deadline" value={`${audi.config.paymentDeadlineHours}h`} />
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <Tabs defaultValue="setup" className="flex flex-col">
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="flex h-auto gap-0 rounded-none bg-transparent p-0">
            {[
              { value: "setup",  label: "Setup",         Icon: ClipboardList },
              { value: "info",   label: "Info",          Icon: Settings2     },
              { value: "rules",  label: "Booking Rules", Icon: Calendar      },
              { value: "images", label: "Images",        Icon: ImageIcon     },
            ].map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent -mb-px bg-transparent px-5 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-nfdc-primary data-[state=active]:bg-transparent data-[state=active]:text-nfdc-primary data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="setup" className="mt-0">
            <SetupTab audi={audi} audiId={audiId} onReadyChange={setSetupComplete} />
          </TabsContent>
          <TabsContent value="info" className="mt-0">
            <InfoTab audi={audi} audiId={audiId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="rules" className="mt-0">
            <RulesTab key={audi?.updatedAt ?? audiId} audi={audi} audiId={audiId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="images" className="mt-0">
            <ImagesTab audi={audi} audiId={audiId} onSaved={onSaved} />
          </TabsContent>
        </div>
      </Tabs>

      {/* ── Status confirm ─────────────────────────────────────────── */}
      <AlertDialog open={statusConfirm} onOpenChange={setStatusConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isActive ? "Deactivate" : "Activate"} &quot;{audi?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "Deactivating this audi may affect associated slots and bookings."
                : "This audi will be available for bookings again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusMutation.mutate()}
              disabled={statusMutation.isPending}
              className={isActive ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
