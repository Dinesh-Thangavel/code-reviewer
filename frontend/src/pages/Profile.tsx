import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-provider'
import { Save, User, Mail, Github, CheckCircle2, ShieldCheck, Fingerprint } from 'lucide-react'
import api from '@/lib/api'
import { ConnectGitHubButton } from '@/components/github/ConnectGitHubButton'

export function Profile() {
  const { toast } = useToast()
  const { user, updateUser } = useAuth()
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
  })
  const [profileDirty, setProfileDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setProfile({
      name: user.name || '',
      email: user.email || '',
    })
    setProfileDirty(false)
  }, [user])

  const handleSaveProfile = async () => {
    if (!profileDirty) return

    setIsSaving(true)
    try {
      await updateUser({
        name: profile.name,
        email: profile.email,
      })
      setProfileDirty(false)
      toast({
        title: 'Profile updated',
        description: 'Your profile information has been saved successfully.',
      })
    } catch (error: any) {
      toast({
        title: 'Failed to update profile',
        description: error?.response?.data?.error || 'Unable to update profile',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const updateProfile = (key: 'name' | 'email', value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
    setProfileDirty(true)
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hero-glow overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-panel/70 shadow-lg">
        <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <User className="h-3.5 w-3.5" />
              Account profile
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Profile</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Manage your personal information, connected provider identity, and the account details shown throughout the review workspace.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Signed in as</p>
              <p className="mt-2 text-lg font-semibold">{user?.name || 'User'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{user?.email || 'No email provided'}</p>
            </div>
            <div className="rounded-3xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Git provider</p>
              <p className="mt-2 text-lg font-semibold">{user?.githubConnected ? 'GitHub connected' : 'Not connected'}</p>
              <p className="mt-1 text-xs text-muted-foreground">Review and repository access follows your linked account.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-6">
          <Card className="glass-panel border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Personal Information
              </CardTitle>
              <CardDescription>Update the identity details used across dashboards, audit logs, and notifications.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm">Name</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => updateProfile('name', e.target.value)}
                  className="h-11 rounded-2xl border-border/60 bg-background/70"
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1 text-sm">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => updateProfile('email', e.target.value)}
                  className="h-11 rounded-2xl border-border/60 bg-background/70"
                  placeholder="your.email@example.com"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  onClick={handleSaveProfile}
                  disabled={!profileDirty || isSaving}
                  className="gap-2 rounded-2xl px-4"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Github className="h-4 w-4" />
                GitHub Access
              </CardTitle>
              <CardDescription>Connect or disconnect GitHub to manage repositories and PR review automation.</CardDescription>
            </CardHeader>
            <CardContent>
              {user?.githubConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-[1.5rem] border border-green-500/20 bg-green-500/10 p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold">Connected as {user.githubUsername}</p>
                        <p className="text-xs text-muted-foreground">Repository discovery and review access are active.</p>
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
                    className="w-fit rounded-2xl"
                  >
                    Disconnect GitHub
                  </Button>
                </div>
              ) : (
                <ConnectGitHubButton onConnected={() => window.location.reload()} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card className="glass-panel border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Workspace Status
              </CardTitle>
              <CardDescription>Quick context about how this account is configured inside the product.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Review access</p>
                <p className="mt-2 text-base font-semibold">{user?.githubConnected ? 'Ready for repository sync' : 'Provider connection recommended'}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Notifications</p>
                <p className="mt-2 text-base font-semibold">Managed in settings</p>
                <p className="mt-1 text-xs text-muted-foreground">Adjust preferences for reminders, alerts, and digest emails from the settings page.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Fingerprint className="h-4 w-4" />
                Account Metadata
              </CardTitle>
              <CardDescription>Reference values useful for support, debugging, and audit tracing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">User ID</p>
                <p className="mt-2 break-all font-mono text-xs">{user?.id || 'N/A'}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Primary email</p>
                <p className="mt-2 text-sm font-medium">{user?.email || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
