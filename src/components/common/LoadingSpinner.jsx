import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function LoadingSpinner({ fullPage }) {
  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 z-50">
        <Loader2 className="h-8 w-8 animate-spin text-nfdc-accent" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-6">
      <Loader2 className="h-6 w-6 animate-spin text-nfdc-accent" />
    </div>
  )
}
