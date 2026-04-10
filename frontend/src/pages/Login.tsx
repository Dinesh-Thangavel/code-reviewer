import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Code2,
  Loader2,
  Github,
  CheckCircle2,
  Sparkles,
  Shield,
  Zap,
  GitBranch,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-provider'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { toast } = useToast()
  const [isGitHubLoading, setIsGitHubLoading] = useState(false)
  const [isBitbucketLoading, setIsBitbucketLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (!errorParam) return

    let errorMessage = 'Sign-in failed. Please try again.'

    if (errorParam === 'missing_params') {
      errorMessage = 'Missing OAuth parameters. Please try signing in again.'
    } else if (errorParam === 'invalid_state') {
      errorMessage =
        'OAuth session expired (try again). If this keeps happening, the server may have restarted between steps—try once more from the login page.'
    } else if (errorParam === 'db_offline' || errorParam === 'db_error') {
      errorMessage =
        'Cannot reach the database. Check DATABASE_URL on Render and that Supabase allows connections from Render.'
    } else if (errorParam === 'oauth_redirect_mismatch') {
      errorMessage =
        'GitHub rejected the redirect URL. On GitHub App settings, set the callback URL to exactly: https://YOUR-RENDER-HOST/api/auth/github/callback and set the same value as GITHUB_OAUTH_REDIRECT_URI on Render.'
    } else if (errorParam === 'oauth_bad_credentials') {
      errorMessage =
        'Invalid GitHub OAuth client ID or secret. In Render, set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET from your GitHub App (Client ID + generate a new client secret).'
    } else if (errorParam === 'oauth_not_configured') {
      errorMessage =
        'GitHub OAuth is not configured on the server. Add GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET to Render.'
    } else if (errorParam === 'oauth_bad_code') {
      errorMessage =
        'Authorization code was invalid or already used. Close the tab and sign in with GitHub again from the login page.'
    } else if (errorParam === 'oauth_token_exchange') {
      errorMessage =
        'Could not exchange the GitHub code for a token. Check callback URL, client secret, and Render logs for details.'
    } else if (errorParam === 'oauth_github_user') {
      errorMessage = 'Signed in with GitHub but could not load your profile. Try again or check API rate limits.'
    } else if (errorParam.includes('Token exchange failed')) {
      errorMessage = 'Failed to exchange authorization code. Please check your OAuth configuration.'
    } else if (errorParam === 'oauth_failed') {
      errorMessage =
        'GitHub sign-in failed. Open Render → Logs, retry sign-in, and search for [OAuth] for the exact error.'
    } else {
      errorMessage = `Sign-in failed: ${decodeURIComponent(errorParam)}`
    }

    setError(errorMessage)
    toast({
      title: 'Sign-in failed',
      description: errorMessage,
      variant: 'destructive',
    })
  }, [searchParams, toast])

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, authLoading, navigate])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isAuthenticated) {
    return null
  }

  const features = [
    {
      icon: Sparkles,
      title: 'AI-powered reviews',
      description: 'Automated code review summaries and actionable feedback for every pull request.',
    },
    {
      icon: Zap,
      title: 'Fast feedback',
      description: 'Spot bugs and quality issues quickly without waiting on manual first-pass review.',
    },
    {
      icon: Shield,
      title: 'Security checks',
      description: 'Catch risky changes early with focused security and severity-aware review signals.',
    },
    {
      icon: GitBranch,
      title: 'Repository workflow',
      description: 'Connect GitHub or Bitbucket and manage pull request reviews in one workspace.',
    },
  ]

  const startOAuth = async (provider: 'github' | 'bitbucket') => {
    const setLoading = provider === 'github' ? setIsGitHubLoading : setIsBitbucketLoading
    setLoading(true)

    try {
      localStorage.removeItem('ai-code-review-token')
      localStorage.removeItem('ai-code-review-user')
      delete api.defaults.headers.common['Authorization']

      const { data } = await api.get(`/auth/${provider}`, {
        params: { mode: 'signin' },
      })

      window.location.href = data.authUrl
    } catch (oauthError: any) {
      toast({
        title: `Failed to sign in with ${provider === 'github' ? 'GitHub' : 'Bitbucket'}`,
        description: oauthError?.response?.data?.error || 'Unable to initiate sign-in',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="mx-auto grid h-full max-w-[1550px] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden h-full overflow-hidden border-r border-border/60 bg-gradient-to-br from-panel/80 via-background to-background lg:order-1 lg:flex">
          <div className="app-grid absolute inset-0 opacity-40" />
          <div className="relative flex w-full flex-col justify-center px-10 py-8 xl:px-14">
            <Badge variant="outline" className="mb-4 w-fit rounded-full border-primary/20 bg-primary/10 px-4 py-1 text-primary">
              Available features
            </Badge>

            <div className="max-w-2xl">
              <h2 className="text-[clamp(2.5rem,3.6vw,4.1rem)] font-semibold leading-[1.02] tracking-tight text-foreground">
                Everything your code review tool can do in one workspace.
              </h2>
              <p className="mt-3 max-w-[760px] text-base leading-7 text-muted-foreground">
                Review pull requests with AI, detect bugs and risky changes, analyze security concerns, and manage repository-connected workflows from a single dashboard.
              </p>
            </div>

            <div className="mt-7 grid max-w-3xl grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.06 }}
                  className="glass-panel rounded-[1.6rem] border border-border/60 bg-background/60 p-5 shadow-sm"
                >
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex h-full items-center justify-center px-4 py-6 sm:px-6 lg:order-2 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-[640px]"
          >
            <Card className="glass-panel overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-panel/40 shadow-2xl">
              <CardContent className="p-7 sm:p-8">
                <div className="mb-6">
                  <div>
                    <div className="mb-4 flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-primary/10 text-primary">
                        <Code2 className="h-7 w-7" />
                      </div>
                      <div>
                        <h1 className="text-[1.85rem] font-semibold tracking-tight text-foreground">CodeReview AI</h1>
                        <p className="text-sm text-muted-foreground">Production-grade review workspace</p>
                      </div>
                    </div>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.2rem]">Sign in to your workspace</h2>
                    <p className="mt-3 max-w-xl text-[15px] leading-7 text-muted-foreground">
                      Connect your Git provider to access dashboards, repository controls, review insights, and pull request detail workflows.
                    </p>
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 rounded-[1.25rem] border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
                  >
                    {error}
                  </motion.div>
                )}

                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-[60px] w-full justify-between rounded-[1.35rem] border-border/60 bg-background/70 px-5 text-base"
                    onClick={() => startOAuth('github')}
                    disabled={isGitHubLoading || isBitbucketLoading}
                  >
                    <span className="flex items-center gap-4">
                      {isGitHubLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Github className="h-5 w-5" />}
                      {isGitHubLoading ? 'Connecting to GitHub...' : 'Continue with GitHub'}
                    </span>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-[60px] w-full justify-between rounded-[1.35rem] border-border/60 bg-background/70 px-5 text-base"
                    onClick={() => startOAuth('bitbucket')}
                    disabled={isGitHubLoading || isBitbucketLoading}
                  >
                    <span className="flex items-center gap-4">
                      {isBitbucketLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03A.768.768 0 0023.23 1H.778zm14.22 9.93l-8.738 5.197a.32.32 0 01-.484-.263V9.23a.32.32 0 01.484-.264l8.738 5.197z"/>
                        </svg>
                      )}
                      {isBitbucketLoading ? 'Connecting to Bitbucket...' : 'Continue with Bitbucket'}
                    </span>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-border/60 bg-background/60 p-4">
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>Your repositories sync automatically after authentication.</span>
                  </div>
                  <div className="mt-3 flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>Use another browser profile or an incognito window if you need to switch accounts.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </div>
    </div>
  )
}
