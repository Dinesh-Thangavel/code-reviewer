/**
 * Code Comparison Dialog
 * Shows side-by-side comparison of original vs changed code
 * Opens in a modal window for better UX
 */

import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  FileCode, 
  GitBranch, 
  Eye, 
  Copy, 
  Check, 
  X,
  ArrowRight,
  Download,
  ExternalLink
} from 'lucide-react'
import { CodeBlock } from './CodeBlock'
import api from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

interface CodeComparisonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string
  fileName: string
  language: string
  changedCode?: string // The patch or changed code
  originalCode?: string // Optional: if we already have it
  lineNumber?: number // For issue-specific views
  issueTitle?: string
  prId?: string
  repoFullName?: string
}

export function CodeComparisonDialog({
  open,
  onOpenChange,
  filePath,
  fileName,
  language,
  changedCode,
  originalCode: providedOriginalCode,
  lineNumber,
  issueTitle,
  prId,
  repoFullName,
}: CodeComparisonDialogProps) {
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side')
  const [showFullFile, setShowFullFile] = useState(false)

  // Fetch original file content if not provided
  const { data: fileContent, isLoading: isLoadingFile } = useQuery({
    queryKey: ['file-content', filePath, prId, repoFullName],
    queryFn: async () => {
      let finalRepoFullName = repoFullName
      
      // Try to get repoFullName from PR if not provided
      if (!finalRepoFullName && prId) {
        try {
          const { data: prData } = await api.get(`/pull-requests/${prId}`)
          finalRepoFullName = prData?.repository?.fullName || prData?.repo
        } catch (error) {
          console.error('Failed to fetch PR data:', error)
        }
      }
      
      if (!finalRepoFullName) return null
      
      try {
        const { data } = await api.get('/code/file', {
          params: {
            repoFullName: finalRepoFullName,
            filePath,
            ref: 'main', // Default to main branch
          },
        })
        return data
      } catch (error) {
        console.error('Failed to fetch file content:', error)
        return null
      }
    },
    enabled: open && !providedOriginalCode && (!!prId || !!repoFullName),
  })

  // Note: useCodeContext requires issueId, not lineNumber
  // We'll fetch file content directly instead

  const originalCode = providedOriginalCode || fileContent?.content || ''
  const isLoading = isLoadingFile

  // Parse changed code (patch format) to extract actual changes
  const parsePatch = (patch: string) => {
    if (!patch) return { additions: [], deletions: [], context: [] }
    
    const lines = patch.split('\n')
    const additions: Array<{ line: number; content: string }> = []
    const deletions: Array<{ line: number; content: string }> = []
    const context: Array<{ line: number; content: string }> = []
    
    let originalLineNum = 0
    let newLineNum = 0
    
    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Parse line numbers from hunk header
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d*/)
        if (match) {
          originalLineNum = parseInt(match[1]) - 1
          newLineNum = parseInt(match[2]) - 1
        }
        continue
      }
      
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions.push({ line: newLineNum++, content: line.substring(1) })
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions.push({ line: originalLineNum++, content: line.substring(1) })
      } else if (!line.startsWith('\\')) {
        context.push({ line: originalLineNum++, content: line })
        newLineNum++
      }
    }
    
    return { additions, deletions, context }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const originalLines = originalCode.split('\n')
  const changedLines = changedCode ? parsePatch(changedCode) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                Code Comparison
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-2">
                <span className="font-mono text-sm">{fileName}</span>
                <Badge variant="outline">{language}</Badge>
                {lineNumber && (
                  <Badge variant="secondary">Line {lineNumber}</Badge>
                )}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'side-by-side' ? 'unified' : 'side-by-side')}
              >
                {viewMode === 'side-by-side' ? (
                  <>
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Unified
                  </>
                ) : (
                  <>
                    <GitBranch className="h-3.5 w-3.5 mr-1" />
                    Side-by-Side
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFullFile(!showFullFile)}
              >
                {showFullFile ? 'Show Context' : 'Show Full File'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[500px] w-full" />
            </div>
          ) : viewMode === 'side-by-side' ? (
            <div className="grid grid-cols-2 gap-4 h-full min-h-0">
              {/* Original Code */}
              <div className="flex flex-col border rounded-lg overflow-hidden">
                <div className="bg-red-500/10 border-b px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <X className="h-4 w-4 text-red-600" />
                    <span className="font-semibold text-sm">Original Code</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(originalCode)}
                    className="h-7"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4">
                    <CodeBlock 
                      code={originalCode} 
                      language={language}
                      showLineNumbers
                    />
                  </div>
                </ScrollArea>
              </div>

              {/* Changed Code */}
              <div className="flex flex-col border rounded-lg overflow-hidden">
                <div className="bg-green-500/10 border-b px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-sm">Changed Code</span>
                  </div>
                  {changedCode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(changedCode)}
                      className="h-7"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4">
                    {changedCode ? (
                      <CodeBlock 
                        code={changedCode} 
                        language={language}
                        showLineNumbers
                      />
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        No changes available
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            /* Unified View */
            <div className="border rounded-lg overflow-hidden h-full min-h-0">
              <div className="bg-muted border-b px-4 py-2 flex items-center justify-between">
                <span className="font-semibold text-sm">Unified Diff View</span>
                {changedCode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(changedCode)}
                    className="h-7"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[calc(90vh-240px)]">
                <div className="p-4">
                  {changedCode ? (
                    <pre className="text-xs font-mono">
                      <code>
                        {changedCode.split('\n').map((line, i) => {
                          const isAddition = line.startsWith('+') && !line.startsWith('+++')
                          const isDeletion = line.startsWith('-') && !line.startsWith('---')
                          const isContext = !isAddition && !isDeletion
                          
                          return (
                            <div
                              key={i}
                              className={`py-0.5 px-2 ${
                                isAddition
                                  ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                  : isDeletion
                                  ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              <span className="text-muted-foreground mr-3 select-none w-8 inline-block text-right">
                                {i + 1}
                              </span>
                              <span className={isContext ? '' : 'font-semibold'}>
                                {line || ' '}
                              </span>
                            </div>
                          )
                        })}
                      </code>
                    </pre>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      No changes available
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCode className="h-4 w-4" />
            <span>{filePath}</span>
          </div>
          <div className="flex items-center gap-2">
            {repoFullName && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://github.com/${repoFullName}/blob/main/${filePath}`, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                View on GitHub
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
