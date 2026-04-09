import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  Code,
  Clock,
  AlertTriangle,
  Timer,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDashboard } from '@/hooks/useDashboard'
import { cn } from '@/lib/utils'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatLastRun(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getRiskVariant(risk: string) {
  switch (risk) {
    case 'HIGH': return 'destructive'
    case 'MEDIUM': return 'default'
    case 'LOW': return 'secondary'
    default: return 'secondary'
  }
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'Completed': return 'default'
    case 'Reviewing': return 'secondary'
    case 'Waiting': return 'outline'
    case 'Failed': return 'destructive'
    default: return 'outline'
  }
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  security: '#f97316',
  performance: '#eab308',
  quality: '#3b82f6',
  style: '#8b5cf6',
}

export function Dashboard() {
  const navigate = useNavigate()
  const { data: dashboardData, isLoading, error, refetch } = useDashboard()

  const weeklyTrendData = useMemo(() => {
    if (!dashboardData?.weeklyReviewTrend) return []
    return dashboardData.weeklyReviewTrend.map((item) => ({
      date: formatDate(item.date),
      reviews: item.reviews,
      approved: item.approved,
      rejected: item.rejected,
    }))
  }, [dashboardData])

  const issuesBySeverityData = useMemo(() => {
    if (!dashboardData?.issuesBySeverity) return []
    return Object.entries(dashboardData.issuesBySeverity).map(([severity, count]) => ({
      severity: severity.charAt(0).toUpperCase() + severity.slice(1),
      count,
      fill: SEVERITY_COLORS[severity] || '#6b7280',
    }))
  }, [dashboardData])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-3 w-28" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[350px] rounded-xl" />
          <Skeleton className="h-[350px] rounded-xl" />
        </div>
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="bg-destructive/10 p-3 rounded-full">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          We couldn't fetch the latest data. Please check your connection and try again.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <Card className="hero-glow overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-panel/70 shadow-lg">
          <CardContent className="flex flex-wrap items-center gap-3 px-5 py-4">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-2.5 py-1 text-primary text-xs">
              Review intelligence
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
            <p className="text-sm text-muted-foreground flex-1 min-w-[220px]">
              Monitor review throughput and surface risky pull requests early.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex h-10 items-center rounded-xl border border-border/60 bg-background/70 px-3">
                <span className="text-[11px] uppercase tracking-[0.14em] mr-2">Health</span>
                <span className="text-base font-semibold text-foreground">{dashboardData?.pendingReviews || 0}</span>
              </div>
              <div className="flex h-10 items-center rounded-xl border border-border/60 bg-background/70 px-3">
                <span className="text-[11px] uppercase tracking-[0.14em] mr-2">Coverage</span>
                <span className="text-base font-semibold text-foreground">{dashboardData?.criticalIssues || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stat Cards */}
      <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={itemVariants}>
        <StatCard
          title="Reviews Today"
          value={dashboardData?.reviewsToday || 0}
          trend="+12%"
          trendDesc="from yesterday"
          icon={Code}
          trendPositive
        />
        <StatCard
          title="Pending Reviews"
          value={dashboardData?.pendingReviews || 0}
          desc="Requires attention"
          icon={Clock}
          iconColor="text-orange-500"
          iconBg="bg-orange-100 dark:bg-orange-500/15"
        />
        <StatCard
          title="Critical Issues"
          value={dashboardData?.criticalIssues || 0}
          desc="Needs immediate action"
          icon={AlertTriangle}
          iconColor="text-red-500"
          iconBg="bg-red-100 dark:bg-red-500/15"
          valueColor="text-red-600 dark:text-red-400"
        />
        <StatCard
          title="Avg Review Time"
          value={`${dashboardData?.avgReviewTime || 0}m`}
          desc="Average processing time"
          icon={Timer}
          iconColor="text-blue-500"
          iconBg="bg-blue-100 dark:bg-blue-500/15"
        />
      </motion.div>

      {/* Charts Row */}
      <motion.div className="grid gap-6 lg:grid-cols-7" variants={itemVariants}>
        {/* Area Chart - Review Activity */}
        <Card className="glass-panel overflow-hidden border-border/60 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Review Activity</CardTitle>
            <CardDescription>Daily review volume over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {weeklyTrendData.length > 0 ? (
              <div className="w-full" style={{ width: '100%', height: '280px', minWidth: 0, minHeight: '280px' }}>
                <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={280}>
                <AreaChart data={weeklyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  dx={-8}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="reviews"
                  stroke="hsl(var(--chart-1))"
                  fillOpacity={1}
                  fill="url(#colorReviews)"
                  strokeWidth={2}
                  name="Total Reviews"
                />
                <Line
                  type="monotone"
                  dataKey="approved"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  name="Approved"
                />
              </AreaChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No review data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - Issues by Severity */}
        <Card className="glass-panel overflow-hidden border-border/60 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Issues by Severity</CardTitle>
            <CardDescription>Distribution across severity levels</CardDescription>
          </CardHeader>
          <CardContent>
            {issuesBySeverityData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                No issue data available yet
              </div>
            ) : (
              <div className="w-full" style={{ width: '100%', height: '240px', minWidth: 0, minHeight: '240px' }}>
                <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240}>
                  <BarChart data={issuesBySeverityData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="severity"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="count" name="Issues" radius={[4, 4, 0, 0]}>
                    {issuesBySeverityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent PRs Table */}
      <motion.div variants={itemVariants}>
        <Card className="glass-panel overflow-hidden border-border/60">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/20">
            <div>
              <CardTitle className="text-base">Recent Reviewed PRs</CardTitle>
              <CardDescription>Latest pull requests reviewed by AI</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/pull-requests')}>
              View All
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {(!dashboardData?.recentPRs || dashboardData.recentPRs.length === 0) ? (
              <div className="text-center py-10 text-muted-foreground">
                <Code className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No recent reviews</p>
                <p className="text-xs mt-1">Pull requests will appear here once reviewed</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">PR Title</TableHead>
                      <TableHead className="hidden sm:table-cell">Repository</TableHead>
                      <TableHead className="hidden md:table-cell">Author</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Risk</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead className="hidden md:table-cell">Last Run</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.recentPRs.map((pr) => (
                      <TableRow
                        key={pr.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate(`/pull-requests/${pr.id}`)}
                      >
                        <TableCell className="font-medium">
                          <span className="truncate block max-w-[180px]" title={pr.title}>
                            {pr.title}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {pr.repo}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {pr.author}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(pr.status)}>{pr.status}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant={getRiskVariant(pr.risk)}>{pr.risk}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            'text-sm font-medium',
                            pr.issues > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                          )}>
                            {pr.issues}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                          {formatLastRun(pr.lastRun)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

function StatCard({ title, value, trend, trendDesc, desc, icon: Icon, iconColor = 'text-primary', iconBg = 'bg-primary/10', valueColor, trendPositive }: any) {
  return (
    <Card className="glass-panel border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn('text-3xl font-semibold tracking-tight', valueColor)}>{value}</div>
        {(trend || trendDesc) && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {trend && (
              <span className={cn('font-medium', trendPositive && 'text-green-600 dark:text-green-400')}>
                {trend} {trendPositive && <TrendingUp className="inline h-3 w-3" />}
              </span>
            )}
            {trendDesc}
          </p>
        )}
        {desc && !trend && !trendDesc && (
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
        )}
      </CardContent>
    </Card>
  )
}
