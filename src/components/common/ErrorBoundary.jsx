import { Component } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CircleAlert } from "lucide-react"

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex items-center justify-center p-10">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center text-center py-10 gap-4">
            <CircleAlert className="h-10 w-10 text-red-500" />
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            {import.meta.env.DEV && (
              <code className="text-xs bg-muted p-2 rounded text-left w-full overflow-auto">
                {this.state.error?.message}
              </code>
            )}
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
