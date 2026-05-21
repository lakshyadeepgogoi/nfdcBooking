import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isSameMonth, isToday, addMonths, subMonths,
} from "date-fns"
import { Plus, ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Form } from "@/components/ui/form"
import PageHeader from "@/components/common/PageHeader"
import FormDatePicker from "@/components/forms/FormDatePicker"
import FormInput from "@/components/forms/FormInput"
import FormTextarea from "@/components/forms/FormTextarea"
import { useAuth } from "@/hooks/useAuth"
import { listAudis } from "@/api/audi"
import { listBlocks, createFullDayBlock, createPartialBlock, deactivateBlock } from "@/api/adminBlocks"
import { parseList } from "@/utils/parseList"
import { toAPIDate } from "@/utils/formatDate"
import { cn } from "@/lib/utils"

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

const baseBlockSchema = {
  date: z.date({ required_error: "Select a date" }),
  reason: z.string().min(3, "Reason required (min 3 chars)"),
}

const fullDaySchema = z.object(baseBlockSchema)
const partialSchema = z.object({
  ...baseBlockSchema,
  startTime: z.string().min(1, "Start time required"),
  endTime: z.string().min(1, "End time required"),
}).refine(d => d.endTime > d.startTime, { message: "End time must be after start time", path: ["endTime"] })

export default function BlockManager() {
  useEffect(() => { document.title = "NFDC Admin — Block Manager" }, [])

  const { user } = useAuth()
  const theaterId = user?.theaterId
  const queryClient = useQueryClient()

  const [selectedAudiId, setSelectedAudiId] = useState("")
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [addBlockOpen, setAddBlockOpen] = useState(false)
  const [blockType, setBlockType] = useState("full")
  const [unblockTarget, setUnblockTarget] = useState(null)

  const { data: audis } = useQuery({
    queryKey: ["audis", theaterId],
    queryFn: () => listAudis(theaterId).then(r => parseList(r.data.data)),
    enabled: !!theaterId,
  })

  const { data: blocksRaw } = useQuery({
    queryKey: ["blocks", selectedAudiId],
    queryFn: () => listBlocks(selectedAudiId).then(r => parseList(r.data.data)),
    enabled: !!selectedAudiId,
  })

  const blocks = blocksRaw ?? []
  const blockedDates = new Set(blocks.map(b => b.date))

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateBlock(id),
    onSuccess: () => {
      toast.success("Block removed")
      queryClient.invalidateQueries({ queryKey: ["blocks", selectedAudiId] })
      setUnblockTarget(null)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const form = useForm({
    resolver: zodResolver(blockType === "full" ? fullDaySchema : partialSchema),
    defaultValues: { date: undefined, reason: "", startTime: "", endTime: "" },
  })

  useEffect(() => {
    form.reset({ date: undefined, reason: "", startTime: "", endTime: "" })
  }, [blockType, form])

  const createMutation = useMutation({
    mutationFn: (values) => {
      const payload = {
        audiId: selectedAudiId,
        date: toAPIDate(values.date),
        reason: values.reason,
      }
      return blockType === "full"
        ? createFullDayBlock(payload)
        : createPartialBlock({ ...payload, startTime: values.startTime, endTime: values.endTime })
    },
    onSuccess: () => {
      toast.success("Block created")
      queryClient.invalidateQueries({ queryKey: ["blocks", selectedAudiId] })
      setAddBlockOpen(false)
      form.reset()
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart)

  const selectedDayBlocks = selectedDay
    ? blocks.filter(b => b.date === toAPIDate(selectedDay))
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Block Manager"
        action={{ label: "Add Block", icon: Plus, onClick: () => setAddBlockOpen(true) }}
      />

      <Select value={selectedAudiId} onValueChange={setSelectedAudiId}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select an audi" />
        </SelectTrigger>
        <SelectContent>
          {(audis ?? []).map(a => (
            <SelectItem key={a.id ?? a._id} value={a.id ?? a._id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_LABELS.map(d => (
              <div key={d} className="h-8 flex items-center justify-center text-xs text-muted-foreground font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map(day => {
              const dateStr = toAPIDate(day)
              const hasBlock = blockedDates.has(dateStr)
              const isSelected = selectedDay && isSameDay(day, selectedDay)
              const todayFlag = isToday(day)
              return (
                <button
                  key={dateStr}
                  onClick={() => { if (selectedAudiId) setSelectedDay(day) }}
                  className={cn(
                    "h-10 w-full flex flex-col items-center justify-center rounded-md text-sm transition-colors",
                    isSelected && "bg-nfdc-primary text-white",
                    !isSelected && hasBlock && "bg-red-100 text-red-700",
                    !isSelected && !hasBlock && todayFlag && "font-bold ring-1 ring-nfdc-accent",
                    !isSelected && !hasBlock && "hover:bg-muted/50",
                    !selectedAudiId && "cursor-default opacity-60"
                  )}
                >
                  <span>{format(day, "d")}</span>
                  {hasBlock && !isSelected && <span className="h-1 w-1 rounded-full bg-red-500 mt-0.5" />}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day panel */}
      {selectedDay && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{format(selectedDay, "EEEE, MMMM d yyyy")}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDay(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {selectedDayBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No blocks on this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayBlocks.map(block => (
                  <div key={block.id ?? block._id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">{block.isFullDay ? "Full Day" : `${block.startTime}–${block.endTime}`}</p>
                      <p className="text-xs text-muted-foreground">{block.reason}</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setUnblockTarget(block)}
                    >Unblock</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Block Dialog */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Add Block</DialogTitle></DialogHeader>
          <div className="mb-4">
            <RadioGroup value={blockType} onValueChange={setBlockType} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full">Full Day</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial">Partial</Label>
              </div>
            </RadioGroup>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-4">
              <FormDatePicker control={form.control} name="date" label="Date" />
              {blockType === "partial" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormInput control={form.control} name="startTime" label="Start Time" type="time" />
                  <FormInput control={form.control} name="endTime" label="End Time" type="time" />
                </div>
              )}
              <FormTextarea control={form.control} name="reason" label="Reason" rows={2} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddBlockOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || !selectedAudiId} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Block
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Unblock alert */}
      <AlertDialog open={!!unblockTarget} onOpenChange={(o) => !o && setUnblockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this block?</AlertDialogTitle>
            <AlertDialogDescription>This time slot will become bookable again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateMutation.mutate(unblockTarget.id ?? unblockTarget._id)}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
