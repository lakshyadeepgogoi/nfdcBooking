import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Plus, Pencil, ListChecks, Loader2, MoreHorizontal, GripVertical,
} from "lucide-react"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
import { Form, FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import EmptyState from "@/components/common/EmptyState"
import StatusBadge from "@/components/common/StatusBadge"
import FormInput from "@/components/forms/FormInput"
import { useAuth } from "@/hooks/useAuth"
import { listAudis } from "@/api/audi"
import {
  listServicesGrouped,
  createService, updateService, updateServiceStatus, moveService,
  createSection, updateSection, updateSectionStatus, reorderSection,
} from "@/api/services"
import { formatINR } from "@/utils/formatCurrency"

// ─── Schemas ───────────────────────────────────────────────────────────────────

const sectionSchema = z.object({
  name:        z.string().min(2, "Min 2 characters"),
  description: z.string().optional(),
  collapsible: z.boolean().optional(),
})

const serviceSchema = z.object({
  name:           z.string().min(1, "Name is required"),
  pricingGovt:    z.coerce.number().min(0).optional().or(z.literal("")),
  pricingNonGovt: z.coerce.number().min(0).optional().or(z.literal("")),
  isMandatory:    z.boolean().optional(),
})

// ─── Section Dialog ────────────────────────────────────────────────────────────

function SectionDialog({ open, onOpenChange, scopeParams, editingSection }) {
  const queryClient = useQueryClient()
  const cacheKey    = JSON.stringify(scopeParams)

  const form = useForm({
    resolver: zodResolver(sectionSchema),
    defaultValues: { name: "", description: "", collapsible: false },
  })

  useEffect(() => {
    if (!open) return
    form.reset(editingSection ? {
      name:        editingSection.name ?? "",
      description: editingSection.description ?? "",
      collapsible: editingSection.collapsible ?? false,
    } : { name: "", description: "", collapsible: false })
  }, [open, editingSection, form])

  const mutation = useMutation({
    mutationFn: (v) => {
      const payload = {
        name:   v.name,
        config: {
          description: v.description || undefined,
          collapsible: v.collapsible ?? false,
        },
      }
      const id = editingSection?.sectionId ?? editingSection?.id ?? editingSection?._id
      return editingSection
        ? updateSection(id, payload)
        : createSection({ ...scopeParams, ...payload })
    },
    onSuccess: () => {
      toast.success(editingSection ? "Section updated" : "Section created")
      queryClient.invalidateQueries({ queryKey: ["services", cacheKey] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingSection ? "Edit Section" : "Add Section"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <FormInput control={form.control} name="name" label="Section Name" placeholder="Photography" />
            <FormInput control={form.control} name="description" label="Description (optional)" placeholder="Brief description..." />
            <FormField control={form.control} name="collapsible" render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} id="collapsible" />
                </FormControl>
                <Label htmlFor="collapsible" className="cursor-pointer text-sm font-normal">
                  Collapsible section
                </Label>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
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

// ─── Service Dialog ────────────────────────────────────────────────────────────

function ServiceDialog({ open, onOpenChange, scopeParams, sectionId, editingService, sections }) {
  const queryClient = useQueryClient()
  const cacheKey    = JSON.stringify(scopeParams)

  const form = useForm({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: "", pricingGovt: "", pricingNonGovt: "", isMandatory: false },
  })

  const [targetSection, setTargetSection] = useState(sectionId ?? "none")

  useEffect(() => {
    if (!open) return
    setTargetSection(sectionId ?? editingService?.relationships?.sectionId ?? "none")
    form.reset(editingService ? {
      name:           editingService.name ?? "",
      pricingGovt:    editingService.config?.pricing?.govt ?? "",
      pricingNonGovt: editingService.config?.pricing?.nonGovt ?? "",
      isMandatory:    editingService.config?.isMandatory ?? false,
    } : { name: "", pricingGovt: "", pricingNonGovt: "", isMandatory: false })
  }, [open, editingService, sectionId, form])

  const mutation = useMutation({
    mutationFn: (v) => {
      const config = {
        pricing: {
          govt:    v.pricingGovt    !== "" ? Number(v.pricingGovt)    : undefined,
          nonGovt: v.pricingNonGovt !== "" ? Number(v.pricingNonGovt) : undefined,
        },
        isMandatory: v.isMandatory ?? false,
      }
      const resolvedSection = targetSection !== "none" ? targetSection : undefined
      const id = editingService?.serviceId ?? editingService?.id ?? editingService?._id
      return editingService
        ? updateService(id, { name: v.name, config })
        : createService({ ...scopeParams, sectionId: resolvedSection, name: v.name, config })
    },
    onSuccess: async () => {
      // If editing and section changed, move the service
      if (editingService) {
        const id = editingService.serviceId ?? editingService.id ?? editingService._id
        const currentSection = editingService.relationships?.sectionId ?? null
        const newSection = targetSection !== "none" ? targetSection : null
        if (currentSection !== newSection) {
          await moveService(id, newSection)
        }
      }
      toast.success(editingService ? "Service updated" : "Service created")
      queryClient.invalidateQueries({ queryKey: ["services", cacheKey] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <FormInput control={form.control} name="name" label="Service Name" placeholder="DSLR Photography" />

            <div className="space-y-2">
              <p className="text-sm font-medium">Pricing (optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <FormInput control={form.control} name="pricingGovt"
                  label="Govt Rate (₹)" type="number" placeholder="e.g. 500" />
                <FormInput control={form.control} name="pricingNonGovt"
                  label="Non-Govt Rate (₹)" type="number" placeholder="e.g. 1000" />
              </div>
            </div>

            {/* Section assignment */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Section</Label>
              <Select value={targetSection} onValueChange={setTargetSection}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No section (Ungrouped)</SelectItem>
                  {sections.filter(s => s.sectionId).map(s => (
                    <SelectItem key={s.sectionId} value={s.sectionId}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* isMandatory */}
            <FormField control={form.control} name="isMandatory" render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} id="mandatory" />
                </FormControl>
                <Label htmlFor="mandatory" className="cursor-pointer text-sm font-normal">
                  Mandatory service (always included in booking)
                </Label>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingService ? "Save" : "Add Service"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Service Row ───────────────────────────────────────────────────────────────

function ServiceRow({ svc, onEdit, onToggleStatus }) {
  const pricing    = svc.config?.pricing
  const isActive   = svc.lifecycle?.status === "active"
  const isMandatory = svc.config?.isMandatory

  return (
    <div className={`flex items-center justify-between py-2.5 px-1 ${!isActive ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{svc.name}</span>
            {isMandatory && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Mandatory</Badge>}
            <StatusBadge status={svc.lifecycle?.status} />
          </div>
          {pricing && (pricing.govt != null || pricing.nonGovt != null) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {pricing.govt    != null && `Govt: ${formatINR(pricing.govt)}`}
              {pricing.govt != null && pricing.nonGovt != null && " · "}
              {pricing.nonGovt != null && `Non-Govt: ${formatINR(pricing.nonGovt)}`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Switch
          checked={isActive}
          onCheckedChange={() => onToggleStatus(svc)}
          className="scale-90"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(svc)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Section Card (sortable) ───────────────────────────────────────────────────

function SectionCard({ section, isReordering, onEditSection, onToggleSectionStatus, onAddService, onEditService, onToggleServiceStatus }) {
  const isActive = section.status === "active"

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.sectionId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={[
        !isActive ? "opacity-60" : "",
        isDragging  ? "shadow-xl ring-2 ring-primary/25 opacity-50" : "",
      ].join(" ")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Drag handle */}
              <button
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground touch-none shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Drag to reorder"
                disabled={isReordering}
              >
                <GripVertical className="h-4 w-4" />
              </button>

              <span className="font-semibold text-sm">{section.name}</span>
              {section.description && (
                <span className="text-xs text-muted-foreground hidden sm:inline">— {section.description}</span>
              )}
              {section.collapsible && (
                <Badge variant="outline" className="text-[10px] px-1">Collapsible</Badge>
              )}
              <StatusBadge status={section.status} />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isReordering && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              <Switch
                checked={isActive}
                onCheckedChange={() => onToggleSectionStatus(section)}
                className="scale-90"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditSection(section)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit Section
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onAddService(section.sectionId)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Service
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {(!section.services || section.services.length === 0) ? (
            <p className="text-sm text-muted-foreground py-1">No services — add one from the menu above.</p>
          ) : (
            <div className="divide-y">
              {section.services.map(svc => (
                <ServiceRow
                  key={svc.serviceId ?? svc.id ?? svc._id}
                  svc={svc}
                  onEdit={onEditService}
                  onToggleStatus={onToggleServiceStatus}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Drag Overlay Card ─────────────────────────────────────────────────────────

function SectionDragOverlay({ section }) {
  if (!section) return null
  return (
    <Card className="shadow-2xl ring-2 ring-primary/30 bg-background cursor-grabbing">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-sm">{section.name}</span>
          <StatusBadge status={section.status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">
          {section.services?.length ?? 0} service{section.services?.length === 1 ? "" : "s"}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ServiceList() {
  useEffect(() => { document.title = "NFDC Admin — Services" }, [])

  const { user }    = useAuth()
  const theaterId   = user?.theaterId
  const queryClient = useQueryClient()

  const [selectedScope, setSelectedScope]   = useState("theater")
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [addServiceCtx,  setAddServiceCtx]  = useState(null)  // { sectionId }
  const [editingService, setEditingService] = useState(null)
  const [sectionToggle,  setSectionToggle]  = useState(null)
  const [serviceToggle,  setServiceToggle]  = useState(null)
  const [activeId,       setActiveId]       = useState(null)

  // Scope params passed to API
  const scopeParams = selectedScope === "theater"
    ? { theaterId }
    : { audiId: selectedScope }
  const cacheKey = JSON.stringify(scopeParams)

  // Audis list
  const { data: audisRaw } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAudis(theaterId).then(r => r.data.data),
    enabled: !!theaterId,
  })
  const allAudis = Array.isArray(audisRaw?.data) ? audisRaw.data : []

  // Grouped services (all statuses — admin view)
  const { data: groupedRaw, isLoading } = useQuery({
    queryKey: ["services", cacheKey],
    queryFn: () => listServicesGrouped(scopeParams).then(r => r.data.data),
    enabled: !!theaterId,
  })

  const sections  = groupedRaw?.sections  ?? []
  const ungrouped = groupedRaw?.ungrouped ?? { sectionId: null, name: "Other Services", services: [] }
  const allSections = sections

  // Status mutations
  const sectionStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateSectionStatus(id, status),
    onSuccess: () => {
      toast.success("Section status updated")
      queryClient.invalidateQueries({ queryKey: ["services", cacheKey] })
      setSectionToggle(null)
    },
    onError: () => toast.error("Something went wrong."),
  })

  const serviceStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateServiceStatus(id, status),
    onSuccess: () => {
      toast.success("Service status updated")
      queryClient.invalidateQueries({ queryKey: ["services", cacheKey] })
      setServiceToggle(null)
    },
    onError: () => toast.error("Something went wrong."),
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, newOrder }) => reorderSection(id, newOrder),
    onSuccess: () => {
      toast.success("Section order saved")
      queryClient.invalidateQueries({ queryKey: ["services", cacheKey] })
    },
    onError: () => {
      toast.error("Reorder failed — order restored.")
      queryClient.invalidateQueries({ queryKey: ["services", cacheKey] })
    },
  })

  // ── Drag-and-drop ────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 8px movement before a drag starts — prevents accidental drags on click
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = ({ active }) => {
    setActiveId(active.id)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const oldIdx = sections.findIndex(s => s.sectionId === active.id)
    const newIdx = sections.findIndex(s => s.sectionId === over.id)
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return

    const section = sections[oldIdx]
    const target  = sections[newIdx]

    // Compute the newOrder integer expected by the backend reorder endpoint.
    // Moving up: take the target's order if it's numerically lower, else slip below tie.
    // Moving down: take the target's order if it's numerically higher, else slip above tie.
    let newOrder
    if (newIdx < oldIdx) {
      newOrder = target.order < section.order
        ? target.order
        : section.order - (oldIdx - newIdx)
    } else {
      newOrder = target.order > section.order
        ? target.order
        : section.order + (newIdx - oldIdx)
    }

    // Optimistic UI: reorder in cache immediately so the list snaps into place
    queryClient.setQueryData(["services", cacheKey], (old) => {
      if (!old) return old
      return { ...old, sections: arrayMove(old.sections, oldIdx, newIdx) }
    })

    reorderMutation.mutate({ id: section.sectionId, newOrder })
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  // ── Status toggle handlers ────────────────────────────────────────────────────

  const handleToggleSectionStatus = (section) => {
    setSectionToggle({
      id:       section.sectionId,
      name:     section.name,
      isActive: section.status === "active",
    })
  }

  const handleToggleServiceStatus = (svc) => {
    setServiceToggle({
      id:       svc.serviceId ?? svc.id ?? svc._id,
      name:     svc.name,
      isActive: svc.lifecycle?.status === "active",
    })
  }

  const activeSection = activeId ? sections.find(s => s.sectionId === activeId) : null

  return (
    <div className="space-y-6">
      <PageHeader title="Services &amp; Sections" />

      {/* Scope selector + Add buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Select value={selectedScope} onValueChange={setSelectedScope}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="theater">Theater-wide</SelectItem>
            {allAudis.map(a => {
              const id = a.audiId ?? a.id ?? a._id
              return <SelectItem key={id} value={id}>{a.name}</SelectItem>
            })}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddServiceCtx({ sectionId: null })}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Service
          </Button>
          <Button onClick={() => setAddSectionOpen(true)} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> Add Section
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <Card key={i}><CardContent className="h-28 animate-pulse bg-muted/30 pt-6" /></Card>
          ))}
        </div>
      ) : sections.length === 0 && ungrouped.services.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No services yet"
          message="Create a section and add services to it."
        />
      ) : (
        <div className="space-y-4">
          {/* Draggable sections */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={sections.map(s => s.sectionId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {sections.map((section) => (
                  <SectionCard
                    key={section.sectionId}
                    section={section}
                    isReordering={reorderMutation.isPending}
                    onEditSection={setEditingSection}
                    onToggleSectionStatus={handleToggleSectionStatus}
                    onAddService={(sectionId) => setAddServiceCtx({ sectionId })}
                    onEditService={setEditingService}
                    onToggleServiceStatus={handleToggleServiceStatus}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Floating card that follows the cursor while dragging */}
            <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
              <SectionDragOverlay section={activeSection} />
            </DragOverlay>
          </DndContext>

          {/* Ungrouped services */}
          {ungrouped.services.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-muted-foreground">Other Services (ungrouped)</span>
                  <Button size="sm" variant="outline" onClick={() => setAddServiceCtx({ sectionId: null })}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y">
                  {ungrouped.services.map(svc => (
                    <ServiceRow
                      key={svc.serviceId ?? svc.id ?? svc._id}
                      svc={svc}
                      onEdit={setEditingService}
                      onToggleStatus={handleToggleServiceStatus}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dialogs */}
      <SectionDialog
        open={addSectionOpen}
        onOpenChange={setAddSectionOpen}
        scopeParams={scopeParams}
        editingSection={null}
      />
      <SectionDialog
        open={!!editingSection}
        onOpenChange={o => !o && setEditingSection(null)}
        scopeParams={scopeParams}
        editingSection={editingSection}
      />

      <ServiceDialog
        open={!!addServiceCtx}
        onOpenChange={o => !o && setAddServiceCtx(null)}
        scopeParams={scopeParams}
        sectionId={addServiceCtx?.sectionId}
        editingService={null}
        sections={allSections}
      />
      <ServiceDialog
        open={!!editingService}
        onOpenChange={o => !o && setEditingService(null)}
        scopeParams={scopeParams}
        sectionId={editingService?.relationships?.sectionId}
        editingService={editingService}
        sections={allSections}
      />

      {/* Section status confirm */}
      <AlertDialog open={!!sectionToggle} onOpenChange={o => !o && setSectionToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sectionToggle?.isActive ? "Deactivate" : "Activate"} &quot;{sectionToggle?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sectionToggle?.isActive
                ? "This section and all its services will be hidden from bookings."
                : "This section will become visible in bookings again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sectionStatusMutation.mutate({
                id:     sectionToggle.id,
                status: sectionToggle.isActive ? "inactive" : "active",
              })}
              className={sectionToggle?.isActive ? "bg-destructive hover:bg-destructive/90" : ""}
            >Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Service status confirm */}
      <AlertDialog open={!!serviceToggle} onOpenChange={o => !o && setServiceToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {serviceToggle?.isActive ? "Deactivate" : "Activate"} &quot;{serviceToggle?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {serviceToggle?.isActive
                ? "This service will no longer appear in bookings."
                : "This service will become available in bookings again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => serviceStatusMutation.mutate({
                id:     serviceToggle.id,
                status: serviceToggle.isActive ? "inactive" : "active",
              })}
              className={serviceToggle?.isActive ? "bg-destructive hover:bg-destructive/90" : ""}
            >Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
