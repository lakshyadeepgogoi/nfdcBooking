import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CalendarDays, Clock, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import PageHeader from "@/components/common/PageHeader"
import FormInput from "@/components/forms/FormInput"
import FormTextarea from "@/components/forms/FormTextarea"
import { useAuth } from "@/hooks/useAuth"
import { createFixedAudi, createFlexibleAudi } from "@/api/audi"

const STEPS = ["Choose Mode", "Audi Details", "Review"]

function StepIndicator({ step }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((label, i) => {
        const idx = i + 1
        const isDone = step > idx
        const isActive = step === idx
        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  isDone && "bg-green-500 text-white",
                  isActive && "bg-nfdc-primary text-white",
                  !isDone && !isActive && "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : idx}
              </div>
              <span className="text-xs mt-1 text-muted-foreground">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-16 mx-2 mb-4",
                  step > idx ? "bg-green-500" : "bg-muted"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const detailsSchemaBase = z.object({
  name: z.string().min(2, "Min 2 characters").max(100),
  capacity: z.coerce.number().int().min(1, "Min 1").max(10000, "Max 10000"),
  description: z.string().optional(),
})

const flexibleExtension = z.object({
  minBookingHours: z.coerce.number().min(1, "Min 1 hour").max(24, "Max 24 hours"),
  maxBookingHours: z.coerce.number().min(1, "Min 1 hour").max(24, "Max 24 hours"),
})

function buildSchema(mode) {
  if (mode === "flexible") {
    return detailsSchemaBase
      .merge(flexibleExtension)
      .refine((d) => d.maxBookingHours >= d.minBookingHours, {
        message: "Max must be ≥ min",
        path: ["maxBookingHours"],
      })
  }
  return detailsSchemaBase
}

export default function AudiCreate() {
  useEffect(() => {
    document.title = "NFDC Admin — Create Audi"
  }, [])

  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(1)
  const [mode, setMode] = useState(null)
  const [formValues, setFormValues] = useState({})

  const form = useForm({
    resolver: zodResolver(buildSchema(mode)),
    defaultValues: {
      name: "",
      capacity: "",
      description: "",
      minBookingHours: "",
      maxBookingHours: "",
    },
  })

  const createMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, theaterId: user?.theaterId }
      return mode === "fixed"
        ? createFixedAudi(payload)
        : createFlexibleAudi(payload)
    },
    onSuccess: () => {
      toast.success("Audi created successfully")
      queryClient.invalidateQueries({ queryKey: ["audis"] })
      navigate("/admin/audis")
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const handleNext = async () => {
    if (step === 2) {
      const valid = await form.trigger()
      if (!valid) return
      setFormValues(form.getValues())
    }
    setStep((s) => s + 1)
  }

  const handleBack = () => setStep((s) => s - 1)

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Create Audi"
        action={{
          label: "Back",
          icon: ArrowLeft,
          onClick: () => navigate("/admin/audis"),
        }}
      />

      <StepIndicator step={step} />

      {/* Step 1 — Choose Mode */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                value: "fixed",
                icon: CalendarDays,
                title: "Fixed Mode",
                desc: "Pre-defined time slots",
                color: "text-blue-500",
              },
              {
                value: "flexible",
                icon: Clock,
                title: "Flexible Mode",
                desc: "Open start and end times",
                color: "text-purple-500",
              },
            ].map((opt) => {
              const selected = mode === opt.value
              return (
                <Card
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "cursor-pointer transition-all hover:border-nfdc-accent relative",
                    selected && "border-2 border-nfdc-accent bg-nfdc-pale/30"
                  )}
                >
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
          <Button
            className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90"
            disabled={!mode}
            onClick={() => setStep(2)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Step 2 — Audi Details */}
      {step === 2 && (
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormInput control={form.control} name="name" label="Audi Name" placeholder="Main Hall" />
              <FormInput control={form.control} name="capacity" label="Capacity" type="number" placeholder="100" />
            </div>
            <FormTextarea control={form.control} name="description" label="Description (optional)" placeholder="About this audi..." rows={3} />
            {mode === "flexible" && (
              <div className="grid grid-cols-2 gap-4">
                <FormInput control={form.control} name="minBookingHours" label="Min Booking Hours" type="number" placeholder="1" />
                <FormInput control={form.control} name="maxBookingHours" label="Max Booking Hours" type="number" placeholder="8" />
              </div>
            )}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                className="flex-1 bg-nfdc-primary hover:bg-nfdc-primary/90"
              >
                Next
              </Button>
            </div>
          </form>
        </Form>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Audi Name</span>
                <span className="font-medium">{formValues.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Mode</span>
                <span className="font-medium capitalize">{mode}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Capacity</span>
                <span className="font-medium">{formValues.capacity}</span>
              </div>
              {formValues.description && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Description</span>
                  <span className="font-medium text-right max-w-xs">{formValues.description}</span>
                </div>
              )}
              {mode === "flexible" && (
                <>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Min Booking Hours</span>
                    <span className="font-medium">{formValues.minBookingHours}h</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-muted-foreground">Max Booking Hours</span>
                    <span className="font-medium">{formValues.maxBookingHours}h</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
              Back
            </Button>
            <Button
              type="button"
              onClick={() => createMutation.mutate(formValues)}
              disabled={createMutation.isPending}
              className="flex-1 bg-nfdc-primary hover:bg-nfdc-primary/90"
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Audi
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
