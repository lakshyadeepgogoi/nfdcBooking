import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import FormInput from "@/components/forms/FormInput"
import FormTextarea from "@/components/forms/FormTextarea"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import { getAudi, updateAudi } from "@/api/audi"

const fixedSchema = z.object({
  name: z.string().min(2, "Min 2 characters").max(100),
  capacity: z.coerce.number().int().min(1, "Min 1").max(10000, "Max 10000"),
  description: z.string().optional(),
})

const flexibleSchema = fixedSchema
  .extend({
    minBookingHours: z.coerce.number().min(1, "Min 1 hour").max(24, "Max 24 hours"),
    maxBookingHours: z.coerce.number().min(1, "Min 1 hour").max(24, "Max 24 hours"),
  })
  .refine((d) => d.maxBookingHours >= d.minBookingHours, {
    message: "Max must be ≥ min",
    path: ["maxBookingHours"],
  })

export default function AudiDetail() {
  const { audiId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: raw, isLoading } = useQuery({
    queryKey: ["audi", audiId],
    queryFn: () => getAudi(audiId).then((r) => r.data.data),
    enabled: !!audiId,
  })

  const audi = raw?.audi ?? raw
  const mode = audi?.mode

  useEffect(() => {
    document.title = audi?.name ? `NFDC Admin — ${audi.name}` : "NFDC Admin — Edit Audi"
  }, [audi?.name])

  const form = useForm({
    resolver: zodResolver(mode === "flexible" ? flexibleSchema : fixedSchema),
    defaultValues: {
      name: "",
      capacity: "",
      description: "",
      minBookingHours: "",
      maxBookingHours: "",
    },
  })

  useEffect(() => {
    if (audi) {
      form.reset({
        name: audi.name ?? "",
        capacity: audi.capacity ?? "",
        description: audi.description ?? "",
        minBookingHours: audi.minBookingHours ?? "",
        maxBookingHours: audi.maxBookingHours ?? "",
      })
    }
  }, [audi, form])

  const updateMutation = useMutation({
    mutationFn: (data) => updateAudi(audiId, data),
    onSuccess: () => {
      toast.success("Audi updated successfully")
      queryClient.invalidateQueries({ queryKey: ["audis"] })
      queryClient.invalidateQueries({ queryKey: ["audi", audiId] })
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Edit Audi"
        action={{ label: "Back", icon: ArrowLeft, onClick: () => navigate("/admin/audis") }}
      />

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mode:</span>
        <Badge variant={mode === "fixed" ? "outline" : "secondary"} className="capitalize">
          {mode}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audi Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput control={form.control} name="name" label="Audi Name" placeholder="Main Hall" />
                <FormInput control={form.control} name="capacity" label="Capacity" type="number" placeholder="100" />
              </div>
              <FormTextarea
                control={form.control}
                name="description"
                label="Description (optional)"
                placeholder="About this audi..."
                rows={3}
              />
              {mode === "flexible" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    control={form.control}
                    name="minBookingHours"
                    label="Min Booking Hours"
                    type="number"
                    placeholder="1"
                  />
                  <FormInput
                    control={form.control}
                    name="maxBookingHours"
                    label="Max Booking Hours"
                    type="number"
                    placeholder="8"
                  />
                </div>
              )}
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
