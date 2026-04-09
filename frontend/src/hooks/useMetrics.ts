/**
 * Metrics Hook
 * Fetches review velocity and team performance metrics
 */

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ReviewVelocity {
  date: string;
  reviewsCompleted: number;
  reviewsFailed: number;
  avgReviewTime: number;
  totalIssues: number;
  criticalIssues: number;
  fixesApplied: number;
  fixesRejected: number;
}

export interface TeamMetrics {
  reviewsCompleted: number;
  reviewsFailed: number;
  totalIssues: number;
  criticalIssues: number;
  fixesApplied: number;
  fixesRejected: number;
  avgReviewTime: number;
  fixAcceptanceRate: number;
  criticalIssueRate: number;
}

export const useReviewVelocity = (options: {
  repositoryId?: string;
  startDate: string;
  endDate: string;
  period?: 'day' | 'week' | 'month';
}) => {
  return useQuery<{ velocity: ReviewVelocity[] }, Error>({
    queryKey: ['review-velocity', options],
    queryFn: async () => {
      const { data } = await api.get('/metrics/velocity', { params: options });
      return data;
    },
  });
};

export const useTeamMetrics = (options: {
  repositoryId?: string;
  startDate: string;
  endDate: string;
}) => {
  return useQuery<{ metrics: TeamMetrics }, Error>({
    queryKey: ['team-metrics', options],
    queryFn: async () => {
      const { data } = await api.get('/metrics/team', { params: options });
      return data;
    },
  });
};
