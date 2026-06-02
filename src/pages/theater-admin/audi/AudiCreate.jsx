import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CalendarDays, Clock, CheckCircle2, Plus, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import PageHeader from "@/components/common/PageHeader"
import FormInput from "@/components/forms/FormInput"
import FormTextarea from "@/components/forms/FormTextarea"
import { useAuth } from "@/hooks/useAuth"
import { createAudi } from "@/api/audi"

const STEPS = [
  { label: "Choose Mode",   desc: "Pick how this audi handles bookings" },
  { label: "Audi Details",  desc: "Name, capacity and operating hours"  },
  { label: "Review & Create", desc: "Confirm everything looks right"    },
]

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div className="flex items-start justify-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const idx      = i + 1
        const isDone   = step > idx
        const isActive = step === idx
        return (
          <div key={idx} className="flex items-start">
            <div className="flex flex-col items-center min-w-[80px]">
              <div className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2",
                isDone   && "bg-green-500 border-green-500 text-white",
                isActive && "bg-nfdc-primary border-nfdc-primary text-white shadow-md",
                !isDone && !isActive && "bg-background border-border text-muted-foreground"
              )}>
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx}
              </div>
              <p className={cn(
                "text-xs font-medium mt-1.5 text-center leading-tight",
                isActive ? "text-nfdc-primary" : isDone ? "text-green-600" : "text-muted-foreground"
              )}>{s.label}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "h-0.5 w-16 mt-4 mx-1 transition-colors",
                step > idx ? "bg-green-500" : "bg-border"
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">{label}</p>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

