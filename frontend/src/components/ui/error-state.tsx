import { AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading data. Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Card className={cn("glass-panel border-destructive/30 bg-background/60", className)}>
      <CardContent className="flex flex-col items-center justify-center px-4 py-14 text-center">
        <div className="mb-5 rounded-[1.5rem] bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="mb-2 text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mb-5 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="gap-2 rounded-2xl px-4">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
