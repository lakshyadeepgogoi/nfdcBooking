import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, Power, MoreHorizontal, Plus, Loader2, X, Search } from "lucide-react"
import RoleGuard from "@/components/common/RoleGuard"
import { PERMISSIONS } from "@/auth/permissions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
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
import { listAllTheaters, createTheater, updateTheaterStatus } from "@/api/superAdmin"

// ─── Schema ────────────────────────────────────────────────────────────────────

const createTheaterSchema = z.object({
  name:    z.string().min(2, "Min 2 characters").max(200),
  address: z.string().optional(),
  city:    z.string().optional(),
  state:   z.string().optional(),
  pincode: z.string().optional(),
  phone:   z.string().optional(),
  email:   z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
  mid:     z.string().optional(),
})

// ─── Create Dialog ─────────────────────────────────────────────────────────────

function CreateTheaterDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient()

  // extra local state (amenities + parking can't go through react-hook-form easily)
  const [amenities,        setAmenities]       = useState([])
  const [amenityInput,     setAmenityInput]     = useState("")
  const [parkingAvailable, setParkingAvailable] = useState(false)
  const [parkingCapacity,  setParkingCapacity]  = useState("")
  const [parkingNotes,     setParkingNotes]     = useState("")

  const form = useForm({
    resolver: zodResolver(createTheaterSchema),
    defaultValues: { name: "", address: "", city: "", state: "", pincode: "", phone: "", email: "", mid: "" },
  })

  useEffect(() => {
    if (open) {
      form.reset({ name: "", address: "", city: "", state: "", pincode: "", phone: "", email: "", mid: "" })
      setAmenities([])
      setAmenityInput("")
      setParkingAvailable(false)
      setParkingCapacity("")
      setParkingNotes("")
    }
  }, [open, form])

  const addAmenity = () => {
    const v = amenityInput.trim()
    if (v && !amenities.includes(v)) { setAmenities(a => [...a, v]); setAmenityInput("") }
  }

  const mutation = useMutation({
    mutationFn: (values) => {
      const { name, mid, ...detailFields } = values

      // build details — only include non-empty fields
      const details = Object.fromEntries(
        Object.entries(detailFields).filter(([, v]) => v !== "")
      )
      if (amenities.length) details.amenities = amenities
      details.parking = {
        available: parkingAvailable,
        ...(parkingAvailable && parkingCapacity !== "" ? { capacity: Number(parkingCapacity) } : {}),
        ...(parkingAvailable && parkingNotes ? { notes: parkingNotes } : {}),
      }

      return createTheater({
        name,
        ...(Object.keys(details).length ? { details } : {}),
        ...(mid ? { paymentConfig: { mid } } : {}),
      })
    },
    onSuccess: () => {
      toast.success("Theater created successfully")
      queryClient.invalidateQueries({ queryKey: ["theaters"] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create Theater</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">

            {/* ── Basic Info ─────────────────────────────────────────────── */}
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Basic Information</p>
              <FormInput control={form.control} name="name" label="Theater Name *" placeholder="NFDC Cinema, Mumbai" />
              <FormInput control={form.control} name="address" label="Address" placeholder="123 Main Street" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormInput control={form.control} name="city"    label="City"    placeholder="Mumbai" />
                <FormInput control={form.control} name="state"   label="State"   placeholder="Maharashtra" />
                <FormInput control={form.control} name="pincode" label="Pincode" placeholder="400001" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput control={form.control} name="phone" label="Phone"              placeholder="+91 22 1234 5678" />
                <FormInput control={form.control} name="email" label="Email" type="email" placeholder="contact@theater.in" />
              </div>
            </div>

            <Separator />

            {/* ── Payment ─────────────────────────────────────────────────── */}
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Payment Configuration</p>
              <FormInput control={form.control} name="mid" label="Payment MID (optional)" placeholder="e.g. NFDC_SIRIFORT_MID" />
            </div>

            <Separator />

            {/* ── Amenities ───────────────────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Amenities</p>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {amenities.length === 0 && <span className="text-sm text-muted-foreground">None added</span>}
                {amenities.map((a) => (
                  <Badge key={a} variant="secondary" className="gap-1 pr-1">
                    {a}
                    <button type="button" onClick={() => setAmenities(x => x.filter(i => i !== a))}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add amenity (e.g. 4K Projection)"
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAmenity() } }}
                  className="max-w-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={addAmenity}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>

            <Separator />

            {/* ── Parking ─────────────────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Parking</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{parkingAvailable ? "Available" : "Not available"}</span>
                  <Switch checked={parkingAvailable} onCheckedChange={setParkingAvailable} />
                </div>
              </div>
              {parkingAvailable && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Capacity (optional)</Label>
                    <Input type="number" placeholder="e.g. 120" value={parkingCapacity}
                      onChange={(e) => setParkingCapacity(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                    <Input placeholder="e.g. Basement parking" value={parkingNotes}
                      onChange={(e) => setParkingNotes(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
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

// ─── Main Page ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "",         label: "All Statuses" },
  { value: "active",   label: "Active"       },
  { value: "inactive", label: "Inactive"     },
]

export default function TheaterList() {
  useEffect(() => { document.title = "NFDC Admin — Theaters" }, [])

  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [statusTarget, setStatusTarget] = useState(null)
  const [createOpen,   setCreateOpen]   = useState(false)

  // filter state
  const [search,        setSearch]       = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [statusFilter,  setStatusFilter]  = useState("")
  const [page,          setPage]          = useState(1)
  const pageSize = 10

  const { data: raw, isLoading } = useQuery({
    queryKey: ["theaters", page, appliedSearch, statusFilter],
    queryFn: () => listAllTheaters({
      page,
      limit:  pageSize,
      search: appliedSearch || undefined,
      status: statusFilter  || undefined,
    }).then(r => r.data.data),
    keepPreviousData: true,
  })

  const theaters = Array.isArray(raw?.data) ? raw.data : []
  const total    = raw?.pagination?.total ?? theaters.length

  const applySearch = () => { setAppliedSearch(search.trim()); setPage(1) }
  const clearSearch = () => { setSearch(""); setAppliedSearch(""); setPage(1) }

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
        const d = row.original.details
        const parts = [d?.city, d?.state].filter(Boolean)
        return parts.length ? parts.join(", ") : (d?.address || "—")
      },
    },
    {
      id: "contact",
      header: "Contact",
      cell: ({ row }) => {
        const d = row.original.details
        return (
          <div className="space-y-0.5">
            {d?.phone && <p className="text-sm">{d.phone}</p>}
            {d?.email && <p className="text-xs text-muted-foreground">{d.email}</p>}
            {!d?.phone && !d?.email && <span className="text-muted-foreground">—</span>}
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
        const theater  = row.original
        const id       = theater.theaterId
        const isActive = theater.lifecycle?.status === "active"
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
                View / Edit
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
    <div className="space-y-5">
      <PageHeader title="Theaters">
        <RoleGuard permissions={PERMISSIONS.CREATE_THEATER}>
          <Button className="bg-nfdc-primary hover:bg-nfdc-primary/90" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Theater
          </Button>
        </RoleGuard>
      </PageHeader>

      {/* Search + status filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search theaters…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applySearch()}
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select
          value={statusFilter || "__all"}
          onValueChange={v => { setStatusFilter(v === "__all" ? "" : v); setPage(1) }}
        >
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value || "__all"} value={o.value || "__all"}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" className="h-9 bg-nfdc-primary hover:bg-nfdc-primary/90" onClick={applySearch}>
          Search
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={theaters}
        isLoading={isLoading}
        emptyMessage="No theaters found"
        pagination={{
          page,
          pageSize,
          total,
          onPageChange:     p  => setPage(p),
          onPageSizeChange: () => {},
        }}
      />

      <CreateTheaterDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog open={!!statusTarget} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change status of &quot;{statusTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will {statusTarget?.isActive ? "deactivate" : "activate"} the theater and may affect all associated bookings.
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
