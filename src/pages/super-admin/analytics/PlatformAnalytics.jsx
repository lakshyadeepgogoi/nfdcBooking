import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts"
import { format } from "date-fns"
import { Download } from "lucide-react"
import { downloadCSV } from "@/utils/exportCsv"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import {
  getPlatformRevenue, getTheaterComparison, getSuperAudiAnalytics, listAllTheaters,
} from "@/api/superAdmin"
import { formatINR } from "@/utils/formatCurrency"
import { toAPIDate, subDays } from "@/utils/formatDate"
import { parseList } from "@/utils/parseList"
import { cn } from "@/lib/utils"

function DatePicker({ label, value, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal text-sm", !value && "text-muted-foreground")}>
          {value ? format(value, "dd MMM yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={value} onSelect={onChange} initialFocus /></PopoverContent>
    </Popover>
  )
}


export default function PlatformAnalytics() {
  useEffect(() => { document.title = "NFDC Admin — Platform Analytics" }, [])

  const [revMode, setRevMode] = useState("daily")
  const [revFrom, setRevFrom] = useState(subDays(new Date(), 30))
  const [revTo, setRevTo] = useState(new Date())
  const [appliedRev, setAppliedRev] = useState({ from: subDays(new Date(), 30), to: new Date() })
  const [audiTheater, setAudiTheater] = useState("")

  const { data: revRaw, isLoading: revLoading } = useQuery({
    queryKey: ["super", "revenue", revMode, toAPIDate(appliedRev.from), toAPIDate(appliedRev.to)],
    queryFn: () => getPlatformRevenue({
      period: revMode,
      start: toAPIDate(appliedRev.from),
      end: toAPIDate(appliedRev.to),
    }).then(r => r.data.data),
  })

  const { data: compRaw, isLoading: compLoading } = useQuery({
    queryKey: ["super", "comparison"],
    queryFn: () => getTheaterComparison().then(r => r.data.data),
  })

  const { data: audiRaw, isLoading: audiLoading } = useQuery({
    queryKey: ["super", "audi-analytics", audiTheater],
    queryFn: () => getSuperAudiAnalytics({ theaterId: audiTheater || undefined }).then(r => r.data.data),
  })

  const { data: theatersRaw } = useQuery({
    queryKey: ["theaters"],
    queryFn: () => listAllTheaters().then(r => parseList(r.data.data)),
  })

  const revenueData = Array.isArray(revRaw) ? revRaw : Array.isArray(revRaw?.revenue) ? revRaw.revenue : []
  const compData = Array.isArray(compRaw) ? compRaw : Object.values(compRaw ?? {}).find(Array.isArray) ?? []
  const audiData = Array.isArray(audiRaw) ? audiRaw : Object.values(audiRaw ?? {}).find(Array.isArray) ?? []
  const theaters = theatersRaw ?? []

  const revBreakdown = Array.isArray(revRaw?.breakdown) ? revRaw.breakdown : []

  const audiColumns = [
    { id: "audi", header: "Audi Name", cell: ({ row }) => row.original.audiName ?? row.original.name ?? "—" },
    { id: "theater", header: "Theater", cell: ({ row }) => row.original.theaterName ?? "—" },
    { accessorKey: "bookings", header: "Bookings" },
    { accessorKey: "revenue", header: "Revenue", cell: ({ getValue }) => formatINR(getValue() ?? 0) },
    {
      accessorKey: "occupancy",
      header: "Occupancy %",
      cell: ({ getValue }) => getValue() != null ? `${getValue()}%` : "—",
    },
  ]

  const revBreakdownColumns = [
    { id: "theater", header: "Theater", cell: ({ row }) => row.original.theaterName ?? row.original.theater ?? "—" },
    { accessorKey: "revenue", header: "Revenue", cell: ({ getValue }) => formatINR(getValue() ?? 0) },
    { accessorKey: "bookings", header: "Bookings" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Analytics" />

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="comparison">Theater Comparison</TabsTrigger>
          <TabsTrigger value="audi">Audi Analytics</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Platform Revenue</CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={revMode === "daily" ? "default" : "outline"} onClick={() => setRevMode("daily")}>Daily</Button>
                  <Button size="sm" variant={revMode === "monthly" ? "default" : "outline"} onClick={() => setRevMode("monthly")}>Monthly</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadCSV(`platform-revenue-${revMode}.csv`, ["Date", "Revenue"], revenueData.map(r => [r.date ?? r.month, r.revenue]))}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />Export CSV
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <DatePicker label="From" value={revFrom} onChange={setRevFrom} />
                <DatePicker label="To" value={revTo} onChange={setRevTo} />
                <Button size="sm" className="bg-nfdc-primary hover:bg-nfdc-primary/90"
                  onClick={() => setAppliedRev({ from: revFrom, to: revTo })}>Apply</Button>
              </div>
            </CardHeader>
            <CardContent>
              {revLoading ? <Skeleton className="h-[280px] w-full" /> : (
                <ResponsiveContainer width="100%" height={280}>
                  {revMode === "daily" ? (
                    <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={v => "₹" + v} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={70} />
                      <Tooltip formatter={v => formatINR(v)} />
                      <Area type="monotone" dataKey="revenue" fill="#D6E8FA" stroke="#1A6FC4" strokeWidth={2} />
                    </AreaChart>
                  ) : (
                    <BarChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={v => "₹" + v} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={70} />
                      <Tooltip formatter={v => formatINR(v)} />
                      <Bar dataKey="revenue" fill="#1A6FC4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          {revBreakdown.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue by Theater</CardTitle></CardHeader>
              <CardContent>
                <DataTable columns={revBreakdownColumns} data={revBreakdown} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Theater Comparison Tab */}
        <TabsContent value="comparison" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Theater Comparison</CardTitle>
                <Button size="sm" variant="outline" onClick={() => downloadCSV("theater-comparison.csv", ["Theater", "Bookings", "Revenue"], compData.map(t => [t.theaterName ?? t.name, t.bookings, t.revenue]))}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {compLoading ? <Skeleton className="h-[300px] w-full" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={compData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="theaterName" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={v => "₹" + v} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
                    <Tooltip formatter={(v, name) => name === "revenue" ? formatINR(v) : v} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="bookings" fill="#1A6FC4" radius={[4, 4, 0, 0]} name="Bookings" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#0B2E5C" radius={[4, 4, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audi Analytics Tab */}
        <TabsContent value="audi" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={audiTheater} onValueChange={v => setAudiTheater(v === "all" ? "" : v)}>
              <SelectTrigger className="w-64"><SelectValue placeholder="All Theaters" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Theaters</SelectItem>
                {theaters.map(t => <SelectItem key={t.id ?? t._id} value={t.id ?? t._id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <DataTable columns={audiColumns} data={audiData} isLoading={audiLoading} emptyMessage="No audi data" />

          {audiData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Audi Bookings Chart</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={audiData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="audiName" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="bookings" fill="#1A6FC4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
