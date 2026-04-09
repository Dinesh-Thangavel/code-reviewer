/**
 * Review Progress Banner
 * Shows detailed progress with files and lines when review is in progress
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, FileCode, CheckCircle2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuth } from '@/lib/auth-provider'

interface ReviewProgressBannerProps {
  reviewStatus?: string
  filesChanged?: number
  isPolling?: boolean
  prId?: string
}

interface ReviewProgress {
  totalFiles: number
  completedFiles: number
  pendingFiles: number
  totalLines: number
  reviewedLines: number
  pendingLines: number
  currentFile?: string
  progressPercent: number
}

export function ReviewProgressBanner({ 
  reviewStatus, 
  filesChanged = 0,
  isPolling = false,
  prId
}: ReviewProgressBannerProps) {
  const { user } = useAuth()
  const [progress, setProgress] = useState<ReviewProgress | null>(null)

  // Listen for WebSocket progress updates
  useWebSocket(user?.id, (event, data) => {
    if (event === 'review-progress' && data.prId === prId) {
      setProgress(data)
    } else if (event === 'review-completed' && data.prId === prId) {
      // Clear progress when review completes
      setTimeout(() => setProgress(null), 2000)
    }
  })

  // Only show if review is actually in progress
  const isReviewing = reviewStatus === 'PENDING' || reviewStatus === 'IN_PROGRESS'

  if (!isReviewing && !isPolling && !progress) return null

  // Use progress data if available, otherwise use fallback
  const displayProgress = progress || {
    totalFiles: filesChanged,
    completedFiles: 0,
    pendingFiles: filesChanged,
    totalLines: 0,
    reviewedLines: 0,
    pendingLines: 0,
    progressPercent: 0,
  }

  const filesPercent = displayProgress.totalFiles > 0 
    ? Math.round((displayProgress.completedFiles / displayProgress.totalFiles) * 100)
    : 0

  const linesPercent = displayProgress.totalLines > 0
    ? Math.round((displayProgress.reviewedLines / displayProgress.totalLines) * 100)
    : 0

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900">
          <CardContent className="p-5">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="flex-shrink-0"
                >
                  <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </motion.div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    AI Review in Progress
                  </h3>
                  {displayProgress.currentFile && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      Analyzing: <span className="font-mono text-xs">{displayProgress.currentFile}</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {displayProgress.progressPercent}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Complete</div>
                </div>
              </div>

              {/* Overall Progress Bar */}
              <div className="space-y-1">
                <Progress value={displayProgress.progressPercent} className="h-2" />
              </div>

              {/* Detailed Stats */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                {/* Files Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                      <FileCode className="h-3.5 w-3.5" />
                      Files
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {displayProgress.completedFiles} / {displayProgress.totalFiles}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Progress 
                      value={filesPercent} 
                      className="h-1.5" 
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{displayProgress.completedFiles} completed</span>
                      <span>{displayProgress.pendingFiles} pending</span>
                    </div>
                  </div>
                </div>

                {/* Lines Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Lines
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {displayProgress.reviewedLines.toLocaleString()} / {displayProgress.totalLines.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Progress 
                      value={linesPercent} 
                      className="h-1.5" 
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{displayProgress.reviewedLines.toLocaleString()} reviewed</span>
                      <span>{displayProgress.pendingLines.toLocaleString()} pending</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
