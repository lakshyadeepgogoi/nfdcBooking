import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, MoreHorizontal, Pencil, Power, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Form } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import DataTable from "@/components/common/DataTable"
import StatusBadge from "@/components/common/StatusBadge"
import FormInput from "@/components/forms/FormInput"
import FormSelect from "@/components/forms/FormSelect"
import { useAuth } from "@/hooks/useAuth"
import { listAudis } from "@/api/audi"
import {
  listPriceConfigs,
  createPriceConfig,
  updatePriceConfig,
  updatePriceConfigStatus,
} from "@/api/priceConfig"
import { formatINR } from "@/utils/formatCurrency"

// ─── Zod schemas ───────────────────────────────────────────────────────────

const hourlySchema = z
  .object({
    audiId: z.string().min(1, "Select an audi"),
    ratePerHour: z.coerce.number().positive("Must be > 0"),
    minHours: z.coerce.number().min(1, "Min 1"),
    maxHours: z.coerce.number().min(1, "Min 1"),
  })
  .refine((d) => d.maxHours >= d.minHours, {
    message: "Max must be ≥ min",
    path: ["maxHours"],
  })

const flatSchema = z.object({
  serviceName: z.string().min(1, "Name is required"),
  amount: z.coerce.number().positive("Must be > 0"),
})

const cancellationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  chargeType: z.enum(["percentage", "flat"]),
  value: z.coerce.number().positive("Must be > 0"),
  noticePeriodHours: z.coerce.number().min(0, "Min 0"),
})

function schemaForTab(tab) {
  if (tab === "hourly") return hourlySchema
  if (tab === "flat") return flatSchema
  return cancellationSchema
}

function defaultsForTab(tab, existing) {
  if (tab === "hourly") {
    return {
      audiId: existing?.audiId ?? "",
      ratePerHour: existing?.ratePerHour ?? "",
      minHours: existing?.minHours ?? "",
      maxHours: existing?.maxHours ?? "",
    }
  }
  if (tab === "flat") {
    return {
      serviceName: existing?.serviceName ?? "",
      amount: existing?.amount ?? "",
    }
  }
  return {
    name: existing?.name ?? "",
    chargeType: existing?.chargeType ?? "percentage",
    value: existing?.value ?? "",
    noticePeriodHours: existing?.noticePeriodHours ?? "",
  }
}

// ─── Config Dialog ──────────────────────────────────────────────────────────

