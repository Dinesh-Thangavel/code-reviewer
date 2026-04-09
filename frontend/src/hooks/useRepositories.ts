import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Repository {
  id: string
  name: string
  fullName: string
  provider?: 'GITHUB' | 'BITBUCKET'
  isActive: boolean
  autoReview: boolean
  strictness: 'RELAXED' | 'BALANCED' | 'STRICT'
  languages: string[]
  ignorePaths: string[]
  pullRequestCount?: number
  createdAt: string
  updatedAt?: string
}

export const useRepositories = () => {
  return useQuery({
    queryKey: ['repositories'],
    queryFn: async (): Promise<Repository[]> => {
      const { data } = await api.get<Repository[]>('/repositories')
      return data
    },
    staleTime: 60 * 1000,
  })
}

export interface UpdateRepositoryParams {
  id: string
  isActive?: boolean
  autoReview?: boolean
  strictness?: string
  languages?: string[]
  ignorePaths?: string[]
}

export const useUpdateRepository = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateRepositoryParams) => {
      const { data } = await api.put(`/repositories/${id}`, updates)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
    },
  })
}
