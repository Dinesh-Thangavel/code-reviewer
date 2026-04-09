import { Check, X, Loader2, AlertCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { FixStatus } from '@/hooks/usePRDetail'

interface FixStatusBadgeProps {
  status: FixStatus
  className?: string
}

export function FixStatusBadge({ status, className }: FixStatusBadgeProps) {
  switch (status) {
    case 'APPLIED':
      return (
        <Badge variant="default" className={`bg-green-600 hover:bg-green-700 gap-1 ${className}`}>
          <Check className="h-3 w-3" />
          Fixed
        </Badge>
      )
    case 'REJECTED':
      return (
        <Badge variant="secondary" className={`gap-1 ${className}`}>
          <X className="h-3 w-3" />
          Dismissed
        </Badge>
      )
    case 'FAILED':
      return (
        <Badge variant="destructive" className={`gap-1 ${className}`}>
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    case 'PENDING':
    default:
      return (
        <Badge variant="outline" className={`gap-1 ${className}`}>
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      )
  }
}