function ConfigDialog({ open, onOpenChange, activeTab, auditOptions, editingConfig }) {
  const queryClient = useQueryClient()

  const form = useForm({
    resolver: zodResolver(schemaForTab(activeTab)),
    defaultValues: defaultsForTab(activeTab, editingConfig),
  })

  useEffect(() => {
    if (open) {
      form.reset(defaultsForTab(activeTab, editingConfig))
    }
  }, [open, activeTab, editingConfig, form])

  const mutation = useMutation({
    mutationFn: (values) =>
      editingConfig
        ? updatePriceConfig(editingConfig.id ?? editingConfig._id, values)
        : createPriceConfig({ type: activeTab, ...values }),
    onSuccess: () => {
      toast.success(editingConfig ? "Config updated" : "Price config created")
      queryClient.invalidateQueries({ queryKey: ["price-configs"] })
      onOpenChange(false)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {editingConfig ? "Edit" : "Add"}{" "}
            {activeTab === "hourly" ? "Hourly Rate" : activeTab === "flat" ? "Flat Service" : "Cancellation Policy"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            {activeTab === "hourly" && (
              <>
                <FormSelect
                  control={form.control}
                  name="audiId"
                  label="Audi"
                  placeholder="Select an audi"
                  options={auditOptions}
                />
                <FormInput control={form.control} name="ratePerHour" label="Rate per Hour (₹)" type="number" />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput control={form.control} name="minHours" label="Min Hours" type="number" />
                  <FormInput control={form.control} name="maxHours" label="Max Hours" type="number" />
                </div>
              </>
            )}

            {activeTab === "flat" && (
              <>
                <FormInput control={form.control} name="serviceName" label="Service Name" placeholder="Decoration Setup" />
                <FormInput control={form.control} name="amount" label="Amount (₹)" type="number" />
              </>
            )}

            {activeTab === "cancellation" && (
              <>
                <FormInput control={form.control} name="name" label="Policy Name" placeholder="Last-minute cancellation" />
                <FormSelect
                  control={form.control}
                  name="chargeType"
                  label="Charge Type"
                  options={[
                    { value: "percentage", label: "Percentage" },
                    { value: "flat", label: "Flat Amount" },
                  ]}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput control={form.control} name="value" label="Value" type="number" />
                  <FormInput control={form.control} name="noticePeriodHours" label="Notice Period (hrs)" type="number" />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-nfdc-primary hover:bg-nfdc-primary/90"
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingConfig ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PriceConfigList() {
  useEffect(() => {
    document.title = "NFDC Admin — Price Config"
  }, [])

  const { user } = useAuth()
  const theaterId = user?.theaterId
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState("hourly")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)

  const toArr = (d) => Array.isArray(d) ? d : (Object.values(d ?? {}).find(Array.isArray) ?? [])

  const { data: allConfigs, isLoading } = useQuery({
    queryKey: ["price-configs"],
    queryFn: () => listPriceConfigs().then((r) => toArr(r.data.data)),
  })

  const { data: audis } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAudis(theaterId).then((r) => toArr(r.data.data)),
    enabled: !!theaterId,
  })

  const auditOptions = (audis ?? []).map((a) => ({
    value: a.id ?? a._id,
    label: a.name,
  }))

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updatePriceConfigStatus(id, status),
    onSuccess: () => {
      toast.success("Status updated")
      queryClient.invalidateQueries({ queryKey: ["price-configs"] })
      setStatusTarget(null)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const filtered = (allConfigs ?? []).filter((c) => c.type === activeTab)

  const actionsCell = (row) => {
    const cfg = row.original
    const isActive = cfg.status === "active"
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setEditingConfig(cfg)
              setAddDialogOpen(true)
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              setStatusTarget({ id: cfg.id ?? cfg._id, name: cfg.name ?? cfg.serviceName, isActive })
            }
            className={isActive ? "text-destructive focus:text-destructive" : ""}
          >
            <Power className="mr-2 h-4 w-4" />
            {isActive ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const hourlyColumns = [
    {
      id: "audi",
      header: "Audi",
      cell: ({ row }) => row.original.audiName ?? row.original.audiId,
    },
    {
      accessorKey: "ratePerHour",
      header: "Rate/hr",
      cell: ({ getValue }) => `${formatINR(getValue())}/hr`,
    },
    { accessorKey: "minHours", header: "Min Hours" },
    { accessorKey: "maxHours", header: "Max Hours" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    },
    { id: "actions", header: "", cell: ({ row }) => actionsCell(row) },
  ]

  const flatColumns = [
    {
      accessorKey: "serviceName",
      header: "Service Name",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ getValue }) => formatINR(getValue()),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    },
    { id: "actions", header: "", cell: ({ row }) => actionsCell(row) },
  ]

  const cancellationColumns = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    {
      accessorKey: "chargeType",
      header: "Charge Type",
      cell: ({ getValue }) => <span className="capitalize">{getValue()}</span>,
    },
    {
      accessorKey: "value",
      header: "Value",
      cell: ({ row }) =>
        row.original.chargeType === "percentage"
          ? `${row.original.value}%`
          : formatINR(row.original.value),
    },
    {
      accessorKey: "noticePeriodHours",
      header: "Notice Period",
      cell: ({ getValue }) => `${getValue()}h`,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    },
    { id: "actions", header: "", cell: ({ row }) => actionsCell(row) },
  ]

  const columnsForTab = {
    hourly: hourlyColumns,
    flat: flatColumns,
    cancellation: cancellationColumns,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Price Configuration"
        action={{
          label: "Add Config",
          icon: Plus,
          onClick: () => {
            setEditingConfig(null)
            setAddDialogOpen(true)
          },
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="hourly" className="flex-1 sm:flex-none">Hourly Rates</TabsTrigger>
          <TabsTrigger value="flat" className="flex-1 sm:flex-none">Flat Services</TabsTrigger>
          <TabsTrigger value="cancellation" className="flex-1 sm:flex-none">
            <span className="hidden sm:inline">Cancellation Policy</span>
            <span className="sm:hidden">Cancellation</span>
          </TabsTrigger>
        </TabsList>

        {["hourly", "flat", "cancellation"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <DataTable
              columns={columnsForTab[tab]}
              data={tab === activeTab ? filtered : []}
              isLoading={isLoading && tab === activeTab}
              emptyMessage={`No ${tab} configs yet`}
            />
          </TabsContent>
        ))}
      </Tabs>

      <ConfigDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open)
          if (!open) setEditingConfig(null)
        }}
        activeTab={activeTab}
        auditOptions={auditOptions}
        editingConfig={editingConfig}
      />

      <AlertDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.isActive ? "Deactivate" : "Activate"}{" "}
              &quot;{statusTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update the price config status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                statusMutation.mutate({
                  id: statusTarget.id,
                  status: statusTarget.isActive ? "inactive" : "active",
                })
              }
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
