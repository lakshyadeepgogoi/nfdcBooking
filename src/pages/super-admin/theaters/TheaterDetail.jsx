import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { ArrowLeft, Users, Plus, X, Loader2, Image as ImageIcon, Upload, Trash2, Clock, ChevronDown, ChevronUp, History, User, Download } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import EmptyState from "@/components/common/EmptyState"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import FormInput from "@/components/forms/FormInput"
import {
  getTheaterDetail, listAdmins, getSuperAudiAnalytics,
  updateSuperTheater, updateTheaterStatus, updateTheaterImages,
} from "@/api/superAdmin"
import { updateTnCDraft, publishTnC } from "@/api/theaters"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { formatDateTime, toAPIDate } from "@/utils/formatDate"
import { formatINR } from "@/utils/formatCurrency"
import { downloadCSV } from "@/utils/exportCsv"
import { parseList } from "@/utils/parseList"
import { cn } from "@/lib/utils"

// ─── Shared primitives ────────────────────────────────────────────────────────


// ─── Zod schema ───────────────────────────────────────────────────────────────

const infoSchema = z.object({
  name:    z.string().min(2, "Min 2 characters"),
  address: z.string().optional(),
  city:    z.string().optional(),
  state:   z.string().optional(),
  pincode: z.string().optional(),
  phone:   z.string().optional(),
  email:   z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
  mid:     z.string().optional(),
})

// ─── Tab: Basic Info ───────────────────────────────────────────────────────────