// ─── Review row ───────────────────────────────────────────────────────────────

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-sm text-right">{value}</span>
    </div>
  )
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  name:        z.string().min(2, "Min 2 characters").max(200),
  capacity:    z.union([z.coerce.number().int().min(1).max(10000), z.literal(""), z.null()]).optional(),
  description: z.string().optional(),
  opStart:     z.string().optional(),
  opEnd:       z.string().optional(),
})

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AudiCreate() {
  useEffect(() => { document.title = "NFDC Admin — Create Audi" }, [])

  const navigate    = useNavigate()
  const { user }    = useAuth()
  const queryClient = useQueryClient()

  const [step,          setStep]          = useState(1)
  const [mode,          setMode]          = useState(null)
  const [formValues,    setFormValues]    = useState({})
  const [durations,     setDurations]     = useState([])
  const [durationInput, setDurationInput] = useState("")

  const form = useForm({
    resolver:      zodResolver(baseSchema),
    defaultValues: { name: "", capacity: "", description: "", opStart: "", opEnd: "" },
  })

  const addDuration = () => {
    const v = Number(durationInput)
    if (v > 0 && !durations.includes(v)) {
      setDurations(d => [...d, v].sort((a, b) => a - b))
      setDurationInput("")
    }
  }

  const createMutation = useMutation({
    mutationFn: (data) => {
      const capacity = data.capacity !== "" && data.capacity != null ? Number(data.capacity) : undefined
      const config = {
        slotMode: mode,
        ...(capacity != null ? { capacity } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.opStart || data.opEnd
          ? { operationalHours: { start: data.opStart || undefined, end: data.opEnd || undefined } }
          : {}),
        ...(mode === "flexible" ? { bookingDurations: durations } : {}),
      }
      return createAudi({ name: data.name, theaterId: user?.theaterId, config })
    },
    onSuccess: (res) => {
      toast.success("Audi created — complete the setup checklist to activate it")
      queryClient.invalidateQueries({ queryKey: ["audis"] })
      const newId = res?.data?.data?.audiId
      navigate(newId ? `/admin/audis/${newId}` : "/admin/audis")
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  const handleNext = async () => {
    if (step === 2) {
      const valid = await form.trigger()
      if (!valid) return
      if (mode === "flexible" && durations.length === 0) {
        toast.error("Add at least one booking duration for flexible mode")
        return
      }
      setFormValues(form.getValues())
    }
    setStep(s => s + 1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Audi"
        action={{ label: "Back to Audis", icon: ArrowLeft, onClick: () => navigate("/admin/audis") }}
      />

      <StepIndicator step={step} />

      {/* ── Step 1: Choose Mode ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 max-w-3xl">
            {[
              {
                value: "fixed",
                Icon: CalendarDays,
                title: "Fixed Slots",
                desc: "Pre-defined time slots that users pick from (e.g. Morning, Evening)",
                color: "text-blue-600",
                bg: "bg-blue-50",
                points: ["Set fixed time windows", "Per-slot pricing", "Multi-slot booking support"],
              },
              {
                value: "flexible",
                Icon: Clock,
                title: "Flexible Hours",
                desc: "Users choose any start time within your operational window",
                color: "text-purple-600",
                bg: "bg-purple-50",
                points: ["Open-ended booking times", "Duration-based pricing", "Set valid durations"],
              },
            ].map((opt) => {
              const selected = mode === opt.value
              return (
                <Card key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selected ? "border-2 border-nfdc-primary ring-1 ring-nfdc-primary/20" : "hover:border-nfdc-primary/40"
                  )}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", opt.bg)}>
                        <opt.Icon className={cn("h-5 w-5", opt.color)} />
                      </div>
                      {selected && (
                        <CheckCircle2 className="h-5 w-5 text-nfdc-primary shrink-0" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{opt.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opt.desc}</p>
                    </div>
                    <ul className="space-y-1">
                      {opt.points.map(p => (
                        <li key={p} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn("h-1 w-1 rounded-full shrink-0", opt.color.replace("text-", "bg-"))} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Button className="max-w-xs bg-nfdc-primary hover:bg-nfdc-primary/90 h-11" disabled={!mode}
            onClick={() => setStep(2)}>
            Continue {mode && `with ${mode === "fixed" ? "Fixed Slots" : "Flexible Hours"}`}
          </Button>
        </div>
      )}

      {/* ── Step 2: Audi Details ── */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Form {...form}>
              <form className="space-y-6">
                <SectionHeader label="Identity" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput control={form.control} name="name"     label="Audi Name"       placeholder="e.g. Main Hall" />
                  <FormInput control={form.control} name="capacity" label="Capacity (seats)" type="number" placeholder="100" />
                </div>
                <FormTextarea control={form.control} name="description" label="Description (optional)" rows={2}
                  placeholder="Brief description shown to users…" />

                <SectionHeader label="Operational Hours" />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput control={form.control} name="opStart" label="Opens At"  type="time" />
                  <FormInput control={form.control} name="opEnd"   label="Closes At" type="time" />
                </div>

                {mode === "flexible" && (
                  <>
                    <SectionHeader label="Booking Durations" />
                    <div className="rounded-lg border p-4 space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Valid durations users can select when booking (in hours). At least one required.
                      </p>
                      <div className="flex flex-wrap gap-2 min-h-[36px]">
                        {durations.length === 0 && (
                          <span className="text-sm text-muted-foreground">None added yet</span>
                        )}
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

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button type="button" onClick={handleNext} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                    Continue to Review
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {/* Info panel */}
          <div className="space-y-4">
            <div className={cn(
              "rounded-lg border p-4 space-y-2",
              mode === "fixed" ? "border-blue-200 bg-blue-50" : "border-purple-200 bg-purple-50"
            )}>
              <div className="flex items-center gap-2">
                {mode === "fixed"
                  ? <CalendarDays className="h-4 w-4 text-blue-600 shrink-0" />
                  : <Clock className="h-4 w-4 text-purple-600 shrink-0" />
                }
                <p className={cn("text-sm font-semibold", mode === "fixed" ? "text-blue-800" : "text-purple-800")}>
                  {mode === "fixed" ? "Fixed Slots mode" : "Flexible Hours mode"}
                </p>
              </div>
              <p className={cn("text-xs leading-relaxed", mode === "fixed" ? "text-blue-700" : "text-purple-700")}>
                {mode === "fixed"
                  ? "After creating, add specific time slots in the Slots page. Users pick from the available slots."
                  : "Users choose any start time within your operational hours. Set valid booking durations below."}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tips</p>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• Operational hours constrain when bookings can start and end</li>
                <li>• Capacity is shown to users but not enforced by the system</li>
                <li>• You can edit all these settings later from Audi Details</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardContent className="p-0">
              {/* Mode header */}
              <div className={cn(
                "flex items-center gap-3 px-5 py-4 border-b rounded-t-xl",
                mode === "fixed" ? "bg-blue-50/60" : "bg-purple-50/60"
              )}>
                {mode === "fixed"
                  ? <CalendarDays className="h-5 w-5 text-blue-600 shrink-0" />
                  : <Clock className="h-5 w-5 text-purple-600 shrink-0" />
                }
                <div>
                  <p className="font-semibold text-sm capitalize">{mode} Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {mode === "fixed" ? "Pre-defined time slots" : "Open-ended booking hours"}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="px-5 py-2">
                <ReviewRow label="Audi Name"   value={formValues.name} />
                <ReviewRow label="Capacity"    value={formValues.capacity ? `${formValues.capacity} seats` : "Not set"} />
                <ReviewRow label="Description" value={formValues.description || "—"} />
                <ReviewRow label="Hours"
                  value={(formValues.opStart || formValues.opEnd)
                    ? `${formValues.opStart || "—"} – ${formValues.opEnd || "—"}`
                    : "Not set"
                  }
                />
                {mode === "flexible" && (
                  <ReviewRow label="Booking Durations"
                    value={durations.length ? durations.map(d => `${d}h`).join(", ") : "—"}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* What happens next */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">After creating</p>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              {[
                mode === "fixed" ? "Add time slots in the Slots page" : "Booking durations are already configured",
                "Set up pricing in Price Configuration",
                "Configure cancellation & postponement policies",
                "Activate the audi to accept bookings",
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-nfdc-primary font-bold mt-0.5">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button type="button"
              onClick={() => createMutation.mutate(formValues)}
              disabled={createMutation.isPending}
              className="bg-nfdc-primary hover:bg-nfdc-primary/90 h-11 px-8"
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Audi
            </Button>
          </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Setup checklist</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                After creating, the audi will be <strong>inactive</strong>. Complete the setup checklist on the audi page to activate it.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
