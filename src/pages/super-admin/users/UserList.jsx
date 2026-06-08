import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Search, X, Mail, Phone, CalendarDays, ShieldCheck, User,
  MoreHorizontal, Ban, CheckCircle2, Loader2,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import { listUsers, updateUserStatus } from "@/api/superAdmin"
import { formatDate, formatDateTime } from "@/utils/formatDate"
import { cn } from "@/lib/utils"

const DEFAULT = { search: "", status: "", authProvider: "", page: 1, limit: 10 }

const STATUS_OPTIONS = [
  { value: "",         label: "All Statuses" },
  { value: "active",   label: "Active"       },
  { value: "inactive", label: "Inactive"     },
]

const PROVIDER_OPTIONS = [
  { value: "",       label: "All Sign-in Methods" },
  { value: "email",  label: "Email & Password"    },
  { value: "google", label: "Google"              },
]

function getInitials(name) {
  if (!name) return "?"
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

function ProviderBadge({ provider }) {
  const isGoogle = provider === "google"
  return (
    <Badge variant="outline" className={cn("text-xs font-normal capitalize", isGoogle
      ? "border-blue-300 text-blue-700 bg-blue-50"
      : "border-slate-300 text-slate-700 bg-slate-50"
    )}>
      {isGoogle ? "Google" : "Email & Password"}
    </Badge>
  )
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </div>
      <div className="text-sm font-medium text-right truncate">{value}</div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
}

export default function UserList() {
  useEffect(() => { document.title = "NFDC Admin — Users" }, [])

  const queryClient = useQueryClient()

  const [draft,          setDraft]          = useState(DEFAULT)
  const [applied,        setApplied]        = useState(DEFAULT)
  const [detailTarget,   setDetailTarget]   = useState(null)
  const [statusTarget,   setStatusTarget]   = useState(null) // { userId, name, isActive }

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateUserStatus(id, status),
    onSuccess: (_res, { status }) => {
      toast.success(status === "inactive" ? "User blocked — they can no longer log in" : "User unblocked")
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setStatusTarget(null)
      setDetailTarget(null)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Something went wrong. Please try again."),
  })

  const { data: raw, isLoading } = useQuery({
    queryKey: ["users", applied],
    queryFn: () => listUsers({
      page:         applied.page,
      limit:        applied.limit,
      search:       applied.search       || undefined,
      status:       applied.status       || undefined,
      authProvider: applied.authProvider || undefined,
    }).then(r => r.data.data),
    keepPreviousData: true,
  })

  const users      = Array.isArray(raw?.data) ? raw.data : []
  const pagination = raw?.pagination ?? {}
  const total      = pagination.total ?? users.length

  const applyFilters = () => setApplied({ ...draft, page: 1 })
  const clearSearch  = () => { setDraft(d => ({ ...d, search: "" })); setApplied(a => ({ ...a, search: "", page: 1 })) }

  const columns = [
    {
      id: "user",
      header: "User",
      cell: ({ row }) => {
        const u = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-nfdc-primary/10 text-nfdc-primary font-semibold text-xs">
                {getInitials(u.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{u.name}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            </div>
          </div>
        )
      },
    },
    {
      id: "phone",
      header: "Phone",
      cell: ({ row }) => row.original.profile?.phone || <span className="text-muted-foreground">—</span>,
    },
    {
      id: "provider",
      header: "Sign-in Method",
      cell: ({ row }) => <ProviderBadge provider={row.original.profile?.authProvider} />,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.lifecycle?.status} />,
    },
    {
      id: "joined",
      header: "Joined",
      cell: ({ row }) => row.original.createdAt ? formatDate(row.original.createdAt) : "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const u = row.original
        const isActive = u.lifecycle?.status === "active"
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => setDetailTarget(u)}>
                <User className="mr-2 h-4 w-4" />View Details
              </DropdownMenuItem>
              {isActive ? (
                <DropdownMenuItem
                  onClick={() => setStatusTarget({ userId: u.userId, name: u.name, isActive: true })}
                  className="text-destructive focus:text-destructive"
                >
                  <Ban className="mr-2 h-4 w-4" />Block User
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => setStatusTarget({ userId: u.userId, name: u.name, isActive: false })}
                  className="text-green-700 focus:text-green-700"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />Unblock User
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
      <PageHeader title="Users" subtitle="Everyone registered on the platform" />

      {/* Total count chip */}
      {total > 0 && !isLoading && (
        <p className="text-xs text-muted-foreground">
          {total} user{total !== 1 ? "s" : ""}
          {applied.status       ? ` · ${applied.status}` : ""}
          {applied.authProvider ? ` · ${applied.authProvider === "google" ? "Google" : "Email & Password"} sign-in` : ""}
          {applied.search       ? ` matching "${applied.search}"` : ""}
        </p>
      )}

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or phone…"
            value={draft.search}
            onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
            className="pl-8 h-9 text-sm"
          />
          {draft.search && (
            <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select value={draft.status || "__all"} onValueChange={v => setDraft(d => ({ ...d, status: v === "__all" ? "" : v }))}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => <SelectItem key={o.value || "__all"} value={o.value || "__all"}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={draft.authProvider || "__all"} onValueChange={v => setDraft(d => ({ ...d, authProvider: v === "__all" ? "" : v }))}>
          <SelectTrigger className="h-9 w-48 text-sm">
            <SelectValue placeholder="All Sign-in Methods" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map(o => <SelectItem key={o.value || "__all"} value={o.value || "__all"}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button size="sm" className="h-9 bg-nfdc-primary hover:bg-nfdc-primary/90" onClick={applyFilters}>
          Search
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="No users found"
        emptyIcon={User}
        onRowClick={(row) => setDetailTarget(row.original)}
        pagination={{
          page:             applied.page,
          pageSize:         applied.limit,
          total,
          onPageChange:     p  => setApplied(a => ({ ...a, page: p })),
          onPageSizeChange: ps => setApplied(a => ({ ...a, page: 1, limit: ps })),
        }}
      />

      {/* User Detail Sheet */}
      <Sheet open={!!detailTarget} onOpenChange={(o) => !o && setDetailTarget(null)}>
        <SheetContent className="w-full sm:max-w-md p-0 gap-0 flex flex-col">
          {detailTarget && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                <SheetTitle className="text-lg">User Details</SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Identity card */}
                <div className="flex items-center gap-4 rounded-2xl border bg-muted/20 p-4">
                  <Avatar size="lg" className="h-14 w-14 shrink-0">
                    <AvatarFallback className="bg-nfdc-primary/15 text-nfdc-primary font-semibold text-base">
                      {getInitials(detailTarget.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{detailTarget.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{detailTarget.email}</p>
                  </div>
                  <StatusBadge status={detailTarget.lifecycle?.status} />
                </div>

                {/* Contact */}
                <div className="space-y-2.5">
                  <SectionLabel>Contact</SectionLabel>
                  <div className="rounded-xl border divide-y overflow-hidden bg-background">
                    <DetailRow icon={Mail}  label="Email" value={detailTarget.email} />
                    <DetailRow icon={Phone} label="Phone" value={detailTarget.profile?.phone || "—"} />
                  </div>
                </div>

                {/* Account */}
                <div className="space-y-2.5">
                  <SectionLabel>Account</SectionLabel>
                  <div className="rounded-xl border divide-y overflow-hidden bg-background">
                    <DetailRow icon={ShieldCheck}  label="Sign-in Method" value={<ProviderBadge provider={detailTarget.profile?.authProvider} />} />
                    <DetailRow icon={CalendarDays} label="Joined"         value={formatDateTime(detailTarget.createdAt)} />
                    <DetailRow icon={CalendarDays} label="Last Updated"   value={formatDateTime(detailTarget.updatedAt)} />
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground font-mono break-all">User ID · {detailTarget.userId}</p>
              </div>

              {/* Sticky action footer */}
              <div className="border-t px-6 py-4 shrink-0">
                {detailTarget.lifecycle?.status === "active" ? (
                  <Button
                    variant="outline"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => setStatusTarget({ userId: detailTarget.userId, name: detailTarget.name, isActive: true })}
                  >
                    <Ban className="mr-2 h-4 w-4" />Block User
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full text-green-700 border-green-300 hover:bg-green-50 hover:text-green-700"
                    onClick={() => setStatusTarget({ userId: detailTarget.userId, name: detailTarget.name, isActive: false })}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />Unblock User
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Block / Unblock confirmation */}
      <AlertDialog open={!!statusTarget} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.isActive ? "Block" : "Unblock"} &quot;{statusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.isActive
                ? "They will be signed out and won't be able to log in until you unblock them."
                : "They will be able to log in again immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusMutation.mutate({ id: statusTarget.userId, status: statusTarget.isActive ? "inactive" : "active" })}
              className={statusTarget?.isActive ? "bg-destructive hover:bg-destructive/90" : ""}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {statusTarget?.isActive ? "Block" : "Unblock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
