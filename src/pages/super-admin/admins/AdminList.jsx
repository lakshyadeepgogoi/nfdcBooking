import { useEffect, useState } from "react"
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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

const transformAdmin = (admin) => ({
  ...admin,
  status: admin.lifecycle?.status || admin.status,
  statusHistory: admin.lifecycle?.statusHistory || admin.statusHistory || [],
  theaterId: admin.relationships?.theaterId || admin.theaterId,
  role: admin.profile?.role || admin.role,
  lastLoginAt: admin.profile?.lastLoginAt,
  createdBy: admin.createdBy,
})

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
  const [statusHistoryTarget, setStatusHistoryTarget] = useState(null)

  const { data: theatersRaw } = useQuery({
    queryKey: ["theaters"],
    queryFn: () => listAllTheaters().then(r => parseList(r.data.data)),
  })
  const theaters = theatersRaw ?? []
  const theaterOptions = theaters.map(t => ({ value: t.theaterId ?? t.id ?? t._id, label: t.name }))
  const theaterNameMap = new Map()
  theaters.forEach(t => {
    const name = t.name
    if (t.id) theaterNameMap.set(t.id, name)
    if (t._id) theaterNameMap.set(t._id, name)
    if (t.theaterId) theaterNameMap.set(t.theaterId, name)
  })

  const { data: adminsRaw, isLoading } = useQuery({
    queryKey: ["admins", theaterFilter],
    queryFn: () => listAdmins(theaterFilter || undefined).then(r => parseList(r.data.data).map(transformAdmin)),
  })
  const admins = adminsRaw ?? []

  const { data: allAdminsRaw } = useQuery({
    queryKey: ["admins", "all"],
    queryFn: () => listAdmins().then(r => parseList(r.data.data)),
  })
  const allAdmins = allAdminsRaw ?? []
  const adminNameMap = new Map(
    allAdmins.map(a => [(a.adminId ?? a.id ?? a._id), a.name])
  )

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admins"] })

  const createMutation = useMutation({
    mutationFn: (data) => createAdmin(data),
    onSuccess: () => { toast.success("Admin created"); invalidate(); setCreateOpen(false) },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const editMutation = useMutation({
    mutationFn: (data) => updateAdmin(editingAdmin.adminId ?? editingAdmin.id ?? editingAdmin._id, data),
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
      cell: ({ row }) => {
        const tid = row.original.theaterId
        return tid ? (theaterNameMap.get(tid) || tid) : "—"
      },
    },
    { accessorKey: "status", header: "Status", cell: ({ getValue, row }) => <button onClick={() => setStatusHistoryTarget(row.original)} className="cursor-pointer hover:opacity-80"><StatusBadge status={getValue()} /></button> },
    {
      id: "lastLogin",
      header: "Last Login",
      cell: ({ row }) => row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : <span className="text-muted-foreground">Never</span>,
    },
    {
      id: "createdBy",
      header: "Created By",
      cell: ({ row }) => adminNameMap.get(row.original.createdBy) || "System",
    },
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
        const id = admin.adminId ?? admin.id ?? admin._id
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
              {admin.status !== "inactive" && (
                <DropdownMenuItem
                  onClick={() => setDeactivateTarget({ id, name: admin.name })}
                  className="text-destructive focus:text-destructive"
                >
                  <UserX className="mr-2 h-4 w-4" />Deactivate
                </DropdownMenuItem>
              )}
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

      {/* Status History Sheet */}
      <Sheet open={!!statusHistoryTarget} onOpenChange={(o) => !o && setStatusHistoryTarget(null)}>
        <SheetContent className="w-full sm:w-96 overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-lg">Status History</SheetTitle>
            <p className="text-sm text-muted-foreground mt-1">{statusHistoryTarget?.name}</p>
          </SheetHeader>

          <div className="space-y-1">
            {statusHistoryTarget?.statusHistory && statusHistoryTarget.statusHistory.length > 0 ? (
              [...statusHistoryTarget.statusHistory].reverse().map((entry, idx) => {
                const isFirst = idx === 0
                const isLast = idx === statusHistoryTarget.statusHistory.length - 1
                return (
                  <div key={entry._id || idx} className="relative pl-6 pb-6">
                    {/* Timeline line */}
                    {!isLast && <div className="absolute left-2 top-6 w-0.5 h-8 bg-border" />}

                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full border-2 ${
                      entry.status === "active"
                        ? "bg-green-100 border-green-500"
                        : "bg-red-100 border-red-500"
                    }`} />

                    {/* Content */}
                    <div className="bg-muted/40 rounded-lg p-4 hover:bg-muted/60 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <StatusBadge status={entry.status} />
                        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mb-2">
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>

                      <div className="pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Changed by:</span>
                          <br />
                          <span className="break-all">
                            {entry.changedBy === "seed"
                              ? "System Seed"
                              : entry.changedBy == null
                                ? "System"
                                : adminNameMap.get(entry.changedBy) || entry.changedBy}
                          </span>
                        </p>
                      </div>
                    </div>

                    {isFirst && (
                      <div className="mt-3 text-xs text-muted-foreground italic">
                        Current status
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="flex items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">No status history available</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
