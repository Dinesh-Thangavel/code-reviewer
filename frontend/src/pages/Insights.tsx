import { useMemo } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { AlertTriangle, TrendingUp, Code, FileCode, CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { useInsights } from '@/hooks/useInsights'
import { ExportButton } from '@/components/dashboard/ExportButton'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.8, 0.4, 1] },
  },
}

export function Insights() {
  const { data: insights, isLoading, error, refetch } = useInsights()

  const riskTrendData = useMemo(() => {
    if (!insights?.riskTrend) return []
    return insights.riskTrend.map((item) => ({
      date: formatDate(item.date),
      'High Risk': item.high,
      'Medium Risk': item.medium,
      'Low Risk': item.low,
    }))
  }, [insights?.riskTrend])

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm">
          <p className="font-medium">{data.language}</p>
          <p className="text-muted-foreground">{data.issues} issues ({data.percentage}%)</p>
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[350px] rounded-xl" />
          <Skeleton className="h-[350px] rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground mt-1">Analytics and insights from code reviews</p>
        </div>
        <ErrorState
          title="Failed to load insights"
          description={error.message || 'Could not fetch insights data.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  if (!insights) return null

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <Card className="hero-glow overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-panel/70 shadow-lg">
          <CardContent className="flex flex-wrap items-center gap-3 px-5 py-4">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-2.5 py-1 text-primary text-xs">
              Review analytics
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Insights</h1>
            <p className="text-sm text-muted-foreground flex-1 min-w-[220px]">
              Track risk trends and issue hotspots.
            </p>
            <ExportButton type="insights" className="rounded-xl h-9" />
            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-2 rounded-xl px-3">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Stats */}
      <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={itemVariants}>
        <Card className="glass-panel border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Avg Issues / PR</CardDescription>
              <div className="h-7 w-7 rounded-lg bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.averageIssuesPerPR}</div>
            <p className="text-xs text-muted-foreground mt-0.5">issues per pull request</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Total Pull Requests</CardDescription>
              <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
                <FileCode className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.totalPRs}</div>
            <p className="text-xs text-muted-foreground mt-0.5">reviewed by AI</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">Total Issues Found</CardDescription>
              <div className="h-7 w-7 rounded-lg bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center">
                <Code className="h-3.5 w-3.5 text-purple-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.totalIssues}</div>
            <p className="text-xs text-muted-foreground mt-0.5">across all reviews</p>
          </CardContent>
        </Card>

        {insights.fixStats && (
          <Card className="glass-panel border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium">Fix Rate</CardDescription>
                <div className="h-7 w-7 rounded-lg bg-green-100 dark:bg-green-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {insights.totalIssues > 0
                  ? `${Math.round((insights.fixStats.applied / insights.totalIssues) * 100)}%`
                  : '0%'}
              </div>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                <Badge variant="default" className="bg-green-600 text-[10px] px-1.5 py-0 h-4">
                  {insights.fixStats.applied} applied
                </Badge>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {insights.fixStats.pending} pending
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Charts Grid */}
      <motion.div className="grid gap-6 lg:grid-cols-2" variants={itemVariants}>
        {/* Bar Chart - Issue Types */}
        <Card className="glass-panel overflow-hidden border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Most Common Issue Types</CardTitle>
            <CardDescription>Distribution of issues by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[280px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
              <BarChart
                data={insights.mostCommonIssueTypes}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="type"
                  type="category"
                  width={90}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 8, 8, 0]} />
              </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Issues per Language */}
        <Card className="glass-panel overflow-hidden border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Issues per Language</CardTitle>
            <CardDescription>Distribution across programming languages</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.issuesPerLanguage && insights.issuesPerLanguage.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="h-[260px] min-w-0 relative overflow-visible">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <Pie
                        data={insights.issuesPerLanguage}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ payload }: any) => {
                          const language = payload?.language;
                          const percentage = payload?.percentage ?? 0;
                          if (percentage < 5) return '';
                          return `${language} ${percentage}%`;
                        }}
                        outerRadius={75}
                        innerRadius={0}
                        paddingAngle={insights.issuesPerLanguage.length > 1 ? 2 : 0}
                        dataKey="issues"
                      >
                        {insights.issuesPerLanguage.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center gap-2">
                  {insights.issuesPerLanguage.map((item, index) => (
                    <div key={item.language} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span className="text-sm font-medium">{item.language || 'Unknown'}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.issues} <span className="text-xs">({item.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                <p>No language data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Line Chart - Risk Trend */}
      <motion.div variants={itemVariants}>
        <Card className="glass-panel overflow-hidden border-border/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">PR Risk Trend</CardTitle>
            </div>
            <CardDescription>Risk level distribution over the last 8 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                <LineChart data={riskTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="High Risk" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="Medium Risk" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="Low Risk" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Fix Stats */}
      {insights.fixStats && (
        <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={itemVariants}>
          <Card className="glass-panel border-border/60 border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Fixes Applied
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{insights.fixStats.applied}</div>
            </CardContent>
          </Card>
          <Card className="glass-panel border-border/60">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Fixes Pending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights.fixStats.pending}</div>
            </CardContent>
          </Card>
          <Card className="glass-panel border-border/60">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Fixes Rejected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights.fixStats.rejected}</div>
            </CardContent>
          </Card>
          <Card className="glass-panel border-border/60 border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                Fixes Failed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{insights.fixStats.failed}</div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
