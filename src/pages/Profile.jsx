import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Loader2, User, Shield, Mail, Calendar, Building2, KeyRound,
  Settings2, Lock, CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import PageHeader from "@/components/common/PageHeader"
import StatusBadge from "@/components/common/StatusBadge"
import FormInput from "@/components/forms/FormInput"
import { useAuth } from "@/hooks/useAuth"
import { getProfile, updateProfile, changePassword } from "@/api/auth"
import { formatDateTime } from "@/utils/formatDate"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return "?"
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">{label}</p>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function InfoChip({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/20">
      <div className="h-8 w-8 rounded-md bg-nfdc-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-nfdc-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium mt-0.5 break-all">{value}</p>
      </div>
    </div>
  )
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword:     z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Profile() {
  useEffect(() => { document.title = "NFDC Admin — Profile" }, [])

  const { user, role } = useAuth()
  const queryClient    = useQueryClient()
  const [activeTab, setActiveTab] = useState("account")

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn:  () => getProfile().then((r) => {
      const payload = r.data?.data ?? r.data
      return payload?.admin ?? payload?.user ?? payload
    }),
    staleTime: 30_000,
  })

  const displayUser = profileData ?? user

  const profileForm = useForm({
    resolver:      zodResolver(profileSchema),
    defaultValues: { name: "" },
  })

  useEffect(() => {
    if (displayUser?.name) profileForm.reset({ name: displayUser.name })
  }, [displayUser?.name, profileForm])

  const passwordForm = useForm({
    resolver:      zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => updateProfile(data),
    onSuccess: () => {
      toast.success("Profile updated")
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Failed to update profile"),
  })

  const passwordMutation = useMutation({
    mutationFn: (data) => changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
    onSuccess: () => { toast.success("Password changed"); passwordForm.reset() },
    onError:   (err) => toast.error(err?.response?.data?.message ?? "Failed to change password"),
  })

  const roleLabel    = role === "super-admin" ? "Super Admin" : "Theater Admin"
  const lastLogin    = displayUser?.profile?.lastLoginAt ?? displayUser?.lastLoginAt
  const memberSince  = displayUser?.createdAt
  const theaterId    = displayUser?.theaterId ?? displayUser?.relationships?.theaterId

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" />

      {/* ── Hero card ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-nfdc-primary/15 via-nfdc-primary/8 to-transparent" />
        <CardContent className="px-6 pb-6 -mt-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
            <Avatar className="h-20 w-20 border-4 border-background shadow-md shrink-0">
              <AvatarFallback className="bg-nfdc-primary text-white text-2xl font-bold">
                {isLoading ? "?" : getInitials(displayUser?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left pb-1 flex-1 min-w-0">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40 mx-auto sm:mx-0" />
                  <Skeleton className="h-4 w-56 mx-auto sm:mx-0" />
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold truncate">{displayUser?.name ?? "Admin"}</h2>
                  <p className="text-sm text-muted-foreground truncate">{displayUser?.email}</p>
                </>
              )}
            </div>
            {!isLoading && (
              <div className="flex items-center gap-2 shrink-0 pb-1">
                <Badge
                  variant={role === "super-admin" ? "default" : "secondary"}
                  className={role === "super-admin" ? "bg-nfdc-primary" : ""}
                >
                  {roleLabel}
                </Badge>
                {displayUser?.lifecycle?.status && (
                  <StatusBadge status={displayUser.lifecycle.status} />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="flex h-auto gap-0 rounded-none bg-transparent p-0">
            {[
              { value: "account",  label: "Account Info",  Icon: User      },
              { value: "edit",     label: "Edit Profile",  Icon: Settings2 },
              { value: "security", label: "Security",      Icon: Lock      },
            ].map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent -mb-px bg-transparent px-5 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-nfdc-primary data-[state=active]:bg-transparent data-[state=active]:text-nfdc-primary data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">

          {/* ── Account Info ── */}
          <TabsContent value="account" className="mt-0">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-lg border bg-muted/20">
                    <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-2.5 w-16" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <InfoChip icon={User}      label="Full Name"     value={displayUser?.name} />
                  <InfoChip icon={Mail}      label="Email Address" value={displayUser?.email} />
                  <InfoChip icon={Shield}    label="Role"          value={roleLabel} />
                  {theaterId && (
                    <InfoChip icon={Building2} label="Theater ID"   value={theaterId} />
                  )}
                  {memberSince && (
                    <InfoChip icon={Calendar}  label="Member Since" value={formatDateTime(memberSince)} />
                  )}
                  {lastLogin && (
                    <InfoChip icon={KeyRound}  label="Last Login"   value={formatDateTime(lastLogin)} />
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Edit Profile ── */}
          <TabsContent value="edit" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card>
                  <CardContent className="pt-6">
                    <Form {...profileForm}>
                      <form onSubmit={profileForm.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-6">
                        <SectionHeader label="Personal Info" />
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
                        <div className="pt-2">
                          <Button type="submit" disabled={updateMutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2 h-fit">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Only your display name can be updated here. For email or role changes, contact your super admin.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ── Security ── */}
          <TabsContent value="security" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card>
                  <CardContent className="pt-6">
                    <Form {...passwordForm}>
                      <form onSubmit={passwordForm.handleSubmit((d) => passwordMutation.mutate(d))} className="space-y-6">
                        <SectionHeader label="Current Password" />
                        <FormInput
                          control={passwordForm.control}
                          name="currentPassword"
                          label="Current Password"
                          type="password"
                          placeholder="Enter your current password"
                        />
                        <SectionHeader label="New Password" />
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
                        <div className="pt-2">
                          <Button type="submit" disabled={passwordMutation.isPending} className="bg-nfdc-primary hover:bg-nfdc-primary/90">
                            {passwordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Change Password
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>

              {/* Security tips */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3 h-fit">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password Tips</p>
                <ul className="space-y-2">
                  {[
                    "At least 8 characters long",
                    "Mix upper and lowercase letters",
                    "Include numbers or symbols",
                    "Don't reuse old passwords",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  )
}
