/**
 * Repository Selector Component
 * CodeRabbit-style repository selection and management
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { useToast } from '@/hooks/use-toast'
import {
  Github,
  Search,
  Star,
  Lock,
  Globe,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Settings,
} from 'lucide-react'
import api from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-provider'

interface GitHubRepository {
  id: number
  name: string
  full_name: string
  private: boolean
  language: string | null
  stargazers_count: number
  updated_at: string
  permissions: {
    admin: boolean
    push: boolean
    pull: boolean
  }
}

interface RepositorySelectorProps {
  onRepositoryConnected?: () => void
}

export function RepositorySelector({ onRepositoryConnected }: RepositorySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set())
  const { toast } = useToast()
  const { updateUser } = useAuth()
  const queryClient = useQueryClient()

  // Fetch GitHub repositories
  const { data, isLoading, error, refetch } = useQuery<{ repositories: GitHubRepository[] }>({
    queryKey: ['github-repositories'],
    queryFn: async () => {
      const { data } = await api.get('/repositories/github/list')
      return data
    },
    retry: 1,
    onError: (error: any) => {
      // If token is invalid, mark GitHub as disconnected in user context
      if (error?.response?.data?.requiresReconnect) {
        updateUser({
          githubConnected: false,
          githubUsername: undefined,
        })
        queryClient.invalidateQueries({ queryKey: ['repositories'] })
      }
    },
  })

  // Connect repository mutation
  const connectMutation = useMutation({
    mutationFn: async (repo: GitHubRepository) => {
      const { data } = await api.post('/repositories/github/connect', {
        repoFullName: repo.full_name,
        githubRepoId: repo.id,
        autoReview: true,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      queryClient.invalidateQueries({ queryKey: ['github-repositories'] })
      toast({
        title: 'Repository connected',
        description: 'The repository has been added to your dashboard',
      })
      onRepositoryConnected?.()
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to connect repository',
        description: error?.response?.data?.error || 'Unable to connect repository',
        variant: 'destructive',
      })
    },
  })

  // Get already connected repositories
  const { data: connectedRepos } = useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const { data } = await api.get('/repositories')
      return data
    },
  })

  const connectedRepoIds = new Set(
    (connectedRepos || []).map((r: any) => r.githubRepoId).filter(Boolean)
  )

  // Filter out already connected repositories from the list
  const unconnectedRepos = data?.repositories.filter((repo) => !connectedRepoIds.has(repo.id)) || []

  // Filter unconnected repositories by search
  const filteredRepos = unconnectedRepos.filter((repo) =>
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleToggleRepo = (repo: GitHubRepository) => {
    if (connectedRepoIds.has(repo.id)) {
      toast({
        title: 'Already connected',
        description: 'This repository is already connected',
      })
      return
    }

    if (selectedRepos.has(repo.id)) {
      setSelectedRepos((prev) => {
        const next = new Set(prev)
        next.delete(repo.id)
        return next
      })
    } else {
      setSelectedRepos((prev) => new Set(prev).add(repo.id))
    }
  }

  const handleConnectSelected = async () => {
    if (selectedRepos.size === 0) {
      toast({
        title: 'No repositories selected',
        description: 'Please select at least one repository to connect',
        variant: 'destructive',
      })
      return
    }

    const reposToConnect = filteredRepos.filter((r) => selectedRepos.has(r.id))

    for (const repo of reposToConnect) {
      await connectMutation.mutateAsync(repo)
    }

    setSelectedRepos(new Set())
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    const requiresReconnect = (error as any)?.response?.data?.requiresReconnect
    const errorMessage = (error as any)?.response?.data?.message || 
                        (error as any)?.response?.data?.error || 
                        'Unable to load your repositories'

    return (
      <Card>
        <CardHeader>
          <CardTitle>GitHub Repositories</CardTitle>
          <CardDescription>Unable to load your repositories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="mb-4 rounded-full bg-destructive/10 p-4">
              <Github className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {requiresReconnect ? 'GitHub Token Invalid' : 'Failed to load repositories'}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              {errorMessage}
            </p>
            {requiresReconnect ? (
              <Button
                onClick={() => {
                  window.location.reload()
                }}
                variant="default"
                className="gap-2"
              >
                <Github className="h-4 w-4" />
                Reconnect GitHub Account
              </Button>
            ) : (
              <Button onClick={() => refetch()} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Don't show the selector if all repositories are already connected
  if (unconnectedRepos.length === 0 && data?.repositories && data.repositories.length > 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Connect New Repositories
            </CardTitle>
            <CardDescription className="mt-1">
              Select repositories to enable AI code reviews
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selected count and connect button */}
        {selectedRepos.size > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium">
              {selectedRepos.size} repository{selectedRepos.size !== 1 ? 'ies' : ''} selected
            </span>
            <Button
              onClick={handleConnectSelected}
              disabled={connectMutation.isPending}
              className="gap-2"
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Connect Selected
                </>
              )}
            </Button>
          </div>
        )}

        {/* Repository List */}
        {filteredRepos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No repositories found' : 'No repositories available'}
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredRepos.map((repo) => {
              const isConnected = connectedRepoIds.has(repo.id)
              const isSelected = selectedRepos.has(repo.id)

              return (
                <Card
                  key={repo.id}
                  className={`border transition-all cursor-pointer hover:shadow-md ${
                    isSelected ? 'ring-2 ring-primary' : ''
                  } ${isConnected ? 'opacity-60' : ''}`}
                  onClick={() => !isConnected && handleToggleRepo(repo)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {repo.private ? (
                            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <h4 className="font-semibold truncate">{repo.full_name}</h4>
                          {isConnected && (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {repo.language && (
                            <Badge variant="outline" className="text-xs">
                              {repo.language}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {repo.stargazers_count}
                          </div>
                          <span>
                            Updated {new Date(repo.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isConnected && (
                          <Switch
                            checked={isSelected}
                            onCheckedChange={() => handleToggleRepo(repo)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        {isConnected && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              // Navigate to repository settings
                            }}
                            className="gap-1"
                          >
                            <Settings className="h-3.5 w-3.5" />
                            Settings
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {filteredRepos.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            {filteredRepos.length} repository{filteredRepos.length !== 1 ? 'ies' : ''} found
          </p>
        )}
      </CardContent>
    </Card>
  )
}
