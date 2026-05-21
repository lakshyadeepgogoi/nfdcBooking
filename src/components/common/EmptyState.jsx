import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        {Icon && <Icon className="h-10 w-10 text-muted-foreground mb-3" />}
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm mt-1">{message}</p>
        {action && (
          <Button className="mt-4" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
