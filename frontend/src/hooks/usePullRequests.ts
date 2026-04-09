import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface PullRequest {
  id: string
  number?: number
  title: string
  repo: string
  author: string
  status: 'Completed' | 'Reviewing' | 'Waiting' | 'Failed'
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
  issues: number
  fixedIssues?: number
  lastRun: string
  reviewId?: string | null
}

export interface PullRequestsResponse {
  data: PullRequest[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface UsePullRequestsOptions {
  search?: string
  status?: string
  risk?: string
  repo?: string
  page?: number
  limit?: number
}

export const usePullRequests = (options?: UsePullRequestsOptions) => {
  return useQuery({
    queryKey: ['pull-requests', options],
    queryFn: async (): Promise<PullRequestsResponse> => {
      const params: Record<string, string> = {}
      if (options?.search) params.search = options.search
      if (options?.status && options.status !== 'all') params.status = options.status
      if (options?.risk && options.risk !== 'all') params.risk = options.risk
      if (options?.repo && options.repo !== 'all') params.repo = options.repo
      if (options?.page) params.page = options.page.toString()
      if (options?.limit) params.limit = options.limit.toString()

      const { data } = await api.get<PullRequestsResponse>('/pull-requests', { params })
      return data
    },
    staleTime: 30 * 1000,
  })
}
