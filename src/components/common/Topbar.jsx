import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Menu, Bell, LogOut, CheckCircle2, XCircle,
  RefreshCw, Clock, ArrowRight,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/useAuth"
import { listNotifications } from "@/api/notifications"
import { formatDate } from "@/utils/formatDate"
import { parseList } from "@/utils/parseList"
import { cn } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return "?"
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function relativeTime(date) {
  if (!date) return ""
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }) } catch { return "" }
}

const TYPE_CONFIG = {
  confirmation: { Icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-100",  label: "Confirmed"   },
  cancellation: { Icon: XCircle,      color: "text-red-600",    bg: "bg-red-100",    label: "Cancelled"   },
  postpone:     { Icon: RefreshCw,    color: "text-indigo-600", bg: "bg-indigo-100", label: "Postponed"   },
  prepone:      { Icon: RefreshCw,    color: "text-indigo-600", bg: "bg-indigo-100", label: "Preponed"    },
  reminder:     { Icon: Clock,        color: "text-amber-600",  bg: "bg-amber-100",  label: "Reminder"    },
}

const STATUS_DOT = {
  sent:   "bg-green-500",
  failed: "bg-red-500",
  queued: "bg-amber-400",
}

const STORAGE_KEY = "notif_last_viewed"

// ─── Notification item ────────────────────────────────────────────────────────

function NotifItem({ n, isNew, onClick }) {
  const type   = n.details?.type ?? ""
  const cfg    = TYPE_CONFIG[type] ?? { Icon: Bell, color: "text-muted-foreground", bg: "bg-muted", label: type }
  const status = n.lifecycle?.status ?? "queued"
  const bookingId = n.relationships?.bookingId

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
        isNew && "bg-nfdc-primary/3"
      )}
    >
      {/* Type icon */}
      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", cfg.bg)}>
        <cfg.Icon className={cn("h-4 w-4", cfg.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug truncate">
            {n.details?.subject ?? cfg.label}
          </p>
          {isNew && (
            <span className="h-2 w-2 rounded-full bg-nfdc-primary shrink-0 mt-1.5" />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {bookingId && (
            <span className="font-mono text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
              #{String(bookingId).slice(-8).toUpperCase()}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status] ?? "bg-muted-foreground")} />
            {status}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</p>
      </div>
    </button>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

export default function Topbar({ title, onMobileMenuToggle }) {
  const navigate = useNavigate()
  const { user, role, logout } = useAuth()
  const isTheaterAdmin = role === "theater-admin"

  const [open, setOpen] = useState(false)

  // Track last-viewed timestamp in localStorage
  const lastViewed = Number(localStorage.getItem(STORAGE_KEY) ?? 0)

  // Backend filters by adminUser.theaterId from JWT — no theaterId param needed.
  // We include it in the queryKey so the cache is isolated per admin/theater.
  const { data: notifRaw, isLoading } = useQuery({
    queryKey: ["notifications", user?.theaterId],
    queryFn:  () => listNotifications({ limit: 10 }).then((r) => r.data.data),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    enabled: isTheaterAdmin && !!user?.theaterId,
  })

  const notifications = isTheaterAdmin ? parseList(notifRaw).slice(0, 8) : []

  // Count notifications newer than last-viewed
  const unreadCount = notifications.filter(
    (n) => n.createdAt && new Date(n.createdAt).getTime() > lastViewed
  ).length

  const handleOpen = (isOpen) => {
    setOpen(isOpen)
    if (isOpen) localStorage.setItem(STORAGE_KEY, String(Date.now()))
  }

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  return (
    <header className="h-14 border-b bg-background flex items-center px-4 gap-3 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open menu"
        onClick={onMobileMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <span className="text-lg font-semibold flex-1 truncate">{title}</span>

      <span className="text-muted-foreground text-sm hidden sm:block shrink-0">
        {formatDate(new Date())}
      </span>

      {/* Notifications — theater admin only */}
      {isTheaterAdmin && (
        <Popover open={open} onOpenChange={handleOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-[360px] p-0 shadow-lg" align="end">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <Badge className="bg-nfdc-primary text-white text-[10px] px-1.5 py-0 h-4">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <Link
                to="/admin/notifications"
                className="text-xs text-nfdc-primary hover:underline flex items-center gap-0.5"
                onClick={() => setOpen(false)}
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto">
              {isLoading ? (
                <div className="space-y-0 divide-y">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                        <div className="h-2.5 bg-muted rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">All caught up</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((n, i) => {
                    const isNew = n.createdAt
                      ? new Date(n.createdAt).getTime() > lastViewed
                      : false
                    return (
                      <NotifItem
                        key={n.notificationId ?? n._id ?? i}
                        n={n}
                        isNew={isNew}
                        onClick={() => {
                          if (n.relationships?.bookingId) {
                            navigate(`/admin/bookings/${n.relationships.bookingId}`)
                          }
                          setOpen(false)
                        }}
                      />
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <>
                <Separator />
                <div className="px-4 py-2.5 text-center">
                  <Link
                    to="/admin/notifications"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    See all notifications
                  </Link>
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
      )}

      {/* Avatar / profile dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="cursor-pointer h-8 w-8">
            <AvatarFallback className="text-sm">{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={role === "super-admin" ? "/super/profile" : "/admin/profile"}>
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
