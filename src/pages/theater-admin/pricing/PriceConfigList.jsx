import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Plus, Pencil, Loader2, Trash2, MoreHorizontal, Settings2, Power,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
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
import { listAudis } from "@/api/audi"
import { listServicesGrouped } from "@/api/services"
import {
  listPriceConfigs, createPriceConfig, updatePriceConfig, updatePriceConfigStatus,
} from "@/api/priceConfig"
import { formatINR } from "@/utils/formatCurrency"

// ─── Constants ─────────────────────────────────────────────────────────────────

const TABS = ["audi", "service", "cancellation", "postponement"]

const PRICING_TYPES_BY_ENTITY = {
  audi:         ["hourly_table", "shift_based", "flat"],
  service:      ["flat"],
  cancellation: ["charge_policy"],
  postponement: ["charge_policy"],
}

const DEFAULT_PRICING_TYPE = {
  audi:         "hourly_table",
  service:      "flat",
  cancellation: "charge_policy",
  postponement: "charge_policy",
}

const PRICING_TYPE_LABELS = {
  hourly_table:  "Hourly Table",
  shift_based:   "Shift Based",
  flat:          "Flat Rate",
  charge_policy: "Charge Policy",
}

// ─── Zod schemas ────────────────────────────────────────────────────────────────

const priceZ = z.object({
  govt:    z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
  nonGovt: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
})

const secDepZ = z.object({
  applicable:  z.boolean().default(false),
  depositType: z.enum(["fixed", "percentage"]).optional(),
  amount:      z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  percentage:  z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional(),
  description: z.string().optional(),
  refundable:  z.boolean().default(true),
})

const hourlyItemZ = z.object({
  hours:           z.coerce.number().positive("Must be > 0"),
  price:           priceZ,
  securityDeposit: secDepZ.optional(),
  isActive:        z.boolean().default(true),
})

const shiftItemZ = z.object({
  name:      z.string().min(1, "Name required"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  price:     priceZ,
  isActive:  z.boolean().default(true),
})

const slabZ = z.object({
  label:         z.string().optional(),
  daysFrom:      z.coerce.number().min(0, "Min 0"),
  daysTo:        z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
  percentage:    z.coerce.number().min(0).max(100, "Max 100%"),
  minimumCharge: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
})

const formZ = z.object({
  entityId:    z.string().min(1, "Select an entity"),
  pricingType: z.enum(["hourly_table", "shift_based", "flat", "charge_policy"]),
  hourlyRates: z.array(hourlyItemZ).optional(),
  shifts:      z.array(shiftItemZ).optional(),
  flatGovt:    z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  flatNonGovt: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  chargeSlabs: z.array(slabZ).optional(),
})

// ─── Form helpers ──────────────────────────────────────────────────────────────

const EMPTY_HOURLY = { hours: "", price: { govt: "", nonGovt: "" }, securityDeposit: { applicable: false, refundable: true }, isActive: true }
const EMPTY_SHIFT  = { name: "", startTime: "09:00", endTime: "18:00", price: { govt: "", nonGovt: "" }, isActive: true }
const EMPTY_SLAB   = { label: "", daysFrom: "", daysTo: "", percentage: "", minimumCharge: "" }

function pcToForm(pc) {
  const c = pc.config
  return {
    entityId:    pc.relationships?.entityId ?? "",
    pricingType: c.pricingType,
    hourlyRates: c.hourlyRates?.length
      ? c.hourlyRates.map(r => ({
          hours:   r.hours ?? "",
          price:   { govt: r.price?.govt ?? "", nonGovt: r.price?.nonGovt ?? "" },
          isActive: r.isActive ?? true,
          securityDeposit: r.securityDeposit ?? { applicable: false, refundable: true },
        }))
      : [{ ...EMPTY_HOURLY }],
    shifts: c.shifts?.length
      ? c.shifts.map(s => ({
          name:      s.name ?? "",
          startTime: s.startTime ?? "09:00",
          endTime:   s.endTime ?? "18:00",
          price:     { govt: s.price?.govt ?? "", nonGovt: s.price?.nonGovt ?? "" },
          isActive:  s.isActive ?? true,
        }))
      : [{ ...EMPTY_SHIFT }],
    flatGovt:    c.flatRate?.price?.govt    ?? "",
    flatNonGovt: c.flatRate?.price?.nonGovt ?? "",
    chargeSlabs: c.chargeSlabs?.length
      ? c.chargeSlabs.map(s => ({
          label:         s.label         ?? "",
          daysFrom:      s.daysFrom      ?? "",
          daysTo:        s.daysTo        ?? "",
          percentage:    s.percentage    ?? "",
          minimumCharge: s.minimumCharge ?? "",
        }))
      : [{ ...EMPTY_SLAB }],
  }
}

function emptyForm(entityType, entityId = "") {
  return {
    entityId,
    pricingType: DEFAULT_PRICING_TYPE[entityType] ?? "flat",
    hourlyRates: [{ ...EMPTY_HOURLY }],
    shifts:      [{ ...EMPTY_SHIFT }],
    flatGovt:    "",
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
      hours:    Number(r.hours),
      price:    { govt: n(r.price.govt), nonGovt: n(r.price.nonGovt) },
      isActive: r.isActive ?? true,
      securityDeposit: r.securityDeposit?.applicable
        ? {
            applicable:  true,
            depositType: r.securityDeposit.depositType,
            amount:      n(r.securityDeposit.amount),
            percentage:  n(r.securityDeposit.percentage),
            description: r.securityDeposit.description || undefined,
            refundable:  r.securityDeposit.refundable ?? true,
          }
        : { applicable: false },
    }))
  } else if (pricingType === "shift_based") {
    config.shifts = values.shifts?.map(s => ({
      name:      s.name,
      startTime: s.startTime,
      endTime:   s.endTime,
      price:     { govt: n(s.price.govt), nonGovt: n(s.price.nonGovt) },
      isActive:  s.isActive ?? true,
    }))
  } else if (pricingType === "flat") {
    config.flatRate = {
      price: { govt: n(values.flatGovt), nonGovt: n(values.flatNonGovt) },
    }
  } else if (pricingType === "charge_policy") {
    config.chargeSlabs = values.chargeSlabs?.map(s => ({
      label:         s.label || undefined,
      daysFrom:      Number(s.daysFrom),
      daysTo:        s.daysTo !== "" && s.daysTo != null ? Number(s.daysTo) : null,
      percentage:    Number(s.percentage),
      minimumCharge: n(s.minimumCharge),
    }))
  }

  return config
}

