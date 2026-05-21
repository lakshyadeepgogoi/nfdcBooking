import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import FormInput from "@/components/forms/FormInput"
import { useAuth } from "@/hooks/useAuth"

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export default function AdminLogin() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState("")
  const [isPending, setIsPending] = useState(false)

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (values) => {
    setError("")
    setIsPending(true)
    const result = await login(values.email, values.password)
    setIsPending(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    if (result.role === "theater-admin") {
      navigate("/admin/dashboard")
    } else if (result.role === "super-admin") {
      navigate("/super/dashboard")
    } else {
      setError("Unauthorized: invalid admin role.")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <p className="text-nfdc-primary font-bold text-2xl">NFDC</p>
          <p className="text-muted-foreground text-sm">Theater Booking Admin</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormInput
                control={form.control}
                name="email"
                label="Email"
                type="email"
                placeholder="admin@nfdc.gov.in"
              />
              <FormInput
                control={form.control}
                name="password"
                label="Password"
                type="password"
              />

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
