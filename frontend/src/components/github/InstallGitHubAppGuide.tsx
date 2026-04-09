/**
 * Install GitHub App Guide Component
 * Guides users to install the GitHub App for automatic code reviews
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useQuery } from '@tanstack/react-query'
import {
  Github,
  ExternalLink,
  AlertCircle,
  Info,
  Copy,
  Check,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'

interface InstallGitHubAppGuideProps {
  onInstalled?: () => void
}

export function InstallGitHubAppGuide({ onInstalled: _onInstalled }: InstallGitHubAppGuideProps) {
  const [copied, setCopied] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const { toast } = useToast()

  // Fetch GitHub App installation URL from backend
  const { data: installUrlData, isLoading: isLoadingUrl, error: urlError } = useQuery({
    queryKey: ['github-app-install-url'],
    queryFn: async () => {
      const { data } = await api.get('/github/app-installation-url')
      return data
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const installUrl = installUrlData?.success !== false ? (installUrlData?.installUrl || null) : null

  const handleCopyWebhookUrl = async () => {
    const webhookUrl = `${window.location.origin.replace('5173', '5000')}/api/github/webhook`
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    toast({
      title: 'Webhook URL copied',
      description: 'Paste this in your GitHub App settings',
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="glass-panel border-blue-200/60 bg-background/60 dark:border-blue-800/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-lg font-semibold">Enable Automatic Code Reviews</CardTitle>
          </div>
        </div>
        <CardDescription className="text-sm mt-1.5 text-foreground/70">
          Install the GitHub App to enable automatic code reviews on your repositories
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <Collapsible open={showInfo} onOpenChange={setShowInfo}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:hover:bg-blue-950/50">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-800 dark:text-blue-200" />
                <span className="text-sm font-bold text-gray-950 dark:text-gray-50">Why install the GitHub App?</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-950 dark:text-gray-50 transition-transform ${showInfo ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/50">
              <p className="text-sm text-gray-950 dark:text-gray-50 leading-relaxed font-medium">
                The GitHub App automatically reviews pull requests when opened and enables direct fixes to your repositories.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/50 bg-muted/50 p-3">
            <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
            </div>
            <p className="text-sm font-semibold leading-tight text-foreground">Click Install</p>
            <p className="text-xs text-muted-foreground leading-tight">Redirect to GitHub</p>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/50 bg-muted/50 p-3">
            <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
            </div>
            <p className="text-sm font-semibold leading-tight text-foreground">Select Repos</p>
            <p className="text-xs text-muted-foreground leading-tight">Choose repositories</p>
          </div>
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/50 bg-muted/50 p-3">
            <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
            </div>
            <p className="text-sm font-semibold leading-tight text-foreground">Auto Reviews</p>
            <p className="text-xs text-muted-foreground leading-tight">Enabled automatically</p>
          </div>
        </div>

        {(urlError || (installUrlData && !installUrlData.success)) && (
          <div className="rounded-md bg-destructive/10 p-3 border border-destructive/20">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-destructive font-semibold leading-tight">
                  {urlError ? 'GitHub App not configured' : 'Configuration error'}
                </p>
                <p className="text-xs text-destructive/90 mt-1 leading-relaxed">
                  {urlError 
                    ? 'Configure GITHUB_APP_ID and GITHUB_PRIVATE_KEY in backend.'
                    : installUrlData?.error || 'Check GitHub App configuration.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5">
          <Button
            onClick={() => {
              if (installUrl) {
                window.open(installUrl, '_blank')
              } else {
                toast({
                  title: 'Installation URL not available',
                  description: 'GitHub App is not configured. Please check your backend configuration.',
                  variant: 'destructive',
                })
              }
            }}
            className="flex-1 gap-2"
            size="default"
            disabled={isLoadingUrl || !installUrl}
          >
            {isLoadingUrl ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <Github className="h-4 w-4" />
                <span>Install GitHub App</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyWebhookUrl}
            className="gap-2"
            size="default"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Webhook</span>
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-foreground/70 leading-relaxed pt-1.5">
          <strong className="font-semibold text-foreground/90">Note:</strong> Repositories will appear automatically after installation. Process is secure.
        </p>
      </CardContent>
    </Card>
  )
}
