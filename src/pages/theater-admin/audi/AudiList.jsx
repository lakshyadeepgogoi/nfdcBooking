import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, MoreHorizontal, Pencil, Power, CalendarDays, Clock, AlertTriangle, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { parseList } from "@/utils/parseList"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import { useAuth } from "@/hooks/useAuth"
import { listAdminAudis, updateAudiStatus } from "@/api/audi"
import { Building2 } from "lucide-react"

export default function AudiList() {
  useEffect(() => { document.title = "NFDC Admin — Audis" }, [])

  const navigate    = useNavigate()
  const { user }    = useAuth()
  const theaterId   = user?.theaterId
  const queryClient = useQueryClient()
  const [statusTarget, setStatusTarget] = useState(null)

  const { data: raw, isLoading } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAdminAudis(theaterId).then(r => r.data.data),
    enabled: !!theaterId,
  })

  // Response: { data: [...], pagination: {...} }
  const audis = Array.isArray(raw?.data) ? raw.data : parseList(raw)

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateAudiStatus(id, status),
    onSuccess: () => {
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: ["audis"] })
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
      id: "mode",
      header: "Mode",
      cell: ({ row }) => {
        // mode lives at config.slotMode, not top-level
        const mode = row.original.config?.slotMode
        return mode === "fixed" ? (
          <Badge variant="outline" className="gap-1">
            <CalendarDays className="h-3 w-3" /> Fixed
          </Badge>
        ) : mode === "flexible" ? (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> Flexible
          </Badge>
        ) : "—"
      },
    },
    {
      id: "capacity",
      header: () => <span className="block text-right">Capacity</span>,
      cell: ({ row }) => (
        <span className="block text-right">
          {row.original.config?.capacity ?? "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const audi     = row.original
        const id       = audi.audiId ?? audi.id ?? audi._id
        const isActive = audi.lifecycle?.status === "active"
        return (
          <div className="flex items-center gap-2">
            <StatusBadge status={audi.lifecycle?.status} />
            {!isActive && (
              <button
                type="button"
                onClick={() => navigate(`/admin/audis/${id}`)}
                className="flex items-center gap-0.5 text-[11px] text-amber-600 hover:text-amber-700 hover:underline font-medium"
              >
                Setup <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const audi     = row.original
        const id       = audi.audiId ?? audi.id ?? audi._id
        const isActive = audi.lifecycle?.status === "active"
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/admin/audis/${id}`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setStatusTarget({ id, name: audi.name, isActive })}
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
      <PageHeader
        title="Audis"
        action={{ label: "Add Audi", icon: Plus, onClick: () => navigate("/admin/audis/create") }}
      />

      {/* Reminder banner for inactive audis */}
      {(() => {
        const inactive = audis.filter(a => a.lifecycle?.status !== "active")
        if (!inactive.length || isLoading) return null
        return (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-medium text-amber-800">
                {inactive.length} audi{inactive.length > 1 ? "s are" : " is"} inactive
              </p>
              <p className="text-xs text-amber-700">
                Complete the setup checklist and activate{" "}
                {inactive.map((a, i) => {
                  const id = a.audiId ?? a.id ?? a._id
                  return (
                    <span key={id}>
                      {i > 0 && ", "}
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/audis/${id}`)}
                        className="font-medium underline underline-offset-2 hover:text-amber-900"
                      >
                        {a.name}
                      </button>
                    </span>
                  )
                })}{" "}
                to accept bookings.
              </p>
            </div>
          </div>
        )
      })()}

      <DataTable
        columns={columns}
        data={audis}
        isLoading={isLoading}
        emptyMessage="No audis yet"
        emptyIcon={Building2}
      />

      <AlertDialog open={!!statusTarget} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.isActive ? "Deactivate" : "Activate"} &quot;{statusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.isActive
                ? "Deactivating this audi may affect associated slots and bookings."
                : "Activate this audi?"}
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
