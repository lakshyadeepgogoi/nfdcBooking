import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Pencil, ListChecks, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Form } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import EmptyState from "@/components/common/EmptyState"
import FormInput from "@/components/forms/FormInput"
import FormTextarea from "@/components/forms/FormTextarea"
import { useAuth } from "@/hooks/useAuth"
import { listAudis } from "@/api/audi"
import {
  listServicesGrouped,
  createService,
  updateService,
  createSection,
  updateSection,
  updateSectionStatus,
  updateServiceStatus,
} from "@/api/services"
import { formatINR } from "@/utils/formatCurrency"

const sectionSchema = z.object({
  name: z.string().min(2, "Min 2 characters"),
})

const serviceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.coerce.number().min(0, "Price must be ≥ 0"),
  description: z.string().optional(),
})

function SectionDialog({ open, onOpenChange, audiId, editingSection, onSuccess }) {
  const queryClient = useQueryClient()
  const form = useForm({
    resolver: zodResolver(sectionSchema),
    defaultValues: { name: "" },
  })

  useEffect(() => {
    if (open) {
      form.reset({ name: editingSection?.name ?? "" })
    }
  }, [open, editingSection, form])

  const mutation = useMutation({
    mutationFn: (values) =>
      editingSection
        ? updateSection(editingSection.id ?? editingSection._id, values)
        : createSection({ audiId, ...values }),
    onSuccess: () => {
      toast.success(editingSection ? "Section updated" : "Section created")
      queryClient.invalidateQueries({ queryKey: ["services", audiId] })
      onOpenChange(false)
      if (onSuccess) onSuccess()
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingSection ? "Edit Section" : "Add Section"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormInput control={form.control} name="name" label="Section Name" placeholder="Photography" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-nfdc-primary hover:bg-nfdc-primary/90"
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingSection ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ServiceDialog({ open, onOpenChange, audiId, sectionId, editingService, onSuccess }) {
  const queryClient = useQueryClient()
  const form = useForm({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: "", price: "", description: "" },
  })

  useEffect(() => {
    if (open) {
      form.reset(
        editingService
          ? {
              name: editingService.name ?? "",
              price: editingService.price ?? "",
              description: editingService.description ?? "",
            }
          : { name: "", price: "", description: "" }
      )
    }
  }, [open, editingService, form])

  const mutation = useMutation({
    mutationFn: (values) =>
      editingService
        ? updateService(editingService.id ?? editingService._id, values)
        : createService({ audiId, sectionId, ...values }),
    onSuccess: () => {
      toast.success(editingService ? "Service updated" : "Service created")
      queryClient.invalidateQueries({ queryKey: ["services", audiId] })
      onOpenChange(false)
      if (onSuccess) onSuccess()
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormInput control={form.control} name="name" label="Service Name" placeholder="DSLR Photography" />
            <FormInput control={form.control} name="price" label="Price (₹)" type="number" placeholder="500" />
            <FormTextarea control={form.control} name="description" label="Description (optional)" rows={2} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-nfdc-primary hover:bg-nfdc-primary/90"
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingService ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function ServiceList() {
  useEffect(() => {
    document.title = "NFDC Admin — Services"
  }, [])

  const { user } = useAuth()
  const theaterId = user?.theaterId
  const queryClient = useQueryClient()

  const [selectedAudiId, setSelectedAudiId] = useState("")
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [addServiceContext, setAddServiceContext] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [sectionStatusTarget, setSectionStatusTarget] = useState(null)
  const [serviceStatusTarget, setServiceStatusTarget] = useState(null)

  const { data: audis } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAudis(theaterId).then((r) => {
      const d = r.data.data; return Array.isArray(d) ? d : Object.values(d).find(Array.isArray) ?? []
    }),
    enabled: !!theaterId,
  })

  const { data: sections, isLoading } = useQuery({
    queryKey: ["services", selectedAudiId],
    queryFn: () => listServicesGrouped(selectedAudiId).then((r) => {
      const d = r.data.data; return Array.isArray(d) ? d : Object.values(d).find(Array.isArray) ?? []
    }),
    enabled: !!selectedAudiId,
  })

  const sectionStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateSectionStatus(id, status),
    onSuccess: () => {
      toast.success("Section status updated")
      queryClient.invalidateQueries({ queryKey: ["services", selectedAudiId] })
      setSectionStatusTarget(null)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const serviceStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateServiceStatus(id, status),
    onSuccess: () => {
      toast.success("Service status updated")
      queryClient.invalidateQueries({ queryKey: ["services", selectedAudiId] })
      setServiceStatusTarget(null)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Services &amp; Sections" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Select value={selectedAudiId} onValueChange={setSelectedAudiId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select an audi" />
          </SelectTrigger>
          <SelectContent>
            {(audis ?? []).map((a) => (
              <SelectItem key={a.id ?? a._id} value={a.id ?? a._id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={() => setAddSectionOpen(true)}
          disabled={!selectedAudiId}
          className="bg-nfdc-primary hover:bg-nfdc-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Section
        </Button>
      </div>

      {!selectedAudiId ? (
        <EmptyState icon={ListChecks} title="Select an audi first" message="Choose an audi above to manage its services." />
      ) : isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="h-32 animate-pulse bg-muted/30" />
            </Card>
          ))}
        </div>
      ) : !sections || sections.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No sections yet"
          message="Create a section to start adding services."
        />
      ) : (
        <div className="space-y-4">
          {sections.map((section) => {
            const sId = section.id ?? section._id
            const isActive = section.status === "active"
            return (
              <Card key={sId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{section.name}</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) =>
                          setSectionStatusTarget({ id: sId, name: section.name, willBeActive: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingSection(section)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddServiceContext({ sectionId: sId })}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add Service
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {(!section.services || section.services.length === 0) ? (
                    <p className="text-sm text-muted-foreground py-2">No services in this section.</p>
                  ) : (
                    <div className="divide-y">
                      {section.services.map((svc) => {
                        const svId = svc.id ?? svc._id
                        const svcActive = svc.status === "active"
                        return (
                          <div key={svId} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{svc.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {formatINR(svc.price)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={svcActive}
                                onCheckedChange={(checked) =>
                                  setServiceStatusTarget({ id: svId, name: svc.name, willBeActive: checked })
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingService(svc)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Section dialogs */}
      <SectionDialog
        open={addSectionOpen}
        onOpenChange={setAddSectionOpen}
        audiId={selectedAudiId}
        editingSection={null}
      />
      <SectionDialog
        open={!!editingSection}
        onOpenChange={(open) => !open && setEditingSection(null)}
        audiId={selectedAudiId}
        editingSection={editingSection}
      />

      {/* Service dialogs */}
      <ServiceDialog
        open={!!addServiceContext}
        onOpenChange={(open) => !open && setAddServiceContext(null)}
        audiId={selectedAudiId}
        sectionId={addServiceContext?.sectionId}
        editingService={null}
      />
      <ServiceDialog
        open={!!editingService}
        onOpenChange={(open) => !open && setEditingService(null)}
        audiId={selectedAudiId}
        sectionId={editingService?.sectionId}
        editingService={editingService}
      />

      {/* Section status AlertDialog */}
      <AlertDialog
        open={!!sectionStatusTarget}
        onOpenChange={(open) => !open && setSectionStatusTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sectionStatusTarget?.willBeActive ? "Activate" : "Deactivate"} &quot;{sectionStatusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update the section status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                sectionStatusMutation.mutate({
                  id: sectionStatusTarget.id,
                  status: sectionStatusTarget.willBeActive ? "active" : "inactive",
                })
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Service status AlertDialog */}
      <AlertDialog
        open={!!serviceStatusTarget}
        onOpenChange={(open) => !open && setServiceStatusTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {serviceStatusTarget?.willBeActive ? "Activate" : "Deactivate"} &quot;{serviceStatusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update the service status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                serviceStatusMutation.mutate({
                  id: serviceStatusTarget.id,
                  status: serviceStatusTarget.willBeActive ? "active" : "inactive",
                })
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
