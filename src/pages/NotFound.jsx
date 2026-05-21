import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"

export default function NotFound() {
  useEffect(() => { document.title = "NFDC Admin — 404" }, [])

  const navigate = useNavigate()
  const { role, isAuthenticated } = useAuth()

  const dashPath = isAuthenticated
    ? role === "theater-admin" ? "/admin/dashboard"
    : role === "super-admin" ? "/super/dashboard"
    : "/login"
    : "/login"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-8xl font-black text-muted-foreground/20 leading-none select-none">404</p>
      <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground text-sm max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3 mt-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
        <Button className="bg-nfdc-primary hover:bg-nfdc-primary/90" onClick={() => navigate(dashPath)}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}
