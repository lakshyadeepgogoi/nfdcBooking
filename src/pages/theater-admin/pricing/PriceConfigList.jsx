import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Plus, Pencil, Loader2, Trash2, MoreHorizontal, Settings2, Power, AlertTriangle, Info,
  Building2, Layers, Ban, CalendarClock,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import EmptyState from "@/components/common/EmptyState"
import StatusBadge from "@/components/common/StatusBadge"
import FormInput from "@/components/forms/FormInput"
import { useAuth } from "@/hooks/useAuth"
import { getTheaterProfile } from "@/api/theaters"
import { listAudis } from "@/api/audi"
import { listSlots } from "@/api/slots"
import { listServicesGrouped } from "@/api/services"
import {
  listPriceConfigs, createPriceConfig, updatePriceConfig, updatePriceConfigStatus,
} from "@/api/priceConfig"
import { formatINR } from "@/utils/formatCurrency"

// ─── Constants ─────────────────────────────────────────────────────────────────

const TABS = ["audi", "service", "cancellation", "postponement"]

const TAB_META = {
  audi:         { description: "Hourly pricing rates for each audi"            },
  service:      { description: "Flat rate pricing for individual services"      },
  cancellation: { description: "Charge policy applied on booking cancellations" },
  postponement: { description: "Charge policy applied on booking postponements" },
}

const PRICING_TYPES_BY_ENTITY = {
  audi: ["hourly_table"],  // flat/shift_based are ignored by the fee calculator for audis
  service: ["flat"],
  cancellation: ["charge_policy"],
  postponement: ["charge_policy"],
}

const DEFAULT_PRICING_TYPE = {
  audi: "hourly_table",
  service: "flat",
  cancellation: "charge_policy",
  postponement: "charge_policy",
}

const PRICING_TYPE_LABELS = {
  hourly_table: "Hourly Table",
  shift_based: "Shift Based",
  flat: "Flat Rate",
  charge_policy: "Charge Policy",
}

// ─── Zod schemas ────────────────────────────────────────────────────────────────

const priceZ = z.object({
  govt: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
  nonGovt: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
})

const secDepZ = z.object({
  applicable: z.boolean().default(false),
  depositType: z.enum(["fixed", "percentage"]).optional(),
  amount: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  percentage: z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional(),
  description: z.string().optional(),
})

const hourlyItemZ = z.object({
  hours: z.coerce.number().positive("Must be > 0"),
  price: priceZ,
  securityDeposit: secDepZ.optional(),
  isActive: z.boolean().default(true),
})

