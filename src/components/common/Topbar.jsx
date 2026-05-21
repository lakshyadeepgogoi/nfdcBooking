import { useNavigate, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Menu, Bell, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/useAuth"
import { listNotifications } from "@/api/notifications"
import { formatDate, formatDateTime } from "@/utils/formatDate"
import { parseList } from "@/utils/parseList"

function getInitials(name) {
  if (!name) return "?"
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export default function Topbar({ title, onMobileMenuToggle }) {
  const navigate = useNavigate()
  const { user, role, logout } = useAuth()

  const { data: notifRaw } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications().then((r) => r.data.data),
    staleTime: 60_000,
  })

  const notifications = parseList(notifRaw).slice(0, 5)
  const hasNew = notifications.length > 0

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  const notifPath = role === "theater-admin" ? "/admin/notifications" : "/super/logs"

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

      {/* Notifications Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {hasNew && (
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="font-medium text-sm">Notifications</span>
            <span className="text-xs text-muted-foreground cursor-default">Mark all read</span>
          </div>
          <Separator />
          {notifications.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-4">No notifications</p>
          ) : (
            notifications.map((n, i) => (
              <div key={n.id ?? n._id ?? i} className="px-3 py-2 border-b last:border-0">
                <p className="text-sm truncate">{String(n.message ?? "").slice(0, 60)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {n.createdAt ? formatDateTime(n.createdAt) : ""}
                </p>
              </div>
            ))
          )}
          <Separator />
          <div className="px-3 py-2 text-center">
            <Link to={notifPath} className="text-sm text-nfdc-accent hover:underline">
              View all notifications →
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="cursor-pointer h-8 w-8">
            <AvatarFallback className="text-sm">{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>Profile</DropdownMenuItem>
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
