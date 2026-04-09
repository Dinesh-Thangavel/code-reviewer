import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface IssueTypeData {
  type: string
  count: number
}

export interface LanguageIssueData {
  language: string
  issues: number
  percentage: number
}

export interface RiskTrendData {
  date: string
  high: number
  medium: number
  low: number
}

export interface InsightsStats {
  totalPRs: number
  totalIssues: number
  totalReviews?: number
  averageIssuesPerPR: number
  mostCommonIssueTypes: IssueTypeData[]
  issuesPerLanguage: LanguageIssueData[]
  riskTrend: RiskTrendData[]
  fixStats?: {
    applied: number
    rejected: number
    failed: number
    pending: number
  }
}

export const useInsights = () => {
  return useQuery({
    queryKey: ['insights'],
    queryFn: async (): Promise<InsightsStats> => {
      const { data } = await api.get<InsightsStats>('/insights')
      return data
    },
    staleTime: 60 * 1000,
  })
}
