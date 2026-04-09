/**
 * CodeRabbit-style enhanced issue card
 * Shows inline code context and better visual presentation
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Wrench, 
  X, 
  GitBranch, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Shield, 
  Zap, 
  Code, 
  Palette,
  Copy,
  Check,
  ExternalLink,
  Edit,
  TestTube,
  FileText,
  RefreshCw,
  Eye
} from 'lucide-react'
import { FixStatusBadge } from './FixStatusBadge'
import { CodeBlock } from './CodeBlock'
import { CustomFixEditor } from './CustomFixEditor'
import { TestGeneratorDialog } from './TestGeneratorDialog'
import { DocstringGeneratorDialog } from './DocstringGeneratorDialog'
import { CodeComparisonDialog } from './CodeComparisonDialog'
import type { PRIssue } from '@/hooks/usePRDetail'

interface EnhancedIssueCardProps {
  issue: PRIssue
  isSelected: boolean
  onSelect: (id: string, selected: boolean) => void
  onApplyFix: (issue: PRIssue, customFix?: string) => void
  onRejectFix: (id: string) => void
  onRollbackFix?: (id: string) => void
  prId?: string
  repoFullName?: string
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-l-red-500',
    badge: 'destructive',
  },
  security: {
    icon: Shield,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-l-orange-500',
    badge: 'destructive',
  },
  performance: {
    icon: Zap,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-l-yellow-500',
    badge: 'default',
  },
  quality: {
    icon: Code,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-l-blue-500',
    badge: 'secondary',
  },
  style: {
    icon: Palette,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-l-purple-500',
    badge: 'outline',
  },
} as const

export function EnhancedIssueCard({
  issue,
  isSelected,
  onSelect,
  onApplyFix,
  onRejectFix,
  onRollbackFix,
  prId,
  repoFullName,
}: EnhancedIssueCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedFixIndex, setSelectedFixIndex] = useState(0)
  const [showCustomEditor, setShowCustomEditor] = useState(false)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [showDocstringDialog, setShowDocstringDialog] = useState(false)
  const [showComparison, setShowComparison] = useState(false)

  const config = severityConfig[issue.severity as keyof typeof severityConfig] || severityConfig.quality
  const Icon = config.icon
  const isFixable = issue.fixStatus === 'PENDING' && (issue.suggestedFix || (issue.alternativeFixes && issue.alternativeFixes.length > 0))

  // Get all available fixes (suggested + alternatives)
  const allFixes = issue.suggestedFix 
    ? [issue.suggestedFix, ...(issue.alternativeFixes || [])]
    : (issue.alternativeFixes || [])
  
  const currentFix = allFixes[selectedFixIndex] || issue.suggestedFix || ''

  const handleCopy = async () => {
    if (currentFix) {
      await navigator.clipboard.writeText(currentFix)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleApplyFix = () => {
    if (showCustomEditor) {
      setShowCustomEditor(true)
    } else {
      onApplyFix(issue, currentFix)
    }
  }

  return (
    <Card className={`glass-panel border-l-4 ${config.borderColor} overflow-hidden border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              {isFixable && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelect(issue.id, !!checked)}
                  className="mr-1"
                />
              )}
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${config.bgColor}`}>
                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                <span className={`text-xs font-semibold uppercase ${config.color}`}>
                  {issue.severity}
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-xs hover:bg-accent">
                {issue.file}:{issue.line}
              </Badge>
              <Badge variant="secondary" className="text-xs">{issue.language}</Badge>
              <FixStatusBadge status={issue.fixStatus} />
            </div>

            {/* Title */}
            <CardTitle className="text-lg font-semibold leading-tight">
              {issue.title}
            </CardTitle>

            {/* Description preview */}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {issue.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-1 shrink-0">
            {issue.fixStatus === 'PENDING' && (
              <>
                {issue.suggestedFix && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onApplyFix(issue)}
                    className="gap-1.5 rounded-xl bg-green-600 text-white hover:bg-green-700"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Fix</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRejectFix(issue.id)}
                  className="gap-1 rounded-xl text-muted-foreground hover:text-destructive"
                  title="Dismiss this issue"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {issue.fixStatus === 'APPLIED' && issue.commitSha && (
              <Badge variant="outline" className="font-mono text-xs shrink-0 gap-1">
                <GitBranch className="h-3 w-3" />
                {issue.commitSha.slice(0, 7)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Full description */}
        <div className="rounded-[1.5rem] border border-border/60 bg-background/70 p-4">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {issue.description}
          </p>
        </div>

        {/* Suggested Fix with Alternatives */}
        {isFixable && currentFix && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <div className="rounded-[1.5rem] border border-green-500/20 bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:from-green-950/20 dark:to-emerald-950/20">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between rounded-2xl p-0 font-semibold text-green-700 hover:bg-transparent dark:text-green-400"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    <span>
                      {allFixes.length > 1 ? `Fix Options (${allFixes.length})` : 'Suggested Fix'}
                    </span>
                    <Badge variant="outline" className="ml-2 rounded-full text-xs">{issue.language}</Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-3">
                {/* Multiple Fix Options */}
                {allFixes.length > 1 ? (
                  <Tabs value={selectedFixIndex.toString()} onValueChange={(v) => setSelectedFixIndex(parseInt(v))}>
                    <TabsList className="grid w-full auto-cols-fr grid-flow-col rounded-2xl bg-background/70 p-1">
                      {allFixes.map((fix, idx) => (
                        <TabsTrigger key={idx} value={idx.toString()} className="text-xs">
                          {idx === 0 ? 'Primary' : `Option ${idx + 1}`}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {allFixes.map((fix, idx) => (
                      <TabsContent key={idx} value={idx.toString()} className="mt-2">
                        <div className="relative">
                          <div className="absolute top-2 right-2 z-10 flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowCustomEditor(true)}
                              className="h-7 rounded-lg bg-background/80 text-xs backdrop-blur-sm"
                              title="Edit fix"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCopy}
                              className="h-7 rounded-lg bg-background/80 text-xs backdrop-blur-sm"
                            >
                              {copied ? (
                                <>
                                  <Check className="h-3 w-3 text-green-600" />
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                </>
                              )}
                            </Button>
                          </div>
                          <CodeBlock code={fix} language={issue.language} />
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  <div className="relative">
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCustomEditor(true)}
                        className="h-7 rounded-lg bg-background/80 text-xs backdrop-blur-sm"
                        title="Edit fix"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
                        className="h-7 rounded-lg bg-background/80 text-xs backdrop-blur-sm"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3 text-green-600" />
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                          </>
                        )}
                      </Button>
                    </div>
                    <CodeBlock code={currentFix} language={issue.language} />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-green-200 pt-3 dark:border-green-800">
                  <Button
                    size="sm"
                    onClick={handleApplyFix}
                    className="gap-2 rounded-xl bg-green-600 text-white hover:bg-green-700"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Apply This Fix
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomEditor(true)}
                    className="gap-2 rounded-xl"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit Before Apply
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowComparison(true)}
                    className="gap-2 rounded-xl"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Compare Code
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://github.com/${repoFullName || issue.file}`, '_blank')}
                    className="gap-2 rounded-xl"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View File
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTestDialog(true)}
                    className="gap-2 rounded-xl"
                    title="Generate unit tests"
                  >
                    <TestTube className="h-3.5 w-3.5" />
                    Generate Tests
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDocstringDialog(true)}
                    className="gap-2 rounded-xl"
                    title="Generate documentation"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Generate Docs
                  </Button>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Custom Fix Editor */}
        {showCustomEditor && currentFix && (
          <CustomFixEditor
            open={showCustomEditor}
            onOpenChange={setShowCustomEditor}
            originalCode={currentFix}
            suggestedFix={currentFix}
            language={issue.language}
            filePath={issue.file}
            lineNumber={issue.line}
            issueTitle={issue.title}
            onApply={(editedFix) => {
              onApplyFix(issue, editedFix)
              setShowCustomEditor(false)
            }}
          />
        )}

        {/* Test Generator Dialog */}
        {currentFix && (
          <TestGeneratorDialog
            open={showTestDialog}
            onOpenChange={setShowTestDialog}
            code={currentFix}
            language={issue.language}
            functionName={issue.title.split(' ')[0]}
          />
        )}

        {/* Docstring Generator Dialog */}
        {currentFix && (
          <DocstringGeneratorDialog
            open={showDocstringDialog}
            onOpenChange={setShowDocstringDialog}
            code={currentFix}
            language={issue.language}
            functionName={issue.title.split(' ')[0]}
          />
        )}
      </CardContent>
    </Card>
  )
}
