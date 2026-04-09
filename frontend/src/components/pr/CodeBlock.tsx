/**
 * Code block component with syntax highlighting and copy functionality
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CodeBlockProps {
  code: string
  language: string
  showLineNumbers?: boolean
}

export function CodeBlock({ code, language, showLineNumbers = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = code.split('\n')

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-muted"
          title="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono border">
        <code className="text-foreground">
          {showLineNumbers ? (
            lines.map((line, i) => (
              <div key={i} className="flex">
                <span className="text-muted-foreground mr-4 select-none w-8 text-right shrink-0">
                  {i + 1}
                </span>
                <span>{line || ' '}</span>
              </div>
            ))
          ) : (
            code
          )}
        </code>
      </pre>
    </div>
  )
}
