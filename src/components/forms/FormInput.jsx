import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

export default function FormInput({ control, name, label, placeholder, type = "text", disabled, hint }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} placeholder={placeholder} disabled={disabled} {...field} />
          </FormControl>
          <FormMessage />
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </FormItem>
      )}
    />
  )
}
