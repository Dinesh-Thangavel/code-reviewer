/**
 * Test Generator Dialog
 * UI for generating unit tests for code
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
import { Textarea } from '@/components/ui/textarea'
import { CodeBlock } from './CodeBlock'
import { Loader2, TestTube, Copy, Check } from 'lucide-react'
import { useGenerateTests, useAnalyzeCoverage } from '@/hooks/useTestGenerator'
import { useToast } from '@/hooks/use-toast'

interface TestGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: string
  language: string
  functionName?: string
}

export function TestGeneratorDialog({
  open,
  onOpenChange,
  code,
  language,
  functionName,
}: TestGeneratorDialogProps) {
  const [framework, setFramework] = useState<string>('')
  const [existingTests, setExistingTests] = useState('')
  const [generatedTests, setGeneratedTests] = useState<string | null>(null)
  const [coverageAnalysis, setCoverageAnalysis] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const generateTestsMutation = useGenerateTests()
  const analyzeCoverageMutation = useAnalyzeCoverage()
  const { toast } = useToast()

  const frameworks: Record<string, string[]> = {
    javascript: ['jest', 'mocha', 'vitest'],
    typescript: ['jest', 'vitest', 'mocha'],
    python: ['pytest', 'unittest', 'nose'],
    java: ['junit', 'testng'],
    go: ['testing', 'testify'],
    rust: ['test'],
  }

  const handleGenerate = async () => {
    try {
      const result = await generateTestsMutation.mutateAsync({
        code,
        language,
        framework: framework || undefined,
        existingTests: existingTests || undefined,
        functionName,
      })
      setGeneratedTests(result.tests)
      toast({
        title: 'Tests generated',
        description: 'Unit tests have been generated successfully.',
      })
    } catch (error: any) {
      toast({
        title: 'Failed to generate tests',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    }
  }

  const handleAnalyzeCoverage = async () => {
    if (!generatedTests) return
    try {
      const result = await analyzeCoverageMutation.mutateAsync({
        code,
        tests: generatedTests,
        language,
      })
      setCoverageAnalysis(result.analysis)
      toast({
        title: 'Coverage analyzed',
        description: `Coverage: ${result.analysis.coverage}%`,
      })
    } catch (error: any) {
      toast({
        title: 'Failed to analyze coverage',
        description: error?.response?.data?.error || error.message,
        variant: 'destructive',
      })
    }
  }

  const handleCopy = async () => {
    if (generatedTests) {
      await navigator.clipboard.writeText(generatedTests)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Generate Unit Tests
          </DialogTitle>
          <DialogDescription>
            Generate comprehensive unit tests for the selected code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Framework Selection */}
          {frameworks[language.toLowerCase()] && (
            <div className="space-y-2">
              <Label>Test Framework</Label>
              <Select value={framework} onValueChange={setFramework}>
                <SelectTrigger>
                  <SelectValue placeholder="Select framework (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {frameworks[language.toLowerCase()].map((fw) => (
                    <SelectItem key={fw} value={fw}>
                      {fw}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Existing Tests */}
          <div className="space-y-2">
            <Label>Existing Tests (optional)</Label>
            <Textarea
              value={existingTests}
              onChange={(e) => setExistingTests(e.target.value)}
              placeholder="Paste existing tests to avoid duplicates..."
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generateTestsMutation.isPending}
            className="w-full"
          >
            {generateTestsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating tests...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Generate Tests
              </>
            )}
          </Button>

          {/* Generated Tests */}
          {generatedTests && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Generated Tests</h3>
                <div className="flex gap-2">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAnalyzeCoverage}
                    disabled={analyzeCoverageMutation.isPending}
                  >
                    {analyzeCoverageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Analyze Coverage'
                    )}
                  </Button>
                </div>
              </div>
              <CodeBlock code={generatedTests} language={language} />
            </div>
          )}

          {/* Coverage Analysis */}
          {coverageAnalysis && (
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold">Coverage Analysis</h4>
              <p className="text-sm">
                <strong>Coverage:</strong> {coverageAnalysis.coverage}%
              </p>
              {coverageAnalysis.missingTests && coverageAnalysis.missingTests.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-semibold">Missing Tests:</p>
                  <ul className="list-disc list-inside text-sm">
                    {coverageAnalysis.missingTests.map((test: string, idx: number) => (
                      <li key={idx}>{test}</li>
                    ))}
                  </ul>
                </div>
              )}
              {coverageAnalysis.suggestions && coverageAnalysis.suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-semibold">Suggestions:</p>
                  <ul className="list-disc list-inside text-sm">
                    {coverageAnalysis.suggestions.map((suggestion: string, idx: number) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
