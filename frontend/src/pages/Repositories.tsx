import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Settings2, Loader2, RefreshCw, Github, Search, CheckCircle2, Plus } from 'lucide-react'
import { InstallGitHubAppGuide } from '@/components/github/InstallGitHubAppGuide'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { useToast } from '@/hooks/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRepositories, useUpdateRepository, type Repository } from '@/hooks/useRepositories'
import { useAuth } from '@/lib/auth-provider'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type StrictnessLevel = 'RELAXED' | 'BALANCED' | 'STRICT'

const AVAILABLE_LANGUAGES = [
  'TypeScript', 'JavaScript', 'React', 'Node.js', 'Kotlin', 'Swift',
  'Dart', 'Python', 'Java', 'Go', 'Rust', 'C++',
]

const STRICTNESS_DISPLAY: Record<string, string> = {
  RELAXED: 'Relaxed',
  BALANCED: 'Balanced',
  STRICT: 'Strict',
}

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

interface UnifiedRepository extends Repository {
  isConnected: boolean
  githubRepoId?: number
  bitbucketRepoUuid?: string
  isAvailable?: boolean
  canConnect?: boolean
}

export function Repositories() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isGitHubConnected = user?.githubConnected || false
  const isBitbucketConnected = user?.bitbucketConnected || false
  const { data: connectedRepos, isLoading: isLoadingConnected, error, refetch } = useRepositories()
  const updateRepoMutation = useUpdateRepository()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  
  // Determine which provider is connected
  const connectedProvider = isBitbucketConnected ? 'bitbucket' : isGitHubConnected ? 'github' : null

  // Fetch GitHub repositories (if GitHub connected)
  const { data: githubReposData, isLoading: isLoadingGitHub } = useQuery<{ repositories: GitHubRepository[] }>({
    queryKey: ['github-repositories'],
    queryFn: async () => {
      const { data } = await api.get('/repositories/github/list')
      return data
    },
    enabled: isGitHubConnected,
    retry: 1,
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['repositories'] })
      await queryClient.invalidateQueries({ queryKey: ['github-repositories'] })
      await queryClient.refetchQueries({ queryKey: ['repositories'] })
      await queryClient.refetchQueries({ queryKey: ['github-repositories'] })
      toast({
        title: 'Repository connected',
        description: 'The repository has been added to your dashboard',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to connect repository',
        description: error?.response?.data?.error || 'Unable to connect repository',
        variant: 'destructive',
      })
    },
  })

  // Disconnect repository mutation
  const disconnectMutation = useMutation({
    mutationFn: async (repoId: string) => {
      await api.delete(`/repositories/${repoId}/disconnect`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['repositories'] })
      await queryClient.invalidateQueries({ queryKey: ['github-repositories'] })
      await queryClient.refetchQueries({ queryKey: ['repositories'] })
      await queryClient.refetchQueries({ queryKey: ['github-repositories'] })
      toast({
        title: 'Repository disconnected',
        description: 'The repository has been removed from your dashboard',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to disconnect repository',
        description: error?.response?.data?.error || 'Unable to disconnect repository',
        variant: 'destructive',
      })
    },
  })

  // Create unified repository list
  const unifiedRepos = useMemo(() => {
    const connected = (connectedRepos || []).map((repo): UnifiedRepository => ({
      ...repo,
      isConnected: true,
      githubRepoId: (repo as any).githubRepoId,
      bitbucketRepoUuid: (repo as any).bitbucketRepoUuid,
      isAvailable: true,
      canConnect: false,
    }))

    if (!isGitHubConnected || !githubReposData?.repositories) {
      return connected
    }

    // Match by fullName (more reliable than githubRepoId which may not be in response)
    const connectedFullNames = new Set(
      connected.map(r => r.fullName.toLowerCase())
    )

    const unconnected = githubReposData.repositories
      .filter(repo => !connectedFullNames.has(repo.full_name.toLowerCase()))
      .map((repo): UnifiedRepository => ({
        id: `github-${repo.id}`,
        name: repo.name,
        fullName: repo.full_name,
        provider: 'GITHUB',
        isActive: false,
        autoReview: false,
        strictness: 'BALANCED',
        languages: repo.language ? [repo.language] : [],
        ignorePaths: [],
        isConnected: false,
        githubRepoId: repo.id,
        isAvailable: true,
        canConnect: repo.permissions.admin || repo.permissions.push,
        createdAt: repo.updated_at,
      }))

    return [...connected, ...unconnected]
  }, [connectedRepos, githubReposData, isGitHubConnected])

  // Filter by search
  const filteredRepos = useMemo(() => {
    if (!searchQuery) return unifiedRepos
    const query = searchQuery.toLowerCase()
    return unifiedRepos.filter(repo =>
      repo.name.toLowerCase().includes(query) ||
      repo.fullName.toLowerCase().includes(query)
    )
  }, [unifiedRepos, searchQuery])

  const isLoading = isLoadingConnected || (isGitHubConnected && isLoadingGitHub)

  const [editingRepo, setEditingRepo] = useState<Repository | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState<{
    languages: string[]
    autoReview: boolean
    strictness: StrictnessLevel
    ignorePaths: string[]
  }>({
    languages: [],
    autoReview: false,
    strictness: 'BALANCED',
    ignorePaths: [],
  })

  const handleEdit = (repo: UnifiedRepository) => {
    if (!repo.isConnected) return
    setEditingRepo(repo)
    setFormData({
      languages: [...(repo.languages || [])],
      autoReview: repo.autoReview,
      strictness: (repo.strictness || 'BALANCED') as StrictnessLevel,
      ignorePaths: [...(repo.ignorePaths || [])],
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingRepo) return
    try {
      await updateRepoMutation.mutateAsync({
        id: editingRepo.id,
        languages: formData.languages,
        autoReview: formData.autoReview,
        strictness: formData.strictness,
        ignorePaths: formData.ignorePaths,
      })
      setIsDialogOpen(false)
      setEditingRepo(null)
      toast({ title: 'Settings saved', description: `Repository settings for ${editingRepo.name} have been updated.` })
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err?.response?.data?.error || err.message, variant: 'destructive' })
    }
  }

  const toggleLanguage = (language: string) => {
    const cur = formData.languages || []
    setFormData({
      ...formData,
      languages: cur.includes(language) ? cur.filter(l => l !== language) : [...cur, language],
    })
  }

  const handleStrictnessChange = async (repo: UnifiedRepository, value: StrictnessLevel) => {
    if (!repo.isConnected) return
    try {
      await updateRepoMutation.mutateAsync({ id: repo.id, strictness: value })
      toast({ title: 'Strictness updated', description: `Set to ${STRICTNESS_DISPLAY[value]} for ${repo.name}.` })
    } catch (err: any) {
      toast({ title: 'Failed to update', description: err.message, variant: 'destructive' })
    }
  }

  const handleAutoReviewToggle = async (repo: UnifiedRepository) => {
    if (!repo.isConnected) return
    try {
      await updateRepoMutation.mutateAsync({ id: repo.id, autoReview: !repo.autoReview })
      toast({ title: 'Auto review updated', description: `${!repo.autoReview ? 'Enabled' : 'Disabled'} for ${repo.name}.` })
    } catch (err: any) {
      toast({ title: 'Failed to update', description: err.message, variant: 'destructive' })
    }
  }

  const handleConnect = async (repo: UnifiedRepository) => {
    if (!repo.canConnect || !githubReposData?.repositories) return
    
    const githubRepo = githubReposData.repositories.find(r => r.id === repo.githubRepoId)
    if (githubRepo) {
      await connectMutation.mutateAsync(githubRepo)
    }
  }

  const handleDisconnect = async (repo: UnifiedRepository) => {
    if (!repo.isConnected) return
    await disconnectMutation.mutateAsync(repo.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardContent className="p-0">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-7 w-14 ml-auto" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repositories</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage repository settings</p>
        </div>
        <ErrorState
          title="Failed to load repositories"
          description={error.message || 'Could not fetch repository data.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-2.5 py-1 text-primary text-xs">
          Repositories
        </Badge>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            {connectedProvider === 'bitbucket' ? 'Your Bitbucket Repositories' : 
             connectedProvider === 'github' ? 'Your GitHub Repositories' : 
             'Your Repositories'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage review configurations
            {connectedRepos && <span className="ml-1">· {connectedRepos.length} connected</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {connectedProvider === 'github' && connectedRepos && connectedRepos.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                try {
                  const githubRepos = connectedRepos.filter(r => r.provider === 'GITHUB' || !r.provider);
                  for (const repo of githubRepos) {
                    try {
                      await api.post('/github/sync', {
                        repoFullName: repo.fullName,
                      });
                    } catch (error: any) {
                      toast({
                        title: `Failed to sync ${repo.name}`,
                        description: error?.response?.data?.error || 'Unable to sync repository',
                        variant: 'destructive',
                      });
                    }
                  }
                  toast({
                    title: 'Sync started',
                    description: 'Syncing pull requests from GitHub...',
                  });
                  setTimeout(() => refetch(), 2000);
                } catch (error: any) {
                  toast({
                    title: 'Sync failed',
                    description: error?.response?.data?.error || 'Unable to sync repositories',
                    variant: 'destructive',
                  });
                }
              }}
              className="h-11 gap-2 rounded-2xl px-4"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync PRs
            </Button>
          )}
          {connectedProvider === 'bitbucket' && connectedRepos && connectedRepos.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                try {
                  const bitbucketRepos = connectedRepos.filter(r => r.provider === 'BITBUCKET');
                  for (const repo of bitbucketRepos) {
                    try {
                      await api.post('/repositories/bitbucket/sync', {
                        repoFullName: repo.fullName,
                      });
                    } catch (error: any) {
                      toast({
                        title: `Failed to sync ${repo.name}`,
                        description: error?.response?.data?.error || 'Unable to sync repository',
                        variant: 'destructive',
                      });
                    }
                  }
                  toast({
                    title: 'Sync started',
                    description: 'Syncing pull requests from Bitbucket...',
                  });
                  setTimeout(() => refetch(), 2000);
                } catch (error: any) {
                  toast({
                    title: 'Sync failed',
                    description: error?.response?.data?.error || 'Unable to sync repositories',
                    variant: 'destructive',
                  });
                }
              }}
              className="h-11 gap-2 rounded-2xl px-4"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync PRs
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-11 gap-2 rounded-2xl px-4">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* OAuth Connection - Show if neither provider is connected */}
      {!isGitHubConnected && !isBitbucketConnected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-panel border-border/60">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Connect your Git provider to get started
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  className="min-w-[180px]"
                  onClick={async () => {
                    try {
                      localStorage.removeItem('ai-code-review-token')
                      localStorage.removeItem('ai-code-review-user')
                      delete api.defaults.headers.common['Authorization']
                      // Avoid CORS by doing a full-page redirect to backend OAuth init.
                      const apiBase = import.meta.env.VITE_API_URL || '/api'
                      window.location.href = `${apiBase}/auth/github?mode=signin&redirect=1`
                    } catch (error: any) {
                      toast({
                        title: 'Failed to connect GitHub',
                        description: error?.response?.data?.error || 'Unable to initiate GitHub connection',
                        variant: 'destructive',
                      })
                    }
                  }}
                >
                  <Github className="mr-2 h-4 w-4" />
                  Connect GitHub
                </Button>
                <Button
                  variant="outline"
                  className="min-w-[180px]"
                  onClick={async () => {
                    try {
                      localStorage.removeItem('ai-code-review-token')
                      localStorage.removeItem('ai-code-review-user')
                      delete api.defaults.headers.common['Authorization']
                      // Avoid CORS by doing a full-page redirect to backend OAuth init.
                      const apiBase = import.meta.env.VITE_API_URL || '/api'
                      window.location.href = `${apiBase}/auth/bitbucket?mode=signin&redirect=1`
                    } catch (error: any) {
                      toast({
                        title: 'Failed to connect Bitbucket',
                        description: error?.response?.data?.error || 'Unable to initiate Bitbucket connection',
                        variant: 'destructive',
                      })
                    }
                  }}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03A.768.768 0 0023.23 1H.778zm14.22 9.93l-8.738 5.197a.32.32 0 01-.484-.263V9.23a.32.32 0 01.484-.264l8.738 5.197z"/>
                  </svg>
                  Connect Bitbucket
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* GitHub App Installation Guide (if GitHub connected but no installations) */}
      {isGitHubConnected && connectedRepos && connectedRepos.length > 0 && connectedRepos.every((r: any) => !r.installationId) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <InstallGitHubAppGuide />
        </motion.div>
      )}

      {/* Unified Repository Table */}
      <Card className="glass-panel overflow-hidden border-border/60">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <CardTitle>All Repositories</CardTitle>
              <CardDescription>
                {filteredRepos.length} repository{filteredRepos.length !== 1 ? 'ies' : ''} found
                {connectedRepos && connectedRepos.length > 0 && (
                  <span className="ml-2">· {connectedRepos.length} connected</span>
                )}
              </CardDescription>
            </div>
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-2xl border-border/60 bg-background/70 pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!unifiedRepos || unifiedRepos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No repositories found</p>
              <p className="text-xs mt-1">
                {connectedProvider === 'bitbucket' 
                  ? 'Your Bitbucket repositories will appear here after connecting'
                  : connectedProvider === 'github'
                  ? 'Connect your GitHub account to see repositories'
                  : 'Connect your Git provider to see repositories'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                    <TableRow className="bg-muted/20">
                    <TableHead>Status</TableHead>
                    <TableHead>Repository</TableHead>
                    <TableHead>Languages</TableHead>
                    <TableHead>Auto Review</TableHead>
                    <TableHead>Strictness</TableHead>
                    <TableHead className="hidden md:table-cell">Ignore Paths</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRepos.map((repo) => (
                    <TableRow key={repo.id} className={!repo.isConnected ? 'opacity-75' : ''}>
                      <TableCell>
                        {repo.isConnected ? (
                            <Badge variant="default" className="rounded-full bg-green-600 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                            <Badge variant="outline" className="rounded-full text-xs">
                            Available
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {repo.name}
                              {repo.provider === 'BITBUCKET' && (
                                  <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0 h-5">
                                  Bitbucket
                                </Badge>
                              )}
                              {repo.provider === 'GITHUB' && (
                                  <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0 h-5">
                                  GitHub
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{repo.fullName}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(repo.languages || []).length > 0 ? (
                            repo.languages.slice(0, 3).map((lang) => (
                              <Badge key={lang} variant="secondary" className="rounded-full text-[10px] px-1.5 py-0 h-5">{lang}</Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Auto-detect</span>
                          )}
                          {(repo.languages || []).length > 3 && (
                            <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0 h-5">+{repo.languages.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {repo.isConnected ? (
                          <Switch
                            checked={repo.autoReview}
                            onCheckedChange={() => handleAutoReviewToggle(repo)}
                            disabled={updateRepoMutation.isPending || connectMutation.isPending}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {repo.isConnected ? (
                          <Select
                            value={repo.strictness}
                            onValueChange={(value: StrictnessLevel) => handleStrictnessChange(repo, value)}
                            disabled={updateRepoMutation.isPending}
                          >
                            <SelectTrigger className="h-9 w-[120px] rounded-xl border-border/60 bg-background/70 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="RELAXED">Relaxed</SelectItem>
                              <SelectItem value="BALANCED">Balanced</SelectItem>
                              <SelectItem value="STRICT">Strict</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {repo.isConnected ? (
                          <Badge variant="outline" className="rounded-full text-xs">
                            {(repo.ignorePaths || []).length} path{(repo.ignorePaths || []).length !== 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {repo.isConnected ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-xl text-xs gap-1.5"
                                onClick={() => handleEdit(repo)}
                                disabled={updateRepoMutation.isPending}
                              >
                                <Settings2 className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-xl text-xs gap-1.5 text-destructive hover:text-destructive"
                                onClick={() => handleDisconnect(repo)}
                                disabled={disconnectMutation.isPending}
                              >
                                Disconnect
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 rounded-xl text-xs gap-1.5"
                              onClick={() => handleConnect(repo)}
                              disabled={!repo.canConnect || connectMutation.isPending}
                            >
                              {connectMutation.isPending ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Connecting...
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5" />
                                  Connect
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="glass-panel max-h-[85vh] max-w-lg overflow-y-auto rounded-[1.75rem] border-border/60">
          <DialogHeader>
            <DialogTitle>Edit Repository Settings</DialogTitle>
            <DialogDescription>
              Configure review settings for <span className="font-medium">{editingRepo?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Languages */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Languages</Label>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-background/60 p-3 md:grid-cols-3">
                {AVAILABLE_LANGUAGES.map((language) => (
                  <div key={language} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lang-${language}`}
                      checked={formData.languages?.includes(language) || false}
                      onCheckedChange={() => toggleLanguage(language)}
                    />
                    <Label htmlFor={`lang-${language}`} className="text-sm font-normal cursor-pointer">
                      {language}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto Review */}
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-3">
              <div>
                <Label htmlFor="auto-review" className="text-sm font-medium">Auto Review</Label>
                <p className="text-xs text-muted-foreground">Automatically review PRs when opened</p>
              </div>
              <Switch
                id="auto-review"
                checked={formData.autoReview}
                onCheckedChange={(checked) => setFormData({ ...formData, autoReview: checked })}
              />
            </div>

            {/* Strictness */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Strictness Level</Label>
              <Select
                value={formData.strictness}
                onValueChange={(value: StrictnessLevel) => setFormData({ ...formData, strictness: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select strictness" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RELAXED">Relaxed — focus on critical issues</SelectItem>
                  <SelectItem value="BALANCED">Balanced — standard review</SelectItem>
                  <SelectItem value="STRICT">Strict — comprehensive review</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ignore Paths */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ignore Paths</Label>
              <p className="text-xs text-muted-foreground">One path per line. Supports glob patterns.</p>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono text-xs"
                value={formData.ignorePaths?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, ignorePaths: e.target.value.split('\n').filter(p => p.trim()) })}
                placeholder="node_modules/**&#10;dist/**&#10;*.test.ts"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); setEditingRepo(null) }} disabled={updateRepoMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateRepoMutation.isPending}>
              {updateRepoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
