import { useState } from 'react'
import { Loader2, Check, AlertTriangle, GitBranch, Copy, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DiffView } from './DiffView'
import { useCodeContext } from '@/hooks/useCodeContext'
import { Skeleton } from '@/components/ui/skeleton'
import type { PRIssue } from '@/hooks/usePRDetail'

interface ApplyFixDialogProps {
  issue: PRIssue | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (issue: PRIssue, customFix?: string) => void
  onReject: (issueId: string) => void
  isApplying: boolean
}

export function ApplyFixDialog({
  issue,
  open,
  onOpenChange,
  onApply,
  onReject,
  isApplying,
}: ApplyFixDialogProps) {
  const [copied, setCopied] = useState(false)
  const { data: codeContext, isLoading: isLoadingContext } = useCodeContext(issue?.id)

  if (!issue) return null

  const handleCopy = async () => {
    if (issue.suggestedFix) {
      await navigator.clipboard.writeText(issue.suggestedFix)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500'
      case 'security': return 'text-orange-500'
      case 'performance': return 'text-yellow-500'
      case 'quality': return 'text-blue-500'
      case 'style': return 'text-purple-500'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${getSeverityColor(issue.severity)}`} />
            Apply Suggested Fix
          </DialogTitle>
          <DialogDescription>
            Review the suggested fix before applying it to the repository.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Issue Info */}
          <div className="space-y-2">
            <h4 className="font-semibold text-lg">{issue.title}</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {issue.file}:{issue.line}
              </Badge>
              <Badge variant="secondary">{issue.language}</Badge>
              <Badge
                variant={issue.severity === 'critical' || issue.severity === 'security' ? 'destructive' : 'outline'}
              >
                {issue.severity.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-lg bg-muted/50 p-4 border">
            <p className="text-sm leading-relaxed">{issue.description}</p>
          </div>

          {/* Suggested Fix with Diff View */}
          {issue.suggestedFix && (
            <div className="space-y-2">
              <Tabs defaultValue="diff" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="diff" className="gap-2">
                    <Eye className="h-3.5 w-3.5" />
                    Diff View
                  </TabsTrigger>
                  <TabsTrigger value="code" className="gap-2">
                    <GitBranch className="h-3.5 w-3.5" />
                    Code Only
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="diff" className="mt-2">
                  {isLoadingContext ? (
                    <div className="space-y-4">
                      <Skeleton className="h-[400px] w-full" />
                    </div>
                  ) : (
                    <DiffView
                      original={codeContext?.originalCode || '// Original code not available'}
                      fixed={issue.suggestedFix}
                      language={issue.language}
                      filePath={issue.file}
                      lineNumber={issue.line}
                      issueTitle={issue.title}
                    />
                  )}
                </TabsContent>
                <TabsContent value="code" className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-sm flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Suggested Fix
                    </h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="h-7 text-xs"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono border max-h-[300px] overflow-y-auto">
                    <code className="text-foreground whitespace-pre-wrap">{issue.suggestedFix}</code>
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* What will happen */}
          <div className="rounded-lg bg-blue-500/10 p-4 border border-blue-500/20">
            <h5 className="font-medium text-sm mb-2 text-blue-700 dark:text-blue-300">
              What will happen:
            </h5>
            <ul className="text-sm space-y-1 text-blue-700/80 dark:text-blue-300/80">
              <li>• A new branch will be created from your base branch</li>
              <li>• The fix will be committed to <code className="font-mono text-xs bg-blue-500/10 px-1 rounded">{issue.file}</code></li>
              <li>• You can review the changes before merging</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => {
              onReject(issue.id)
              onOpenChange(false)
            }}
            disabled={isApplying}
          >
            Dismiss Issue
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onApply(issue)}
            disabled={isApplying || !issue.suggestedFix}
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying Fix...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Apply Fix
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
