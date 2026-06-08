import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Plus, Loader2, X, Search, Building2,
  MapPin, Phone, Mail, Power, Eye, CreditCard,
} from "lucide-react"
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import StatusBadge from "@/components/common/StatusBadge"
import FormInput from "@/components/forms/FormInput"
import { listAllTheaters, createTheater, updateTheaterStatus } from "@/api/superAdmin"
import { cn } from "@/lib/utils"

// ─── Schema ────────────────────────────────────────────────────────────────────

const createTheaterSchema = z.object({
  name:    z.string().min(2, "Min 2 characters").max(200),
  address: z.string().optional(),
  city:    z.string().optional(),
  state:   z.string().optional(),
  pincode: z.string().optional(),
  phone:   z.string().optional(),
  email:   z.union([z.string().email({ message: "Enter a valid email" }), z.literal("")]).optional(),
  mid:     z.string().optional(),
})

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">{label}</p>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

// ─── Create Dialog ─────────────────────────────────────────────────────────────

function CreateTheaterDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient()
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
      setAmenities([]); setAmenityInput(""); setParkingAvailable(false)
      setParkingCapacity(""); setParkingNotes("")
    }
  }, [open, form])

  const addAmenity = () => {
    const v = amenityInput.trim()
    if (v && !amenities.includes(v)) { setAmenities(a => [...a, v]); setAmenityInput("") }
  }

  const mutation = useMutation({
    mutationFn: (values) => {
      const { name, mid, ...detailFields } = values
      const details = Object.fromEntries(Object.entries(detailFields).filter(([, v]) => v !== ""))
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
      toast.success("Theater created")
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
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-6 py-2">
            <SectionHeader label="Identity" />
            <FormInput control={form.control} name="name" label="Theater Name" placeholder="NFDC Cinema, Mumbai" />

            <SectionHeader label="Location" />
            <FormInput control={form.control} name="address" label="Address" placeholder="123 Main Street" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormInput control={form.control} name="city"    label="City"    placeholder="Mumbai" />
              <FormInput control={form.control} name="state"   label="State"   placeholder="Maharashtra" />
              <FormInput control={form.control} name="pincode" label="Pincode" placeholder="400001" />
            </div>

            <SectionHeader label="Contact" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormInput control={form.control} name="phone" label="Phone" placeholder="+91 22 1234 5678" />
              <FormInput control={form.control} name="email" label="Email" type="email" placeholder="contact@theater.in" />
            </div>

            <SectionHeader label="Payment" />
            <FormInput control={form.control} name="mid" label="Payment MID (optional)" placeholder="e.g. NFDC_SIRIFORT_MID" />

            <SectionHeader label="Amenities" />
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2 min-h-[36px] p-3 rounded-lg border bg-muted/20">
                {amenities.length === 0
                  ? <span className="text-sm text-muted-foreground">None added</span>
                  : amenities.map(a => (
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
                <Input placeholder="Add amenity (e.g. 4K Projection)" value={amenityInput}
                  onChange={e => setAmenityInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAmenity() } }}
                  className="max-w-xs" />
                <Button type="button" variant="outline" size="sm" onClick={addAmenity}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>

            <SectionHeader label="Parking" />
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Parking Available</p>
                  <p className="text-xs text-muted-foreground">Toggle if this theater has on-site parking</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{parkingAvailable ? "Yes" : "No"}</span>
                  <Switch checked={parkingAvailable} onCheckedChange={setParkingAvailable} />
                </div>
              </div>
              {parkingAvailable && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Capacity (optional)</Label>
                    <Input type="number" placeholder="e.g. 120" value={parkingCapacity}
                      onChange={e => setParkingCapacity(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                    <Input placeholder="e.g. Basement, Level B2" value={parkingNotes}
                      onChange={e => setParkingNotes(e.target.value)} />
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

// ─── Theater Card ──────────────────────────────────────────────────────────────

function TheaterCard({ theater, onView, onToggle }) {
  const id       = theater.theaterId
  const isActive = theater.lifecycle?.status === "active"
  const d        = theater.details ?? {}
  const city     = [d.city, d.state].filter(Boolean).join(", ")
  const hasMid   = !!theater.paymentConfig?.mid

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col bg-background cursor-pointer group",
      !isActive && "opacity-70"
    )} onClick={() => onView(id)}>

      {/* Header */}
      <div className={cn(
        "px-5 py-4 flex items-start justify-between gap-3",
        isActive ? "bg-nfdc-primary/5" : "bg-muted/30"
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            isActive ? "bg-nfdc-primary/15" : "bg-muted"
          )}>
            <Building2 className={cn("h-5 w-5", isActive ? "text-nfdc-primary" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate group-hover:text-nfdc-primary transition-colors">
              {theater.name}
            </p>
            {city && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-2.5 w-2.5 shrink-0" />{city}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={theater.lifecycle?.status} />
      </div>

      {/* Body */}
      <div className="px-5 py-3 flex-1 space-y-2">
        {d.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{d.phone}</span>
          </div>
        )}
        {d.email && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{d.email}</span>
          </div>
        )}
        {d.address && !d.phone && !d.email && (
          <p className="text-xs text-muted-foreground truncate">{d.address}</p>
        )}
        {!d.phone && !d.email && !d.address && (
          <p className="text-xs text-muted-foreground italic">No contact details</p>
        )}

        {/* Indicators */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {hasMid && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5 font-medium">
              <CreditCard className="h-2.5 w-2.5" /> Payment configured
            </span>
          )}
          {!hasMid && (
            <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 font-medium">
              <CreditCard className="h-2.5 w-2.5" /> No payment MID
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2.5 flex items-center gap-2 bg-muted/10"
        onClick={e => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs gap-1"
          onClick={() => onView(id)}>
          <Eye className="h-3.5 w-3.5" /> View & Edit
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <Button size="sm" variant="ghost"
          className={cn(
            "flex-1 h-7 text-xs gap-1",
            isActive
              ? "text-destructive/60 hover:text-destructive hover:bg-destructive/5"
              : "text-green-600/60 hover:text-green-700 hover:bg-green-50"
          )}
          onClick={() => onToggle(theater)}>
          <Power className="h-3.5 w-3.5" />
          {isActive ? "Deactivate" : "Activate"}
        </Button>
      </div>
    </div>
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
  const [search,        setSearch]       = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [statusFilter,  setStatusFilter]  = useState("")
  const [stateFilter,   setStateFilter]   = useState("")
  const [page,          setPage]          = useState(1)
  const pageSize = 12

  const { data: raw, isLoading } = useQuery({
    queryKey: ["theaters", page, appliedSearch, statusFilter, stateFilter],
    queryFn: () => listAllTheaters({ page, limit: pageSize, search: appliedSearch || undefined, status: statusFilter || undefined, state: stateFilter || undefined }).then(r => r.data.data),
    keepPreviousData: true,
  })

  const theaters        = Array.isArray(raw?.data) ? raw.data : []
  const total           = raw?.pagination?.total ?? theaters.length
  const availableStates = Array.isArray(raw?.availableStates) ? raw.availableStates : []

  const applySearch = () => { setAppliedSearch(search.trim()); setPage(1) }
  const clearSearch = () => { setSearch(""); setAppliedSearch(""); setPage(1) }

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateTheaterStatus(id, status),
    onSuccess: () => {
      toast.success("Theater status updated")
      queryClient.invalidateQueries({ queryKey: ["theaters"] })
      setStatusTarget(null)
    },
    onError: () => toast.error("Something went wrong."),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Theaters">
        <RoleGuard permissions={PERMISSIONS.CREATE_THEATER}>
          <Button className="bg-nfdc-primary hover:bg-nfdc-primary/90" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Theater
          </Button>
        </RoleGuard>
      </PageHeader>

      {/* Total count chip */}
      {total > 0 && !isLoading && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {total} theater{total !== 1 ? "s" : ""}
            {statusFilter ? ` · ${statusFilter}` : ""}
            {stateFilter  ? ` · ${stateFilter}`  : ""}
            {appliedSearch ? ` matching "${appliedSearch}"` : ""}
          </span>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search theaters…" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applySearch()}
            className="pl-8 h-9 text-sm" />
          {search && (
            <button onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={statusFilter || "__all"} onValueChange={v => { setStatusFilter(v === "__all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value || "__all"} value={o.value || "__all"}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stateFilter || "__all"} onValueChange={v => { setStateFilter(v === "__all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="__all">All States</SelectItem>
            {availableStates.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9 bg-nfdc-primary hover:bg-nfdc-primary/90" onClick={applySearch}>
          Search
        </Button>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-52 rounded-2xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : theaters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
            <Building2 className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-semibold">No theaters found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {appliedSearch || statusFilter ? "Try clearing your filters" : "Create your first theater to get started"}
            </p>
          </div>
          {!appliedSearch && !statusFilter && (
            <Button className="bg-nfdc-primary hover:bg-nfdc-primary/90" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Theater
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            data-tour="theaters-list">
            {theaters.map(t => (
              <TheaterCard
                key={t.theaterId}
                theater={t}
                onView={id => navigate(`/super/theaters/${id}`)}
                onToggle={theater => setStatusTarget({ id: theater.theaterId, name: theater.name, isActive: theater.lifecycle?.status === "active" })}
              />
            ))}
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <span className="text-xs text-muted-foreground">{page} / {Math.ceil(total / pageSize)}</span>
                <Button size="sm" variant="outline" disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      <CreateTheaterDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog open={!!statusTarget} onOpenChange={o => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.isActive ? "Deactivate" : "Activate"} &quot;{statusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will {statusTarget?.isActive ? "deactivate" : "activate"} the theater
              {statusTarget?.isActive ? " and may affect all associated bookings." : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = statusTarget; setStatusTarget(null)
                statusMutation.mutate({ id: t.id, status: t.isActive ? "inactive" : "active" })
              }}
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
