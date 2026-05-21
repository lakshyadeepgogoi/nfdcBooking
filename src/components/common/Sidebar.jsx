import { Link, useLocation, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"

function getInitials(name) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function SidebarContent({ navItems, onClose }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, role, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  return (
    <div className="flex flex-col h-full py-4 px-3">
      <div className="px-1 mb-3">
        <p className="text-white font-bold text-lg leading-none">NFDC</p>
        <p className="text-white/60 text-xs mt-0.5">Admin</p>
      </div>
      <Separator className="bg-white/20 mb-3" />

      <nav className="flex-1 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/")
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 py-2 px-3 rounded-lg text-white/80 hover:bg-white/10 transition-colors text-sm",
                isActive && "bg-white/15 text-white font-medium"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge != null && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {item.badge}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-3 border-t border-white/20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-left">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.name ?? "Admin"}</p>
                <p className="text-white/60 text-xs capitalize truncate">{role?.replace("_", " ")}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem disabled>Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default function Sidebar({ navItems, isMobileOpen, onMobileClose }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-nfdc-primary fixed left-0 top-0 h-full z-30">
        <SidebarContent navItems={navItems} onClose={undefined} />
      </aside>

      {/* Mobile sidebar via Sheet */}
      <Sheet open={isMobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="w-[240px] p-0 bg-nfdc-primary border-r-0">
          <SidebarContent navItems={navItems} onClose={onMobileClose} />
        </SheetContent>
      </Sheet>
    </>
  )
}
