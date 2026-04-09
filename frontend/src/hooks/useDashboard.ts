import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface RecentPR {
  id: string
  title: string
  repo: string
  author: string
  status: string
  risk: string
  issues: number
  lastRun: string
}

export interface DashboardStats {
  reviewsToday: number
  pendingReviews: number
  criticalIssues: number
  avgReviewTime: number
  completedReviews?: number
  weeklyReviewTrend: {
    date: string
    reviews: number
    approved: number
    rejected: number
    issues: number
  }[]
  issuesBySeverity?: Record<string, number>
  recentPRs?: RecentPR[]
}

export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardStats> => {
      const { data } = await api.get<DashboardStats>('/dashboard')
      return data
    },
    staleTime: 30 * 1000,
    refetchOnMount: true,
  })
}
