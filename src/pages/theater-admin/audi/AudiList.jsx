import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Plus, Pencil, Power, CalendarDays, Clock, AlertTriangle,
  Building2, Users, Settings2, ChevronRight, CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import { parseList } from "@/utils/parseList"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import PageHeader from "@/components/common/PageHeader"
import StatusBadge from "@/components/common/StatusBadge"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import { useAuth } from "@/hooks/useAuth"
import { listAdminAudis, updateAudiStatus } from "@/api/audi"
import { fmt12 } from "@/utils/formatDate"
import { cn } from "@/lib/utils"

// ─── Audi Card ────────────────────────────────────────────────────────────────

function AudiCard({ audi, onDeactivate, onNavigate }) {
  const id        = audi.audiId ?? audi.id ?? audi._id
  const isActive  = audi.lifecycle?.status === "active"
  const mode      = audi.config?.slotMode
  const opStart   = audi.config?.operationalHours?.start
  const opEnd     = audi.config?.operationalHours?.end
  const capacity  = audi.config?.capacity
  const buffer    = audi.config?.bufferTime

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col bg-background",
      !isActive && "opacity-80"
    )} onClick={() => onNavigate(id)}>

      {/* Coloured header */}
      <div className={cn(
        "px-5 py-4 flex items-center justify-between gap-3",
        isActive ? "bg-nfdc-primary/8" : "bg-amber-50/60"
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
            isActive ? "bg-nfdc-primary/15" : "bg-amber-100"
          )}>
            <Building2 className={cn("h-5 w-5", isActive ? "text-nfdc-primary" : "text-amber-600")} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate leading-tight">{audi.name}</p>
            {mode && (
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium mt-0.5",
                isActive ? "text-nfdc-primary/70" : "text-amber-600/70"
              )}>
                {mode === "fixed"
                  ? <><CalendarDays className="h-2.5 w-2.5" />Fixed slots</>
                  : <><Clock className="h-2.5 w-2.5" />Flexible hours</>
                }
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={audi.lifecycle?.status} />
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex-1 space-y-3">
        <div className="grid grid-cols-1 gap-2">
          {capacity && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Capacity
              </span>
              <span className="font-semibold">{capacity} seats</span>
            </div>
          )}
          {(opStart || opEnd) && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Hours
              </span>
              <span className="font-semibold tabular-nums">{fmt12(opStart)} – {fmt12(opEnd)}</span>
            </div>
          )}
          {buffer > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Settings2 className="h-3 w-3" /> Buffer
              </span>
              <span className="font-semibold">{buffer} min</span>
            </div>
          )}
          {!capacity && !opStart && !opEnd && !buffer && (
            <p className="text-xs text-muted-foreground italic">No details configured</p>
          )}
        </div>

        {!isActive && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Complete setup checklist to activate
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t px-4 py-3 flex items-center gap-2 bg-muted/10"
        onClick={e => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs"
          onClick={() => onNavigate(id)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          {isActive ? "Edit" : "Setup"}
        </Button>
        <Separator orientation="vertical" className="h-5" />
        {isActive ? (
          <Button size="sm" variant="ghost"
            className="flex-1 h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/5"
            onClick={() => onDeactivate(audi)}>
            <Power className="mr-1.5 h-3.5 w-3.5" /> Deactivate
          </Button>
        ) : (
          <Button size="sm" variant="ghost"
            className="flex-1 h-8 text-xs text-nfdc-primary hover:text-nfdc-primary hover:bg-nfdc-primary/5"
            onClick={() => onNavigate(id)}>
            <ChevronRight className="mr-1.5 h-3.5 w-3.5" /> View Setup
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AudiList() {
  useEffect(() => { document.title = "NFDC Admin — Audis" }, [])

  const navigate    = useNavigate()
  const { user }    = useAuth()
  const theaterId   = user?.theaterId
  const queryClient = useQueryClient()

  const [statusTarget, setStatusTarget] = useState(null)
  const [filter,       setFilter]       = useState("all") // all | active | inactive

  const { data: raw, isLoading } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn:  () => listAdminAudis(theaterId).then(r => r.data.data),
    enabled:  !!theaterId,
  })

  const allAudis  = Array.isArray(raw?.data) ? raw.data : parseList(raw)
  const active    = allAudis.filter(a => a.lifecycle?.status === "active")
  const inactive  = allAudis.filter(a => a.lifecycle?.status !== "active")
  const displayed = filter === "active" ? active : filter === "inactive" ? inactive : allAudis

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateAudiStatus(id, status),
    onSuccess: () => {
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: ["audis"] })
      setStatusTarget(null)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong."),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audis"
        action={{ label: "Add Audi", icon: Plus, onClick: () => navigate("/admin/audis/create") }}
      />

      {/* Summary stats */}
      {allAudis.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total",    count: allAudis.length, color: "bg-muted",        key: "all"      },
            { label: "Active",   count: active.length,   color: "bg-green-500",    key: "active"   },
            { label: "Inactive", count: inactive.length, color: "bg-amber-400",    key: "inactive" },
          ].map(s => (
            <button key={s.key} type="button"
              onClick={() => setFilter(f => f === s.key ? "all" : s.key)}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-background px-4 py-3 text-left shadow-sm transition-all hover:shadow-md",
                filter === s.key && "ring-2 ring-nfdc-primary/30 border-nfdc-primary/40"
              )}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", s.color)} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold leading-none">{s.count}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Inactive reminder */}
      {inactive.length > 0 && filter !== "active" && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">
              {inactive.length} audi{inactive.length > 1 ? "s are" : " is"} inactive
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Complete the setup checklist and activate{" "}
              {inactive.map((a, i) => {
                const id = a.audiId ?? a.id ?? a._id
                return (
                  <span key={id}>
                    {i > 0 && ", "}
                    <button type="button" onClick={() => navigate(`/admin/audis/${id}`)}
                      className="font-medium underline underline-offset-2 hover:text-amber-900">
                      {a.name}
                    </button>
                  </span>
                )
              })}{" "}
              to accept bookings.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {allAudis.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
            <Building2 className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-semibold">No audis yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first audi to start accepting bookings</p>
          </div>
          <Button className="bg-nfdc-primary hover:bg-nfdc-primary/90"
            onClick={() => navigate("/admin/audis/create")}>
            <Plus className="mr-2 h-4 w-4" /> Add Audi
          </Button>
        </div>
      )}

      {/* No filter results */}
      {allAudis.length > 0 && displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-400 mb-2" />
          <p className="text-sm font-medium">All audis are active</p>
          <button type="button" onClick={() => setFilter("all")}
            className="text-xs text-nfdc-primary hover:underline mt-1">
            Show all audis
          </button>
        </div>
      )}

      {/* Audi cards grid */}
      {displayed.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map(audi => (
            <AudiCard
              key={audi.audiId ?? audi.id ?? audi._id}
              audi={audi}
              onNavigate={id => navigate(`/admin/audis/${id}`)}
              onDeactivate={a => setStatusTarget({ id: a.audiId ?? a.id ?? a._id, name: a.name, isActive: true })}
              onActivate={a => setStatusTarget({ id: a.audiId ?? a.id ?? a._id, name: a.name, isActive: false })}
            />
          ))}
        </div>
      )}

      {/* Status confirm */}
      <AlertDialog open={!!statusTarget} onOpenChange={o => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.isActive ? "Deactivate" : "Activate"} &quot;{statusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.isActive
                ? "Deactivating this audi may affect associated slots and bookings."
                : "This audi will be available for bookings again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = statusTarget
                setStatusTarget(null)
                statusMutation.mutate({
                  id: pending.id,
                  status: pending.isActive ? "inactive" : "active",
                })
              }}
              className={statusTarget?.isActive ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {statusMutation.isPending && <span className="mr-2 h-4 w-4 animate-spin">⏳</span>}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
