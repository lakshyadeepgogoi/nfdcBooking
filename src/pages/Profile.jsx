import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, User, Shield, Mail, Calendar, Building2, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import PageHeader from "@/components/common/PageHeader"
import FormInput from "@/components/forms/FormInput"
import { useAuth } from "@/hooks/useAuth"
import { getProfile, updateProfile, changePassword } from "@/api/auth"
import { formatDateTime } from "@/utils/formatDate"

function getInitials(name) {
  if (!name) return "?"
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="h-8 w-8 rounded-full bg-nfdc-pale flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-nfdc-accent" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium mt-0.5 break-all">{value ?? "—"}</p>
      </div>
    </div>
  )
}

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

export default function Profile() {
  useEffect(() => {
    document.title = "NFDC Admin — Profile"
  }, [])

  const { user, role } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("account")

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile().then((r) => {
      const payload = r.data?.data ?? r.data
      return payload?.admin ?? payload?.user ?? payload
    }),
    staleTime: 30_000,
  })

  const displayUser = profileData ?? user

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "" },
  })

  useEffect(() => {
    if (displayUser?.name) {
      profileForm.reset({ name: displayUser.name })
    }
  }, [displayUser?.name, profileForm])

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => updateProfile(data),
    onSuccess: () => {
      toast.success("Profile updated successfully")
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message ?? "Failed to update profile")
    },
  })

  const passwordMutation = useMutation({
    mutationFn: (data) => changePassword({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    }),
    onSuccess: () => {
      toast.success("Password changed successfully")
      passwordForm.reset()
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message ?? "Failed to change password")
    },
  })

  const roleBadgeVariant = role === "super-admin" ? "default" : "secondary"
  const roleLabel = role === "super-admin" ? "Super Admin" : "Theater Admin"

  const lastLogin = displayUser?.profile?.lastLoginAt ?? displayUser?.lastLoginAt
  const memberSince = displayUser?.createdAt
  const theaterId = displayUser?.theaterId ?? displayUser?.relationships?.theaterId

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="View and manage your account details"
      />

      {/* Profile Overview Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarFallback className="bg-nfdc-pale text-nfdc-accent text-2xl font-bold">
                {isLoading ? "?" : getInitials(displayUser?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              {isLoading ? (
                <>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-36 mb-3" />
                  <Skeleton className="h-5 w-24" />
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold">{displayUser?.name ?? "Admin"}</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">{displayUser?.email}</p>
                  <div className="mt-2 flex items-center gap-2 justify-center sm:justify-start">
                    <Badge variant={roleBadgeVariant} className={role === "super-admin" ? "bg-nfdc-primary" : ""}>
                      {roleLabel}
                    </Badge>
                    {displayUser?.lifecycle?.status && (
                      <Badge variant="outline" className="capitalize text-green-600 border-green-300 bg-green-50">
                        {displayUser.lifecycle.status}
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="account">Account Info</TabsTrigger>
          <TabsTrigger value="edit">Edit Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* ── Account Info Tab ── */}
        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Details</CardTitle>
              <CardDescription>Your personal information and account metadata</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {isLoading ? (
                <div className="space-y-4 py-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-4 w-40" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <InfoRow icon={User} label="Full Name" value={displayUser?.name} />
                  <InfoRow icon={Mail} label="Email Address" value={displayUser?.email} />
                  <InfoRow icon={Shield} label="Role" value={roleLabel} />
                  {theaterId && (
                    <InfoRow icon={Building2} label="Theater ID" value={theaterId} />
                  )}
                  {memberSince && (
                    <InfoRow icon={Calendar} label="Member Since" value={formatDateTime(memberSince)} />
                  )}
                  {lastLogin && (
                    <InfoRow icon={KeyRound} label="Last Login" value={formatDateTime(lastLogin)} />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Edit Profile Tab ── */}
        <TabsContent value="edit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edit Profile</CardTitle>
              <CardDescription>Update your display name</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form
                  onSubmit={profileForm.handleSubmit((data) => updateMutation.mutate(data))}
                  className="space-y-4 max-w-md"
                >
                  <FormInput
                    control={profileForm.control}
                    name="name"
                    label="Full Name"
                    placeholder="Your full name"
                  />
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Email Address</Label>
                    <Input value={displayUser?.email ?? ""} disabled readOnly />
                    <p className="text-xs text-muted-foreground">Email cannot be changed. Contact a super admin if needed.</p>
                  </div>
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

        {/* ── Security Tab ── */}
        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}
                  className="space-y-4 max-w-md"
                >
                  <FormInput
                    control={passwordForm.control}
                    name="currentPassword"
                    label="Current Password"
                    type="password"
                    placeholder="Enter current password"
                  />
                  <Separator />
                  <FormInput
                    control={passwordForm.control}
                    name="newPassword"
                    label="New Password"
                    type="password"
                    placeholder="At least 8 characters"
                  />
                  <FormInput
                    control={passwordForm.control}
                    name="confirmPassword"
                    label="Confirm New Password"
                    type="password"
                    placeholder="Repeat new password"
                  />
                  <Button
                    type="submit"
                    disabled={passwordMutation.isPending}
                    className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90"
                  >
                    {passwordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
