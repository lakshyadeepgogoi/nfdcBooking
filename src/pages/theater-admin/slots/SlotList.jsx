import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, MoreHorizontal, Pencil, Power, Clock, Loader2, Info } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import EmptyState from "@/components/common/EmptyState"
import FormInput from "@/components/forms/FormInput"
import { useAuth } from "@/hooks/useAuth"
import { listAudis } from "@/api/audi"
import { listSlots, createSlot, updateSlot, updateSlotStatus } from "@/api/slots"
import { formatINR } from "@/utils/formatCurrency"

// ─── Schema ────────────────────────────────────────────────────────────────────
// Backend slot: { name, config: { startTime, endTime, pricing: { govt, nonGovt } } }
// There is NO 'days' field in the slot schema.

const slotSchema = z
  .object({
    name:           z.string().min(1, "Name is required"),
    startTime:      z.string().min(1, "Start time is required"),
    endTime:        z.string().min(1, "End time is required"),
    pricingGovt:    z.coerce.number().min(0).optional().or(z.literal("")),
    pricingNonGovt: z.coerce.number().min(0).optional().or(z.literal("")),
  })
  .refine(d => d.endTime > d.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  })

// ─── Slot Dialog ───────────────────────────────────────────────────────────────

function SlotDialog({ open, onOpenChange, audiId, editingSlot }) {
  const queryClient = useQueryClient()

  const form = useForm({
    resolver: zodResolver(slotSchema),
    defaultValues: { name: "", startTime: "", endTime: "", pricingGovt: "", pricingNonGovt: "" },
  })

  useEffect(() => {
    if (!open) return
    form.reset(editingSlot ? {
      name:           editingSlot.name ?? "",
      startTime:      editingSlot.config?.startTime ?? "",
      endTime:        editingSlot.config?.endTime ?? "",
      pricingGovt:    editingSlot.config?.pricing?.govt ?? "",
      pricingNonGovt: editingSlot.config?.pricing?.nonGovt ?? "",
    } : { name: "", startTime: "", endTime: "", pricingGovt: "", pricingNonGovt: "" })
  }, [open, editingSlot, form])

  const mutation = useMutation({
    mutationFn: (v) => {
      const config = {
        startTime: v.startTime,
        endTime:   v.endTime,
        pricing: {
          govt:    v.pricingGovt    !== "" ? Number(v.pricingGovt)    : undefined,
          nonGovt: v.pricingNonGovt !== "" ? Number(v.pricingNonGovt) : undefined,
        },
      }
      const id = editingSlot?.slotId ?? editingSlot?.id ?? editingSlot?._id
      return editingSlot
        ? updateSlot(id, { name: v.name, config })
        : createSlot({ name: v.name, audiId, config })
    },
    onSuccess: () => {
      toast.success(editingSlot ? "Slot updated" : "Slot created")
      queryClient.invalidateQueries({ queryKey: ["slots", audiId] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingSlot ? "Edit Slot" : "Add Slot"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <FormInput control={form.control} name="name" label="Slot Name" placeholder="Morning Slot" />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startTime" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <FormControl>
                    <input type="time" {...field}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endTime" render={({ field }) => (
                <FormItem>
                  <FormLabel>End Time</FormLabel>
                  <FormControl>
                    <input type="time" {...field}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Pricing (optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <FormInput control={form.control} name="pricingGovt"
                  label="Govt Rate (₹)" type="number" placeholder="e.g. 5000" />
                <FormInput control={form.control} name="pricingNonGovt"
                  label="Non-Govt Rate (₹)" type="number" placeholder="e.g. 10000" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingSlot ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SlotList() {
  useEffect(() => { document.title = "NFDC Admin — Slots" }, [])

  const { user }    = useAuth()
  const theaterId   = user?.theaterId
  const queryClient = useQueryClient()

  const [selectedAudiId, setSelectedAudiId] = useState("")
  const [createOpen,     setCreateOpen]     = useState(false)
  const [editingSlot,    setEditingSlot]     = useState(null)
  const [statusTarget,   setStatusTarget]   = useState(null)

  // All audis for this theater
  const { data: audisRaw } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAudis(theaterId).then(r => r.data.data),
    enabled: !!theaterId,
  })

  const allAudis = Array.isArray(audisRaw?.data)
    ? audisRaw.data
    : Array.isArray(audisRaw) ? audisRaw : []

  // Determine the mode of the currently selected audi
  const selectedAudi = allAudis.find(a =>
    (a.audiId ?? a.id ?? a._id) === selectedAudiId
  )
  const selectedMode = selectedAudi?.config?.slotMode  // "fixed" | "flexible" | undefined

  // Fetch ALL slots for the selected audi (no status filter → active + inactive)
  const { data: slotsRaw, isLoading } = useQuery({
    queryKey: ["slots", selectedAudiId],
    queryFn: () => listSlots(selectedAudiId).then(r => r.data.data),
    enabled: !!selectedAudiId,
  })

  const slots = Array.isArray(slotsRaw?.data)
    ? slotsRaw.data
    : Array.isArray(slotsRaw) ? slotsRaw : []

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateSlotStatus(id, status),
    onSuccess: () => {
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: ["slots", selectedAudiId] })
      setStatusTarget(null)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const columns = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    {
      id: "startTime",
      header: "Start",
      cell: ({ row }) => row.original.config?.startTime ?? "—",
    },
    {
      id: "endTime",
      header: "End",
      cell: ({ row }) => row.original.config?.endTime ?? "—",
    },
    {
      id: "duration",
      header: "Duration",
      cell: ({ row }) => {
        const s = row.original.config?.startTime
        const e = row.original.config?.endTime
        if (!s || !e) return "—"
        const toMins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
        const diff = toMins(e) - toMins(s)
        if (diff <= 0) return "—"
        const h = Math.floor(diff / 60), m = diff % 60
        return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`
      },
    },
    {
      id: "pricing",
      header: "Pricing",
      cell: ({ row }) => {
        const p = row.original.config?.pricing
        if (!p?.govt && !p?.nonGovt) return <span className="text-xs text-muted-foreground">Not set</span>
        return (
          <div className="text-xs space-y-0.5">
            {p.govt    != null && <p>Govt: {formatINR(p.govt)}</p>}
            {p.nonGovt != null && <p>Non-Govt: {formatINR(p.nonGovt)}</p>}
          </div>
        )
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.lifecycle?.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const slot     = row.original
        const id       = slot.slotId ?? slot.id ?? slot._id
        const isActive = slot.lifecycle?.status === "active"
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingSlot(slot)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setStatusTarget({ id, name: slot.name, isActive })}
                className={isActive ? "text-destructive focus:text-destructive" : ""}
              >
                <Power className="mr-2 h-4 w-4" />
                {isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Slots" />

      {/* Audi selector — all audis, not just fixed */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Select value={selectedAudiId} onValueChange={setSelectedAudiId}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder={
              allAudis.length === 0 ? "No audis found" : "Select an audi"
            } />
          </SelectTrigger>
          <SelectContent>
            {allAudis.map(a => {
              const id   = a.audiId ?? a.id ?? a._id
              const mode = a.config?.slotMode
              return (
                <SelectItem key={id} value={id}>
                  <span className="flex items-center gap-2">
                    {a.name}
                    {mode && (
                      <Badge variant={mode === "fixed" ? "outline" : "secondary"} className="text-[10px] px-1 py-0 capitalize">
                        {mode}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <Button
          onClick={() => setCreateOpen(true)}
          disabled={!selectedAudiId || selectedMode === "flexible"}
          className="bg-nfdc-primary hover:bg-nfdc-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Slot
        </Button>
      </div>

      {/* No audi selected */}
      {!selectedAudiId && (
        <EmptyState
          icon={Clock}
          title="Select an audi"
          message="Choose an audi above to view and manage its time slots."
        />
      )}

      {/* Flexible-mode audi selected — slots not applicable */}
      {selectedAudiId && selectedMode === "flexible" && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Flexible mode audi</p>
            <p className="text-sm mt-0.5">
              Flexible-mode audis don't use time slots. Customers book any start/end time within the
              valid <strong>Booking Durations</strong> set in the Audi settings.
            </p>
          </div>
        </div>
      )}

      {/* Fixed or unknown mode — show slots table */}
      {selectedAudiId && selectedMode !== "flexible" && (
        <DataTable
          columns={columns}
          data={slots}
          isLoading={isLoading}
          emptyMessage="No slots yet — add one above"
          emptyIcon={Clock}
        />
      )}

      <SlotDialog open={createOpen}    onOpenChange={setCreateOpen}               audiId={selectedAudiId} editingSlot={null} />
      <SlotDialog open={!!editingSlot} onOpenChange={o => !o && setEditingSlot(null)} audiId={selectedAudiId} editingSlot={editingSlot} />

      <AlertDialog open={!!statusTarget} onOpenChange={o => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.isActive ? "Deactivate" : "Activate"} &quot;{statusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.isActive
                ? "This slot will no longer be available for new bookings."
                : "This slot will become available for bookings again."}
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
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
