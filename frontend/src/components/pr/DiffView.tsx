/**
 * CodeRabbit-style diff view component
 * Shows side-by-side comparison of original vs fixed code
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileCode, ArrowRight } from 'lucide-react'

interface DiffViewProps {
  original: string
  fixed: string
  language: string
  filePath: string
  lineNumber: number
  issueTitle: string
}

export function DiffView({
  original,
  fixed,
  language,
  filePath,
  lineNumber,
  issueTitle,
}: DiffViewProps) {
  const originalLines = original ? original.split('\n') : []
  const fixedLines = fixed ? fixed.split('\n') : []

  // Simple diff highlighting
  const maxLines = Math.max(originalLines.length, fixedLines.length)

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{issueTitle}</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {filePath}:{lineNumber}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-destructive">Original</span>
              <Badge variant="destructive" className="text-xs">
                {language}
              </Badge>
            </div>
            <ScrollArea className="h-[400px] rounded-lg border bg-muted/50 p-4">
              <pre className="text-xs font-mono">
                <code className="text-foreground">
                  {originalLines.map((line, i) => (
                    <div
                      key={i}
                      className="py-0.5 px-2 rounded hover:bg-destructive/10 transition-colors"
                    >
                      <span className="text-muted-foreground mr-2 select-none">
                        {i + 1}
                      </span>
                      <span className="text-destructive">{line || ' '}</span>
                    </div>
                  ))}
                </code>
              </pre>
            </ScrollArea>
          </div>

          {/* Fixed Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                Fixed
              </span>
              <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                {language}
              </Badge>
            </div>
            <ScrollArea className="h-[400px] rounded-lg border bg-muted/50 p-4">
              <pre className="text-xs font-mono">
                <code className="text-foreground">
                  {fixedLines.map((line, i) => (
                    <div
                      key={i}
                      className="py-0.5 px-2 rounded hover:bg-green-500/10 transition-colors"
                    >
                      <span className="text-muted-foreground mr-2 select-none">
                        {i + 1}
                      </span>
                      <span className="text-green-600 dark:text-green-400">{line || ' '}</span>
                    </div>
                  ))}
                </code>
              </pre>
            </ScrollArea>
          </div>
        </div>

        {/* Arrow indicator */}
        <div className="flex items-center justify-center mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Changes</span>
            <ArrowRight className="h-4 w-4" />
            <span className="text-green-600 dark:text-green-400">Applied</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
