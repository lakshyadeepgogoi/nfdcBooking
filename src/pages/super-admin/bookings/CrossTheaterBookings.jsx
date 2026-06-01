import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  CalendarDays, Building2, Filter, X, Eye, Ticket,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import { getCrossTheaterBookings, listAllTheaters } from "@/api/superAdmin"
import { formatDate } from "@/utils/formatDate"
import { formatINR } from "@/utils/formatCurrency"
import { BOOKING_STATUS } from "@/utils/constants"
import { cn } from "@/lib/utils"

// relationships.theaterName / audiName / userName are already denormalized by the backend

const DEFAULT = { theaterId: "", status: "", bookingType: "", date: null, page: 1, limit: 10 }

const BOOKING_TYPES = [
  { value: "govt",     label: "Government"     },
  { value: "non-govt", label: "Non-Government" },
]

function DatePicker({ value, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-9 w-full justify-start text-left font-normal text-sm", !value && "text-muted-foreground")}
        >
          <CalendarDays className="mr-2 h-3.5 w-3.5" />
          {value ? format(value, "dd MMM yyyy") : "Pick date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Calendar mode="single" selected={value} onSelect={onChange} className="w-full [--cell-size:2.25rem]" captionLayout="dropdown" fromYear={2020} toYear={2035} initialFocus />
      </PopoverContent>
    </Popover>
  )
}

function TypeBadge({ type }) {
  if (!type) return <span className="text-muted-foreground">—</span>
  const isGovt = type === "govt"
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", isGovt
      ? "border-blue-300 text-blue-700 bg-blue-50"
      : "border-orange-300 text-orange-700 bg-orange-50"
    )}>
      {isGovt ? "Govt" : "Non-Govt"}
    </Badge>
  )
}

