/**
 * Audit Logs Page
 * Comprehensive audit log viewer with filters and search
 */

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import {
  Wrench,
  X,
  RefreshCw,
  GitBranch,
  Shield,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Globe,
  Settings,
  LogIn,
  LogOut,
  Github,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import api from '@/lib/api'
import { formatDistanceToNow, format } from 'date-fns'
import { ExportButton } from '@/components/dashboard/ExportButton'

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId?: string
  details?: any
  ipAddress?: string
  userAgent?: string
  createdAt: string
  user?: {
    id: string
    name: string
    email: string
  }
  repository?: {
    id: string
    name: string
    fullName: string
  }
}

const actionIcons: Record<string, any> = {
  fix_applied: Wrench,
  fix_rejected: X,
  fix_modified: Wrench,
  review_rerun: RefreshCw,
  review_created: FileCode,
  repo_connected: GitBranch,
  repo_disconnected: GitBranch,
  repo_updated: Settings,
  user_login: LogIn,
  user_logout: LogOut,
  github_connected: Github,
  github_disconnected: Github,
  settings_updated: Settings,
  bulk_fix_applied: Wrench,
  fix_pr_created: GitBranch,
  fix_rollback: RefreshCw,
  review_completed: CheckCircle2,
  critical_issue: AlertTriangle,
}

const actionColors: Record<string, string> = {
  fix_applied: 'text-green-600 bg-green-50 dark:bg-green-950',
  fix_rejected: 'text-red-600 bg-red-50 dark:bg-red-950',
  fix_modified: 'text-orange-600 bg-orange-50 dark:bg-orange-950',
  review_rerun: 'text-blue-600 bg-blue-50 dark:bg-blue-950',
  review_created: 'text-blue-600 bg-blue-50 dark:bg-blue-950',
  repo_connected: 'text-purple-600 bg-purple-50 dark:bg-purple-950',
  repo_disconnected: 'text-red-600 bg-red-50 dark:bg-red-950',
  repo_updated: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950',
  user_login: 'text-green-600 bg-green-50 dark:bg-green-950',
  user_logout: 'text-gray-600 bg-gray-50 dark:bg-gray-950',
  github_connected: 'text-purple-600 bg-purple-50 dark:bg-purple-950',
  github_disconnected: 'text-red-600 bg-red-50 dark:bg-red-950',
  settings_updated: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950',
  bulk_fix_applied: 'text-green-600 bg-green-50 dark:bg-green-950',
  fix_pr_created: 'text-blue-600 bg-blue-50 dark:bg-blue-950',
  fix_rollback: 'text-orange-600 bg-orange-50 dark:bg-orange-950',
  review_completed: 'text-green-600 bg-green-50 dark:bg-green-950',
  critical_issue: 'text-red-600 bg-red-50 dark:bg-red-950',
}

