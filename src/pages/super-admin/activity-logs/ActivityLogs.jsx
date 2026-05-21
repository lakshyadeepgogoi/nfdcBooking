import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Filter, ChevronDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import { getActivityLogs, listAdmins, listAllTheaters } from "@/api/superAdmin"
import { parseList } from "@/utils/parseList"
import { formatDateTime } from "@/utils/formatDate"
import { cn } from "@/lib/utils"

const DEFAULT = { adminId: "", theaterId: "", action: "", from: null, to: null, page: 1, pageSize: 10 }

// Derive badge variant from action string
function getActionVariant(action = "") {
  if (action.includes("create") || action.includes("created")) return "default"
  if (action.includes("update") || action.includes("updated")) return "secondary"
  if (action.includes("delete") || action.includes("deleted") || action.includes("deactivate")) return "destructive"
  return "outline"
}

// Format action string: "update_theater_admin" → "Update Theater Admin"
function formatAction(action = "") {
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function DatePicker({ label, value, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal h-9 text-sm", !value && "text-muted-foreground")}
        >
          {value ? format(value, "dd MMM yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
      </PopoverContent>
    </Popover>
  )
}

function AdminCombobox({ admins, value, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = admins.find(a => (a.adminId ?? a.id ?? a._id) === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal truncate">
          <span className="truncate">{selected?.name ?? "All Admins"}</span>
          <ChevronDown className="ml-2 h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search admin..." />
          <CommandEmpty>No admin found.</CommandEmpty>
          <CommandGroup>
            <CommandItem value="all" onSelect={() => { onChange(""); setOpen(false) }}>
              All Admins
            </CommandItem>
            {admins.map(a => {
              const id = a.adminId ?? a.id ?? a._id
              return (
                <CommandItem key={id} value={a.name ?? id} onSelect={() => { onChange(id); setOpen(false) }}>
                  <div>
                    <p className="text-sm">{a.name}</p>
                    {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function ActivityLogs() {
  useEffect(() => { document.title = "NFDC Admin — Activity Logs" }, [])

  const [filtersVisible, setFiltersVisible] = useState(false)
  const [draft,   setDraft]   = useState(DEFAULT)
  const [applied, setApplied] = useState(DEFAULT)

  const { data: adminsRaw } = useQuery({
    queryKey: ["admins"],
    queryFn: () => listAdmins().then(r => parseList(r.data.data)),
  })
  const admins = adminsRaw ?? []

  const { data: theatersRaw } = useQuery({
    queryKey: ["theaters"],
    queryFn: () => listAllTheaters().then(r => parseList(r.data.data)),
  })
  const theaters = theatersRaw ?? []

  const { data: raw, isLoading } = useQuery({
    queryKey: ["activity-logs", applied],
    queryFn: () => getActivityLogs({
      page:      applied.page,
      limit:     applied.pageSize,
      adminId:   applied.adminId   || undefined,
      theaterId: applied.theaterId || undefined,
      action:    applied.action    || undefined,
      from: applied.from ? format(applied.from, "yyyy-MM-dd") : undefined,
      to:   applied.to   ? format(applied.to,   "yyyy-MM-dd") : undefined,
    }).then(r => r.data.data),
  })

  // Response shape: { data: [...], pagination: { total, page, limit, totalPages } }
  const logs  = parseList(raw)
  const total = raw?.pagination?.total ?? logs.length

  const columns = [
    {
      id: "admin",
      header: "Admin",
      cell: ({ row }) => {
        const admin = row.original.adminName
        return (
          <div>
            <p className="font-medium text-sm">{admin?.name ?? "—"}</p>
            {admin?.email && <p className="text-xs text-muted-foreground">{admin.email}</p>}
          </div>
        )
      },
    },
    {
      id: "theater",
      header: "Theater",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.theaterName ?? "—"}</span>
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => {
        const action = row.original.activity?.action ?? ""
        return (
          <Badge variant={getActionVariant(action)} className="whitespace-nowrap text-xs">
            {formatAction(action)}
          </Badge>
        )
      },
    },
    {
      id: "description",
      header: "Description",
      cell: ({ row }) => {
        const desc = row.original.activity?.description ?? "—"
        return (
          <span className="text-sm text-muted-foreground line-clamp-2 max-w-xs" title={desc}>
            {desc}
          </span>
        )
      },
    },
    {
      id: "entity",
      header: "Affected",
      cell: ({ row }) => {
        const entity     = row.original.entityName
        const entityType = row.original.activity?.entityType
        return entity ? (
          <div>
            <p className="text-sm font-medium">{entity.name}</p>
            {entity.email && <p className="text-xs text-muted-foreground">{entity.email}</p>}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground capitalize">{entityType ?? "—"}</span>
        )
      },
    },
    {
      id: "createdAt",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.createdAt ? formatDateTime(row.original.createdAt) : "—"}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Activity Logs" />
        <Button variant="outline" size="sm" onClick={() => setFiltersVisible(v => !v)}>
          <Filter className="mr-2 h-4 w-4" />
          {filtersVisible ? "Hide Filters" : "Filters"}
        </Button>
      </div>

      {filtersVisible && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Admin</p>
                <AdminCombobox
                  admins={admins}
                  value={draft.adminId}
                  onChange={v => setDraft(d => ({ ...d, adminId: v }))}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Theater</p>
                <Select
                  value={draft.theaterId}
                  onValueChange={v => setDraft(d => ({ ...d, theaterId: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Theaters" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Theaters</SelectItem>
                    {theaters.map(t => (
                      <SelectItem key={t.theaterId ?? t.id ?? t._id} value={t.theaterId ?? t.id ?? t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">From</p>
                <DatePicker label="From date" value={draft.from} onChange={d => setDraft(f => ({ ...f, from: d }))} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">To</p>
                <DatePicker label="To date" value={draft.to} onChange={d => setDraft(f => ({ ...f, to: d }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-nfdc-primary hover:bg-nfdc-primary/90"
                onClick={() => setApplied({ ...draft, page: 1 })}
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setDraft(DEFAULT); setApplied(DEFAULT) }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyMessage="No activity logs found"
        pagination={{
          page:           applied.page,
          pageSize:       applied.pageSize,
          total,
          onPageChange:     p  => setApplied(f => ({ ...f, page: p })),
          onPageSizeChange: ps => setApplied(f => ({ ...f, pageSize: ps, page: 1 })),
        }}
      />
    </div>
  )
}
