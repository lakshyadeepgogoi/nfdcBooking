import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CalendarDays, Clock, Check, Plus, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import PageHeader from "@/components/common/PageHeader"
import FormInput from "@/components/forms/FormInput"
import FormTextarea from "@/components/forms/FormTextarea"
import { useAuth } from "@/hooks/useAuth"
import { createAudi } from "@/api/audi"

const STEPS = ["Choose Mode", "Audi Details", "Review"]

function StepIndicator({ step }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((label, i) => {
        const idx      = i + 1
        const isDone   = step > idx
        const isActive = step === idx
        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                isDone   && "bg-green-500 text-white",
                isActive && "bg-nfdc-primary text-white",
                !isDone && !isActive && "bg-muted text-muted-foreground"
              )}>
                {isDone ? <Check className="h-4 w-4" /> : idx}
              </div>
              <span className="text-xs mt-1 text-muted-foreground">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px w-16 mx-2 mb-4", step > idx ? "bg-green-500" : "bg-muted")} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Step-2 schema — shared fields
const baseSchema = z.object({
  name:        z.string().min(2, "Min 2 characters").max(200),
  capacity:    z.coerce.number().int().min(1, "Min 1").max(10000, "Max 10000"),
  description: z.string().optional(),
  opStart:     z.string().optional(),
  opEnd:       z.string().optional(),
})

export default function AudiCreate() {
  useEffect(() => { document.title = "NFDC Admin — Create Audi" }, [])

  const navigate    = useNavigate()
  const { user }    = useAuth()
  const queryClient = useQueryClient()

  const [step,       setStep]       = useState(1)
  const [mode,       setMode]       = useState(null)
  const [formValues, setFormValues] = useState({})
  // flexible-mode booking durations (array of valid hours)
  const [durations,     setDurations]     = useState([])
  const [durationInput, setDurationInput] = useState("")

  const form = useForm({
    resolver: zodResolver(baseSchema),
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
      const config = {
        slotMode:    mode,
        capacity:    data.capacity,
        description: data.description || undefined,
        ...(data.opStart || data.opEnd
          ? { operationalHours: { start: data.opStart || undefined, end: data.opEnd || undefined } }
          : {}),
        ...(mode === "flexible" ? { bookingDurations: durations } : {}),
      }
      return createAudi({ name: data.name, theaterId: user?.theaterId, config })
    },
    onSuccess: () => {
      toast.success("Audi created successfully")
      queryClient.invalidateQueries({ queryKey: ["audis"] })
      navigate("/admin/audis")
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  const handleNext = async () => {
    if (step === 2) {
      const valid = await form.trigger()
      if (!valid) return
      if (mode === "flexible" && durations.length === 0) {
        toast.error("Add at least one booking duration")
        return
      }
      setFormValues(form.getValues())
    }
    setStep(s => s + 1)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Create Audi"
        action={{ label: "Back", icon: ArrowLeft, onClick: () => navigate("/admin/audis") }}
      />

      <StepIndicator step={step} />

      {/* Step 1 — Choose Mode */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "fixed",    icon: CalendarDays, title: "Fixed Mode",    desc: "Pre-defined time slots",      color: "text-blue-500" },
              { value: "flexible", icon: Clock,        title: "Flexible Mode", desc: "Open start and end times",    color: "text-purple-500" },
            ].map((opt) => {
              const selected = mode === opt.value
              return (
                <Card key={opt.value} onClick={() => setMode(opt.value)}
                  className={cn("cursor-pointer transition-all hover:border-nfdc-accent relative",
                    selected && "border-2 border-nfdc-accent bg-nfdc-pale/30")}>
                  <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-3">
                    {selected && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-nfdc-accent flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <opt.icon className={cn("h-8 w-8", opt.color)} />
                    <div>
                      <p className="font-semibold">{opt.title}</p>
                      <p className="text-sm text-muted-foreground">{opt.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <Button className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90" disabled={!mode}
            onClick={() => setStep(2)}>
            Next
          </Button>
        </div>
      )}

      {/* Step 2 — Audi Details */}
      {step === 2 && (
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormInput control={form.control} name="name"     label="Audi Name"  placeholder="Main Hall" />
              <FormInput control={form.control} name="capacity" label="Capacity"   type="number" placeholder="100" />
            </div>
            <FormTextarea control={form.control} name="description" label="Description (optional)" rows={2} />

            <div className="grid grid-cols-2 gap-4">
              <FormInput control={form.control} name="opStart" label="Opens At (HH:MM)" type="time" />
              <FormInput control={form.control} name="opEnd"   label="Closes At (HH:MM)" type="time" />
            </div>

            {/* Flexible: booking durations */}
            {mode === "flexible" && (
              <div className="space-y-3 border rounded-lg p-4">
                <Label className="text-sm font-medium">
                  Booking Durations (hours)
                  <span className="text-muted-foreground font-normal ml-1">— valid options users can book</span>
                </Label>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {durations.length === 0 && (
                    <span className="text-sm text-muted-foreground">None added</span>
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
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button type="button" onClick={handleNext} className="flex-1 bg-nfdc-primary hover:bg-nfdc-primary/90">Next</Button>
            </div>
          </form>
        </Form>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {[
                ["Audi Name",        formValues.name],
                ["Mode",             <span className="capitalize">{mode}</span>],
                ["Capacity",         formValues.capacity],
                ["Description",      formValues.description || "—"],
                ["Operational Hours",
                  formValues.opStart || formValues.opEnd
                    ? `${formValues.opStart || "—"} – ${formValues.opEnd || "—"}`
                    : "—"
                ],
                ...(mode === "flexible"
                  ? [["Booking Durations", durations.length ? durations.map(d => `${d}h`).join(", ") : "—"]]
                  : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="font-medium text-sm text-right max-w-xs">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
            <Button type="button" onClick={() => createMutation.mutate(formValues)}
              disabled={createMutation.isPending}
              className="flex-1 bg-nfdc-primary hover:bg-nfdc-primary/90">
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Audi
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
