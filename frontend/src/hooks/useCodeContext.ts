/**
 * Hook to fetch code context for diff view
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface CodeContext {
  originalCode: string
  fullContent: string
  lineNumber: number
  startLine: number
  endLine: number
}

export const useCodeContext = (issueId: string | undefined) => {
  return useQuery<CodeContext>({
    queryKey: ['code-context', issueId],
    queryFn: async () => {
      if (!issueId) throw new Error('Issue ID is required')
      const { data } = await api.get(`/code/context/${issueId}`)
      return data
    },
    enabled: !!issueId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
