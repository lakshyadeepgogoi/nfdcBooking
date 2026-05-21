import { Button } from "@/components/ui/button"

/**
 * PageHeader — page-level header with optional action area.
 *
 * Two ways to provide actions:
 *   1. `action` prop  — { label, icon, onClick } — renders a single Button
 *   2. `children`     — any JSX, rendered as-is in the action area.
 *                       Use this with <RoleGuard> for role-conditional buttons.
 *
 * Example with RoleGuard:
 *   <PageHeader title="Bookings">
 *     <RoleGuard permissions={PERMISSIONS.CREATE_MANUAL_BOOKING}>
 *       <Button onClick={...}>Manual Booking</Button>
 *     </RoleGuard>
 *   </PageHeader>
 */
export default function PageHeader({ title, subtitle, action, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
      </div>

      {/* Action area — either prop-based button or arbitrary children */}
      {(action || children) && (
        <div className="flex items-center gap-2 shrink-0">
          {action && (
            <Button onClick={action.onClick}>
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