// ─── Config Summary (card display) ─────────────────────────────────────────────

function ConfigSummary({ config }) {
  const { pricingType } = config

  if (pricingType === "hourly_table") {
    const active = config.hourlyRates?.filter(r => r.isActive) ?? []
    const inactive = config.hourlyRates?.filter(r => !r.isActive) ?? []
    return (
      <div className="space-y-1 text-sm">
        {active.map((r, i) => (
          <div key={i} className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground w-12">{r.hours}h</span>
            <div className="flex gap-3">
              {r.price?.govt    != null && <span>Govt: <strong>{formatINR(r.price.govt)}</strong></span>}
              {r.price?.nonGovt != null && <span>Non-Govt: <strong>{formatINR(r.price.nonGovt)}</strong></span>}
            </div>
            {r.securityDeposit?.applicable && (
              <Badge variant="outline" className="text-[10px] px-1">Deposit</Badge>
            )}
          </div>
        ))}
        {inactive.length > 0 && (
          <p className="text-xs text-muted-foreground">{inactive.length} inactive rate{inactive.length > 1 ? "s" : ""} hidden</p>
        )}
      </div>
    )
  }

  if (pricingType === "shift_based") {
    return (
      <div className="space-y-1 text-sm">
        {config.shifts?.map((s, i) => (
          <div key={i} className={`flex items-center justify-between py-0.5 ${!s.isActive ? "opacity-40" : ""}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium truncate">{s.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{s.startTime}–{s.endTime}</span>
            </div>
            <div className="flex gap-3 shrink-0">
              {s.price?.govt    != null && <span>Govt: <strong>{formatINR(s.price.govt)}</strong></span>}
              {s.price?.nonGovt != null && <span>Non-Govt: <strong>{formatINR(s.price.nonGovt)}</strong></span>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (pricingType === "flat") {
    const p = config.flatRate?.price
    if (!p?.govt && !p?.nonGovt) return <p className="text-sm text-muted-foreground">No pricing set</p>
    return (
      <div className="flex flex-wrap gap-4 text-sm">
        {p?.govt    != null && <span>Govt: <strong>{formatINR(p.govt)}</strong></span>}
        {p?.nonGovt != null && <span>Non-Govt: <strong>{formatINR(p.nonGovt)}</strong></span>}
      </div>
    )
  }

  if (pricingType === "charge_policy") {
    return (
      <div className="space-y-1 text-sm">
        {config.chargeSlabs?.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground">
              {s.label ? `${s.label}: ` : ""}
              Day {s.daysFrom}–{s.daysTo ?? "∞"}
            </span>
            <span>
              <strong>{s.percentage}%</strong>
              {s.minimumCharge ? ` (min ${formatINR(s.minimumCharge)})` : ""}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return null
}

// ─── Price Config Dialog ────────────────────────────────────────────────────────

function PriceConfigDialog({ open, onOpenChange, entityType, entityOptions, editingConfig }) {
  const queryClient = useQueryClient()

  const form = useForm({
    resolver: zodResolver(formZ),
    defaultValues: editingConfig ? pcToForm(editingConfig) : emptyForm(entityType),
  })

  const pricingType = form.watch("pricingType")

  const {
    fields: hrFields, append: hrAppend, remove: hrRemove,
  } = useFieldArray({ control: form.control, name: "hourlyRates" })

  const {
    fields: shiftFields, append: shiftAppend, remove: shiftRemove,
  } = useFieldArray({ control: form.control, name: "shifts" })

  const {
    fields: slabFields, append: slabAppend, remove: slabRemove,
  } = useFieldArray({ control: form.control, name: "chargeSlabs" })

  useEffect(() => {
    if (!open) return
    form.reset(editingConfig ? pcToForm(editingConfig) : emptyForm(entityType))
  }, [open, editingConfig, entityType, form])

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

  const allowedTypes = PRICING_TYPES_BY_ENTITY[entityType] ?? []

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
              onSubmit={form.handleSubmit(v => mutation.mutate(v))}
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
                        disabled={!!editingConfig}
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
                      <Select value={field.value} onValueChange={field.onChange}>
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
                    const depositType   = form.watch(`hourlyRates.${i}.securityDeposit.depositType`)
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
                            <FormField
                              control={form.control}
                              name={`hourlyRates.${i}.securityDeposit.refundable`}
                              render={({ field: f }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={f.value} onCheckedChange={f.onChange} id={`ref-${i}`} />
                                  </FormControl>
                                  <Label htmlFor={`ref-${i}`} className="text-sm font-normal cursor-pointer">Refundable</Label>
                                </FormItem>
                              )}
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
                    <p className="text-sm font-semibold">Shifts</p>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => shiftAppend({ ...EMPTY_SHIFT })}>
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
                        <FormInput
                          control={form.control}
                          name={`shifts.${i}.startTime`}
                          label="Start Time"
                          placeholder="09:00"
                        />
                        <FormInput
                          control={form.control}
                          name={`shifts.${i}.endTime`}
                          label="End Time"
                          placeholder="18:00"
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
              {pricingType === "charge_policy" && (
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
            className="bg-nfdc-primary hover:bg-nfdc-primary/90"
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

function PriceConfigCard({ pc, entityName, onEdit, onToggleStatus }) {
  const isActive = pc.lifecycle?.status === "active"

  return (
    <Card className={!isActive ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-semibold text-sm truncate">{entityName}</span>
            <Badge variant="secondary" className="text-xs shrink-0">
              {PRICING_TYPE_LABELS[pc.config?.pricingType] ?? pc.config?.pricingType}
            </Badge>
            <StatusBadge status={pc.lifecycle?.status} />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(pc)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Config
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onToggleStatus(pc)}
                className={isActive ? "text-destructive focus:text-destructive" : ""}
              >
                <Power className="mr-2 h-4 w-4" />
                {isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ConfigSummary config={pc.config} />
        <p className="text-[10px] text-muted-foreground mt-2 font-mono">
          ID: {pc.priceConfigId}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Tab content ────────────────────────────────────────────────────────────────

function TabPane({ entityType, entityOptions, entityMap, onAdd, onEdit, onToggleStatus }) {
  const { data: configs, isLoading } = useQuery({
    queryKey: ["price-configs", entityType],
    queryFn: () => listPriceConfigs({ entityType }).then(r => {
      const raw = r.data.data
      return Array.isArray(raw) ? raw : []
    }),
    enabled: entityOptions.length > 0 || entityType === "cancellation" || entityType === "postponement",
  })

  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <Card key={i}><CardContent className="h-32 animate-pulse bg-muted/30 pt-6" /></Card>
        ))}
      </div>
    )
  }

  if (!configs?.length) {
    return (
      <EmptyState
        icon={Settings2}
        title="No price configs"
        message={`No pricing configured for ${entityType} yet. Create one to get started.`}
        action={{ label: `Add ${entityType} Config`, onClick: onAdd }}
      />
    )
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {configs.map(pc => (
        <PriceConfigCard
          key={pc.priceConfigId}
          pc={pc}
          entityName={entityMap.get(pc.relationships?.entityId) ?? pc.relationships?.entityId ?? "—"}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
        />
      ))}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function PriceConfigList() {
  useEffect(() => { document.title = "NFDC Admin — Price Config" }, [])

  const { user }    = useAuth()
  const theaterId   = user?.theaterId
  const queryClient = useQueryClient()

  const [activeTab,      setActiveTab]      = useState("audi")
  const [dialogOpen,     setDialogOpen]     = useState(false)
  const [editingConfig,  setEditingConfig]  = useState(null)
  const [statusTarget,   setStatusTarget]   = useState(null)

  // ── Audis ──
  const { data: audisRaw } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAudis(theaterId).then(r => r.data.data),
    enabled: !!theaterId,
  })
  const allAudis = Array.isArray(audisRaw?.data) ? audisRaw.data : []
  const audiOptions = allAudis.map(a => ({ id: a.audiId ?? a.id ?? a._id, name: a.name }))
  const audiMap = new Map(audiOptions.map(a => [a.id, a.name]))

  // ── Services (for service tab entity selector) ──
  const { data: groupedRaw } = useQuery({
    queryKey: ["services", JSON.stringify({ theaterId })],
    queryFn: () => listServicesGrouped({ theaterId }).then(r => r.data.data),
    enabled: !!theaterId && activeTab === "service",
  })
  const allServices = [
    ...(groupedRaw?.sections?.flatMap(s => s.services) ?? []),
    ...(groupedRaw?.ungrouped?.services ?? []),
  ]
  const serviceOptions = allServices.map(s => ({
    id:   s.serviceId ?? s.id ?? s._id,
    name: s.name,
  }))
  const serviceMap = new Map(serviceOptions.map(s => [s.id, s.name]))

  // Entity options + map for current tab
  const entityOptionsForTab = (tab) => {
    if (tab === "service") return serviceOptions
    return audiOptions  // audi, cancellation, postponement all use audis
  }
  const entityMapForTab = (tab) => {
    if (tab === "service") return serviceMap
    return audiMap
  }

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

  const openCreate = () => {
    setEditingConfig(null)
    setDialogOpen(true)
  }

  const openEdit = (pc) => {
    setEditingConfig(pc)
    setDialogOpen(true)
  }

  const handleToggleStatus = (pc) => {
    setStatusTarget({
      id:       pc.priceConfigId,
      name:     entityMapForTab(activeTab).get(pc.relationships?.entityId) ?? pc.relationships?.entityId,
      isActive: pc.lifecycle?.status === "active",
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Price Configuration"
        action={{ label: "Add Config", icon: Plus, onClick: openCreate }}
      />

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setEditingConfig(null) }}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="audi"         className="flex-1 sm:flex-none">Audi</TabsTrigger>
          <TabsTrigger value="service"      className="flex-1 sm:flex-none">Service</TabsTrigger>
          <TabsTrigger value="cancellation" className="flex-1 sm:flex-none">
            <span className="hidden sm:inline">Cancellation</span>
            <span className="sm:hidden">Cancel</span>
          </TabsTrigger>
          <TabsTrigger value="postponement" className="flex-1 sm:flex-none">
            <span className="hidden sm:inline">Postponement</span>
            <span className="sm:hidden">Postpone</span>
          </TabsTrigger>
        </TabsList>

        {TABS.map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <TabPane
              entityType={tab}
              entityOptions={entityOptionsForTab(tab)}
              entityMap={entityMapForTab(tab)}
              onAdd={openCreate}
              onEdit={openEdit}
              onToggleStatus={handleToggleStatus}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Create / Edit dialog */}
      <PriceConfigDialog
        key={editingConfig?.priceConfigId ?? `new-${activeTab}`}
        open={dialogOpen}
        onOpenChange={o => { setDialogOpen(o); if (!o) setEditingConfig(null) }}
        entityType={editingConfig?.relationships?.entityType ?? activeTab}
        entityOptions={entityOptionsForTab(editingConfig?.relationships?.entityType ?? activeTab)}
        editingConfig={editingConfig}
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
                id:     statusTarget.id,
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
