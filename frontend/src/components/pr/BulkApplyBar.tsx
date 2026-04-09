import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Loader2, GitBranch, ExternalLink, GitMerge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface BulkApplyBarProps {
  selectedCount: number
  totalCount: number
  onApplyAll: () => void
  onCreatePR: () => void
  onMergePR: () => void
  onDeselectAll: () => void
  isApplying: boolean
  isCreatingPR: boolean
  isMergingPR: boolean
  appliedCount: number
  fixPRUrl?: string | null
  fixPRNumber?: number | null
}

export function BulkApplyBar({
  selectedCount,
  totalCount,
  onApplyAll,
  onCreatePR,
  onMergePR,
  onDeselectAll,
  isApplying,
  isCreatingPR,
  isMergingPR,
  appliedCount,
  fixPRUrl,
  fixPRNumber,
}: BulkApplyBarProps) {
  if (selectedCount === 0 && appliedCount === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Left side - Info */}
            <div className="flex items-center gap-3">
              {selectedCount > 0 && (
                <>
                  <Badge variant="default" className="text-sm">
                    {selectedCount} selected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    of {totalCount} fixable issues
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDeselectAll}
                    className="h-7 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </>
              )}

              {appliedCount > 0 && (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                  <Check className="h-3 w-3" />
                  {appliedCount} fixes applied
                </Badge>
              )}
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <Button
                  onClick={onApplyAll}
                  disabled={isApplying}
                  size="sm"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Applying {selectedCount} fixes...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Apply {selectedCount} Fixes
                    </>
                  )}
                </Button>
              )}

              {appliedCount > 0 && !fixPRUrl && (
                <Button
                  onClick={onCreatePR}
                  disabled={isCreatingPR}
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isCreatingPR ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating PR...
                    </>
                  ) : (
                    <>
                      <GitBranch className="h-4 w-4 mr-2" />
                      Create Fix PR
                    </>
                  )}
                </Button>
              )}

              {fixPRUrl && fixPRNumber && (
                <>
                  <Button
                    onClick={onMergePR}
                    disabled={isMergingPR}
                    variant="default"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isMergingPR ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Merging...
                      </>
                    ) : (
                      <>
                        <GitMerge className="h-4 w-4 mr-2" />
                        Merge PR #{fixPRNumber}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href={fixPRUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Fix PR
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
