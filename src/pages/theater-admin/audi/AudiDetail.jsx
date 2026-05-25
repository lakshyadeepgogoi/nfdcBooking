import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2, Plus, X, Upload, Image as ImageIcon, CheckCircle2, Circle, ExternalLink, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
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
import { getAudi, updateAudi, updateAudiStatus, uploadAudiImages } from "@/api/audi"
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

const rulesSchema = z.object({
  bufferTime:           z.coerce.number().int().min(0).optional(),
  paymentDeadlineHours: z.coerce.number().int().min(1).optional(),
  minDaysInAdvance:     z.coerce.number().int().min(0).optional(),
  maxDaysInAdvance:     z.coerce.number().int().min(0).optional(),
  maxSlotsPerBooking:   z.coerce.number().int().min(1).optional(),
})

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
    if (audi) {
      form.reset({
        name:        audi.name ?? "",
        capacity:    cfg.capacity ?? "",
        description: cfg.description ?? "",
        opStart:     cfg.operationalHours?.start ?? "",
        opEnd:       cfg.operationalHours?.end ?? "",
        paymentMid:  cfg.paymentMid ?? "",
      })
    }
  }, [audi, form])

  const mutation = useMutation({
    mutationFn: (v) => {
      const config = {
        capacity:    v.capacity  || undefined,
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
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput control={form.control} name="name"     label="Audi Name" />
          <FormInput control={form.control} name="capacity" label="Capacity" type="number" placeholder="100" />
        </div>
        <FormTextarea control={form.control} name="description" label="Description (optional)" rows={3} />
        <div className="grid grid-cols-2 gap-4">
          <FormInput control={form.control} name="opStart" label="Opens At (HH:MM)" type="time" />
          <FormInput control={form.control} name="opEnd"   label="Closes At (HH:MM)" type="time" />
        </div>
        <FormInput control={form.control} name="paymentMid" label="Payment MID (optional)" placeholder="e.g. AUDI_MID" />
        <Button type="submit" disabled={mutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Info
        </Button>
      </form>
    </Form>
  )
}

// ─── Tab: Booking Rules ────────────────────────────────────────────────────────

function RulesTab({ audi, audiId, onSaved }) {
  const cfg  = audi?.config ?? {}
  const mode = cfg.slotMode

  // Local state for toggles
  const [overtimeAllowed, setOvertimeAllowed]   = useState(cfg.overtime?.allowed ?? false)
  const [overtimeMult,    setOvertimeMult]       = useState(String(cfg.overtime?.rateMultiplier ?? 2))
  const [multiAllowed,    setMultiAllowed]       = useState(cfg.multiSlot?.allowed ?? true)
  const [multiGap,        setMultiGap]           = useState(cfg.multiSlot?.allowGapBetweenSlots ?? false)

  // Flexible: booking durations
  const [durations,     setDurations]     = useState(cfg.bookingDurations ?? [])
  const [durationInput, setDurationInput] = useState("")

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
    if (audi) {
      form.reset({
        bufferTime:           cfg.bufferTime ?? "",
        paymentDeadlineHours: cfg.paymentDeadlineHours ?? "",
        minDaysInAdvance:     cfg.bookingWindow?.minDaysInAdvance ?? "",
        maxDaysInAdvance:     cfg.bookingWindow?.maxDaysInAdvance ?? "",
        maxSlotsPerBooking:   cfg.multiSlot?.maxSlotsPerBooking ?? "",
      })
    }
  }, [audi, form])

  const addDuration = () => {
    const v = Number(durationInput)
    if (v > 0 && !durations.includes(v)) {
      setDurations(d => [...d, v].sort((a, b) => a - b))
      setDurationInput("")
    }
  }

  const mutation = useMutation({
    mutationFn: (v) => {
      const config = {
        bufferTime:           v.bufferTime !== "" ? Number(v.bufferTime) : undefined,
        paymentDeadlineHours: v.paymentDeadlineHours !== "" ? Number(v.paymentDeadlineHours) : undefined,
        bookingWindow: {
          minDaysInAdvance: v.minDaysInAdvance !== "" ? Number(v.minDaysInAdvance) : 0,
          maxDaysInAdvance: v.maxDaysInAdvance !== "" ? Number(v.maxDaysInAdvance) : 180,
        },
        overtime: {
          allowed:        overtimeAllowed,
          rateMultiplier: overtimeAllowed ? Number(overtimeMult) || 2 : 2,
        },
        ...(mode === "fixed" ? {
          multiSlot: {
            allowed:               multiAllowed,
            allowGapBetweenSlots:  multiGap,
            maxSlotsPerBooking:    v.maxSlotsPerBooking !== "" ? Number(v.maxSlotsPerBooking) : undefined,
          },
        } : {}),
        ...(mode === "flexible" ? { bookingDurations: durations } : {}),
      }
      return updateAudi(audiId, { config })
    },
    onSuccess: () => { toast.success("Booking rules updated"); onSaved() },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-6 max-w-2xl">

        {/* Booking Window */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Booking Window</p>
          <div className="grid grid-cols-2 gap-4">
            <FormInput control={form.control} name="minDaysInAdvance" label="Min Days in Advance" type="number" placeholder="0" />
            <FormInput control={form.control} name="maxDaysInAdvance" label="Max Days in Advance" type="number" placeholder="180" />
          </div>
        </div>

        {/* Timing */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Timing</p>
          <div className="grid grid-cols-2 gap-4">
            <FormInput control={form.control} name="bufferTime"           label="Buffer Between Bookings (min)" type="number" placeholder="0" />
            <FormInput control={form.control} name="paymentDeadlineHours" label="Payment Deadline (hours)"      type="number" placeholder="24" />
          </div>
        </div>

        {/* Overtime */}
        <div className="space-y-3 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Overtime</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{overtimeAllowed ? "Allowed" : "Not allowed"}</span>
              <Switch checked={overtimeAllowed} onCheckedChange={setOvertimeAllowed} />
            </div>
          </div>
          {overtimeAllowed && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rate Multiplier (e.g. 2 = double rate)</Label>
              <Input type="number" step="0.1" min="1" value={overtimeMult}
                onChange={e => setOvertimeMult(e.target.value)} className="w-32" />
            </div>
          )}
        </div>

        {/* Multi-slot (Fixed mode only) */}
        {mode === "fixed" && (
          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Multi-slot Booking</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{multiAllowed ? "Allowed" : "Not allowed"}</span>
                <Switch checked={multiAllowed} onCheckedChange={setMultiAllowed} />
              </div>
            </div>
            {multiAllowed && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Allow gap between slots</span>
                  <Switch checked={multiGap} onCheckedChange={setMultiGap} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Max slots per booking (optional)</Label>
                  <FormInput control={form.control} name="maxSlotsPerBooking" label="" type="number" placeholder="No limit" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Booking Durations (Flexible mode only) */}
        {mode === "flexible" && (
          <div className="space-y-3 border rounded-lg p-4">
            <p className="text-sm font-medium">
              Booking Durations
              <span className="font-normal text-muted-foreground ml-1">— valid hours users can book</span>
            </p>
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
        )}

        <Button type="submit" disabled={mutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Rules
        </Button>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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

// ─── Tab: Setup Checklist ─────────────────────────────────────────────────────

function SetupTab({ audi, audiId }) {
  const navigate = useNavigate()
  const mode             = audi?.config?.slotMode
  const bookingDurations = audi?.config?.bookingDurations ?? []

  const { data: slotsRaw } = useQuery({
    queryKey: ["slots", audiId],
    queryFn: () => listSlots(audiId).then(r => {
      const raw = r.data.data
      return Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
    }),
    enabled: !!audiId && mode === "fixed",
  })
  const slotsArr  = Array.isArray(slotsRaw?.data) ? slotsRaw.data : Array.isArray(slotsRaw) ? slotsRaw : []
  const activeSlots = slotsArr.filter(s => s.lifecycle?.status === "active")

  const { data: audiPriceConfigs } = useQuery({
    queryKey: ["price-configs", "audi", audiId],
    queryFn: () => listPriceConfigs({ entityType: "audi" }).then(r => {
      const raw = r.data.data
      return (Array.isArray(raw) ? raw : []).filter(pc => pc.relationships?.entityId === audiId)
    }),
    enabled: !!audiId,
  })

  const { data: cancelConfigs } = useQuery({
    queryKey: ["price-configs", "cancellation", audiId],
    queryFn: () => listPriceConfigs({ entityType: "cancellation" }).then(r => {
      const raw = r.data.data
      return (Array.isArray(raw) ? raw : []).filter(pc => pc.relationships?.entityId === audiId)
    }),
    enabled: !!audiId,
  })

  const { data: postponeConfigs } = useQuery({
    queryKey: ["price-configs", "postponement", audiId],
    queryFn: () => listPriceConfigs({ entityType: "postponement" }).then(r => {
      const raw = r.data.data
      return (Array.isArray(raw) ? raw : []).filter(pc => pc.relationships?.entityId === audiId)
    }),
    enabled: !!audiId,
  })

  const hasAudiPriceConfig = (audiPriceConfigs ?? []).some(pc => pc.lifecycle?.status === "active")
  const hasCancelConfig    = (cancelConfigs    ?? []).some(pc => pc.lifecycle?.status === "active")
  const hasPostponeConfig  = (postponeConfigs  ?? []).some(pc => pc.lifecycle?.status === "active")

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
        ? `${bookingDurations.map(d => `${d}h`).join(", ")} — set in Booking Rules`
        : "No booking durations set — go to the Booking Rules tab and add valid durations",
      done:      bookingDurations.length > 0,
      link:      null,
      linkLabel: null,
      optional:  false,
    },
    {
      label:     "Price Config (Hourly Table)",
      desc:      hasAudiPriceConfig
        ? "Active pricing configured"
        : "No active price config — without this, bookings cannot be priced",
      done:      hasAudiPriceConfig,
      link:      "/admin/pricing",
      linkLabel: "Manage Price Config",
      optional:  false,
    },
    {
      label:     "Cancellation Policy",
      desc:      hasCancelConfig
        ? "Active cancellation policy configured"
        : "No cancellation policy — bookings will have no cancellation charges",
      done:      hasCancelConfig,
      link:      "/admin/pricing",
      linkLabel: "Manage Price Config",
      optional:  false,
    },
    {
      label:     "Postponement Policy",
      desc:      hasPostponeConfig
        ? "Active postponement policy configured"
        : "No postponement policy configured",
      done:      hasPostponeConfig,
      link:      "/admin/pricing",
      linkLabel: "Manage Price Config",
      optional:  true,
    },
  ].filter(Boolean)

  const required          = items.filter(i => !i.optional)
  const completedRequired = required.filter(i => i.done).length
  const allDone           = completedRequired === required.length

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {completedRequired} of {required.length} required steps complete
        </p>
        {allDone && (
          <Badge variant="secondary" className="text-green-700 bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" /> All set
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className={cn(
            "flex items-start gap-3 rounded-lg border p-3",
            item.done    ? "border-green-200 bg-green-50/40"
            : item.optional ? "border-dashed bg-muted/20"
            : "border-amber-200 bg-amber-50/30"
          )}>
            {item.done
              ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              : <Circle className={cn("h-4 w-4 shrink-0 mt-0.5", item.optional ? "text-muted-foreground" : "text-amber-500")} />
            }
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{item.label}</span>
                {item.optional && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Optional</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            {item.link && (
              <Button type="button" size="sm" variant="ghost"
                className="h-7 shrink-0 text-xs px-2"
                onClick={() => navigate(item.link)}>
                {item.linkLabel}
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!mode && (
        <div className="flex items-start gap-2 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Audi mode not detected. Recreate this audi if the mode appears missing.</span>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function AudiDetail() {
  const { audiId }  = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [statusConfirm, setStatusConfirm] = useState(false)

  const { data: raw, isLoading } = useQuery({
    queryKey: ["audi", audiId],
    queryFn: () => getAudi(audiId).then(r => r.data.data),
    enabled: !!audiId,
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
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={audi?.name ?? "Edit Audi"}
          action={{ label: "Back to Audis", icon: ArrowLeft, onClick: () => navigate("/admin/audis") }}
        />
        <div className="flex items-center gap-3 shrink-0">
          {mode && (
            <Badge variant={mode === "fixed" ? "outline" : "secondary"} className="capitalize">
              {mode}
            </Badge>
          )}
          <StatusBadge status={audi?.lifecycle?.status} />
          <Button size="sm" variant={isActive ? "destructive" : "default"}
            onClick={() => setStatusConfirm(true)}>
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>

      {/* Vertical tabs */}
      <Tabs defaultValue="setup" orientation="vertical" className="flex flex-col sm:flex-row gap-0">
        <TabsList className="flex sm:flex-col h-auto w-full sm:w-44 shrink-0 bg-muted/50 border rounded-lg sm:rounded-r-none p-1 justify-start">
          <TabsTrigger value="setup"  className="w-full justify-start text-left data-[state=active]:shadow-sm">Setup</TabsTrigger>
          <TabsTrigger value="info"   className="w-full justify-start text-left data-[state=active]:shadow-sm">Info</TabsTrigger>
          <TabsTrigger value="rules"  className="w-full justify-start text-left data-[state=active]:shadow-sm">Booking Rules</TabsTrigger>
          <TabsTrigger value="images" className="w-full justify-start text-left data-[state=active]:shadow-sm">Images</TabsTrigger>
        </TabsList>

        <div className="flex-1 border rounded-lg sm:rounded-l-none sm:border-l-0 bg-background">
          <TabsContent value="setup" className="m-0 p-6">
            <h3 className="text-base font-semibold mb-4">Setup Checklist</h3>
            <SetupTab audi={audi} audiId={audiId} />
          </TabsContent>
          <TabsContent value="info" className="m-0 p-6">
            <h3 className="text-base font-semibold mb-4">Basic Information</h3>
            <InfoTab audi={audi} audiId={audiId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="rules" className="m-0 p-6">
            <h3 className="text-base font-semibold mb-4">Booking Rules</h3>
            <RulesTab audi={audi} audiId={audiId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="images" className="m-0 p-6">
            <h3 className="text-base font-semibold mb-4">Audi Images</h3>
            <ImagesTab audi={audi} audiId={audiId} onSaved={onSaved} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Status confirm */}
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
            <AlertDialogAction onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending}
              className={isActive ? "bg-destructive hover:bg-destructive/90" : ""}>
              {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
