import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, MoreHorizontal, Pencil, Power, Clock, Loader2 } from "lucide-react"
import { parseList } from "@/utils/parseList"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const slotSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    days: z.array(z.string()).min(1, "Select at least one day"),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  })

function SlotDialog({ open, onOpenChange, audiId, editingSlot, onSuccess }) {
  const form = useForm({
    resolver: zodResolver(slotSchema),
    defaultValues: { name: "", startTime: "", endTime: "", days: [] },
  })

  useEffect(() => {
    if (open) {
      form.reset(
        editingSlot
          ? {
              name: editingSlot.name ?? "",
              startTime: editingSlot.startTime ?? "",
              endTime: editingSlot.endTime ?? "",
              days: editingSlot.days ?? [],
            }
          : { name: "", startTime: "", endTime: "", days: [] }
      )
    }
  }, [open, editingSlot, form])

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (values) =>
      editingSlot
        ? updateSlot(editingSlot.id ?? editingSlot._id, values)
        : createSlot({ audiId, ...values }),
    onSuccess: () => {
      toast.success(editingSlot ? "Slot updated" : "Slot created")
      queryClient.invalidateQueries({ queryKey: ["slots", audiId] })
      onOpenChange(false)
      if (onSuccess) onSuccess()
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editingSlot ? "Edit Slot" : "Add Slot"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormInput control={form.control} name="name" label="Slot Name" placeholder="Morning Slot" />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <input
                        type="time"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <input
                        type="time"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Days</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-3 pt-1">
                      {DAYS.map((day) => {
                        const checked = field.value.includes(day)
                        return (
                          <div key={day} className="flex items-center gap-1.5">
                            <Checkbox
                              id={`day-${day}`}
                              checked={checked}
                              onCheckedChange={(c) =>
                                field.onChange(
                                  c
                                    ? [...field.value, day]
                                    : field.value.filter((d) => d !== day)
                                )
                              }
                            />
                            <Label htmlFor={`day-${day}`} className="text-sm font-normal cursor-pointer">
                              {day}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {editingSlot ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function SlotList() {
  useEffect(() => {
    document.title = "NFDC Admin — Slots"
  }, [])

  const { user } = useAuth()
  const theaterId = user?.theaterId
  const queryClient = useQueryClient()

  const [selectedAudiId, setSelectedAudiId] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)

  const { data: audis } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAudis(theaterId).then((r) => parseList(r.data.data)),
    enabled: !!theaterId,
  })

  const { data: slots, isLoading } = useQuery({
    queryKey: ["slots", selectedAudiId],
    queryFn: () => listSlots(selectedAudiId).then((r) => parseList(r.data.data)),
    enabled: !!selectedAudiId,
  })

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
      accessorKey: "startTime",
      header: "Start Time",
    },
    {
      accessorKey: "endTime",
      header: "End Time",
    },
    {
      accessorKey: "days",
      header: "Days",
      cell: ({ getValue }) => {
        const days = getValue()
        return Array.isArray(days) ? days.join(", ") : days
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const slot = row.original
        const isActive = slot.status === "active"
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingSlot(slot)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  setStatusTarget({ id: slot.id ?? slot._id, name: slot.name, isActive })
                }
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

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Select value={selectedAudiId} onValueChange={setSelectedAudiId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select an audi to view slots" />
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
          onClick={() => setCreateDialogOpen(true)}
          disabled={!selectedAudiId}
          className="bg-nfdc-primary hover:bg-nfdc-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Slot
        </Button>
      </div>

      {!selectedAudiId ? (
        <EmptyState
          icon={Clock}
          title="Select an audi"
          message="Choose an audi above to manage its slots."
        />
      ) : (
        <DataTable
          columns={columns}
          data={slots ?? []}
          isLoading={isLoading}
          emptyMessage="No slots yet"
          emptyIcon={Clock}
        />
      )}

      <SlotDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        audiId={selectedAudiId}
        editingSlot={null}
      />

      <SlotDialog
        open={!!editingSlot}
        onOpenChange={(open) => !open && setEditingSlot(null)}
        audiId={selectedAudiId}
        editingSlot={editingSlot}
      />

      <AlertDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.isActive ? "Deactivate" : "Activate"} &quot;{statusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.isActive
                ? "This will deactivate the slot."
                : "This will activate the slot."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                statusMutation.mutate({
                  id: statusTarget.id,
                  status: statusTarget.isActive ? "inactive" : "active",
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
