import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, Power, MoreHorizontal, Plus, Loader2 } from "lucide-react"
import RoleGuard from "@/components/common/RoleGuard"
import { PERMISSIONS } from "@/auth/permissions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import FormInput from "@/components/forms/FormInput"
import { listAllTheaters, createTheater, updateTheaterStatus } from "@/api/superAdmin"
import { parseList } from "@/utils/parseList"

const createTheaterSchema = z.object({
  name: z.string().min(2, "Min 2 characters").max(200, "Max 200 characters"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
})

function CreateTheaterDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient()

  const form = useForm({
    resolver: zodResolver(createTheaterSchema),
    defaultValues: { name: "", address: "", city: "", state: "", phone: "", email: "" },
  })

  useEffect(() => {
    if (open) form.reset({ name: "", address: "", city: "", state: "", phone: "", email: "" })
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values) => {
      const { name, ...rest } = values
      const details = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== "")
      )
      return createTheater({ name, ...(Object.keys(details).length ? { details } : {}) })
    },
    onSuccess: () => {
      toast.success("Theater created successfully")
      queryClient.invalidateQueries({ queryKey: ["theaters"] })
      onOpenChange(false)
    },
    onError: (err) => {
      const msg = err?.response?.data?.message ?? "Something went wrong. Please try again."
      toast.error(msg)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create Theater</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormInput
              control={form.control}
              name="name"
              label="Theater Name"
              placeholder="NFDC Cinema, Mumbai"
            />
            <FormInput
              control={form.control}
              name="address"
              label="Address (optional)"
              placeholder="123 Main Street"
            />
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                control={form.control}
                name="city"
                label="City (optional)"
                placeholder="Mumbai"
              />
              <FormInput
                control={form.control}
                name="state"
                label="State (optional)"
                placeholder="Maharashtra"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                control={form.control}
                name="phone"
                label="Phone (optional)"
                placeholder="+91 98765 43210"
              />
              <FormInput
                control={form.control}
                name="email"
                label="Email (optional)"
                type="email"
                placeholder="contact@theater.in"
              />
            </div>
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
                Create Theater
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function TheaterList() {
  useEffect(() => { document.title = "NFDC Admin — Theaters" }, [])

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [statusTarget, setStatusTarget] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: raw, isLoading } = useQuery({
    queryKey: ["theaters"],
    queryFn: () => listAllTheaters().then(r => parseList(r.data.data)),
  })

  const theaters = raw ?? []

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateTheaterStatus(id, status),
    onSuccess: () => {
      toast.success("Theater status updated")
      queryClient.invalidateQueries({ queryKey: ["theaters"] })
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
      id: "location",
      header: "Location",
      cell: ({ row }) => {
        const d = row.original.details ?? row.original
        return [d.city, d.state].filter(Boolean).join(", ") || row.original.address || "—"
      },
    },
    {
      id: "contact",
      header: "Contact",
      cell: ({ row }) => {
        const d = row.original.details ?? row.original
        return d.phone || d.email || "—"
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
        const theater = row.original
        const id = theater.id ?? theater._id ?? theater.theaterId
        const isActive = theater.status === "active"
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/super/theaters/${id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setStatusTarget({ id, name: theater.name, isActive })}
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
      <PageHeader title="Theaters">
        <RoleGuard permissions={PERMISSIONS.CREATE_THEATER}>
          <Button
            className="bg-nfdc-primary hover:bg-nfdc-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Theater
          </Button>
        </RoleGuard>
      </PageHeader>

      <DataTable
        columns={columns}
        data={theaters}
        isLoading={isLoading}
        emptyMessage="No theaters found"
      />

      <CreateTheaterDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog open={!!statusTarget} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change status of &quot;{statusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will {statusTarget?.isActive ? "deactivate" : "activate"} the theater and may affect all associated bookings.
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
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
