import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Loader2, Plus, X, Upload, Image as ImageIcon,
  Clock, User, ChevronDown, ChevronUp,
  Settings2, Star, FileText, MapPin, Phone, Mail,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Form } from "@/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import PageHeader from "@/components/common/PageHeader"
import StatusBadge from "@/components/common/StatusBadge"
import FormInput from "@/components/forms/FormInput"
import EmptyState from "@/components/common/EmptyState"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import { useAuth } from "@/hooks/useAuth"
import {
  getTheaterProfile, updateTheaterInfo, uploadTheaterImages,
  updateTnCDraft, publishTnC,
} from "@/api/theaters"
import { toAPIDate } from "@/utils/formatDate"
import { cn } from "@/lib/utils"

// ─── Zod schema ───────────────────────────────────────────────────────────────

const infoSchema = z.object({
  name:    z.string().min(2, "Min 2 characters"),
  address: z.string().optional(),
  city:    z.string().optional(),
  state:   z.string().optional(),
  pincode: z.string().optional(),
  phone:   z.string().optional(),
  email:   z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
})

// ─── Shared helpers ────────────────────────────────────────────────────────────

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">{label}</p>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

// ─── Tab: Info ────────────────────────────────────────────────────────────────

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
    },
  })

  useEffect(() => {
    if (theater) form.reset({
      name:    theater.name ?? "",
      address: details.address ?? "",
      city:    details.city ?? "",
      state:   details.state ?? "",
      pincode: details.pincode ?? "",
      phone:   details.phone ?? "",
      email:   details.email ?? "",
    })
  }, [theater, form])

  const mutation = useMutation({
    mutationFn: (values) => {
      const { name, ...detailFields } = values
      const cleanDetails = Object.fromEntries(
        Object.entries(detailFields).filter(([, v]) => v !== "" && v != null)
      )
      return updateTheaterInfo(theaterId, {
        name,
        ...(Object.keys(cleanDetails).length ? { details: cleanDetails } : {}),
      })
    },
    onSuccess: () => { toast.success("Theater info updated"); onSaved() },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6 max-w-2xl">
        <SectionHeader label="Identity" />
        <FormInput control={form.control} name="name" label="Theater Name" />

        <SectionHeader label="Location" />
        <FormInput control={form.control} name="address" label="Address" placeholder="123 Main Street" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormInput control={form.control} name="city"    label="City" />
          <FormInput control={form.control} name="state"   label="State" />
          <FormInput control={form.control} name="pincode" label="Pincode" />
        </div>

        <SectionHeader label="Contact" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput control={form.control} name="phone" label="Phone" />
          <FormInput control={form.control} name="email" label="Email" type="email" />
        </div>

        <div className="pt-2">
          <Button type="submit" disabled={mutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ─── Tab: Facilities ──────────────────────────────────────────────────────────

function FacilitiesTab({ theater, theaterId, onSaved }) {
  const details = theater?.details ?? {}

  const [amenities,        setAmenities]       = useState(details.amenities ?? [])
  const [amenityInput,     setAmenityInput]     = useState("")
  const [parkingAvailable, setParkingAvailable] = useState(details.parking?.available ?? false)
  const [parkingCapacity,  setParkingCapacity]  = useState(String(details.parking?.capacity ?? ""))
  const [parkingNotes,     setParkingNotes]     = useState(details.parking?.notes ?? "")

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
    mutationFn: () => updateTheaterInfo(theaterId, {
      details: {
        amenities,
        parking: {
          available: parkingAvailable,
          capacity:  parkingAvailable && parkingCapacity !== "" ? Number(parkingCapacity) : undefined,
          notes:     parkingNotes || undefined,
        },
      },
    }),
    onSuccess: () => { toast.success("Facilities updated"); onSaved() },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader label="Amenities" />
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg border bg-muted/20">
          {amenities.length === 0
            ? <span className="text-sm text-muted-foreground">No amenities added yet</span>
            : amenities.map((a) => (
              <Badge key={a} variant="secondary" className="gap-1 pr-1">
                {a}
                <button type="button" onClick={() => setAmenities(x => x.filter(i => i !== a))}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          }
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add amenity (e.g. 4K Projection, AC)"
            value={amenityInput}
            onChange={(e) => setAmenityInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAmenity() } }}
            className="max-w-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={addAmenity}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      <SectionHeader label="Parking" />
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Parking Available</p>
              <p className="text-xs text-muted-foreground">Toggle to indicate parking at your venue</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{parkingAvailable ? "Yes" : "No"}</span>
              <Switch checked={parkingAvailable} onCheckedChange={setParkingAvailable} />
            </div>
          </div>
          {parkingAvailable && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Capacity (optional)</Label>
                <Input type="number" placeholder="e.g. 120 vehicles" value={parkingCapacity}
                  onChange={(e) => setParkingCapacity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                <Input placeholder="e.g. Basement, Level B2" value={parkingNotes}
                  onChange={(e) => setParkingNotes(e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pt-2">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="bg-nfdc-primary hover:bg-nfdc-primary/90">
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Facilities
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Images ──────────────────────────────────────────────────────────────

function ImagesTab({ theater, theaterId, onSaved }) {
  const queryClient = useQueryClient()

  const [keepUrls, setKeepUrls] = useState(theater?.details?.images ?? [])
  const [newFiles,  setNewFiles]  = useState([])
  const [previews,  setPreviews]  = useState([])

  useEffect(() => {
    setKeepUrls(theater?.details?.images ?? [])
    setNewFiles([])
    setPreviews(prev => { prev.forEach(URL.revokeObjectURL); return [] })
  }, [theater])

  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [])

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const urls = files.map(f => URL.createObjectURL(f))
    setNewFiles(prev => [...prev, ...files])
    setPreviews(prev => [...prev, ...urls])
    e.target.value = ""
  }

  const removeNew = (i) => {
    URL.revokeObjectURL(previews[i])
    setNewFiles(prev => prev.filter((_, x) => x !== i))
    setPreviews(prev => prev.filter((_, x) => x !== i))
  }

  const mutation = useMutation({
    mutationFn: () => uploadTheaterImages(theaterId, keepUrls, newFiles),
    onSuccess: () => {
      toast.success("Images updated")
      queryClient.invalidateQueries({ queryKey: ["theater", theaterId] })
      onSaved()
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  const hasChanges = keepUrls.length !== (theater?.details?.images?.length ?? 0) || newFiles.length > 0
  const totalCount = keepUrls.length + newFiles.length

  return (
    <div className="space-y-5">
      {totalCount === 0 && (
        <EmptyState icon={ImageIcon} title="No images" message="Upload images using the button below." />
      )}

      {totalCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {keepUrls.map((src) => (
            <div key={src} className="relative group aspect-video rounded-lg overflow-hidden border bg-muted">
              <img src={src} alt="Theater" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setKeepUrls(prev => prev.filter(u => u !== src))}
                className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {previews.map((src, i) => (
            <div key={src} className="relative group aspect-video rounded-lg overflow-hidden border-2 border-dashed border-nfdc-accent bg-muted">
              <img src={src} alt="New" className="w-full h-full object-cover" />
              <div className="absolute top-1.5 left-1.5 bg-nfdc-accent text-white text-[10px] px-1.5 py-0.5 rounded font-medium">New</div>
              <button type="button" onClick={() => removeNew(i)}
                className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer">
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={handleFileChange} />
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium shadow-sm hover:bg-accent transition-colors">
            <Upload className="h-4 w-4" /> Add Images
          </span>
        </label>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !hasChanges}
          className="bg-nfdc-primary hover:bg-nfdc-primary/90">
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Images
        </Button>
        {totalCount > 0 && (
          <span className="text-sm text-muted-foreground">{totalCount} image{totalCount !== 1 ? "s" : ""}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Accepted: JPEG, PNG, WebP · Max 5 MB · Up to 10 images</p>
    </div>
  )
}

// ─── T&C history entry ────────────────────────────────────────────────────────

function HistoryEntry({ entry }) {
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

// ─── Tab: T&C ─────────────────────────────────────────────────────────────────

function TnCTab({ theater, theaterId, onSaved }) {
  const tnc     = theater?.details?.tnc ?? {}
  const history = [...(tnc.history ?? [])].reverse()

  const [title,         setTitle]        = useState(tnc.title ?? "")
  const [body,          setBody]          = useState(tnc.body ?? "")
  const [effectiveFrom, setEffectiveFrom] = useState(tnc.effectiveFrom ? new Date(tnc.effectiveFrom) : null)
  const [publishOpen,   setPublishOpen]   = useState(false)

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
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/30 border">
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
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Booking Terms &amp; Conditions"
          />
        </div>

        {/* Effective From */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Effective From (optional)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full sm:w-56 justify-start text-left font-normal", !effectiveFrom && "text-muted-foreground")}
              >
                {effectiveFrom ? format(effectiveFrom, "dd MMM yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Calendar
                mode="single"
                selected={effectiveFrom}
                onSelect={setEffectiveFrom}
                className="w-full [--cell-size:2.25rem]"
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
            title={!canSaveDraft ? "Add title or content to save" : undefined}
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
            {history.map((entry) => (
              <HistoryEntry key={entry.version} entry={entry} />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish T&amp;C?</AlertDialogTitle>
            <AlertDialogDescription>
              This will increment to v{(tnc.version ?? 1) + 1} and make it live immediately.
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TheaterSettings() {
  useEffect(() => { document.title = "NFDC Admin — Theater Settings" }, [])

  const { user }    = useAuth()
  const theaterId   = user?.theaterId
  const queryClient = useQueryClient()

  const { data: theaterRaw, isLoading } = useQuery({
    queryKey: ["theater", theaterId],
    queryFn:  () => getTheaterProfile(theaterId).then((r) => r.data.data),
    enabled:  !!theaterId,
  })

  const theater = theaterRaw?.theater ?? theaterRaw
  const details = theater?.details ?? {}

  const onSaved = () => queryClient.invalidateQueries({ queryKey: ["theater", theaterId] })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <PageHeader title="Theater Settings" />

        {/* Quick info chips */}
        {theater && (
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={theater?.lifecycle?.status} />
            {details.city && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-3 py-1.5 bg-background shadow-sm">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{[details.city, details.state].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {details.phone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-3 py-1.5 bg-background shadow-sm">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{details.phone}</span>
              </div>
            )}
            {details.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-3 py-1.5 bg-background shadow-sm">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[180px]">{details.email}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="flex flex-col">
        {/* Underline tab bar */}
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="flex h-auto gap-0 rounded-none bg-transparent p-0">
            {[
              { value: "info",       label: "Info",        Icon: Settings2  },
              { value: "facilities", label: "Facilities",  Icon: Star       },
              { value: "images",     label: "Images",      Icon: ImageIcon  },
              { value: "tnc",        label: "T&C",         Icon: FileText   },
            ].map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent -mb-px bg-transparent px-5 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-nfdc-primary data-[state=active]:bg-transparent data-[state=active]:text-nfdc-primary data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="info" className="mt-0">
            <InfoTab theater={theater} theaterId={theaterId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="facilities" className="mt-0">
            <FacilitiesTab theater={theater} theaterId={theaterId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="images" className="mt-0">
            <ImagesTab theater={theater} theaterId={theaterId} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="tnc" className="mt-0">
            <TnCTab theater={theater} theaterId={theaterId} onSaved={onSaved} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
