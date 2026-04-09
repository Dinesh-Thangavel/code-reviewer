import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-provider'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { updateUser } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  useEffect(() => {
    const token = searchParams.get('token')

    if (token) {
      localStorage.removeItem('ai-code-review-token')
      localStorage.removeItem('ai-code-review-user')
      delete api.defaults.headers.common['Authorization']

      queryClient.clear()
      localStorage.setItem('ai-code-review-token', token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`

      api.get('/auth/me')
        .then((response: any) => {
          if (!response.data.success) {
            throw new Error('Failed to get user data')
          }

          const newUser = response.data.user
          localStorage.setItem('ai-code-review-user', JSON.stringify(newUser))
          updateUser(newUser)
          queryClient.invalidateQueries()

          const githubSignin = searchParams.get('github_signin')
          const bitbucketSignin = searchParams.get('bitbucket_signin')
          const redirectTo = searchParams.get('redirect')

          if (githubSignin === 'true') {
            toast({
              title: 'Signed in with GitHub',
              description: `Welcome, ${newUser.name || newUser.githubUsername}!`,
            })
          } else if (bitbucketSignin === 'true') {
            toast({
              title: 'Signed in with Bitbucket',
              description: `Welcome, ${newUser.name || newUser.bitbucketUsername}!`,
            })
          }

          setTimeout(() => {
            navigate(redirectTo || '/dashboard', { replace: true })
          }, 100)
        })
        .catch(() => {
          toast({
            title: 'Authentication failed',
            description: 'Failed to complete sign-in. Please try again.',
            variant: 'destructive',
          })
          navigate('/login', { replace: true })
        })
    } else {
      navigate('/login', { replace: true })
    }
  }, [searchParams, navigate, toast, updateUser, queryClient])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="hero-glow glass-panel w-full max-w-xl overflow-hidden rounded-[2rem] border border-border/60 p-8 shadow-2xl">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Secure workspace handoff
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Completing your sign-in</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                We’re validating your provider session, refreshing your workspace, and preparing your review dashboard.
              </p>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-border/60 bg-background/60 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold">Verifying account</p>
                <p className="text-xs text-muted-foreground">This should only take a moment.</p>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Syncing credentials and loading your workspace</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
