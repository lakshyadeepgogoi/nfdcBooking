import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { ArrowLeft, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import EmptyState from "@/components/common/EmptyState"
import { getTheaterDetail, listAdmins, getSuperAudiAnalytics } from "@/api/superAdmin"
import { formatDateTime } from "@/utils/formatDate"
import { parseList } from "@/utils/parseList"

function InfoRow({ label, value }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  )
}

export default function TheaterDetail() {
  const { theaterId } = useParams()
  const navigate = useNavigate()

  const { data: theaterRaw, isLoading: tLoading } = useQuery({
    queryKey: ["theater-detail", theaterId],
    queryFn: () => getTheaterDetail(theaterId).then(r => r.data.data),
    enabled: !!theaterId,
  })

  const { data: adminsRaw } = useQuery({
    queryKey: ["admins", theaterId],
    queryFn: () => listAdmins(theaterId).then(r => parseList(r.data.data)),
    enabled: !!theaterId,
  })

  const { data: audiRaw, isLoading: audiLoading } = useQuery({
    queryKey: ["super", "audi-analytics", theaterId],
    queryFn: () => getSuperAudiAnalytics({ theaterId }).then(r => r.data.data),
    enabled: !!theaterId,
  })

  // Derive all computed values BEFORE any hooks that depend on them
  const theater = theaterRaw?.theater ?? theaterRaw
  const details  = theater?.details ?? {}
  const admins   = adminsRaw ?? []
  const audiData = Array.isArray(audiRaw)
    ? audiRaw
    : Object.values(audiRaw ?? {}).find(Array.isArray) ?? []

  useEffect(() => {
    document.title = theater?.name
      ? `NFDC Admin — ${theater.name}`
      : "NFDC Admin — Theater Detail"
  }, [theater?.name])

  const adminColumns = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => (
        <span className="capitalize text-sm">
          {row.original.profile?.role?.replace(/_/g, " ") ?? "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.lifecycle?.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ getValue }) => getValue() ? formatDateTime(getValue()) : "—",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={theater?.name ?? "Theater Detail"}
        action={{ label: "Back", icon: ArrowLeft, onClick: () => navigate("/super/theaters") }}
      />

      {/* Theater Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Theater Information</CardTitle></CardHeader>
        <CardContent>
          {tLoading ? <Skeleton className="h-24 w-full" /> : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InfoRow label="Name"    value={theater?.name} />
              <InfoRow label="City"    value={details.city} />
              <InfoRow label="State"   value={details.state} />
              <InfoRow label="Address" value={details.address} />
              <InfoRow label="Phone"   value={details.phone} />
              <InfoRow label="Email"   value={details.email} />
              {details.pincode && <InfoRow label="Pincode" value={details.pincode} />}
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={theater?.lifecycle?.status} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned Admins */}
      <Card>
        <CardHeader><CardTitle className="text-base">Assigned Admins</CardTitle></CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No admins assigned"
              message="No admins are assigned to this theater."
            />
          ) : (
            <DataTable columns={adminColumns} data={admins} />
          )}
        </CardContent>
      </Card>

      {/* Audi Analytics */}
      <Card>
        <CardHeader><CardTitle className="text-base">Audi Performance</CardTitle></CardHeader>
        <CardContent>
          {audiLoading ? <Skeleton className="h-[250px] w-full" /> : audiData.length === 0 ? (
            <EmptyState title="No audi data" message="No analytics available for this theater." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={audiData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="audiName" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="bookings" fill="#1A6FC4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