const shiftItemZ = z.object({
  name: z.string().min(1, "Name required"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  price: priceZ,
  isActive: z.boolean().default(true),
})

const slabZ = z.object({
  label: z.string().optional(),
  daysFrom: z.coerce.number().min(0, "Min 0"),
  daysTo: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
  percentage: z.coerce.number().min(0).max(100, "Max 100%"),
  minimumCharge: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
})

const formZ = z.object({
  entityId: z.string().min(1, "Select an entity"),
  pricingType: z.enum(["hourly_table", "shift_based", "flat", "charge_policy"]),
  hourlyRates: z.array(hourlyItemZ).optional(),
  shifts: z.array(shiftItemZ).optional(),
  flatGovt: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  flatNonGovt: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  chargeSlabs: z.array(slabZ).optional(),
})

// ─── Form helpers ──────────────────────────────────────────────────────────────

const EMPTY_HOURLY = { hours: "", price: { govt: "", nonGovt: "" }, securityDeposit: { applicable: false }, isActive: true }
const EMPTY_SLAB = { label: "", daysFrom: "", daysTo: "", percentage: "", minimumCharge: "" }

function pcToForm(pc) {
  const c = pc.config
  return {
    entityId: pc.relationships?.entityId ?? "",
    pricingType: c.pricingType,
    hourlyRates: c.hourlyRates?.length
      ? c.hourlyRates.map(r => ({
        hours: r.hours ?? "",
        price: { govt: r.price?.govt ?? "", nonGovt: r.price?.nonGovt ?? "" },
        isActive: r.isActive ?? true,
        securityDeposit: r.securityDeposit ?? { applicable: false },
      }))
      : [],
    shifts: c.shifts?.length
      ? c.shifts.map(s => ({
        name: s.name ?? "",
        startTime: s.startTime ?? "09:00",
        endTime: s.endTime ?? "18:00",
        price: { govt: s.price?.govt ?? "", nonGovt: s.price?.nonGovt ?? "" },
        isActive: s.isActive ?? true,
      }))
      : [],
    flatGovt: c.flatRate?.price?.govt ?? "",
    flatNonGovt: c.flatRate?.price?.nonGovt ?? "",
    chargeSlabs: c.chargeSlabs?.length
      ? c.chargeSlabs.map(s => ({
        label: s.label ?? "",
        daysFrom: s.daysFrom ?? "",
        daysTo: s.daysTo ?? "",
        percentage: s.percentage ?? "",
        minimumCharge: s.minimumCharge ?? "",
      }))
      : [{ ...EMPTY_SLAB }],
  }
}

function emptyForm(entityType, entityId = "") {
  return {
    entityId,
    pricingType: DEFAULT_PRICING_TYPE[entityType] ?? "flat",
    hourlyRates: [],   // start empty — hidden rows with invalid values block submission silently
    shifts: [],   // same reason
    flatGovt: "",
    flatNonGovt: "",
    chargeSlabs: [{ ...EMPTY_SLAB }],
  }
}

// Clean up form values → API payload
function buildConfig(values) {
  const { pricingType } = values
  const n = (v) => (v !== "" && v != null ? Number(v) : undefined)

  const config = { pricingType }

  if (pricingType === "hourly_table") {
    config.hourlyRates = values.hourlyRates?.map(r => ({
      hours: Number(r.hours),
      price: { govt: n(r.price.govt), nonGovt: n(r.price.nonGovt) },
      isActive: r.isActive ?? true,
      securityDeposit: r.securityDeposit?.applicable
        ? {
          applicable: true,
          depositType: r.securityDeposit.depositType,
          amount: n(r.securityDeposit.amount),
          percentage: n(r.securityDeposit.percentage),
          description: r.securityDeposit.description || undefined,
        }
        : { applicable: false },
    }))
  } else if (pricingType === "shift_based") {
    config.shifts = values.shifts?.map(s => ({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      price: { govt: n(s.price.govt), nonGovt: n(s.price.nonGovt) },
      isActive: s.isActive ?? true,
    }))
  } else if (pricingType === "flat") {
    config.flatRate = {
      price: { govt: n(values.flatGovt), nonGovt: n(values.flatNonGovt) },
    }
  } else if (pricingType === "charge_policy") {
    config.chargeSlabs = values.chargeSlabs?.map(s => ({
      label: s.label || undefined,
      daysFrom: Number(s.daysFrom),
      daysTo: s.daysTo !== "" && s.daysTo != null ? Number(s.daysTo) : null,
      percentage: Number(s.percentage),
      minimumCharge: n(s.minimumCharge),
    }))
  }

  return config
}

// ─── Config Summary (card display) ─────────────────────────────────────────────

function SummaryTable({ head, rows }) {
  return (
    <div className="rounded-md border overflow-hidden text-sm">
      <div className="grid bg-blue-50 border-b px-3 py-1.5" style={{ gridTemplateColumns: `repeat(${head.length}, 1fr)` }}>
        {head.map(h => (
          <span key={h} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} className={`grid px-3 py-2 ${i % 2 === 1 ? "bg-muted/20" : ""}`} style={{ gridTemplateColumns: `repeat(${head.length}, 1fr)` }}>
          {row.map((cell, j) => (
            <span key={j} className={`tabular-nums truncate ${j === 0 ? "font-medium" : "text-muted-foreground"}`}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  )
}

function ConfigSummary({ config }) {
  const { pricingType } = config

  if (pricingType === "hourly_table") {
    const active   = config.hourlyRates?.filter(r => r.isActive) ?? []
    const inactive = config.hourlyRates?.filter(r => !r.isActive) ?? []
    if (!active.length && !inactive.length)
      return <p className="text-xs text-muted-foreground">No rates configured</p>
    return (
      <div className="space-y-2">
        <SummaryTable
          head={["Duration", "Govt", "Non-Govt"]}
          rows={active.map(r => [
            `${r.hours}h`,
            r.price?.govt != null ? formatINR(r.price.govt) : "—",
            r.price?.nonGovt != null ? formatINR(r.price.nonGovt) : "—",
          ])}
        />
        {inactive.length > 0 && (
          <p className="text-xs text-muted-foreground">{inactive.length} inactive rate{inactive.length > 1 ? "s" : ""} hidden</p>
        )}
      </div>
    )
  }

  if (pricingType === "shift_based") {
    const shifts = config.shifts ?? []
    if (!shifts.length) return <p className="text-xs text-muted-foreground">No shifts configured</p>
    return (
      <SummaryTable
        head={["Shift", "Time", "Govt", "Non-Govt"]}
        rows={shifts.map(s => [
          s.name,
          `${s.startTime}–${s.endTime}`,
          s.price?.govt != null ? formatINR(s.price.govt) : "—",
          s.price?.nonGovt != null ? formatINR(s.price.nonGovt) : "—",
        ])}
      />
    )
  }

  if (pricingType === "flat") {
    const p = config.flatRate?.price
    if (!p?.govt && !p?.nonGovt) return <p className="text-xs text-muted-foreground">No pricing set</p>
    return (
      <div className="grid grid-cols-2 gap-2">
        {p?.govt != null && (
          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Govt</p>
            <p className="text-base font-semibold tabular-nums mt-0.5">{formatINR(p.govt)}</p>
          </div>
        )}
        {p?.nonGovt != null && (
          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Non-Govt</p>
            <p className="text-base font-semibold tabular-nums mt-0.5">{formatINR(p.nonGovt)}</p>
          </div>
        )}
      </div>
    )
  }

  if (pricingType === "charge_policy") {
    if (!config.chargeSlabs?.length)
      return <p className="text-xs text-muted-foreground">No charge slabs configured</p>
    return (
      <SummaryTable
        head={["Window", "Charge", "Min"]}
        rows={config.chargeSlabs.map(s => [
          `${s.label ? s.label + ": " : ""}Day ${s.daysFrom}–${s.daysTo ?? "∞"}`,
          `${s.percentage}%`,
          s.minimumCharge ? formatINR(s.minimumCharge) : "—",
        ])}
      />
    )
  }

  return null
}

// ─── Audi Info Panel ───────────────────────────────────────────────────────────

function AudiInfoPanel({ audi, existingActiveConfig, audiSlots = [] }) {
  if (!audi) return null
  const cfg = audi.config ?? {}
  const mode = cfg.slotMode
  const capacity = cfg.capacity
  const durations = cfg.bookingDurations ?? []

  const toMins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
  const slotDurations = audiSlots
    .filter(s => s.config?.startTime && s.config?.endTime)
    .map(s => {
      const diff = toMins(s.config.endTime) - toMins(s.config.startTime)
      // handle overnight slots
      const mins = diff < 0 ? diff + 24 * 60 : diff
      const hrs = Math.round((mins / 60) * 10) / 10
      return { name: s.name, start: s.config.startTime, end: s.config.endTime, hours: hrs }
    })

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">Audi Details</span>
        {mode && (
          <Badge variant="secondary" className="text-xs capitalize">{mode}</Badge>
        )}
        {capacity && (
          <span className="text-xs text-muted-foreground">{capacity} seats</span>
        )}
      </div>

      {/* Flexible mode */}
      {mode === "flexible" && durations.length > 0 && (
        <div className="text-xs space-y-0.5">
          <span className="text-muted-foreground">Booking durations: </span>
          <span className="font-medium">{durations.map(d => `${d}h`).join(", ")}</span>
          <p className="text-muted-foreground">
            Use <strong>Hourly Table</strong> and add one rate entry per duration above — the system matches bookings by hours to look up the price.
          </p>
        </div>
      )}
      {mode === "flexible" && durations.length === 0 && (
        <div className="flex items-start gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>No booking durations set on this audi. Go to Audi Rules and add them first, then create the price config.</span>
        </div>
      )}

      {/* Fixed mode — show slot durations so admin knows exactly which hours to add */}
      {mode === "fixed" && slotDurations.length > 0 && (
        <div className="text-xs space-y-1.5">
          <p className="text-muted-foreground">
            Your active slots — add these exact durations to the <strong>Hourly Table</strong>:
          </p>
          <div className="space-y-1">
            {slotDurations.map(s => (
              <div key={s.name} className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">{s.hours}h</Badge>
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground ml-auto shrink-0">{s.start}–{s.end}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground">
            Unique durations needed: <strong>{[...new Set(slotDurations.map(s => `${s.hours}h`))].join(", ")}</strong>.
            If a slot's duration has no matching rate, it falls back to slot's own pricing.
          </p>
        </div>
      )}
      {mode === "fixed" && slotDurations.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No active slots found. Go to <strong>Slots</strong> page and add time windows first — the slot durations will pre-fill the <strong>Hourly Table</strong> rates automatically.
        </p>
      )}

      {existingActiveConfig && (
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            An active price config already exists for this audi (<span className="font-mono">{existingActiveConfig.priceConfigId}</span>).
            Creating another will be rejected — edit or deactivate the existing one first.
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Price Config Dialog ────────────────────────────────────────────────────────

function PriceConfigDialog({ open, onOpenChange, entityType, entityOptions, editingConfig, audiDataMap, existingConfigs, prefilledEntityId }) {
  const queryClient = useQueryClient()
  const [autoPopulatedFor, setAutoPopulatedFor] = useState(null)

  const form = useForm({
    resolver: zodResolver(formZ),
    defaultValues: editingConfig ? pcToForm(editingConfig) : emptyForm(entityType),
  })

  const pricingType = form.watch("pricingType")
  const selectedEntity = form.watch("entityId")

  // Derive selected audi details + duplicate-config warning
  const selectedAudi = entityType === "audi" && audiDataMap
    ? audiDataMap.get(selectedEntity)
    : null

  const existingActiveConfig = entityType === "audi" && existingConfigs && selectedEntity
    ? existingConfigs.find(
      c => c.relationships?.entityId === selectedEntity &&
        c.lifecycle?.status === "active" &&
        (!editingConfig || c.priceConfigId !== editingConfig.priceConfigId)
    ) ?? null
    : null

  // Operational hours from the selected audi — used to constrain shift times
  const audiMode = selectedAudi?.config?.slotMode
  const opStart = selectedAudi?.config?.operationalHours?.start ?? ""
  const opEnd = selectedAudi?.config?.operationalHours?.end ?? ""

  // Fetch active slots for fixed-mode audis — used to show duration hints in the info panel
  const { data: slotsRaw } = useQuery({
    queryKey: ["slots", selectedEntity],
    queryFn: () => listSlots(selectedEntity).then(r => {
      const raw = r.data.data
      return Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
    }),
    enabled: entityType === "audi" && audiMode === "fixed" && !!selectedEntity,
  })
  const slotsArr = Array.isArray(slotsRaw?.data) ? slotsRaw.data : Array.isArray(slotsRaw) ? slotsRaw : []
  const audiSlots = slotsArr.filter(s => s.lifecycle?.status === "active")

  // When a new audi is selected, auto-fill existing shift rows with its operational hours
  useEffect(() => {
    if (editingConfig) return
    if (!opStart && !opEnd) return
    if (form.getValues("pricingType") !== "shift_based") return
    const shifts = form.getValues("shifts") ?? []
    shifts.forEach((_, i) => {
      if (opStart) form.setValue(`shifts.${i}.startTime`, opStart)
      if (opEnd) form.setValue(`shifts.${i}.endTime`, opEnd)
    })
  }, [opStart, opEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  // If switching to a Fixed/Flexible audi narrows allowed types and the current
  // pricingType is no longer valid (e.g. shift_based was selected first), reset it.
  useEffect(() => {
    if (editingConfig) return
    const current = form.getValues("pricingType")
    if (!allowedTypes.includes(current)) {
      form.setValue("pricingType", allowedTypes[0] ?? "flat")
    }
  }, [audiMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate hourly rate rows when an audi is selected (new config only).
  // Flexible: one row per bookingDuration. Fixed: one row per unique slot duration.
  // Runs again when audiSlots arrives (async fetch) — guard with autoPopulatedFor
  // so we don't overwrite the user's edits after they've typed in prices.
  useEffect(() => {
    if (editingConfig) return
    if (entityType !== "audi") return
    if (!selectedEntity) return
    if (autoPopulatedFor === selectedEntity) return
    if (form.getValues("pricingType") !== "hourly_table") return

    if (audiMode === "flexible") {
      const durations = selectedAudi?.config?.bookingDurations ?? []
      if (durations.length > 0) {
        hrReplace(durations.map(d => ({ ...EMPTY_HOURLY, hours: d })))
        setAutoPopulatedFor(selectedEntity)
      }
    } else if (audiMode === "fixed") {
      const toMins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
      const uniqueHours = [...new Set(
        audiSlots
          .filter(s => s.config?.startTime && s.config?.endTime)
          .map(s => {
            const diff = toMins(s.config.endTime) - toMins(s.config.startTime)
            const mins = diff < 0 ? diff + 24 * 60 : diff
            return Math.round((mins / 60) * 10) / 10
          })
      )].sort((a, b) => a - b)
      if (uniqueHours.length > 0) {
        hrReplace(uniqueHours.map(h => ({ ...EMPTY_HOURLY, hours: h })))
        setAutoPopulatedFor(selectedEntity)
      }
    }
  }, [selectedEntity, audiSlots, audiMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (values) => {
    if (values.pricingType === "shift_based" && (opStart || opEnd)) {
      let hasError = false
      values.shifts?.forEach((s, i) => {
        if (opStart && s.startTime < opStart) {
          form.setError(`shifts.${i}.startTime`, { message: `Must be ${opStart} or later` })
          hasError = true
        }
        if (opEnd && s.endTime > opEnd) {
          form.setError(`shifts.${i}.endTime`, { message: `Must be ${opEnd} or earlier` })
          hasError = true
        }
        if (s.startTime >= s.endTime) {
          form.setError(`shifts.${i}.endTime`, { message: "End time must be after start time" })
          hasError = true
        }
      })
      if (hasError) return
    }
    mutation.mutate(values)
  }

  const {
    fields: hrFields, append: hrAppend, remove: hrRemove, replace: hrReplace,
  } = useFieldArray({ control: form.control, name: "hourlyRates" })

  const {
    fields: shiftFields, append: shiftAppend, remove: shiftRemove,
  } = useFieldArray({ control: form.control, name: "shifts" })

  const {
    fields: slabFields, append: slabAppend, remove: slabRemove,
  } = useFieldArray({ control: form.control, name: "chargeSlabs" })

  useEffect(() => {
    if (!open) return
    setAutoPopulatedFor(null)
    form.reset(editingConfig ? pcToForm(editingConfig) : emptyForm(entityType, prefilledEntityId ?? ""))
  }, [open, editingConfig, entityType, prefilledEntityId, form])

  const mutation = useMutation({
    mutationFn: (values) => {
      const config = buildConfig(values)
      if (editingConfig) {
        return updatePriceConfig(editingConfig.priceConfigId, { config })
      }
      return createPriceConfig({ entityType, entityId: values.entityId, config })
    },
    onSuccess: () => {
      toast.success(editingConfig ? "Price config updated" : "Price config created")
      queryClient.invalidateQueries({ queryKey: ["price-configs", entityType] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  // Only hourly_table is valid for audi: flat/shift_based are silently ignored by the
  // fee calculator (resolveHourlyRate only handles pricingType === 'hourly_table').
  // When editing an existing config with a legacy type, keep that type available so
  // the admin can still view and update it.
  const baseAllowed = PRICING_TYPES_BY_ENTITY[entityType] ?? []
  const allowedTypes = editingConfig && !baseAllowed.includes(editingConfig.config?.pricingType)
    ? [...baseAllowed, editingConfig.config.pricingType]
    : baseAllowed

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] flex flex-col"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {editingConfig ? "Edit" : "Add"} Price Config — {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          <Form {...form}>
            <form
              id="price-config-form"
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-5 py-2"
            >
              {/* Entity + Pricing type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Entity selector */}
                <FormField
                  control={form.control}
                  name="entityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {entityType === "service" ? "Service" : "Audi"}
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!!editingConfig || !!prefilledEntityId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {entityOptions.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pricing type */}
                <FormField
                  control={form.control}
                  name="pricingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pricing Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={allowedTypes.length === 1}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allowedTypes.map(t => (
                            <SelectItem key={t} value={t}>{PRICING_TYPE_LABELS[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Audi info panel — shown when an audi is selected */}
              {entityType === "audi" && selectedEntity && (
                <AudiInfoPanel
                  audi={selectedAudi}
                  existingActiveConfig={existingActiveConfig}
                  audiSlots={audiSlots}
                />
              )}

              <Separator />

              {/* ── Hourly Table ── */}
              {pricingType === "hourly_table" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Hourly Rates</p>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => hrAppend({ ...EMPTY_HOURLY })}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Rate
                    </Button>
                  </div>

                  {hrFields.map((field, i) => {
                    const secApplicable = form.watch(`hourlyRates.${i}.securityDeposit.applicable`)
                    const depositType = form.watch(`hourlyRates.${i}.securityDeposit.depositType`)
                    return (
                      <Card key={field.id} className="p-3 space-y-3">
                        <div className="grid grid-cols-3 gap-3 items-end">
                          <FormInput
                            control={form.control}
                            name={`hourlyRates.${i}.hours`}
                            label="Hours"
                            type="number"
                            placeholder="e.g. 2"
                          />
                          <FormInput
                            control={form.control}
                            name={`hourlyRates.${i}.price.govt`}
                            label="Govt Rate (₹)"
                            type="number"
                            placeholder="0"
                          />
                          <FormInput
                            control={form.control}
                            name={`hourlyRates.${i}.price.nonGovt`}
                            label="Non-Govt Rate (₹)"
                            type="number"
                            placeholder="0"
                          />
                        </div>

                        {/* Security deposit toggle */}
                        <FormField
                          control={form.control}
                          name={`hourlyRates.${i}.securityDeposit.applicable`}
                          render={({ field: f }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                              <FormControl>
                                <Checkbox checked={f.value} onCheckedChange={f.onChange} id={`sd-${i}`} />
                              </FormControl>
                              <Label htmlFor={`sd-${i}`} className="text-sm font-normal cursor-pointer">
                                Security Deposit
                              </Label>
                            </FormItem>
                          )}
                        />

                        {secApplicable && (
                          <div className="pl-4 border-l space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <FormField
                                control={form.control}
                                name={`hourlyRates.${i}.securityDeposit.depositType`}
                                render={({ field: f }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Deposit Type</FormLabel>
                                    <Select value={f.value ?? ""} onValueChange={f.onChange}>
                                      <FormControl>
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue placeholder="Select…" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                                        <SelectItem value="percentage">Percentage</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                              {depositType === "fixed" && (
                                <FormInput
                                  control={form.control}
                                  name={`hourlyRates.${i}.securityDeposit.amount`}
                                  label="Amount (₹)"
                                  type="number"
                                  placeholder="0"
                                />
                              )}
                              {depositType === "percentage" && (
                                <FormInput
                                  control={form.control}
                                  name={`hourlyRates.${i}.securityDeposit.percentage`}
                                  label="Percentage (%)"
                                  type="number"
                                  placeholder="0"
                                />
                              )}
                            </div>
                            <FormInput
                              control={form.control}
                              name={`hourlyRates.${i}.securityDeposit.description`}
                              label="Description (optional)"
                              placeholder="e.g. Returned after event"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <FormField
                            control={form.control}
                            name={`hourlyRates.${i}.isActive`}
                            render={({ field: f }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Switch checked={f.value} onCheckedChange={f.onChange} className="scale-90" />
                                </FormControl>
                                <Label className="text-sm font-normal">Active</Label>
                              </FormItem>
                            )}
                          />
                          {hrFields.length > 1 && (
                            <Button type="button" size="icon" variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => hrRemove(i)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}

              {/* ── Shift Based ── */}
              {pricingType === "shift_based" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Shifts</p>
                      {(opStart || opEnd) && (
                        <p className="text-xs text-muted-foreground">
                          Allowed window: {opStart || "—"} – {opEnd || "—"}
                        </p>
                      )}
                    </div>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => shiftAppend({
                        name: "", isActive: true,
                        startTime: opStart || "09:00",
                        endTime: opEnd || "18:00",
                        price: { govt: "", nonGovt: "" },
                      })}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Shift
                    </Button>
                  </div>

                  {shiftFields.map((field, i) => (
                    <Card key={field.id} className="p-3 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <FormInput
                          control={form.control}
                          name={`shifts.${i}.name`}
                          label="Shift Name"
                          placeholder="Morning"
                        />
                        <FormField
                          control={form.control}
                          name={`shifts.${i}.startTime`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>Start Time</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  min={opStart || undefined}
                                  max={opEnd || undefined}
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`shifts.${i}.endTime`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>End Time</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  min={opStart || undefined}
                                  max={opEnd || undefined}
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormInput
                          control={form.control}
                          name={`shifts.${i}.price.govt`}
                          label="Govt Rate (₹)"
                          type="number"
                          placeholder="0"
                        />
                        <FormInput
                          control={form.control}
                          name={`shifts.${i}.price.nonGovt`}
                          label="Non-Govt Rate (₹)"
                          type="number"
                          placeholder="0"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <FormField
                          control={form.control}
                          name={`shifts.${i}.isActive`}
                          render={({ field: f }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                              <FormControl>
                                <Switch checked={f.value} onCheckedChange={f.onChange} className="scale-90" />
                              </FormControl>
                              <Label className="text-sm font-normal">Active</Label>
                            </FormItem>
                          )}
                        />
                        {shiftFields.length > 1 && (
                          <Button type="button" size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => shiftRemove(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* ── Flat Rate ── */}
              {pricingType === "flat" && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Flat Rate Pricing</p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput
                      control={form.control}
                      name="flatGovt"
                      label="Govt Rate (₹)"
                      type="number"
                      placeholder="0"
                    />
                    <FormInput
                      control={form.control}
                      name="flatNonGovt"
                      label="Non-Govt Rate (₹)"
                      type="number"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* ── Charge Policy ── */}
              {(pricingType === "charge_policy" || entityType === "cancellation" || entityType === "postponement") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Charge Slabs</p>
                      <p className="text-xs text-muted-foreground">Leave "Days To" empty for open-ended slab</p>
                    </div>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => slabAppend({ ...EMPTY_SLAB })}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Slab
                    </Button>
                  </div>

                  {slabFields.map((field, i) => (
                    <Card key={field.id} className="p-3 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <FormInput
                          control={form.control}
                          name={`chargeSlabs.${i}.label`}
                          label="Label (optional)"
                          placeholder="e.g. Last minute"
                        />
                        <FormInput
                          control={form.control}
                          name={`chargeSlabs.${i}.daysFrom`}
                          label="Days From"
                          type="number"
                          placeholder="0"
                        />
                        <FormInput
                          control={form.control}
                          name={`chargeSlabs.${i}.daysTo`}
                          label="Days To (blank = ∞)"
                          type="number"
                          placeholder="∞"
                        />
                        <FormInput
                          control={form.control}
                          name={`chargeSlabs.${i}.percentage`}
                          label="Charge (%)"
                          type="number"
                          placeholder="0–100"
                        />
                        <FormInput
                          control={form.control}
                          name={`chargeSlabs.${i}.minimumCharge`}
                          label="Min Charge ₹ (optional)"
                          type="number"
                          placeholder="0"
                        />
                      </div>

                      {slabFields.length > 1 && (
                        <div className="flex justify-end">
                          <Button type="button" size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => slabRemove(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </form>
          </Form>
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="price-config-form"
            disabled={mutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingConfig ? "Save Changes" : "Create Config"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Price Config Card ──────────────────────────────────────────────────────────

function PriceConfigCard({ pc, entity, onEdit, onToggleStatus }) {
  const isConfigured = !!pc
  const isActive     = pc?.lifecycle?.status === "active"

  return (
    <Card className={`border-l-4 hover:shadow-md transition-shadow duration-200 ${
      !isConfigured ? "border-l-slate-200" :
      isActive      ? "border-l-blue-500"  : "border-l-slate-300 opacity-60"
    }`}>
      <CardContent className="p-5 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-snug truncate">{entity.name}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {isConfigured ? (
                <>
                  <Badge variant="secondary" className="text-xs">
                    {PRICING_TYPE_LABELS[pc.config?.pricingType] ?? pc.config?.pricingType}
                  </Badge>
                  <StatusBadge status={pc.lifecycle?.status} />
                </>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground border-dashed">
                  Not configured
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {isConfigured && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={onToggleStatus}
                    className={isActive ? "text-destructive focus:text-destructive" : ""}
                  >
                    <Power className="mr-2 h-4 w-4" />
                    {isActive ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {isConfigured ? (
          <>
            <Separator />
            <ConfigSummary config={pc.config} />
            <p className="text-[10px] text-muted-foreground/50 font-mono truncate pt-1">
              {pc.priceConfigId}
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-5 text-center">
            <Settings2 className="h-7 w-7 text-muted-foreground/25" />
            <p className="text-xs text-muted-foreground">No pricing configured</p>
            <p className="text-[11px] text-muted-foreground/60">Click edit to set up</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Tab content ────────────────────────────────────────────────────────────────

function TabPane({ entityType, entities, onEdit, onToggleStatus }) {
  const { data: configs, isLoading } = useQuery({
    queryKey: ["price-configs", entityType],
    queryFn: () => listPriceConfigs({ entityType }).then(r => {
      const raw = r.data.data
      return Array.isArray(raw) ? raw : []
    }),
    enabled: entities.length > 0 || entityType === "cancellation" || entityType === "postponement",
  })

  const meta = TAB_META[entityType]
  const configByEntityId = new Map((configs ?? []).map(c => [c.relationships?.entityId, c]))

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><CardContent className="h-40 animate-pulse bg-muted/30 pt-6" /></Card>
        ))}
      </div>
    )
  }

  if (!entities.length) {
    return (
      <EmptyState
        icon={Settings2}
        title="No entities found"
        message={`No ${entityType === "service" ? "services" : "audis"} set up yet.`}
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{meta.description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {entities.map(entity => {
          const pc = configByEntityId.get(entity.id) ?? null
          return (
            <PriceConfigCard
              key={entity.id}
              pc={pc}
              entity={entity}
              onEdit={() => onEdit(pc, entity)}
              onToggleStatus={() => onToggleStatus(pc)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function PriceConfigList() {
  useEffect(() => { document.title = "NFDC Admin — Price Config" }, [])

  const { user } = useAuth()
  const theaterId = user?.theaterId
  const queryClient = useQueryClient()

  const [activeTab,        setActiveTab]        = useState("audi")
  const [dialogOpen,       setDialogOpen]       = useState(false)
  const [editingConfig,    setEditingConfig]    = useState(null)
  const [prefilledEntityId, setPrefilledEntityId] = useState(null)
  const [statusTarget,     setStatusTarget]     = useState(null)

  // ── Theater config (allowUserReschedule gate) ──
  const { data: theaterRaw } = useQuery({
    queryKey: ["theater-profile", theaterId],
    queryFn:  () => getTheaterProfile(theaterId).then(r => r.data.data),
    enabled:  !!theaterId,
    staleTime: 60_000,
  })
  const allowUserReschedule = theaterRaw?.config?.allowUserReschedule ?? false

  // ── Audis — always fresh so newly created audis appear in entity selectors ──
  const { data: audisRaw } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAudis(theaterId).then(r => r.data.data),
    enabled: !!theaterId,
    staleTime: 0,
    refetchOnMount: "always",
  })
  const allAudis = Array.isArray(audisRaw?.data) ? audisRaw.data : []
  const audiOptions = allAudis.map(a => ({ id: a.audiId ?? a.id ?? a._id, name: a.name }))
  // Full audi objects keyed by audiId — passed into the dialog for the info panel
  const audiDataMap = new Map(allAudis.map(a => [a.audiId ?? a.id ?? a._id, a]))

  // ── Services ──
  const { data: groupedRaw } = useQuery({
    queryKey: ["services", JSON.stringify({ theaterId })],
    queryFn: () => listServicesGrouped({ theaterId }).then(r => r.data.data),
    enabled: !!theaterId,
    staleTime: 0,
    refetchOnMount: "always",
  })
  const allServices = [
    ...(groupedRaw?.sections?.flatMap(s => s.services) ?? []),
    ...(groupedRaw?.ungrouped?.services ?? []),
  ]
  const serviceOptions = allServices.map(s => ({
    id: s.serviceId ?? s.id ?? s._id,
    name: s.name,
  }))

  // Entity options for current tab
  const entityOptionsForTab = (tab) => tab === "service" ? serviceOptions : audiOptions

  // ── Config queries for pending badges (share cache with TabPane) ──
  const toList = r => Array.isArray(r.data.data) ? r.data.data : []
  const { data: audiConfigs }         = useQuery({ queryKey: ["price-configs", "audi"],         queryFn: () => listPriceConfigs({ entityType: "audi"         }).then(toList), enabled: audiOptions.length    > 0 })
  const { data: serviceConfigs }      = useQuery({ queryKey: ["price-configs", "service"],      queryFn: () => listPriceConfigs({ entityType: "service"      }).then(toList), enabled: serviceOptions.length > 0 })
  const { data: cancellationConfigs } = useQuery({ queryKey: ["price-configs", "cancellation"], queryFn: () => listPriceConfigs({ entityType: "cancellation" }).then(toList), enabled: allowUserReschedule && audiOptions.length > 0 })
  const { data: postponementConfigs } = useQuery({ queryKey: ["price-configs", "postponement"], queryFn: () => listPriceConfigs({ entityType: "postponement" }).then(toList), enabled: allowUserReschedule && audiOptions.length > 0 })

  const configuredSet = (configs) => new Set((configs ?? []).map(c => c.relationships?.entityId))
  const pendingCount = {
    audi:         audiOptions.filter(e    => !configuredSet(audiConfigs).has(e.id)).length,
    service:      serviceOptions.filter(e => !configuredSet(serviceConfigs).has(e.id)).length,
    cancellation: allowUserReschedule ? audiOptions.filter(e => !configuredSet(cancellationConfigs).has(e.id)).length : 0,
    postponement: allowUserReschedule ? audiOptions.filter(e => !configuredSet(postponementConfigs).has(e.id)).length : 0,
  }

  const visibleTabs = allowUserReschedule
    ? ["audi", "service", "cancellation", "postponement"]
    : ["audi", "service"]

  // ── Status mutation ──
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updatePriceConfigStatus(id, status),
    onSuccess: () => {
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: ["price-configs", activeTab] })
      setStatusTarget(null)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  const openEdit = (pc, entity) => {
    setEditingConfig(pc ?? null)
    setPrefilledEntityId(!pc ? (entity?.id ?? null) : null)
    setDialogOpen(true)
  }

  const handleToggleStatus = (pc) => {
    if (!pc) return
    setStatusTarget({
      id: pc.priceConfigId,
      name: pc.relationships?.entityId ?? pc.priceConfigId,
      isActive: pc.lifecycle?.status === "active",
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Price Configuration" />

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setEditingConfig(null) }}>
        {/* Tab bar — full-width underline style */}
        <div className="flex flex-col">
          <div className="border-b border-border overflow-x-auto ">
            <TabsList className="flex h-auto gap-0 rounded-none bg-transparent p-0">
              {[
                { value: "audi",         label: "Audi",         Icon: Building2    },
                { value: "service",      label: "Service",      Icon: Layers       },
                { value: "cancellation", label: "Cancellation", Icon: Ban          },
                { value: "postponement", label: "Postponement", Icon: CalendarClock },
              ].filter(t => visibleTabs.includes(t.value)).map(({ value, label, Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex items-center gap-2 rounded-none border-b-2 border-transparent -mb-px bg-transparent px-5 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  {pendingCount[value] > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white tabular-nums">
                      {pendingCount[value]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Full-width content */}
          <div className="mt-6">
            {TABS.filter(tab => visibleTabs.includes(tab)).map(tab => (
              <TabsContent key={tab} value={tab} className="mt-0">
                <TabPane
                  entityType={tab}
                  entities={entityOptionsForTab(tab)}
                  onEdit={openEdit}
                  onToggleStatus={handleToggleStatus}
                />
              </TabsContent>
            ))}
          </div>

        </div>

      </Tabs>

      {/* Create / Edit dialog */}
      <PriceConfigDialog
        key={editingConfig?.priceConfigId ?? `new-${activeTab}-${prefilledEntityId}`}
        open={dialogOpen}
        onOpenChange={o => { setDialogOpen(o); if (!o) { setEditingConfig(null); setPrefilledEntityId(null) } }}
        entityType={editingConfig?.relationships?.entityType ?? activeTab}
        entityOptions={entityOptionsForTab(editingConfig?.relationships?.entityType ?? activeTab)}
        editingConfig={editingConfig}
        audiDataMap={audiDataMap}
        existingConfigs={queryClient.getQueryData(["price-configs", editingConfig?.relationships?.entityType ?? activeTab]) ?? []}
        prefilledEntityId={prefilledEntityId}
      />

      {/* Status confirm dialog */}
      <AlertDialog open={!!statusTarget} onOpenChange={o => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.isActive ? "Deactivate" : "Activate"} config for &quot;{statusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.isActive
                ? "This pricing config will no longer be used for bookings."
                : "This pricing config will become active again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusMutation.mutate({
                id: statusTarget.id,
                status: statusTarget.isActive ? "inactive" : "active",
              })}
              className={statusTarget?.isActive ? "bg-destructive hover:bg-destructive/90" : ""}
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
