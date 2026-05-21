import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Filter, ChevronDown } from "lucide-react"
import { pick } from "@/utils/pick"
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
import { ACTION_TYPES } from "@/utils/constants"
import { cn } from "@/lib/utils"

const DEFAULT = { adminId: "", theaterId: "", action: "", from: null, to: null, page: 1, pageSize: 25 }

const ACTION_VARIANT = {
  create: "default", update: "default",
  delete: "destructive",
  login: "secondary", logout: "secondary",
}

function DatePicker({ label, value, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !value && "text-muted-foreground")}>
          {value ? format(value, "dd MMM yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={value} onSelect={onChange} initialFocus /></PopoverContent>
    </Popover>
  )
}

function AdminCombobox({ admins, value, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = admins.find(a => (a.id ?? a._id) === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
          {selected?.name ?? "All Admins"}
          <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0">
        <Command>
          <CommandInput placeholder="Search admin..." />
          <CommandEmpty>No admin found.</CommandEmpty>
          <CommandGroup>
            <CommandItem value="all" onSelect={() => { onChange(""); setOpen(false) }}>All Admins</CommandItem>
            {admins.map(a => {
              const id = a.id ?? a._id
              return (
                <CommandItem key={id} value={a.name ?? id} onSelect={() => { onChange(id); setOpen(false) }}>
                  {a.name}
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
  const [draft, setDraft] = useState(DEFAULT)
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
      ...applied,
      adminId: applied.adminId || undefined,
      theaterId: applied.theaterId || undefined,
      action: applied.action || undefined,
      from: applied.from ? format(applied.from, "yyyy-MM-dd") : undefined,
      to: applied.to ? format(applied.to, "yyyy-MM-dd") : undefined,
    }).then(r => r.data.data),
  })

  const logs = parseList(raw)
  const total = raw?.total ?? raw?.pagination?.total ?? logs.length

  const columns = [
    { id: "admin", header: "Admin", cell: ({ row }) => <span className="font-medium">{pick(row.original.admin?.name, row.original.adminName, row.original.admin)}</span> },
    { id: "theater", header: "Theater", cell: ({ row }) => pick(row.original.theater?.name, row.original.theaterName, row.original.theater) },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ getValue }) => {
        const action = getValue()
        const variant = ACTION_VARIANT[action] ?? "outline"
        return <Badge variant={variant} className="capitalize">{action}</Badge>
      },
    },
    { id: "entityType", header: "Entity Type", cell: ({ row }) => row.original.entityType ?? row.original.entity ?? "—" },
    {
      id: "entityId",
      header: "Entity ID",
      cell: ({ row }) => {
        const id = row.original.entityId ?? row.original.targetId
        return id ? <span className="font-mono text-xs text-muted-foreground">{String(id).slice(0, 10)}...</span> : "—"
      },
    },
    {
      accessorKey: "createdAt",
      header: "Timestamp",
      cell: ({ getValue }) => getValue() ? formatDateTime(getValue()) : "—",
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title="Activity Logs" />
        <Button variant="outline" size="sm" onClick={() => setFiltersVisible(v => !v)}>
          <Filter className="mr-2 h-4 w-4" />
          {filtersVisible ? "Hide Filters" : "Show Filters"}
        </Button>
      </div>

      {filtersVisible && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Admin</p>
                <AdminCombobox admins={admins} value={draft.adminId} onChange={v => setDraft(d => ({ ...d, adminId: v }))} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Theater</p>
                <Select value={draft.theaterId} onValueChange={v => setDraft(d => ({ ...d, theaterId: v === "all" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Theaters" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Theaters</SelectItem>
                    {theaters.map(t => <SelectItem key={t.id ?? t._id} value={t.id ?? t._id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Action</p>
                <Select value={draft.action} onValueChange={v => setDraft(d => ({ ...d, action: v === "all" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All actions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {ACTION_TYPES.map(a => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <DatePicker label="From" value={draft.from} onChange={d => setDraft(f => ({ ...f, from: d }))} />
                <DatePicker label="To" value={draft.to} onChange={d => setDraft(f => ({ ...f, to: d }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-nfdc-primary hover:bg-nfdc-primary/90"
                onClick={() => setApplied({ ...draft, page: 1 })}>Apply</Button>
              <Button size="sm" variant="outline" onClick={() => { setDraft(DEFAULT); setApplied(DEFAULT) }}>
                Clear All
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
          page: applied.page,
          pageSize: applied.pageSize,
          total,
          onPageChange: p => setApplied(f => ({ ...f, page: p })),
          onPageSizeChange: ps => setApplied(f => ({ ...f, pageSize: ps, page: 1 })),
        }}
      />
    </div>
  )
}
