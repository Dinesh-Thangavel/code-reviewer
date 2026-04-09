import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  RefreshCw,
  Shield,
  FileCode,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wrench,
  X,
  GitBranch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Checkbox } from '@/components/ui/checkbox'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import {
  usePRDetail,
  useApplyFix,
  useRejectFix,
  useBulkApplyFixes,
  useCreateFixPR,
  useMergeFixPR,
  useRerunReview,
  useRollbackFix,
  type PRIssue,
} from '@/hooks/usePRDetail'
import { FixStatusBadge } from '@/components/pr/FixStatusBadge'
import { ApplyFixDialog } from '@/components/pr/ApplyFixDialog'
import { BulkApplyBar } from '@/components/pr/BulkApplyBar'
import { EnhancedIssueCard } from '@/components/pr/EnhancedIssueCard'
import { PRSummaryCard } from '@/components/pr/PRSummaryCard'
import { CodeBlock } from '@/components/pr/CodeBlock'
import { PRFileChanges } from '@/components/pr/PRFileChanges'
import { TestGeneratorDialog } from '@/components/pr/TestGeneratorDialog'
import { DocstringGeneratorDialog } from '@/components/pr/DocstringGeneratorDialog'
import { ReviewProgressBanner } from '@/components/pr/ReviewProgressBanner'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuth } from '@/lib/auth-provider'

type IssueSeverity = 'critical' | 'security' | 'performance' | 'quality' | 'style'

function groupIssuesBySeverity(issues: PRIssue[]) {
  const grouped: Record<string, PRIssue[]> = {
    critical: [],
    security: [],
    performance: [],
    quality: [],
    style: [],
  }
  issues.forEach(issue => {
    if (grouped[issue.severity]) {
      grouped[issue.severity].push(issue)
    }
  })
  return grouped
}

function getRiskVariant(risk: string) {
  switch (risk) {
    case 'HIGH': return 'destructive'
    case 'MEDIUM': return 'default'
    case 'LOW': return 'secondary'
    default: return 'secondary'
  }
}

// CodeBlock component is now imported from @/components/pr/CodeBlock