function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    fix_applied: 'Fix Applied',
    fix_rejected: 'Fix Rejected',
    fix_modified: 'Fix Modified',
    review_rerun: 'Review Re-run',
    review_created: 'Review Created',
    repo_connected: 'Repository Connected',
    repo_disconnected: 'Repository Disconnected',
    repo_updated: 'Repository Updated',
    user_login: 'User Login',
    user_logout: 'User Logout',
    github_connected: 'GitHub Connected',
    github_disconnected: 'GitHub Disconnected',
    settings_updated: 'Settings Updated',
    bulk_fix_applied: 'Bulk Fix Applied',
    fix_pr_created: 'Fix PR Created',
    fix_rollback: 'Fix Rolled Back',
    review_completed: 'Review Completed',
    critical_issue: 'Critical Issue Found',
  }
  return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function Audit() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')

  const { data, isLoading, error, refetch } = useQuery<{ logs: AuditLog[]; count: number }>({
    queryKey: ['audit-logs', actionFilter, entityTypeFilter, dateFilter],
    queryFn: async () => {
      const params: any = { limit: 100 }
      if (actionFilter !== 'all') params.action = actionFilter
      if (entityTypeFilter !== 'all') params.entityType = entityTypeFilter
      if (dateFilter !== 'all') {
        const now = new Date()
        if (dateFilter === 'today') {
          params.startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString()
        } else if (dateFilter === 'week') {
          params.startDate = new Date(now.setDate(now.getDate() - 7)).toISOString()
        } else if (dateFilter === 'month') {
          params.startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString()
        }
      }
      const { data } = await api.get('/audit-logs', { params })
      return data
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  })

  const filteredLogs = useMemo(() => {
    if (!data?.logs) return []
    let filtered = data.logs

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (log) =>
          formatAction(log.action).toLowerCase().includes(query) ||
          log.user?.name?.toLowerCase().includes(query) ||
          log.user?.email?.toLowerCase().includes(query) ||
          log.repository?.fullName?.toLowerCase().includes(query) ||
          log.ipAddress?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [data?.logs, searchQuery])

  const uniqueActions = useMemo(() => {
    if (!data?.logs) return []
    return Array.from(new Set(data.logs.map((log) => log.action))).sort()
  }, [data?.logs])

  const uniqueEntityTypes = useMemo(() => {
    if (!data?.logs) return []
    return Array.from(new Set(data.logs.map((log) => log.entityType))).sort()
  }, [data?.logs])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">View all system activity and user actions</p>
        </div>
        <ErrorState
          title="Failed to load audit logs"
          description={error instanceof Error ? error.message : 'Could not fetch audit logs.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View all system activity and user actions
            {data?.count && <span className="ml-1">· {data.count} total logs</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton type="audit" className="rounded-2xl" />
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-11 gap-2 rounded-2xl px-4">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-panel border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-2xl border-border/60 bg-background/70 pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-background/70">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {formatAction(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-background/70">
                <SelectValue placeholder="All Entity Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entity Types</SelectItem>
                {uniqueEntityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-background/70">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
            <Card className="glass-panel border-border/60">
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No audit logs found</p>
                <p className="text-sm">
                  {searchQuery || actionFilter !== 'all' || entityTypeFilter !== 'all' || dateFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Audit logs will appear here as actions are performed'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log, index) => {
            const Icon = actionIcons[log.action] || FileCode
            const colorClass = actionColors[log.action] || 'text-muted-foreground bg-muted'
            const details = log.details
              ? typeof log.details === 'string'
                ? JSON.parse(log.details)
                : log.details
              : null

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                <Card className="glass-panel border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2.5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <h3 className="font-semibold text-sm">{formatAction(log.action)}</h3>
                              <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5">
                                {log.entityType}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {log.user && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span className="truncate max-w-[120px]">{log.user.name || log.user.email}</span>
                                </div>
                              )}
                              {log.repository && (
                                <div className="flex items-center gap-1">
                                  <GitBranch className="h-3 w-3" />
                                  <span className="truncate max-w-[150px]">{log.repository.fullName}</span>
                                </div>
                              )}
                              {log.ipAddress && (
                                <div className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  <span className="font-mono text-[10px]">{log.ipAddress}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span className="text-[10px]">{format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}</span>
                                <span className="text-[10px]">
                                  ({formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })})
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {details && Object.keys(details).length > 0 && (
                          <Collapsible
                            open={expandedLogs.has(log.id)}
                              onOpenChange={(open) => {
                                const newExpanded = new Set(expandedLogs)
                                if (open) {
                                  newExpanded.add(log.id)
                                } else {
                                  newExpanded.delete(log.id)
                                }
                                setExpandedLogs(newExpanded)
                              }}
                            >
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground mt-1"
                              >
                                {expandedLogs.has(log.id) ? (
                                  <>
                                    <ChevronDown className="h-3 w-3 mr-1" />
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight className="h-3 w-3 mr-1" />
                                    Show Details
                                  </>
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 rounded-2xl border border-border/50 bg-muted/50 p-3 text-[10px] font-mono">
                                <pre className="whitespace-pre-wrap leading-tight">{JSON.stringify(details, null, 2)}</pre>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })
        )}
      </div>
    </motion.div>
  )
}
