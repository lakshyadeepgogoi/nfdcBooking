import { useEffect, useState } from "react"
import { pick } from "@/utils/pick"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Pencil, UserX, MoreHorizontal, ArrowLeftRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import FormSelect from "@/components/forms/FormSelect"
import {
  listAdmins, createAdmin, updateAdmin, deactivateAdmin, reassignAdmin, listAllTheaters,
} from "@/api/superAdmin"
import { parseList } from "@/utils/parseList"
import { formatDateTime } from "@/utils/formatDate"

const createSchema = z.object({
  name: z.string().min(2, "Min 2 characters"),
  email: z.string().email("Valid email required"),
  password: z.string()
    .min(8, "Min 8 characters")
    .refine(v => /[A-Z]/.test(v), "Must contain an uppercase letter")
    .refine(v => /[0-9]/.test(v), "Must contain a number"),
  theaterId: z.string().min(1, "Select a theater"),
})

const editSchema = z.object({
  name: z.string().min(2, "Min 2 characters"),
  email: z.string().email("Valid email required"),
  theaterId: z.string().min(1, "Select a theater"),
})

const reassignSchema = z.object({
  theaterId: z.string().min(1, "Select a theater"),
})

export default function AdminList() {
  useEffect(() => { document.title = "NFDC Admin — Admin Management" }, [])

  const queryClient = useQueryClient()
  const [theaterFilter, setTheaterFilter] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [reassignTarget, setReassignTarget] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)

  const { data: theatersRaw } = useQuery({
    queryKey: ["theaters"],
    queryFn: () => listAllTheaters().then(r => parseList(r.data.data)),
  })
  const theaters = theatersRaw ?? []
  const theaterOptions = theaters.map(t => ({ value: t.id ?? t._id ?? t.theaterId, label: t.name }))

  const { data: adminsRaw, isLoading } = useQuery({
    queryKey: ["admins", theaterFilter],
    queryFn: () => listAdmins(theaterFilter || undefined).then(r => parseList(r.data.data)),
  })
  const admins = adminsRaw ?? []

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admins"] })

  const createMutation = useMutation({
    mutationFn: (data) => createAdmin(data),
    onSuccess: () => { toast.success("Admin created"); invalidate(); setCreateOpen(false) },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const editMutation = useMutation({
    mutationFn: (data) => updateAdmin(editingAdmin.id ?? editingAdmin._id, data),
    onSuccess: () => { toast.success("Admin updated"); invalidate(); setEditingAdmin(null) },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateAdmin(id),
    onSuccess: () => { toast.success("Admin deactivated"); invalidate(); setDeactivateTarget(null) },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const reassignMutation = useMutation({
    mutationFn: ({ id, theaterId }) => reassignAdmin(id, theaterId),
    onSuccess: () => { toast.success("Admin reassigned"); invalidate(); setReassignTarget(null) },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const createForm = useForm({ resolver: zodResolver(createSchema), defaultValues: { name: "", email: "", password: "", theaterId: "" } })
  const editForm = useForm({ resolver: zodResolver(editSchema), defaultValues: { name: "", email: "", theaterId: "" } })
  const reassignForm = useForm({ resolver: zodResolver(reassignSchema), defaultValues: { theaterId: "" } })

  useEffect(() => {
    if (editingAdmin) {
      editForm.reset({
        name: editingAdmin.name ?? "",
        email: editingAdmin.email ?? "",
        theaterId: editingAdmin.theaterId ?? editingAdmin.theater?.id ?? "",
      })
    }
  }, [editingAdmin, editForm])

  useEffect(() => {
    if (reassignTarget) reassignForm.reset({ theaterId: "" })
  }, [reassignTarget, reassignForm])

  const columns = [
    { accessorKey: "name", header: "Name", cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> },
    { accessorKey: "email", header: "Email" },
    {
      id: "theater",
      header: "Theater",
      cell: ({ row }) => pick(row.original.theater?.name, row.original.theaterName, row.original.theater),
    },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue()} /> },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ getValue }) => getValue() ? formatDateTime(getValue()) : "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const admin = row.original
        const id = admin.id ?? admin._id ?? admin.adminId
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingAdmin(admin)}>
                <Pencil className="mr-2 h-4 w-4" />Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setReassignTarget({ ...admin, id })}>
                <ArrowLeftRight className="mr-2 h-4 w-4" />Reassign Theater
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeactivateTarget({ id, name: admin.name })}
                className="text-destructive focus:text-destructive"
              >
                <UserX className="mr-2 h-4 w-4" />Deactivate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Management"
        action={{ label: "Create Admin", icon: Plus, onClick: () => setCreateOpen(true) }}
      />

      <div className="flex items-center gap-3">
        <Select value={theaterFilter} onValueChange={(v) => setTheaterFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All Theaters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Theaters</SelectItem>
            {theaterOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={admins} isLoading={isLoading} emptyMessage="No admins found" />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Create Admin</DialogTitle></DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(v => createMutation.mutate(v))} className="space-y-4">
              <FormInput control={createForm.control} name="name" label="Name" />
              <FormInput control={createForm.control} name="email" label="Email" type="email" />
              <FormInput control={createForm.control} name="password" label="Password" type="password" />
              <FormSelect control={createForm.control} name="theaterId" label="Theater" options={theaterOptions} placeholder="Select a theater" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingAdmin} onOpenChange={(o) => !o && setEditingAdmin(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Edit Admin</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(v => editMutation.mutate(v))} className="space-y-4">
              <FormInput control={editForm.control} name="name" label="Name" />
              <FormInput control={editForm.control} name="email" label="Email" type="email" />
              <FormSelect control={editForm.control} name="theaterId" label="Theater" options={theaterOptions} placeholder="Select a theater" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingAdmin(null)}>Cancel</Button>
                <Button type="submit" disabled={editMutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                  {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={!!reassignTarget} onOpenChange={(o) => !o && setReassignTarget(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Reassign Theater</DialogTitle></DialogHeader>
          <Form {...reassignForm}>
            <form onSubmit={reassignForm.handleSubmit(v => reassignMutation.mutate({ id: reassignTarget.id, theaterId: v.theaterId }))} className="space-y-4">
              <FormSelect
                control={reassignForm.control}
                name="theaterId"
                label="New Theater"
                placeholder="Select a theater"
                options={theaterOptions.filter(t => t.value !== (reassignTarget?.theaterId ?? reassignTarget?.theater?.id))}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReassignTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={reassignMutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                  {reassignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reassign
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Deactivate Alert */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate &quot;{deactivateTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>They will lose access immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateMutation.mutate(deactivateTarget.id)}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
