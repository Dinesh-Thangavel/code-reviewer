import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from '@/lib/theme-provider'
import { useAuth } from '@/lib/auth-provider'
import { Sun, Moon, Monitor, Save, Server, CheckCircle2, XCircle, Github, BellRing, SlidersHorizontal } from 'lucide-react'
import api from '@/lib/api'
import { ConnectGitHubButton } from '@/components/github/ConnectGitHubButton'

interface NotificationPrefs {
  emailNotifications: boolean
  prReminders: boolean
  criticalAlerts: boolean
  weeklyDigest: boolean
}

const NOTIFICATION_KEY = 'ai-code-review-notifications'

function loadNotifications(): NotificationPrefs {
  try {
    const stored = localStorage.getItem(NOTIFICATION_KEY)
    return stored ? JSON.parse(stored) : {
      emailNotifications: true,
      prReminders: true,
      criticalAlerts: true,
      weeklyDigest: false,
    }
  } catch {
    return { emailNotifications: true, prReminders: true, criticalAlerts: true, weeklyDigest: false }
  }
}

export function Settings() {
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { user, updateUser } = useAuth()

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
  })
  const [profileDirty, setProfileDirty] = useState(false)
  const [notifications, setNotifications] = useState<NotificationPrefs>(loadNotifications())
  const [notifDirty, setNotifDirty] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    if (!user) return
    setProfile({
      name: user.name || '',
      email: user.email || '',
    })
    setProfileDirty(false)
  }, [user])

  useEffect(() => {
    api.get('/health').then(() => setBackendStatus('online')).catch(() => setBackendStatus('offline'))
    api.get('/health/ollama').then(() => setOllamaStatus('online')).catch(() => setOllamaStatus('offline'))
  }, [])

  const handleSaveProfile = async () => {
    try {
      await updateUser({
        name: profile.name,
        email: profile.email,
      })
      setProfileDirty(false)
      toast({
        title: 'Profile updated',
        description: 'Your account settings have been updated.',
      })
    } catch {
      // auth provider handles error state
    }
  }

  const handleSaveNotifications = () => {
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications))
    setNotifDirty(false)
    toast({
      title: 'Preferences saved',
      description: 'Your notification preferences have been updated.',
    })
  }

  const updateProfile = (key: 'name' | 'email', value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
    setProfileDirty(true)
  }

  const updateNotification = (key: keyof NotificationPrefs, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }))
    setNotifDirty(true)
  }

  const StatusBadge = ({ status }: { status: 'checking' | 'online' | 'offline' }) => {
    if (status === 'checking') {
      return <Badge variant="secondary" className="rounded-full text-xs">Checking...</Badge>
    }
    if (status === 'online') {
      return (
        <Badge variant="default" className="gap-1 rounded-full bg-green-600 text-xs">
          <CheckCircle2 className="h-3 w-3" />
          Online
        </Badge>
      )
    }
    return (
      <Badge variant="destructive" className="gap-1 rounded-full text-xs">
        <XCircle className="h-3 w-3" />
        Offline
      </Badge>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hero-glow overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-panel/70 shadow-lg">
        <CardContent className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Workspace settings
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
          <p className="text-sm text-muted-foreground flex-1 min-w-[240px]">
            Control your account, notifications, theme, and connectivity.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex h-10 items-center rounded-xl border border-border/60 bg-background/70 px-3">
              <span className="text-[11px] uppercase tracking-[0.14em] mr-2">Theme</span>
              <span className="text-base font-semibold capitalize text-foreground">{theme}</span>
            </div>
            <div className="flex h-10 items-center rounded-xl border border-border/60 bg-background/70 px-3">
              <span className="text-[11px] uppercase tracking-[0.14em] mr-2">Services</span>
              <span className="text-base font-semibold text-foreground">
                {backendStatus === 'online' && ollamaStatus === 'online' ? 'Healthy' : 'Needs attention'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="glass-panel border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Profile Defaults</CardTitle>
            <CardDescription>Change the account name and email used throughout the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">Name</Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => updateProfile('name', e.target.value)}
                className="h-11 rounded-2xl border-border/60 bg-background/70"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => updateProfile('email', e.target.value)}
                className="h-11 rounded-2xl border-border/60 bg-background/70"
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={!profileDirty} className="w-fit gap-2 rounded-2xl px-4">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="h-4 w-4" />
              Notifications
            </CardTitle>
            <CardDescription>Choose which reminders and alerts are worth interrupting you for.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ['emailNotifications', 'Email notifications', 'Receive general account and review notifications.'],
              ['prReminders', 'PR review reminders', 'Get nudges when pull requests are waiting too long.'],
              ['criticalAlerts', 'Critical issue alerts', 'Be alerted immediately when severe findings appear.'],
              ['weeklyDigest', 'Weekly digest', 'Receive a summary of review trends and repository activity.'],
            ].map(([key, label, description]) => (
              <div key={key} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={notifications[key as keyof NotificationPrefs]}
                  onCheckedChange={(value) => updateNotification(key as keyof NotificationPrefs, value)}
                />
              </div>
            ))}
            <Button onClick={handleSaveNotifications} disabled={!notifDirty} className="w-fit gap-2 rounded-2xl px-4">
              <Save className="h-4 w-4" />
              Save Preferences
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Select how the workspace should look on this device.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              onClick={() => setTheme('light')}
              className="h-12 gap-2 rounded-2xl"
            >
              <Sun className="h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              onClick={() => setTheme('dark')}
              className="h-12 gap-2 rounded-2xl"
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              onClick={() => setTheme('system')}
              className="h-12 gap-2 rounded-2xl"
            >
              <Monitor className="h-4 w-4" />
              System
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Github className="h-4 w-4" />
              GitHub Integration
            </CardTitle>
            <CardDescription>Connect or disconnect repository access for automated reviews and sync.</CardDescription>
          </CardHeader>
          <CardContent>
            {user?.githubConnected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-[1.5rem] border border-green-500/20 bg-green-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-semibold">Connected as {user.githubUsername}</p>
                      <p className="text-xs text-muted-foreground">Repository sync and OAuth access are active.</p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await api.post('/auth/github/disconnect')
                      updateUser({ githubConnected: false, githubUsername: undefined })
                      toast({
                        title: 'GitHub disconnected',
                        description: 'Your GitHub account has been disconnected.',
                      })
                    } catch (error: any) {
                      toast({
                        title: 'Failed to disconnect',
                        description: error?.response?.data?.error || 'Unable to disconnect GitHub account',
                        variant: 'destructive',
                      })
                    }
                  }}
                  className="rounded-2xl"
                >
                  Disconnect GitHub
                </Button>
              </div>
            ) : (
              <ConnectGitHubButton onConnected={() => window.location.reload()} />
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/60 xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" />
              System Status
            </CardTitle>
            <CardDescription>Live health checks for the services your review workflow depends on.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
              <div>
                <p className="text-sm font-medium">Backend API</p>
                <p className="text-xs text-muted-foreground">Required for data loading, auth, and repository operations.</p>
              </div>
              <StatusBadge status={backendStatus} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
              <div>
                <p className="text-sm font-medium">Ollama AI runtime</p>
                <p className="text-xs text-muted-foreground">Needed for code review generation and related AI actions.</p>
              </div>
              <StatusBadge status={ollamaStatus} />
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
