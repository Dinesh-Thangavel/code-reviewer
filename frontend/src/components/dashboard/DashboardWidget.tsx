/**
 * Dashboard Widget Component
 * Reusable widget for customizable dashboard
 */

import { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GripVertical, X } from 'lucide-react'

interface DashboardWidgetProps {
  id: string
  title: string
  description?: string
  children: ReactNode
  onRemove?: (id: string) => void
  isDraggable?: boolean
  className?: string
}

export function DashboardWidget({
  id,
  title,
  description,
  children,
  onRemove,
  isDraggable = false,
  className,
}: DashboardWidgetProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDraggable && (
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
            )}
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {description && (
                <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
              )}
            </div>
          </div>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onRemove(id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
