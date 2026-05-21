import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"

export default function FormTextarea({ control, name, label, placeholder, rows, disabled }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea placeholder={placeholder} rows={rows} disabled={disabled} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