// Issue card with fix actions
function IssueCard({
  issue,
  isSelected,
  onSelect,
  onApplyFix,
  onRejectFix,
}: {
  issue: PRIssue
  isSelected: boolean
  onSelect: (id: string, selected: boolean) => void
  onApplyFix: (issue: PRIssue) => void
  onRejectFix: (id: string) => void
}) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-l-red-500'
      case 'security': return 'border-l-orange-500'
      case 'performance': return 'border-l-yellow-500'
      case 'quality': return 'border-l-blue-500'
      case 'style': return 'border-l-purple-500'
      default: return 'border-l-primary'
    }
  }

  const isFixable = issue.fixStatus === 'PENDING' && issue.suggestedFix

  return (
    <Card className={`border-l-4 ${getSeverityColor(issue.severity)} hover:shadow-md transition-shadow`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {isFixable && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelect(issue.id, !!checked)}
                  className="mr-1"
                />
              )}
              <Badge variant="outline" className="font-mono text-xs hover:bg-accent">
                {issue.file}:{issue.line}
              </Badge>
              <Badge variant="secondary">{issue.language}</Badge>
              <FixStatusBadge status={issue.fixStatus} />
            </div>
            <CardTitle className="text-lg">{issue.title}</CardTitle>
          </div>
          {/* Fix actions */}
          {issue.fixStatus === 'PENDING' && (
            <div className="flex gap-1 shrink-0">
              {issue.suggestedFix && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onApplyFix(issue)}
                  className="gap-1 bg-green-600 hover:bg-green-700"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Apply Fix</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRejectFix(issue.id)}
                className="gap-1 text-muted-foreground"
                title="Dismiss this issue"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {issue.fixStatus === 'APPLIED' && issue.commitSha && (
            <Badge variant="outline" className="font-mono text-xs shrink-0">
              <GitBranch className="h-3 w-3 mr-1" />
              {issue.commitSha.slice(0, 7)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground leading-relaxed">{issue.description}</p>
        {issue.suggestedFix && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-semibold">Suggested Fix:</span>
              <Badge variant="outline" className="text-xs">{issue.language}</Badge>
            </div>
            <CodeBlock code={issue.suggestedFix} language={issue.language} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Main PRDetail component
export function PRDetail() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const { user } = useAuth()
  const { data: prDetail, isLoading, error, refetch } = usePRDetail(id)

  // WebSocket for real-time updates
  useWebSocket(user?.id, (event, data) => {
    if (event === 'review-completed' && data.prId === id) {
      toast({
        title: 'Review completed',
        description: 'The AI review has been completed. Refreshing...',
        variant: 'success',
      })
      refetch()
    } else if (event === 'fix-applied' && data.prId === id) {
      toast({
        title: 'Fix applied',
        description: 'A fix has been applied to this PR. Refreshing...',
        variant: 'success',
      })
      refetch()
    } else if (event === 'pr-status-update' && data.prId === id) {
      refetch()
    }
  })

  // Mutations
  const applyFixMutation = useApplyFix()
  const rejectFixMutation = useRejectFix()
  const bulkApplyMutation = useBulkApplyFixes()
  const createFixPRMutation = useCreateFixPR()
  const mergeFixPRMutation = useMergeFixPR()
  const rerunReviewMutation = useRerunReview()
  const rollbackFixMutation = useRollbackFix()

  // State
  const [isFullReviewOpen, setIsFullReviewOpen] = useState(false)
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set())
  const [applyDialogIssue, setApplyDialogIssue] = useState<PRIssue | null>(null)
  const [fixPRUrl, setFixPRUrl] = useState<string | null>(null)
  const [fixPRNumber, setFixPRNumber] = useState<number | null>(null)

  // Computed values
  const fixableIssues = useMemo(() => {
    if (!prDetail) return []
    return prDetail.issues.filter(i => i.fixStatus === 'PENDING' && i.suggestedFix)
  }, [prDetail])

  const appliedIssues = useMemo(() => {
    if (!prDetail) return []
    return prDetail.issues.filter(i => i.fixStatus === 'APPLIED')
  }, [prDetail])

  const groupedIssues = useMemo(() => {
    if (!prDetail) return { critical: [], security: [], performance: [], quality: [], style: [] }
    return groupIssuesBySeverity(prDetail.issues)
  }, [prDetail])

  const severityTabs = useMemo(() => {
    return [
      { value: 'critical', label: 'Critical Bugs', count: groupedIssues.critical.length },
      { value: 'security', label: 'Security Risks', count: groupedIssues.security.length },
      { value: 'performance', label: 'Performance', count: groupedIssues.performance.length },
      { value: 'quality', label: 'Code Quality', count: groupedIssues.quality.length },
      { value: 'style', label: 'Style', count: groupedIssues.style.length },
    ].filter(tab => tab.count > 0)
  }, [groupedIssues])

  // Handlers
  const handleSelectIssue = (issueId: string, selected: boolean) => {
    const newSet = new Set(selectedIssueIds)
    if (selected) {
      newSet.add(issueId)
    } else {
      newSet.delete(issueId)
    }
    setSelectedIssueIds(newSet)
  }

  const handleApplyFix = async (issue: PRIssue, customFix?: string) => {
    try {
      await applyFixMutation.mutateAsync({ issueId: issue.id, customFix })
      toast({
        title: 'Fix applied successfully',
        description: customFix 
          ? 'The custom fix has been committed to a new branch.'
          : 'The suggested fix has been committed to a new branch.',
        variant: 'success',
      })
      setApplyDialogIssue(null)
      refetch()
    } catch (error: any) {
      toast({
        title: 'Failed to apply fix',
        description: error?.response?.data?.error || error.message || 'Something went wrong',
        variant: 'destructive',
      })
    }
  }

  const handleRejectFix = async (issueId: string) => {
    try {
      await rejectFixMutation.mutateAsync(issueId)
      toast({
        title: 'Issue dismissed',
        description: 'The issue has been marked as dismissed.',
      })
      refetch()
    } catch (error: any) {
      toast({
        title: 'Failed to dismiss issue',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      })
    }
  }

  const handleRollbackFix = async (issueId: string) => {
    try {
      await rollbackFixMutation.mutateAsync(issueId)
      toast({
        title: 'Fix rolled back',
        description: 'The fix has been successfully rolled back.',
        variant: 'success',
      })
      refetch()
    } catch (error: any) {
      toast({
        title: 'Failed to rollback fix',
        description: error?.response?.data?.error || error.message || 'Something went wrong',
        variant: 'destructive',
      })
    }
  }

  const handleBulkApply = async () => {
    if (!prDetail?.reviewId || selectedIssueIds.size === 0) return
    try {
      const result = await bulkApplyMutation.mutateAsync({
        reviewId: prDetail.reviewId,
        issueIds: Array.from(selectedIssueIds),
      })
      toast({
        title: `Applied ${result.totalApplied} fixes`,
        description: result.message,
        variant: 'success',
      })
      setSelectedIssueIds(new Set())
      refetch()
    } catch (error: any) {
      toast({
        title: 'Bulk apply failed',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    }
  }

  const handleCreateFixPR = async () => {
    if (!prDetail?.reviewId) return
    try {
      const result = await createFixPRMutation.mutateAsync(prDetail.reviewId)
      toast({
        title: `Fix PR #${result.prNumber} created`,
        description: `${result.fixesApplied} fixes included in the PR.`,
        variant: 'success',
      })
      if (result.prUrl) setFixPRUrl(result.prUrl)
      if (result.prNumber) setFixPRNumber(result.prNumber)
    } catch (error: any) {
      toast({
        title: 'Failed to create fix PR',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    }
  }

  const handleMergeFixPR = async () => {
    if (!fixPRNumber) return
    try {
      const result = await mergeFixPRMutation.mutateAsync({ prNumber: fixPRNumber })
      toast({
        title: `Fix PR #${fixPRNumber} merged`,
        description: result.message || 'The fix PR has been successfully merged.',
        variant: 'success',
      })
      setFixPRUrl(null) // Clear PR URL since it's merged
      setFixPRNumber(null)
    } catch (error: any) {
      toast({
        title: 'Failed to merge fix PR',
        description: error?.response?.data?.error || error?.response?.data?.details || error.message,
        variant: 'destructive',
      })
    }
  }

  const handleRerunReview = async (securityOnly = false) => {
    if (!id) return
    try {
      await rerunReviewMutation.mutateAsync({ prId: id, securityOnly })
      toast({
        title: securityOnly ? 'Security scan started' : 'Review started',
        description: `The ${securityOnly ? 'security-only' : 'full'} review has been queued.`,
        variant: 'success',
      })
    } catch (error: any) {
      toast({
        title: 'Failed to queue review',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error / Not found
  if (!id || error || !prDetail) {
    return (
      <div className="space-y-6">
        <Link to="/pull-requests">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pull Requests
          </Button>
        </Link>
        <ErrorState
          title="Pull request not found"
          description={error?.message || 'The requested pull request could not be found.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  // Pie chart data
  const pieChartData = prDetail.languageBreakdown.map(item => ({
    name: item.language,
    value: item.percentage,
    files: item.files,
    lines: item.lines,
  }))

  const COLORS = [
    'hsl(var(--primary))',
    'hsl(142, 76%, 36%)',
    'hsl(221, 83%, 53%)',
    'hsl(38, 92%, 50%)',
    'hsl(280, 100%, 70%)',
    'hsl(173, 80%, 40%)',
  ]

  // Full review text
  const fullReviewText = `${prDetail.summary}\n\n## Issues Found\n\n${prDetail.issues.map((issue, idx) => `### ${idx + 1}. [${issue.fixStatus}] ${issue.title}\n\n**File:** \`${issue.file}:${issue.line}\`\n**Severity:** ${issue.severity}\n**Language:** ${issue.language}\n\n${issue.description}\n\n${issue.suggestedFix ? `**Suggested Fix:**\n\`\`\`${issue.language}\n${issue.suggestedFix}\n\`\`\`` : 'No suggested fix available.'}`).join('\n\n')}`

  return (
    <>
      <motion.div
        className="space-y-6 pb-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Back button */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <Link to="/pull-requests">
            <Button variant="ghost" className="transition-all hover:scale-105">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Pull Requests
            </Button>
          </Link>
        </motion.div>

        {/* Review Progress Banner - Shows when review is in progress */}
        {(prDetail.reviewStatus === 'PENDING' || prDetail.reviewStatus === 'IN_PROGRESS' || (!prDetail.reviewStatus && !prDetail.reviewId)) && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <ReviewProgressBanner 
              reviewStatus={prDetail.reviewStatus}
              filesChanged={prDetail.filesChanged}
              isPolling={true}
              prId={prDetail.id}
            />
          </motion.div>
        )}

        {/* Enhanced PR Summary Card - CodeRabbit Style */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <PRSummaryCard
            title={prDetail.title}
            summary={prDetail.summary}
            riskLevel={prDetail.riskLevel}
            confidenceScore={prDetail.confidenceScore}
            filesChanged={prDetail.filesChanged}
            issues={prDetail.issues}
          />
        </motion.div>

        {/* Action Buttons */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass-panel hero-glow overflow-hidden border-border/60 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Repository: <span className="font-semibold text-foreground">{prDetail.repo}</span></span>
                  {prDetail.author && (
                    <> • Author: <span className="font-semibold text-foreground">{prDetail.author}</span></>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    className="gap-2 rounded-2xl px-4 transition-all hover:scale-[1.02]"
                    onClick={() => handleRerunReview(false)}
                    disabled={rerunReviewMutation.isPending}
                  >
                    {rerunReviewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Re-run Review
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 rounded-2xl px-4 transition-all hover:scale-[1.02]"
                    onClick={() => handleRerunReview(true)}
                    disabled={rerunReviewMutation.isPending}
                  >
                    <Shield className="h-4 w-4" />
                    Security Only
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* PR File Changes Viewer */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <PRFileChanges prId={id!} repoFullName={prDetail?.repo} />
        </motion.div>

        {/* Issues by Severity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="glass-panel overflow-hidden border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>Issues by Severity</CardTitle>
                  <CardDescription>
                    {prDetail.issues.length} issue{prDetail.issues.length !== 1 ? 's' : ''} found across {prDetail.filesChanged} files
                    {fixableIssues.length > 0 && (
                      <> • <span className="text-green-600 font-medium">{fixableIssues.length} fixable</span></>
                    )}
                  </CardDescription>
                </div>
                {fixableIssues.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedIssueIds.size === fixableIssues.length) {
                          setSelectedIssueIds(new Set())
                        } else {
                          setSelectedIssueIds(new Set(fixableIssues.map(i => i.id)))
                        }
                      }}
                    >
                      {selectedIssueIds.size === fixableIssues.length ? 'Deselect All' : 'Select All Fixable'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {severityTabs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No issues found in this review.
                </div>
              ) : (
                <Tabs defaultValue={severityTabs[0]?.value || 'critical'} className="w-full">
                  <TabsList className="flex w-full overflow-x-auto rounded-2xl border border-border/60 bg-muted/40 p-1 md:grid md:grid-cols-5">
                    {severityTabs.map((tab) => (
                      <TabsTrigger key={tab.value} value={tab.value} className="relative whitespace-nowrap rounded-xl">
                        {tab.label}
                        <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1.5 text-xs">
                          {tab.count}
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {severityTabs.map((tab) => (
                    <TabsContent key={tab.value} value={tab.value} className="mt-6">
                      <div className="space-y-4">
                        <AnimatePresence>
                          {groupedIssues[tab.value as IssueSeverity].map((issue, index) => (
                            <motion.div
                              key={issue.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{ delay: index * 0.05 }}
                            >
                                <EnhancedIssueCard
                                  issue={issue}
                                  isSelected={selectedIssueIds.has(issue.id)}
                                  onSelect={handleSelectIssue}
                                  onApplyFix={handleApplyFix}
                                  onRejectFix={handleRejectFix}
                                  onRollbackFix={handleRollbackFix}
                                  prId={id}
                                  repoFullName={prDetail?.repository?.fullName}
                                />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Language Breakdown */}
        {pieChartData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="glass-panel overflow-hidden border-border/60">
              <CardHeader>
                <CardTitle>Language Breakdown</CardTitle>
                <CardDescription>Distribution of code changes by language</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-[300px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col justify-center space-y-3">
                    {prDetail.languageBreakdown.map((item, index) => (
                      <div key={item.language} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <div>
                            <div className="font-semibold">{item.language}</div>
                            <div className="text-sm text-muted-foreground">{item.files} files • {item.lines} lines</div>
                          </div>
                        </div>
                        <div className="text-lg font-bold">{item.percentage}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Review History */}
        {prDetail.reviews && prDetail.reviews.length > 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <Card className="glass-panel overflow-hidden border-border/60">
              <CardHeader>
                <CardTitle>Review History</CardTitle>
                <CardDescription>Past reviews for this pull request</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {prDetail.reviews.map((review, idx) => (
                    <div key={review.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 p-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={review.status === 'COMPLETED' ? 'default' : review.status === 'FAILED' ? 'destructive' : 'secondary'}>
                          {review.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(review.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span>Risk: <strong>{review.riskLevel}</strong></span>
                        <span>Confidence: <strong>{review.confidenceScore}%</strong></span>
                        <span>Issues: <strong>{review.issueCount}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Full AI Review - Collapsible */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="glass-panel overflow-hidden border-border/60">
            <Collapsible open={isFullReviewOpen} onOpenChange={setIsFullReviewOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer transition-colors hover:bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Full AI Review</CardTitle>
                      <CardDescription>Complete review report with all details</CardDescription>
                    </div>
                    {isFullReviewOpen ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <pre className="overflow-x-auto rounded-[1.5rem] border border-border/60 bg-background/70 p-6 text-sm whitespace-pre-wrap">
                    {fullReviewText}
                  </pre>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </motion.div>
      </motion.div>

      {/* Apply Fix Dialog */}
      <ApplyFixDialog
        issue={applyDialogIssue}
        open={!!applyDialogIssue}
        onOpenChange={(open) => { if (!open) setApplyDialogIssue(null) }}
        onApply={handleApplyFix}
        onReject={handleRejectFix}
        isApplying={applyFixMutation.isPending}
      />

      {/* Bulk Apply Bar */}
      <BulkApplyBar
        selectedCount={selectedIssueIds.size}
        totalCount={fixableIssues.length}
        onApplyAll={handleBulkApply}
        onCreatePR={handleCreateFixPR}
        onMergePR={handleMergeFixPR}
        onDeselectAll={() => setSelectedIssueIds(new Set())}
        isApplying={bulkApplyMutation.isPending}
        isCreatingPR={createFixPRMutation.isPending}
        isMergingPR={mergeFixPRMutation.isPending}
        appliedCount={appliedIssues.length}
        fixPRUrl={fixPRUrl}
        fixPRNumber={fixPRNumber}
      />

    </>
  )
}
