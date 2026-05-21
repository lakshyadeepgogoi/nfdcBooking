import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Plus, Eye, ChevronLeft, ChevronRight } from "lucide-react"
import { pick } from "@/utils/pick"
import RoleGuard from "@/components/common/RoleGuard"
import { PERMISSIONS } from "@/auth/permissions"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import { useAuth } from "@/hooks/useAuth"
import { listBookings } from "@/api/bookings"
import { listAudis } from "@/api/audi"
import { parseList } from "@/utils/parseList"
import { formatDate, formatTime } from "@/utils/formatDate"
import { formatINR } from "@/utils/formatCurrency"
import { BOOKING_STATUS } from "@/utils/constants"
import { cn } from "@/lib/utils"

const DEFAULT_FILTERS = { from: null, to: null, status: "", audiId: "", page: 1, pageSize: 10 }

function DatePicker({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !value && "text-muted-foreground")}>
            {value ? format(value, "dd MMM yyyy") : "Pick date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function BookingList() {
  useEffect(() => { document.title = "NFDC Admin — Bookings" }, [])

  const navigate = useNavigate()
  const { user } = useAuth()
  const theaterId = user?.theaterId

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS)
  const [filterValues, setFilterValues] = useState(DEFAULT_FILTERS)

  const { data: audis } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAudis(theaterId).then(r => parseList(r.data.data)),
    enabled: !!theaterId,
  })

  const { data: raw, isLoading } = useQuery({
    queryKey: ["bookings", appliedFilters],
    queryFn: () => listBookings({
      ...appliedFilters,
      from: appliedFilters.from ? format(appliedFilters.from, "yyyy-MM-dd") : undefined,
      to: appliedFilters.to ? format(appliedFilters.to, "yyyy-MM-dd") : undefined,
      status: appliedFilters.status || undefined,
      audiId: appliedFilters.audiId || undefined,
    }).then(r => r.data.data),
  })

  const bookings = parseList(raw)
  const total = raw?.total ?? raw?.pagination?.total ?? bookings.length

  const columns = [
    {
      accessorKey: "id",
      header: "Booking ID",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {String(getValue()).slice(0, 12)}...
        </span>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => pick(row.original.user?.name, row.original.customerName, row.original.user),
    },
    {
      id: "audi",
      header: "Audi",
      cell: ({ row }) => pick(row.original.audi?.name, row.original.audiName, row.original.audi),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ getValue }) => formatDate(getValue()),
    },
    {
      id: "time",
      header: "Time",
      cell: ({ row }) => {
        const s = row.original.startTime
        const e = row.original.endTime
        return s && e ? `${s}–${e}` : "—"
      },
    },
    {
      id: "amount",
      header: "Amount",
      cell: ({ row }) => formatINR(row.original.totalAmount ?? row.original.amount ?? 0),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const id = row.original.id ?? row.original._id ?? row.original.bookingId
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/bookings/${id}`) }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Bookings">
        <RoleGuard permissions={PERMISSIONS.CREATE_MANUAL_BOOKING}>
          <Button
            className="bg-nfdc-primary hover:bg-nfdc-primary/90"
            onClick={() => navigate("/admin/bookings/manual")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Manual Booking
          </Button>
        </RoleGuard>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DatePicker
              label="From"
              value={filterValues.from}
              onChange={(d) => setFilterValues(v => ({ ...v, from: d }))}
            />
            <DatePicker
              label="To"
              value={filterValues.to}
              onChange={(d) => setFilterValues(v => ({ ...v, to: d }))}
            />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <Select
                value={filterValues.status}
                onValueChange={(v) => setFilterValues(f => ({ ...f, status: v === "all" ? "" : v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.values(BOOKING_STATUS).map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Audi</p>
              <Select
                value={filterValues.audiId}
                onValueChange={(v) => setFilterValues(f => ({ ...f, audiId: v === "all" ? "" : v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All audis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All audis</SelectItem>
                  {(audis ?? []).map(a => (
                    <SelectItem key={a.id ?? a._id} value={a.id ?? a._id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="bg-nfdc-primary hover:bg-nfdc-primary/90"
              onClick={() => setAppliedFilters({ ...filterValues, page: 1 })}
            >
              Apply Filters
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setFilterValues(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS) }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={bookings}
        isLoading={isLoading}
        emptyMessage="No bookings found"
        onRowClick={(row) => {
          const id = row.original.id ?? row.original._id ?? row.original.bookingId
          navigate(`/admin/bookings/${id}`)
        }}
        pagination={{
          page: appliedFilters.page,
          pageSize: appliedFilters.pageSize,
          total,
          onPageChange: (p) => setAppliedFilters(f => ({ ...f, page: p })),
          onPageSizeChange: (ps) => setAppliedFilters(f => ({ ...f, pageSize: ps, page: 1 })),
        }}
      />
    </div>
  )
}
