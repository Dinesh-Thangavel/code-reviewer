/**
 * Docstring Generator Dialog
 * UI for generating docstrings for code
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CodeBlock } from './CodeBlock'
import { Loader2, FileText, Copy, Check } from 'lucide-react'
import { useGenerateDocstring, type DocstringFormat } from '@/hooks/useDocstringGenerator'
import { useToast } from '@/hooks/use-toast'

interface DocstringGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: string
  language: string
  functionName?: string
  className?: string
}

export function DocstringGeneratorDialog({
  open,
  onOpenChange,
  code,
  language,
  functionName,
  className,
}: DocstringGeneratorDialogProps) {
  const [format, setFormat] = useState<DocstringFormat>('jsdoc')
  const [generatedDocstring, setGeneratedDocstring] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generateDocstringMutation = useGenerateDocstring()
  const { toast } = useToast()

  const formats: { value: DocstringFormat; label: string }[] = [
    { value: 'jsdoc', label: 'JSDoc (JavaScript)' },
    { value: 'tsdoc', label: 'TSDoc (TypeScript)' },
    { value: 'python', label: 'Python Docstring' },
    { value: 'java', label: 'JavaDoc' },
    { value: 'go', label: 'Go Comments' },
    { value: 'rust', label: 'Rust Docs' },
  ]

  const handleGenerate = async () => {
    try {
      const result = await generateDocstringMutation.mutateAsync({
        code,
        language,
        format,
        functionName,
        className,
      })
      setGeneratedDocstring(result.docstring)
      toast({
        title: 'Docstring generated',
        description: 'Documentation has been generated successfully.',
      })
    } catch (error: any) {
      toast({
        title: 'Failed to generate docstring',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    }
  }

  const handleCopy = async () => {
    if (generatedDocstring) {
      await navigator.clipboard.writeText(generatedDocstring)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Docstring
          </DialogTitle>
          <DialogDescription>
            Generate documentation for the selected code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Documentation Format</Label>
            <Select value={format} onValueChange={(value) => setFormat(value as DocstringFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formats.map((fmt) => (
                  <SelectItem key={fmt.value} value={fmt.value}>
                    {fmt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generateDocstringMutation.isPending}
            className="w-full"
          >
            {generateDocstringMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating docstring...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Docstring
              </>
            )}
          </Button>

          {/* Generated Docstring */}
          {generatedDocstring && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Generated Docstring</h3>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <CodeBlock code={generatedDocstring} language={language} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
