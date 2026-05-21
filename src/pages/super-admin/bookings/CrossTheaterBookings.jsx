import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { pick } from "@/utils/pick"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import { getCrossTheaterBookings, listAllTheaters } from "@/api/superAdmin"
import { parseList } from "@/utils/parseList"
import { formatDate } from "@/utils/formatDate"
import { formatINR } from "@/utils/formatCurrency"
import { BOOKING_STATUS } from "@/utils/constants"
import { cn } from "@/lib/utils"

const DEFAULT = { theaterId: "", status: "", from: null, to: null, page: 1, pageSize: 10 }

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

export default function CrossTheaterBookings() {
  useEffect(() => { document.title = "NFDC Admin — Cross-Theater Bookings" }, [])

  const [applied, setApplied] = useState(DEFAULT)
  const [draft, setDraft] = useState(DEFAULT)

  const { data: theatersRaw } = useQuery({
    queryKey: ["theaters"],
    queryFn: () => listAllTheaters().then(r => parseList(r.data.data)),
  })
  const theaters = theatersRaw ?? []

  const { data: raw, isLoading } = useQuery({
    queryKey: ["super-bookings", applied],
    queryFn: () => getCrossTheaterBookings({
      ...applied,
      theaterId: applied.theaterId || undefined,
      status: applied.status || undefined,
      from: applied.from ? format(applied.from, "yyyy-MM-dd") : undefined,
      to: applied.to ? format(applied.to, "yyyy-MM-dd") : undefined,
    }).then(r => r.data.data),
  })

  const bookings = parseList(raw)
  const total = raw?.total ?? raw?.pagination?.total ?? bookings.length

  const columns = [
    {
      accessorKey: "id",
      header: "Booking ID",
      cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{String(getValue()).slice(0, 12)}...</span>,
    },
    {
      id: "theater",
      header: "Theater",
      cell: ({ row }) => pick(row.original.theater?.name, row.original.theaterName, row.original.theater),
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
      cell: ({ getValue }) => getValue() ? formatDate(getValue()) : "—",
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
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Cross-Theater Bookings" />

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              <p className="text-xs text-muted-foreground">Status</p>
              <Select value={draft.status} onValueChange={v => setDraft(d => ({ ...d, status: v === "all" ? "" : v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.values(BOOKING_STATUS).map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DatePicker label="From" value={draft.from} onChange={d => setDraft(f => ({ ...f, from: d }))} />
            <DatePicker label="To" value={draft.to} onChange={d => setDraft(f => ({ ...f, to: d }))} />
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="bg-nfdc-primary hover:bg-nfdc-primary/90"
              onClick={() => setApplied({ ...draft, page: 1 })}>
              Apply
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setDraft(DEFAULT); setApplied(DEFAULT) }}>
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
