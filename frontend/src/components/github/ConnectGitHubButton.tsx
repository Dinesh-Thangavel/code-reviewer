/**
 * Connect GitHub Button Component
 * CodeRabbit-style GitHub OAuth connection
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Github, CheckCircle2, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth-provider'
import { useQueryClient } from '@tanstack/react-query'

interface ConnectGitHubButtonProps {
  onConnected?: () => void
}

export function ConnectGitHubButton({ onConnected }: ConnectGitHubButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const { user, updateUser } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      // Avoid CORS by redirecting the browser directly to backend OAuth init.
      // VITE_API_URL should be like: https://<backend>/api
      const apiBase = import.meta.env.VITE_API_URL || '/api'
      window.location.href = `${apiBase}/auth/github?redirect=1`
    } catch (error: any) {
      toast({
        title: 'Failed to connect GitHub',
        description: error?.response?.data?.error || 'Unable to initiate GitHub connection',
        variant: 'destructive',
      })
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await api.post('/auth/github/disconnect')
      
      // Update user in context
      updateUser({
        githubConnected: false,
        githubUsername: undefined,
      })
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      queryClient.invalidateQueries({ queryKey: ['github-repositories'] })

      toast({
        title: 'GitHub disconnected',
        description: 'Your GitHub account has been disconnected',
      })

      onConnected?.()
    } catch (error: any) {
      toast({
        title: 'Failed to disconnect',
        description: error?.response?.data?.error || 'Unable to disconnect GitHub',
        variant: 'destructive',
      })
    }
  }

  // Check if GitHub is connected (from user object or check API)
  const isConnected = (user as any)?.githubConnected || false
  const githubUsername = (user as any)?.githubUsername

  if (isConnected) {
    return (
      <div className="glass-panel flex items-center gap-3 rounded-[1.5rem] border border-green-500/20 bg-green-500/10 p-4">
        <div className="flex items-center gap-2 flex-1">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-semibold">GitHub Connected</p>
            <p className="text-xs text-muted-foreground">
              Connected as <span className="font-mono">{githubUsername}</span>
            </p>
          </div>
        </div>
        <Badge variant="default" className="bg-green-600">
          <Github className="h-3 w-3 mr-1" />
          Connected
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          className="gap-2 rounded-xl"
        >
          <X className="h-4 w-4" />
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <div className="glass-panel rounded-[1.75rem] border border-border/60 bg-background/60 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <h3 className="mb-1 text-lg font-semibold tracking-tight">Connect Your GitHub Account</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Connect your GitHub account to automatically discover and manage your repositories. 
            This allows you to review pull requests from all your repositories in one place.
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Github className="h-6 w-6" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>Automatically discover your repositories</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>Review pull requests from all your repos</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>One-click repository management</span>
        </div>
      </div>

      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className="mt-5 w-full gap-2 rounded-2xl"
        size="lg"
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Github className="h-4 w-4" />
            Connect GitHub Account
          </>
        )}
      </Button>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        You'll be redirected to GitHub to authorize this application
      </p>
    </div>
  )
}
