import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Home, Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"

export default function NotFound() {
  useEffect(() => { document.title = "NFDC Admin — 404" }, [])

  const navigate = useNavigate()
  const { role, isAuthenticated } = useAuth()

  const dashPath = isAuthenticated
    ? role === "theater-admin" ? "/admin/dashboard"
    : role === "super-admin"  ? "/super/dashboard"
    : "/login"
    : "/login"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="flex flex-col items-center text-center max-w-md space-y-6">

        {/* Icon */}
        <div className="h-20 w-20 rounded-2xl bg-nfdc-primary/10 flex items-center justify-center">
          <Compass className="h-10 w-10 text-nfdc-primary" />
        </div>

        {/* 404 */}
        <p className="text-[7rem] font-black leading-none tracking-tighter text-nfdc-primary/10 select-none">
          404
        </p>

        {/* Text */}
        <div className="space-y-2 -mt-4">
          <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </Button>
          <Button
            className="bg-nfdc-primary hover:bg-nfdc-primary/90 gap-2"
            onClick={() => navigate(dashPath)}
          >
            <Home className="h-4 w-4" /> Dashboard
          </Button>
        </div>

      </div>
    </div>
  )
}
