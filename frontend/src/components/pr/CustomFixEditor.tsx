/**
 * Custom Fix Editor
 * Allows users to edit fixes before applying
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CodeBlock } from './CodeBlock'
import { DiffView } from './DiffView'
import { Loader2, Edit, Check } from 'lucide-react'

interface CustomFixEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalCode: string
  suggestedFix: string
  language: string
  filePath: string
  lineNumber: number
  issueTitle: string
  onApply: (editedFix: string) => void
  isApplying?: boolean
}

export function CustomFixEditor({
  open,
  onOpenChange,
  originalCode,
  suggestedFix,
  language,
  filePath,
  lineNumber,
  issueTitle,
  onApply,
  isApplying = false,
}: CustomFixEditorProps) {
  const [editedFix, setEditedFix] = useState(suggestedFix)
  const [showDiff, setShowDiff] = useState(false)

  const handleApply = () => {
    onApply(editedFix)
  }

  const handleReset = () => {
    setEditedFix(suggestedFix)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Fix Before Applying
          </DialogTitle>
          <DialogDescription>
            Customize the suggested fix before applying it to {filePath}:{lineNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle between editor and diff view */}
          <div className="flex items-center justify-between">
            <Label>Edit Fix Code</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiff(!showDiff)}
            >
              {showDiff ? 'Show Editor' : 'Show Diff'}
            </Button>
          </div>

          {showDiff ? (
            <DiffView
              original={originalCode}
              fixed={editedFix}
              language={language}
              filePath={filePath}
              lineNumber={lineNumber}
              issueTitle={issueTitle}
            />
          ) : (
            <div className="space-y-2">
              <Textarea
                value={editedFix}
                onChange={(e) => setEditedFix(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
                placeholder="Edit the fix code here..."
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reset to Original
                </Button>
                <div className="text-xs text-muted-foreground flex items-center">
                  Language: {language}
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <CodeBlock code={editedFix} language={language} />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={isApplying || editedFix.trim() === ''}
              className="gap-2"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Apply Edited Fix
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
