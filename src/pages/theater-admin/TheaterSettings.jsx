import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Form } from "@/components/ui/form"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import PageHeader from "@/components/common/PageHeader"
import FormInput from "@/components/forms/FormInput"
import FormTextarea from "@/components/forms/FormTextarea"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import { useAuth } from "@/hooks/useAuth"
import {
  getTheaterProfile,
  updateTheater,
  getTnC,
  updateTnCDraft,
  publishTnC,
} from "@/api/theaters"

const theaterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  phone: z.string().min(10, "Phone must be at least 10 characters"),
  email: z.string().email("Enter a valid email"),
  description: z.string().optional(),
})

export default function TheaterSettings() {
  useEffect(() => {
    document.title = "NFDC Admin — Theater Settings"
  }, [])

  const { user } = useAuth()
  const theaterId = user?.theaterId
  const queryClient = useQueryClient()
  const [tncContent, setTncContent] = useState("")
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)

  const { data: theaterData, isLoading: theaterLoading } = useQuery({
    queryKey: ["theater", theaterId],
    queryFn: () => getTheaterProfile(theaterId).then((r) => r.data.data),
    enabled: !!theaterId,
  })

  const { data: tncData, isLoading: tncLoading } = useQuery({
    queryKey: ["tnc", theaterId],
    queryFn: () => getTnC(theaterId).then((r) => r.data.data),
    enabled: !!theaterId,
  })

  useEffect(() => {
    if (tncData?.content != null) {
      setTncContent(tncData.content)
    }
  }, [tncData])

  const form = useForm({
    resolver: zodResolver(theaterSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
      description: "",
    },
  })

  useEffect(() => {
    if (theaterData) {
      form.reset({
        name: theaterData.name ?? "",
        address: theaterData.address ?? "",
        phone: theaterData.phone ?? "",
        email: theaterData.email ?? "",
        description: theaterData.description ?? "",
      })
    }
  }, [theaterData, form])

  const updateMutation = useMutation({
    mutationFn: (data) => updateTheater(theaterId, data),
    onSuccess: () => {
      toast.success("Theater updated successfully")
      queryClient.invalidateQueries({ queryKey: ["theater", theaterId] })
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const saveDraftMutation = useMutation({
    mutationFn: () => updateTnCDraft(theaterId, { content: tncContent }),
    onSuccess: () => toast.success("Draft saved"),
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  const publishMutation = useMutation({
    mutationFn: () => publishTnC(theaterId),
    onSuccess: () => {
      toast.success("Terms published")
      queryClient.invalidateQueries({ queryKey: ["tnc", theaterId] })
      setPublishDialogOpen(false)
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  })

  if (theaterLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <PageHeader title="Theater Settings" />

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Theater Info</TabsTrigger>
          <TabsTrigger value="tnc">Terms &amp; Conditions</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theater Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))}
                  className="space-y-4 max-w-2xl"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormInput control={form.control} name="name" label="Theater Name" placeholder="NFDC Cinemas" />
                    <FormInput control={form.control} name="phone" label="Phone" placeholder="+91 98765 43210" />
                  </div>
                  <FormInput control={form.control} name="email" label="Email" type="email" placeholder="contact@theater.in" />
                  <FormTextarea control={form.control} name="address" label="Address" placeholder="123 Main Street, City" rows={2} />
                  <FormTextarea control={form.control} name="description" label="Description (optional)" placeholder="About this theater..." rows={3} />
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90"
                  >
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tnc" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Terms &amp; Conditions</CardTitle>
              {!tncLoading && (
                <p className="text-sm text-muted-foreground">
                  Published version: v{tncData?.version ?? 1}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
              <Textarea
                value={tncContent}
                onChange={(e) => setTncContent(e.target.value)}
                placeholder="Enter terms and conditions..."
                rows={14}
                className="font-mono text-sm"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={saveDraftMutation.isPending}
                >
                  {saveDraftMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Draft
                </Button>
                <Button
                  onClick={() => setPublishDialogOpen(true)}
                  className="bg-nfdc-primary hover:bg-nfdc-primary/90"
                >
                  Publish
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Terms &amp; Conditions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will increment the version to v{(tncData?.version ?? 1) + 1} and make it live
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="bg-nfdc-primary hover:bg-nfdc-primary/90"
            >
              {publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
