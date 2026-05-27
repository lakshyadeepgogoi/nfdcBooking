import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

// Native implementation — bypasses @radix-ui/react-checkbox's setControl/setState
// ref pattern which causes an infinite loop with React 19.2 + radix-ui 1.4.x.
const Checkbox = React.forwardRef(function Checkbox(
  { className, checked, defaultChecked, onCheckedChange, onClick, disabled, ...props },
  ref
) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const isChecked = isControlled ? checked : uncontrolled

  const handleClick = (e) => {
    onClick?.(e)
    if (disabled) return
    const next = !isChecked
    if (!isControlled) setUncontrolled(next)
    onCheckedChange?.(next)
  }

  return (
    <button
      type="button"
      role="checkbox"
      ref={ref}
      aria-checked={isChecked}
      data-state={isChecked ? "checked" : "unchecked"}
      data-disabled={disabled ? "" : undefined}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "group peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      <span
        data-slot="checkbox-indicator"
        className="hidden group-data-[state=checked]:grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon />
      </span>
    </button>
  )
})

Checkbox.displayName = "Checkbox"

export { Checkbox }
