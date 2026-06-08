import { useState, useEffect } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetPassword } from "@/api/auth"

export default function ResetPassword() {
  const [searchParams]          = useSearchParams()
  const navigate                = useNavigate()
  const token                   = searchParams.get("token") ?? ""

  const [password,    setPassword]    = useState("")
  const [confirm,     setConfirm]     = useState("")
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error,       setError]       = useState("")
  const [done,        setDone]        = useState(false)

  // No token in URL → show error immediately
  const noToken = !token

  const mutation = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: () => {
      setDone(true)
      setTimeout(() => navigate("/login", { replace: true }), 3000)
    },
    onError: (err) => setError(err?.response?.data?.message ?? "Something went wrong. Please try again."),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError("")
    if (password.length < 8)        { setError("Password must be at least 8 characters"); return }
    if (password !== confirm)        { setError("Passwords do not match"); return }
    mutation.mutate()
  }

  if (noToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <div className="space-y-1">
            <p className="font-semibold">Invalid reset link</p>
            <p className="text-sm text-muted-foreground">
              This link is missing a reset token. Please use the link from your email exactly as sent.
            </p>
          </div>
          <Link to="/forgot-password" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">NFDC Admin</h1>
          <p className="text-sm text-muted-foreground">Set a new password</p>
        </div>

        <div className="bg-background rounded-xl border shadow-sm p-6 space-y-5">
          {done ? (
            /* ── Success state ── */
            <div className="space-y-4 text-center py-2">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <div className="space-y-1">
                <p className="font-semibold">Password updated!</p>
                <p className="text-sm text-muted-foreground">
                  Your password has been reset successfully. Redirecting to login…
                </p>
              </div>
            </div>
          ) : (
            /* ── Form state ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="Min 8 characters"
                    className="pl-9 pr-9"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={mutation.isPending}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter password"
                    className="pl-9 pr-9"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    disabled={mutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
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
                Reset Password
              </Button>
            </form>
          )}
        </div>

        {!done && (
          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
