/**
 * PR File Changes Viewer
 * Shows what files changed in the PR with diff view
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  FileCode, 
  Plus, 
  Minus, 
  GitBranch, 
  ChevronDown, 
  ChevronRight,
  ExternalLink,
  Loader2,
  Eye
} from 'lucide-react'
import { CodeComparisonDialog } from './CodeComparisonDialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface PRFile {
  filename: string
  language: string
  patch: string
  additions: number
  deletions: number
  changes: number
  status: string
}

interface PRFilesResponse {
  files: PRFile[]
  totalFiles: number
  totalAdditions: number
  totalDeletions: number
  totalChanges: number
  repoFullName?: string
}

interface PRFileChangesProps {
  prId: string
  repoFullName?: string
}

function FileDiffView({ file, prId, repoFullName }: { file: PRFile; prId?: string; repoFullName?: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  
  const lines = file.patch.split('\n')
  const hasChanges = file.changes > 0

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="border">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-mono truncate">{file.filename}</CardTitle>
                  <div className="text-xs mt-1 text-muted-foreground flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{file.language}</Badge>
                    <span>{file.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {hasChanges && (
                  <>
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Plus className="h-3.5 w-3.5" />
                      <span className="text-sm font-semibold">{file.additions}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <Minus className="h-3.5 w-3.5" />
                      <span className="text-sm font-semibold">{file.deletions}</span>
                    </div>
                  </>
                )}
                <Badge variant="secondary" className="text-xs">
                  {file.changes} changes
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowComparison(true)
                  }}
                  className="gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Compare
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <ScrollArea className="h-[400px] rounded-lg border bg-muted/30 p-4">
              <pre className="text-xs font-mono">
                <code>
                  {lines.map((line, i) => {
                    const isAddition = line.startsWith('+') && !line.startsWith('+++')
                    const isDeletion = line.startsWith('-') && !line.startsWith('---')
                    const isContext = !isAddition && !isDeletion
                    
                    return (
                      <div
                        key={i}
                        className={`py-0.5 px-2 rounded ${
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
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Card>
      
      <CodeComparisonDialog
        open={showComparison}
        onOpenChange={setShowComparison}
        filePath={file.filename}
        fileName={file.filename.split('/').pop() || file.filename}
        language={file.language}
        changedCode={file.patch}
        prId={prId}
        repoFullName={repoFullName}
      />
    </Collapsible>
  )
}

export function PRFileChanges({ prId, repoFullName: providedRepoFullName }: PRFileChangesProps) {
  const { data, isLoading, error } = useQuery<PRFilesResponse>({
    queryKey: ['pr-files', prId],
    queryFn: async () => {
      const { data } = await api.get(`/pull-requests/${prId}/files`)
      return data
    },
    enabled: !!prId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>File Changes</CardTitle>
          <CardDescription>Unable to load file changes</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              File Changes
            </CardTitle>
            <CardDescription className="mt-1">
              {data.totalFiles} file{data.totalFiles !== 1 ? 's' : ''} changed
              {' • '}
              <span className="text-green-600 dark:text-green-400 font-semibold">
                +{data.totalAdditions}
              </span>
              {' '}
              <span className="text-red-600 dark:text-red-400 font-semibold">
                -{data.totalDeletions}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <FileCode className="h-3 w-3" />
              {data.totalFiles} files
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <GitBranch className="h-3 w-3" />
              {data.totalChanges} changes
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No file changes found
          </div>
        ) : (
          <div className="space-y-3">
            {data.files.map((file) => (
              <FileDiffView 
                key={file.filename} 
                file={file} 
                prId={prId}
                repoFullName={data.repoFullName || providedRepoFullName}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
