/**
 * CodeRabbit-style PR summary card
 * Shows visual breakdown and walkthrough
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  FileCode, 
  AlertTriangle, 
  Shield, 
  Zap, 
  CheckCircle2,
  TrendingUp,
  Clock
} from 'lucide-react'
import { motion } from 'framer-motion'

interface PRSummaryCardProps {
  title: string
  summary: string
  riskLevel: string
  confidenceScore: number
  filesChanged: number
  issues: Array<{
    severity: string
    title: string
  }>
}

export function PRSummaryCard({
  title,
  summary,
  riskLevel,
  confidenceScore,
  filesChanged,
  issues,
}: PRSummaryCardProps) {
  const normalizedRiskLevel = riskLevel === 'HIGH' || riskLevel === 'MEDIUM' || riskLevel === 'LOW'
    ? riskLevel
    : 'LOW'

  const issuesBySeverity = issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const criticalCount = (issuesBySeverity.critical || 0) + (issuesBySeverity.security || 0)
  const warningCount = (issuesBySeverity.performance || 0) + (issuesBySeverity.quality || 0)
  const styleCount = issuesBySeverity.style || 0

  const riskColor = {
    LOW: 'bg-green-500',
    MEDIUM: 'bg-yellow-500',
    HIGH: 'bg-red-500',
  }[normalizedRiskLevel]

  const riskBgColor = {
    LOW: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300',
    MEDIUM: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-300',
    HIGH: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300',
  }[normalizedRiskLevel]

  return (
    <Card className="hero-glow overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-panel/60 shadow-lg">
      <div className={`h-1.5 ${riskColor}`} />
      
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary">
              AI review summary
            </Badge>
            <CardTitle className="text-2xl leading-tight">{title}</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6">
              A concise walkthrough of risk, confidence, and issue distribution for this pull request.
            </CardDescription>
          </div>
          <div className={`rounded-3xl border px-4 py-3 shadow-sm ${riskBgColor}`}>
            <div className="text-xs text-muted-foreground mb-1">Risk Level</div>
            <Badge 
              variant={normalizedRiskLevel === 'HIGH' ? 'destructive' : normalizedRiskLevel === 'MEDIUM' ? 'default' : 'secondary'}
              className="text-sm font-bold"
            >
              {normalizedRiskLevel}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="glass-panel flex flex-col items-center rounded-3xl border border-border/60 p-4"
          >
            <FileCode className="h-5 w-5 text-primary mb-2" />
            <div className="text-2xl font-bold">{filesChanged}</div>
            <div className="text-xs text-muted-foreground">Files Changed</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center rounded-3xl border border-red-500/20 bg-red-500/10 p-4"
          >
            <AlertTriangle className="h-5 w-5 text-red-500 mb-2" />
            <div className="text-2xl font-bold text-red-500">{criticalCount}</div>
            <div className="text-xs text-muted-foreground">Critical Issues</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-4"
          >
            <Zap className="h-5 w-5 text-yellow-500 mb-2" />
            <div className="text-2xl font-bold text-yellow-500">{warningCount}</div>
            <div className="text-xs text-muted-foreground">Warnings</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center rounded-3xl border border-blue-500/20 bg-blue-500/10 p-4"
          >
            <TrendingUp className="h-5 w-5 text-blue-500 mb-2" />
            <div className="text-2xl font-bold text-blue-500">{confidenceScore}%</div>
            <div className="text-xs text-muted-foreground">Confidence</div>
          </motion.div>
        </div>

        {/* Issue Breakdown */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Issue Breakdown
          </h4>
          <div className="space-y-3">
            {criticalCount > 0 && (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-red-500 font-medium">Critical & Security</span>
                    <span className="font-semibold">{criticalCount}</span>
                  </div>
                  <Progress value={(criticalCount / issues.length) * 100} className="h-2 bg-red-100 dark:bg-red-950/40" />
                </div>
              </div>
            )}
            {warningCount > 0 && (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-yellow-500 font-medium">Performance & Quality</span>
                    <span className="font-semibold">{warningCount}</span>
                  </div>
                  <Progress value={(warningCount / issues.length) * 100} className="h-2 bg-yellow-100 dark:bg-yellow-950/40" />
                </div>
              </div>
            )}
            {styleCount > 0 && (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-purple-500 font-medium">Style</span>
                    <span className="font-semibold">{styleCount}</span>
                  </div>
                  <Progress value={(styleCount / issues.length) * 100} className="h-2 bg-purple-100 dark:bg-purple-950/40" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Text */}
        <div className="rounded-[1.75rem] border border-border/60 bg-background/60 p-5">
          <div className="text-sm leading-7 text-foreground whitespace-pre-wrap">
            {summary}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
          <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
            <Clock className="h-3 w-3" />
            Review Time: ~2 min
          </Badge>
          {criticalCount === 0 && (
            <Badge variant="default" className="gap-1.5 rounded-full bg-green-600 px-3 py-1">
              <CheckCircle2 className="h-3 w-3" />
              Ready to Merge
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
