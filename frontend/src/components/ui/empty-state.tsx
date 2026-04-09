import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("glass-panel border-dashed border-border/60 bg-background/50", className)}>
      <CardContent className="flex flex-col items-center justify-center px-4 py-14 text-center">
        {Icon && (
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary/10 text-primary shadow-sm">
            <Icon className="h-8 w-8" />
          </div>
        )}
        <h3 className="mb-2 text-xl font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="mb-5 max-w-md text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
        {action && (
          <Button onClick={action.onClick} variant="outline" className="rounded-2xl px-4">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
