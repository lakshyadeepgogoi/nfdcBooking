import { useState } from "react"
import { Link } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { forgotPassword } from "@/api/auth"

export default function ForgotPassword() {
  const [email, setEmail]   = useState("")
  const [sent,  setSent]    = useState(false)
  const [error, setError]   = useState("")

  const mutation = useMutation({
    mutationFn: () => forgotPassword(email),
    onSuccess: () => setSent(true),
    onError: (err) => setError(err?.response?.data?.message ?? "Something went wrong. Please try again."),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError("")
    if (!email.trim()) { setError("Email is required"); return }
    mutation.mutate()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / brand */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">NFDC Admin</h1>
          <p className="text-sm text-muted-foreground">Reset your password</p>
        </div>

        <div className="bg-background rounded-xl border shadow-sm p-6 space-y-5">

          {sent ? (
            /* ── Success state ── */
            <div className="space-y-4 text-center py-2">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <div className="space-y-1">
                <p className="font-semibold">Check your inbox</p>
                <p className="text-sm text-muted-foreground">
                  If <strong>{email}</strong> is registered, a password reset link has been sent.
                  It expires in 10 minutes.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive it? Check spam or{" "}
                <button
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => { setSent(false); mutation.reset() }}
                >
                  try again
                </button>.
              </p>
            </div>
          ) : (
            /* ── Form state ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">
                  Enter your registered email address and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-9"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={mutation.isPending}
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-nfdc-primary hover:bg-nfdc-primary/90"
                disabled={mutation.isPending}
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          )}
        </div>

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
