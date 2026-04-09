import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export type FixStatus = 'PENDING' | 'APPLIED' | 'REJECTED' | 'FAILED'

export interface PRIssue {
  id: string
  severity: string
  file: string
  line: number
  title: string
  description: string
  suggestedFix: string | null
  alternativeFixes?: string[]
  language: string
  fixStatus: FixStatus
  appliedAt?: string | null
  commitSha?: string | null
  fixBranch?: string | null
}

export interface LanguageBreakdown {
  language: string
  files: number
  lines: number
  percentage: number
}

export interface ReviewHistoryItem {
  id: string
  status: string
  confidenceScore: number
  riskLevel: string
  issueCount: number
  createdAt: string
}

export interface PRDetailData {
  id: string
  number?: number
  title: string
  author: string
  repo: string
  repoId?: string
  status: string
  riskLevel: string
  baseBranch?: string
  headSha?: string
  reviewId: string | null
  summary: string
  confidenceScore: number
  reviewStatus?: string
  filesChanged: number
  languageBreakdown: LanguageBreakdown[]
  issues: PRIssue[]
  reviews?: ReviewHistoryItem[]
  createdAt: string
  updatedAt?: string
}

export const usePRDetail = (id: string | undefined) => {
  return useQuery({
    queryKey: ['pr-detail', id],
    enabled: !!id,
    queryFn: async (): Promise<PRDetailData | null> => {
      if (!id) return null

      const { data } = await api.get<PRDetailData>(`/pull-requests/${id}`)
      return data
    },
    staleTime: 30 * 1000,
    // Poll every 3 seconds when review is in progress
    refetchInterval: (query) => {
      const data = query.state.data as PRDetailData | null
      // Only poll if review status is explicitly PENDING or IN_PROGRESS
      const isReviewing = data?.reviewStatus === 'PENDING' || data?.reviewStatus === 'IN_PROGRESS'
      return isReviewing ? 3000 : false
    },
  })
}

// Helper to extract a user-friendly error message from API errors
function getApiErrorMessage(error: any, fallback: string): string {
  if (error?.response?.data?.error) return error.response.data.error
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.message) return error.message
  return fallback
}

// Apply a single fix
export const useApplyFix = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (issueId: string) => {
      const { data } = await api.post(`/issues/${issueId}/apply-fix`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-detail'] })
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
    onError: (error: any) => {
      const msg = getApiErrorMessage(error, 'Failed to apply fix')
      error.userMessage = msg
    },
  })
}

// Reject a fix
export const useRejectFix = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (issueId: string) => {
      const { data } = await api.post(`/issues/${issueId}/reject-fix`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-detail'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
  })
}

// Bulk apply fixes
export const useBulkApplyFixes = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ reviewId, issueIds }: { reviewId: string; issueIds: string[] }) => {
      const { data } = await api.post(`/reviews/${reviewId}/apply-bulk`, { issueIds })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-detail'] })
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
  })
}

// Create fix PR
export const useCreateFixPR = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { data } = await api.post(`/reviews/${reviewId}/create-fix-pr`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-detail'] })
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
    },
  })
}

// Merge fix PR
export const useMergeFixPR = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ prNumber, mergeMethod = 'merge' }: { prNumber: number; mergeMethod?: 'merge' | 'squash' | 'rebase' }) => {
      const { data } = await api.post(`/pull-requests/${prNumber}/merge`, { mergeMethod })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-detail'] })
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
    },
  })
}

// Re-run review
export const useRerunReview = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ prId, securityOnly = false }: { prId: string; securityOnly?: boolean }) => {
      const { data } = await api.post(`/reviews/${prId}/rerun`, { securityOnly })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-detail'] })
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// Rollback fix
export const useRollbackFix = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (issueId: string) => {
      const { data } = await api.post(`/issues/${issueId}/rollback`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-detail'] })
      queryClient.invalidateQueries({ queryKey: ['pull-requests'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
  })
}