export default function CrossTheaterBookings() {
  useEffect(() => { document.title = "NFDC Admin — Cross-Theater Bookings" }, [])

  const navigate = useNavigate()
  const [applied, setApplied] = useState(DEFAULT)
  const [draft, setDraft]     = useState(DEFAULT)

  // Theaters list for the filter dropdown + theater name resolution
  const { data: theatersRaw } = useQuery({
    queryKey: ["theaters"],
    queryFn: () => listAllTheaters().then(r => r.data.data),
  })
  const theaters = useMemo(() => {
    if (Array.isArray(theatersRaw)) return theatersRaw
    if (Array.isArray(theatersRaw?.data)) return theatersRaw.data
    return []
  }, [theatersRaw])

  // Bookings query
  const { data: raw, isLoading } = useQuery({
    queryKey: ["super-bookings", applied],
    queryFn: () => getCrossTheaterBookings({
      page:        applied.page,
      limit:       applied.limit,
      theaterId:   applied.theaterId   || undefined,
      status:      applied.status      || undefined,
      bookingType: applied.bookingType || undefined,
      date:        applied.date ? format(applied.date, "yyyy-MM-dd") : undefined,
    }).then(r => r.data.data),
    keepPreviousData: true,
  })

  const bookings   = Array.isArray(raw?.data) ? raw.data : []
  const pagination = raw?.pagination ?? {}
  const total      = pagination.total ?? bookings.length

  // Active filter chips
  const activeFilters = [
    applied.theaterId   && { key: "theaterId",   label: `Theater: ${theaters.find(t => (t.theaterId ?? t._id) === applied.theaterId)?.name ?? applied.theaterId}` },
    applied.status      && { key: "status",      label: `Status: ${applied.status}` },
    applied.bookingType && { key: "bookingType", label: applied.bookingType === "govt" ? "Type: Government" : "Type: Non-Government" },
    applied.date        && { key: "date",        label: `Date: ${format(applied.date, "dd MMM yyyy")}` },
  ].filter(Boolean)

  const applyFilters = () => setApplied({ ...draft, page: 1 })
  const clearAll     = () => { setDraft(DEFAULT); setApplied(DEFAULT) }
  const clearFilter  = (key) => {
    const updated = { ...applied, [key]: DEFAULT[key], page: 1 }
    setApplied(updated)
    setDraft(updated)
  }

  const columns = [
    {
      id: "bookingId",
      header: "Booking ID",
      cell: ({ row }) => {
        const id = String(row.original.bookingId ?? row.original._id ?? "")
        return <span className="font-mono text-xs text-muted-foreground">#{id.slice(-10)}</span>
      },
    },
    {
      id: "theater",
      header: "Theater",
      cell: ({ row }) => {
        const name = row.original.relationships?.theaterName ?? "—"
        return (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm">{name}</span>
          </div>
        )
      },
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const b = row.original
        return <span className="text-sm">{b.relationships?.userName ?? b.user?.name ?? "—"}</span>
      },
    },
    {
      id: "audi",
      header: "Audi",
      cell: ({ row }) => {
        const b = row.original
        return <span className="text-sm text-muted-foreground">{b.relationships?.audiName ?? "—"}</span>
      },
    },
    {
      id: "datetime",
      header: "Date & Time",
      cell: ({ row }) => {
        const b     = row.original
        const date  = formatDate(b.bookingDetails?.date)
        const start = b.bookingDetails?.startTime
        const end   = b.bookingDetails?.endTime
        return (
          <div>
            <p className="text-sm">{date}</p>
            {start && end && <p className="text-xs text-muted-foreground">{start}–{end}</p>}
          </div>
        )
      },
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => <TypeBadge type={row.original.bookingDetails?.bookingType} />,
    },
    {
      id: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const b = row.original
        return <span className="font-medium">{formatINR(b.pricing?.totalAmount ?? b.totalAmount ?? 0)}</span>
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.lifecycle?.status ?? row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const id = row.original.bookingId ?? row.original._id
        return (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={e => { e.stopPropagation(); navigate(`/admin/bookings/${id}`) }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )
      },
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Cross-Theater Bookings" />

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Theater */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Theater</p>
              <Select
                value={draft.theaterId || "__all"}
                onValueChange={v => setDraft(d => ({ ...d, theaterId: v === "__all" ? "" : v }))}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Theaters" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All Theaters</SelectItem>
                  {theaters.map(t => {
                    const id = t.theaterId ?? t._id
                    return <SelectItem key={id} value={id}>{t.name}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <Select
                value={draft.status || "__all"}
                onValueChange={v => setDraft(d => ({ ...d, status: v === "__all" ? "" : v }))}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All Statuses</SelectItem>
                  {Object.values(BOOKING_STATUS).map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Booking Type */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Booking Type</p>
              <Select
                value={draft.bookingType || "__all"}
                onValueChange={v => setDraft(d => ({ ...d, bookingType: v === "__all" ? "" : v }))}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All Types</SelectItem>
                  {BOOKING_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Date</p>
              <DatePicker value={draft.date} onChange={d => setDraft(f => ({ ...f, date: d }))} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-nfdc-primary hover:bg-nfdc-primary/90"
              onClick={applyFilters}
            >
              Apply Filters
            </Button>
            {activeFilters.length > 0 && (
              <Button size="sm" variant="outline" onClick={clearAll}>
                Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map(f => (
            <Badge key={f.key} variant="secondary" className="gap-1 pr-1 text-xs">
              {f.label}
              <button
                onClick={() => clearFilter(f.key)}
                className="ml-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Result count */}
      {!isLoading && total > 0 && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Ticket className="h-3.5 w-3.5" />
          <span>
            <strong className="text-foreground">{total.toLocaleString("en-IN")}</strong>
            {" "}booking{total !== 1 ? "s" : ""} found
          </span>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={bookings}
        isLoading={isLoading}
        emptyMessage="No bookings found"
        emptyIcon={Ticket}
        onRowClick={row => navigate(`/admin/bookings/${row.original.bookingId ?? row.original._id}`)}
        pagination={{
          page:           applied.page,
          pageSize:       applied.limit,
          total,
          onPageChange:     p  => setApplied(f => ({ ...f, page: p })),
          onPageSizeChange: ps => setApplied(f => ({ ...f, limit: ps, page: 1 })),
        }}
      />
    </div>
  )
}