function InfoTab({ theater, theaterId, onSaved }) {
  const details = theater?.details ?? {}

  const form = useForm({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      name:    theater?.name ?? "",
      address: details.address ?? "",
      city:    details.city ?? "",
      state:   details.state ?? "",
      pincode: details.pincode ?? "",
      phone:   details.phone ?? "",
      email:   details.email ?? "",
      mid:     theater?.paymentConfig?.mid ?? "",
    },
  })

  useEffect(() => {
    if (theater) {
      form.reset({
        name:    theater.name ?? "",
        address: details.address ?? "",
        city:    details.city ?? "",
        state:   details.state ?? "",
        pincode: details.pincode ?? "",
        phone:   details.phone ?? "",
        email:   details.email ?? "",
        mid:     theater.paymentConfig?.mid ?? "",
      })
    }
  }, [theater, form])

  const mutation = useMutation({
    mutationFn: (values) => {
      const { name, mid, ...detailFields } = values

      // Strip empty strings so we don't send noise; backend .min(1) requires at least 1 key.
      const details = Object.fromEntries(
        Object.entries(detailFields).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      )

      return updateSuperTheater(theaterId, {
        name,
        ...(Object.keys(details).length ? { details } : {}),
        ...(mid ? { paymentConfig: { mid } } : {}),
      })
    },
    onSuccess: () => { toast.success("Theater updated"); onSaved() },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4 max-w-2xl">
        <FormInput control={form.control} name="name" label="Theater Name" />
        <FormInput control={form.control} name="address" label="Address" placeholder="123 Main Street" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormInput control={form.control} name="city"    label="City" />
          <FormInput control={form.control} name="state"   label="State" />
          <FormInput control={form.control} name="pincode" label="Pincode" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput control={form.control} name="phone" label="Phone" />
          <FormInput control={form.control} name="email" label="Email" type="email" />
        </div>
        <FormInput control={form.control} name="mid" label="Payment MID" placeholder="e.g. NFDC_SIRIFORT_MID" />
        <Button type="submit" disabled={mutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </Form>
  )
}

// ─── Tab: Facilities ──────────────────────────────────────────────────────────

function FacilitiesTab({ theater, theaterId, onSaved }) {
  const details = theater?.details ?? {}

  const [amenities,        setAmenities]        = useState(details.amenities ?? [])
  const [amenityInput,     setAmenityInput]      = useState("")
  const [parkingAvailable, setParkingAvailable]  = useState(details.parking?.available ?? false)
  const [parkingCapacity,  setParkingCapacity]   = useState(String(details.parking?.capacity ?? ""))
  const [parkingNotes,     setParkingNotes]      = useState(details.parking?.notes ?? "")

  useEffect(() => {
    if (theater) {
      setAmenities(details.amenities ?? [])
      setParkingAvailable(details.parking?.available ?? false)
      setParkingCapacity(String(details.parking?.capacity ?? ""))
      setParkingNotes(details.parking?.notes ?? "")
    }
  }, [theater])

  const addAmenity = () => {
    const v = amenityInput.trim()
    if (v && !amenities.includes(v)) { setAmenities(a => [...a, v]); setAmenityInput("") }
  }

  const mutation = useMutation({
    mutationFn: () => updateSuperTheater(theaterId, {
      details: {
        amenities,
        parking: {
          available: parkingAvailable,
          capacity: parkingAvailable && parkingCapacity !== "" ? Number(parkingCapacity) : undefined,
          notes: parkingNotes || undefined,
        },
      },
    }),
    onSuccess: () => { toast.success("Facilities updated"); onSaved() },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Amenities</Label>
        <div className="flex flex-wrap gap-2 min-h-[36px]">
          {amenities.length === 0 && <span className="text-sm text-muted-foreground">No amenities added</span>}
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

      <div className="space-y-4 border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Parking</Label>
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

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}
        className="bg-nfdc-primary hover:bg-nfdc-primary/90">
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Facilities
      </Button>
    </div>
  )
}

// ─── Tab: Images (editable) ────────────────────────────────────────────────────

function ImagesTab({ theater, theaterId, onSaved }) {
  const queryClient = useQueryClient()

  // Existing URLs from the server
  const [keepUrls, setKeepUrls] = useState(theater?.details?.images ?? [])
  // New File objects pending upload
  const [newFiles, setNewFiles]   = useState([])
  // Blob preview URLs for new files (revoked on cleanup)
  const [previews, setPreviews]   = useState([])

  // Sync when theater data changes (e.g. after save)
  useEffect(() => {
    setKeepUrls(theater?.details?.images ?? [])
    setNewFiles([])
    setPreviews(prev => { prev.forEach(URL.revokeObjectURL); return [] })
  }, [theater])

  // Revoke blob URLs on unmount to avoid memory leaks
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [])

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const urls = files.map(f => URL.createObjectURL(f))
    setNewFiles(prev => [...prev, ...files])
    setPreviews(prev => [...prev, ...urls])
    e.target.value = ""               // reset input so same file can be re-selected
  }

  const removeExisting = (url) => setKeepUrls(prev => prev.filter(u => u !== url))

  const removeNew = (index) => {
    URL.revokeObjectURL(previews[index])
    setNewFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const mutation = useMutation({
    mutationFn: () => updateTheaterImages(theaterId, keepUrls, newFiles),
    onSuccess: () => {
      toast.success("Images updated")
      queryClient.invalidateQueries({ queryKey: ["theater-detail", theaterId] })
      onSaved()
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  const totalCount = keepUrls.length + newFiles.length
  const hasChanges = keepUrls.length !== (theater?.details?.images?.length ?? 0) || newFiles.length > 0

  return (
    <div className="space-y-5">
      {/* Existing images */}
      {keepUrls.length === 0 && newFiles.length === 0 && (
        <EmptyState icon={ImageIcon} title="No images" message="Upload images using the button below." />
      )}

      {(keepUrls.length > 0 || newFiles.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {keepUrls.map((src) => (
            <div key={src} className="relative group aspect-video rounded-lg overflow-hidden border bg-muted">
              <img src={src} alt="Theater" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeExisting(src)}
                className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* New file previews */}
          {previews.map((src, i) => (
            <div key={src} className="relative group aspect-video rounded-lg overflow-hidden border-2 border-dashed border-nfdc-accent bg-muted">
              <img src={src} alt="New upload preview" className="w-full h-full object-cover" />
              <div className="absolute top-1.5 left-1.5 bg-nfdc-accent text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                New
              </div>
              <button
                type="button"
                onClick={() => removeNew(i)}
                className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={handleFileChange}
          />
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">
            <Upload className="h-4 w-4" />
            Add Images
          </span>
        </label>

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !hasChanges}
          className="bg-nfdc-primary hover:bg-nfdc-primary/90"
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Images
        </Button>

        {totalCount > 0 && (
          <span className="text-sm text-muted-foreground">{totalCount} image{totalCount !== 1 ? "s" : ""}</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Accepted: JPEG, PNG, WebP · Max 5 MB per file · Up to 10 images
      </p>
    </div>
  )
}

// ─── T&C version history entry ────────────────────────────────────────────────

function TnCHistoryEntry({ entry }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant="outline" className="shrink-0 font-mono">v{entry.version}</Badge>
          <div className="flex flex-col gap-0.5 min-w-0">
            {entry.publishedAt && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                {format(new Date(entry.publishedAt), "dd MMM yyyy, HH:mm")}
              </span>
            )}
            {entry.publishedBy && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <User className="h-3 w-3 shrink-0" />
                {entry.publishedBy}
              </span>
            )}
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>
      {open && entry.body && (
        <>
          <Separator />
          <div
            className="rich-editor-content px-4 py-3 text-xs text-muted-foreground max-h-64 overflow-y-auto bg-muted/20"
            dangerouslySetInnerHTML={{ __html: entry.body }}
          />
        </>
      )}
    </div>
  )
}

// ─── Theater status dot ───────────────────────────────────────────────────────

function StatusDot({ status }) {
  const colors = {
    active: "bg-green-500", confirmed: "bg-green-500",
    inactive: "bg-red-500", cancelled: "bg-red-500",
    pending: "bg-yellow-500",
  }
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 mt-1.5 ${colors[status] ?? "bg-muted-foreground"}`} />
}

// ─── Tab: T&C (editable) ──────────────────────────────────────────────────────

function TnCTab({ theater, theaterId, onSaved }) {
  const tnc     = theater?.details?.tnc ?? {}
  const history = [...(tnc.history ?? [])].reverse()

  const [title,         setTitle]         = useState(tnc.title ?? "")
  const [body,          setBody]           = useState(tnc.body ?? "")
  const [effectiveFrom, setEffectiveFrom]  = useState(tnc.effectiveFrom ? new Date(tnc.effectiveFrom) : null)
  const [publishOpen,   setPublishOpen]    = useState(false)

  useEffect(() => {
    setTitle(tnc.title ?? "")
    setBody(tnc.body ?? "")
    setEffectiveFrom(tnc.effectiveFrom ? new Date(tnc.effectiveFrom) : null)
  }, [theater])

  const draftPayload = {
    ...(title         ? { title }                                   : {}),
    ...(body          ? { body }                                    : {}),
    ...(effectiveFrom ? { effectiveFrom: toAPIDate(effectiveFrom) } : {}),
  }
  const canSaveDraft = Object.keys(draftPayload).length > 0

  const draftMutation = useMutation({
    mutationFn: () => updateTnCDraft(theaterId, draftPayload),
    onSuccess: () => { toast.success("Draft saved"); onSaved() },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  const publishMutation = useMutation({
    mutationFn: () => publishTnC(theaterId),
    onSuccess: () => { toast.success("T&C published"); onSaved(); setPublishOpen(false) },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* ── Editor ── */}
      <div className="xl:col-span-2 space-y-5">
        {/* Status row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">v{tnc.version ?? 1}</Badge>
          <Badge variant={tnc.status === "published" ? "default" : "secondary"} className="capitalize">
            {tnc.status ?? "draft"}
          </Badge>
          {tnc.effectiveFrom && (
            <span className="text-xs text-muted-foreground">
              Effective: {format(new Date(tnc.effectiveFrom), "dd MMM yyyy")}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. NFDC Siri Fort Booking Terms & Conditions" />
        </div>

        {/* Effective From */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Effective From (optional)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full sm:w-56 justify-start text-left font-normal",
                !effectiveFrom && "text-muted-foreground")}>
                {effectiveFrom ? format(effectiveFrom, "dd MMM yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={effectiveFrom}
                onSelect={setEffectiveFrom}
                captionLayout="dropdown"
                fromYear={2020}
                toYear={2035}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Rich text editor */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Content</Label>
          <RichTextEditor
            content={body}
            onChange={setBody}
            placeholder="Write the terms and conditions here…"
            minHeight={320}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button
            variant="outline"
            onClick={() => draftMutation.mutate()}
            disabled={draftMutation.isPending || !canSaveDraft}
            title={!canSaveDraft ? "Add title or content to save a draft" : undefined}
          >
            {draftMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Draft
          </Button>
          <Button
            onClick={() => setPublishOpen(true)}
            disabled={!body}
            title={!body ? "Add content before publishing" : undefined}
            className="bg-nfdc-primary hover:bg-nfdc-primary/90"
          >
            Publish
          </Button>
        </div>
      </div>

      {/* ── Version History ── */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold">Version History</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Previously published versions</p>
        </div>
        {history.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg px-4 py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No published versions yet.</p>
            <p className="text-xs text-muted-foreground mt-1">History appears after publishing.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(entry => (
              <TnCHistoryEntry key={entry.version} entry={entry} />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish T&amp;C?</AlertDialogTitle>
            <AlertDialogDescription>
              This will increment the version to v{(tnc.version ?? 1) + 1} and make it live immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="bg-nfdc-primary hover:bg-nfdc-primary/90"
            >
              {publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Tab: Config ──────────────────────────────────────────────────────────────

function ConfigTab({ theater, theaterId, onSaved }) {
  const [allowUserReschedule, setAllowUserReschedule] = useState(
    theater?.config?.allowUserReschedule ?? false
  )

  useEffect(() => {
    setAllowUserReschedule(theater?.config?.allowUserReschedule ?? false)
  }, [theater])

  const mutation = useMutation({
    mutationFn: (val) => updateSuperTheater(theaterId, { config: { allowUserReschedule: val } }),
    onSuccess: () => { toast.success("Config updated"); onSaved() },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  const handleToggle = (val) => {
    setAllowUserReschedule(val)
    mutation.mutate(val)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-semibold">Booking Configuration</h3>
        <p className="text-sm text-muted-foreground mt-0.5">Control booking behaviour for this theater</p>
      </div>

      <div className="border rounded-lg divide-y">
        <div className="flex items-center justify-between p-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">User-initiated Reschedule</Label>
            <p className="text-xs text-muted-foreground">
              Allow customers to request a reschedule from their booking portal
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={allowUserReschedule}
              onCheckedChange={handleToggle}
              disabled={mutation.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function TheaterDetail() {
  const { theaterId } = useParams()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()

  const [audiDate, setAudiDate] = useState(new Date())

  const { data: theaterRaw, isLoading: tLoading } = useQuery({
    queryKey: ["theater-detail", theaterId],
    queryFn: () => getTheaterDetail(theaterId).then(r => r.data.data),
    enabled: !!theaterId,
  })

  const { data: adminsRaw } = useQuery({
    queryKey: ["admins", theaterId],
    queryFn: () => listAdmins(theaterId).then(r => parseList(r.data.data)),
    enabled: !!theaterId,
  })

  const { data: audiRaw, isLoading: audiLoading } = useQuery({
    queryKey: ["super", "audi-analytics", theaterId, toAPIDate(audiDate)],
    queryFn: () =>
      getSuperAudiAnalytics({ theaterId, date: toAPIDate(audiDate) }).then(r => r.data.data),
    enabled: !!theaterId,
  })

  const theater = theaterRaw?.theater ?? theaterRaw
  const admins  = adminsRaw ?? []

  const audiList = Array.isArray(audiRaw) ? audiRaw : []
  const audiChartData = audiList.map((a, i) => ({
    name:      a.audiName ?? a.audiId ?? `Audi ${i + 1}`,
    bookings:  a.stats?.confirmedBookings ?? 0,
    revenue:   a.stats?.totalRevenue      ?? 0,
    occupancy: a.stats?.occupancyRate     ?? 0,
  }))

  const isActive = theater?.lifecycle?.status === "active"

  const statusMutation = useMutation({
    mutationFn: (status) => updateTheaterStatus(theaterId, status),
    onSuccess: () => {
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: ["theater-detail", theaterId] })
      queryClient.invalidateQueries({ queryKey: ["theaters"] })
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  useEffect(() => {
    document.title = theater?.name
      ? `NFDC Admin — ${theater.name}`
      : "NFDC Admin — Theater Detail"
  }, [theater?.name])

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["theater-detail", theaterId] })
    queryClient.invalidateQueries({ queryKey: ["theaters"] })
  }

  const adminColumns = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    { accessorKey: "email", header: "Email" },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => (
        <span className="capitalize text-sm">
          {row.original.profile?.role?.replace(/_/g, " ") ?? "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.lifecycle?.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ getValue }) => getValue() ? formatDateTime(getValue()) : "—",
    },
  ]

  if (tLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={theater?.name ?? "Theater Detail"}
          action={{ label: "Back", icon: ArrowLeft, onClick: () => navigate("/super/theaters") }}
        />
        {/* <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={theater?.lifecycle?.status} />
          <Button
            size="sm"
            variant={isActive ? "destructive" : "default"}
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate(isActive ? "inactive" : "active")}
          >
            {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        </div> */}
      </div>

      {/* Vertical tabs */}
      <Tabs defaultValue="info" orientation="vertical" className="flex flex-col sm:flex-row gap-0">
        <TabsList className="flex sm:flex-col h-auto w-full sm:w-44 shrink-0 bg-muted/50 border rounded-lg sm:rounded-r-none p-1 justify-start">
          <TabsTrigger value="info"       className="w-full justify-start text-left data-[state=active]:shadow-sm">Info</TabsTrigger>
          <TabsTrigger value="facilities" className="w-full justify-start text-left data-[state=active]:shadow-sm">Facilities</TabsTrigger>
          <TabsTrigger value="images"     className="w-full justify-start text-left data-[state=active]:shadow-sm">Images</TabsTrigger>
          <TabsTrigger value="tnc"        className="w-full justify-start text-left data-[state=active]:shadow-sm">T&amp;C</TabsTrigger>
          <TabsTrigger value="config"     className="w-full justify-start text-left data-[state=active]:shadow-sm">Config</TabsTrigger>
        </TabsList>

        <div className="flex-1 border rounded-lg sm:rounded-l-none sm:border-l-0 bg-background">
          <TabsContent value="info" className="m-0 p-6">
            <InfoTab theater={theater} theaterId={theaterId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="facilities" className="m-0 p-6">
            <FacilitiesTab theater={theater} theaterId={theaterId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="images" className="m-0 p-6">
            <h3 className="text-base font-semibold mb-4">Theater Images</h3>
            <ImagesTab theater={theater} theaterId={theaterId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="tnc" className="m-0 p-6">
            <h3 className="text-base font-semibold mb-4">Terms &amp; Conditions</h3>
            <TnCTab theater={theater} theaterId={theaterId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="config" className="m-0 p-6">
            <ConfigTab theater={theater} theaterId={theaterId} onSaved={onSaved} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Assigned Admins */}
      <Card>
        <CardHeader><CardTitle className="text-base">Assigned Admins</CardTitle></CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <EmptyState icon={Users} title="No admins assigned" message="No admins are assigned to this theater." />
          ) : (
            <DataTable columns={adminColumns} data={admins} />
          )}
        </CardContent>
      </Card>

      {/* Audi Performance */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Audi Performance</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Bookings, revenue and occupancy per audi</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"
                className={cn("justify-start text-left font-normal", !audiDate && "text-muted-foreground")}>
                {audiDate ? format(audiDate, "dd MMM yyyy") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={audiDate}
                onSelect={d => d && setAudiDate(d)}
                captionLayout="dropdown"
                fromYear={2020}
                toYear={2035}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {audiLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-[260px] w-full rounded-xl" />
            <Skeleton className="h-[260px] w-full rounded-xl" />
          </div>
        ) : audiChartData.length === 0 ? (
          <EmptyState title="No data for this date" message="Try selecting a different date." />
        ) : (
          <>
            {/* Bookings + Revenue charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Confirmed Bookings by Audi</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={audiChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="bookings" name="Bookings" fill="#1A6FC4" radius={[4, 4, 0, 0]} maxBarSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Revenue by Audi</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={audiChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={v => "₹" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)}
                        tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52}
                      />
                      <Tooltip formatter={v => formatINR(v)} />
                      <Bar dataKey="revenue" name="Revenue" fill="#0B2E5C" radius={[4, 4, 0, 0]} maxBarSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Export */}
            <div className="flex justify-end">
              <Button size="sm" variant="outline"
                onClick={() => downloadCSV(
                  `audi-performance-${toAPIDate(audiDate)}.csv`,
                  ["Audi", "Bookings", "Revenue (₹)", "Occupancy %"],
                  audiChartData.map(a => [a.name, a.bookings, a.revenue, a.occupancy])
                )}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Status History */}
      {theater?.lifecycle?.statusHistory?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <History className="h-4 w-4" /> Status History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...theater.lifecycle.statusHistory].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <StatusDot status={h.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium capitalize">{h.status}</span>
                      {h.note && <span className="text-muted-foreground text-xs">— {h.note}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDateTime(h.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
