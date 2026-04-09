/**
 * Activity Feed Component
 * Shows recent actions and activities
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Wrench, 
  X, 
  RefreshCw, 
  GitBranch, 
  Shield, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  FileCode,
} from 'lucide-react'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
  id: string
  action: string
  entityType: string
  entityId?: string
  details?: any
  createdAt: string
  repository?: {
    name: string
    fullName: string
  }
}

const actionIcons: Record<string, any> = {
  fix_applied: Wrench,
  fix_rejected: X,
  review_rerun: RefreshCw,
  repo_connected: GitBranch,
  fix_rollback: RefreshCw,
  review_completed: CheckCircle2,
  critical_issue: AlertTriangle,
}

const actionColors: Record<string, string> = {
  fix_applied: 'text-green-600',
  fix_rejected: 'text-red-600',
  review_rerun: 'text-blue-600',
  repo_connected: 'text-purple-600',
  fix_rollback: 'text-orange-600',
  review_completed: 'text-green-600',
  critical_issue: 'text-red-600',
}

const useActivityFeed = (limit = 20) => {
  return useQuery<ActivityItem[]>({
    queryKey: ['activity-feed', limit],
    queryFn: async () => {
      const { data } = await api.get('/audit-logs', {
        params: { limit, orderBy: 'createdAt', order: 'desc' },
      })
      return data.logs || []
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  })
}

export function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const { data: activities, isLoading } = useActivityFeed(limit)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>Recent actions and activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No recent activity
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
        <CardDescription>Recent actions and activities</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const Icon = actionIcons[activity.action] || FileCode
              const color = actionColors[activity.action] || 'text-muted-foreground'
              const details = activity.details ? (typeof activity.details === 'string' ? JSON.parse(activity.details) : activity.details) : null

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {formatAction(activity.action)}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {activity.repository && (
                      <p className="text-xs text-muted-foreground">
                        {activity.repository.fullName}
                      </p>
                    )}
                    {details && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {details.commitSha && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {details.commitSha.slice(0, 7)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    fix_applied: 'Fix Applied',
    fix_rejected: 'Fix Rejected',
    review_rerun: 'Review Re-run',
    repo_connected: 'Repository Connected',
    fix_rollback: 'Fix Rolled Back',
    review_completed: 'Review Completed',
    critical_issue: 'Critical Issue Found',
  }
  return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
