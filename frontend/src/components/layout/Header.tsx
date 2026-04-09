import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Moon, Sun, User, LogOut, Settings as SettingsIcon, Menu, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/lib/theme-provider'
import { useAuth } from '@/lib/auth-provider'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const getPageTitle = (pathname: string): string => {
  if (pathname.startsWith('/pull-requests/')) {
    return 'Pull Request Details'
  }

  const titles: Record<string, string> = {
    '/': 'Dashboard',
    '/dashboard': 'Dashboard',
    '/pull-requests': 'Pull Requests',
    '/repositories': 'Repositories',
    '/insights': 'Insights',
    '/profile': 'Profile',
    '/settings': 'Settings',
  }

  return titles[pathname] || 'Dashboard'
}

interface HeaderProps {
  onMenuToggle: () => void
}

export function Header({ onMenuToggle }: HeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [isDark, setIsDark] = useState(false)
  const pageTitle = getPageTitle(location.pathname)
  const pageSubtitle = location.pathname.startsWith('/pull-requests/')
    ? 'Inspect findings, apply fixes, and monitor review progress.'
    : location.pathname === '/'
      ? 'Track review volume, risk, and team throughput in one place.'
      : 'Review code quality signals without losing context.'

  useEffect(() => {
    const root = window.document.documentElement
    setIsDark(root.classList.contains('dark'))
  }, [theme])

  const toggleTheme = () => {
    const root = window.document.documentElement
    const currentIsDark = root.classList.contains('dark')
    setTheme(currentIsDark ? 'light' : 'dark')
  }

  // Handle search - navigate to pull requests with search query
  const handleSearch = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/pull-requests?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }, [searchQuery, navigate])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return 'U'
    const nameParts = user.name.split(' ')
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
    }
    return user.name.charAt(0).toUpperCase()
  }

  return (
    <header className="sticky top-0 z-30 h-20 shrink-0 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="flex h-full w-full items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left side */}
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="h-9 w-9 rounded-xl border border-border/60 bg-background/80 lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="hidden h-8 w-8 items-center justify-center rounded-xl bg-primary/12 text-primary sm:flex">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                  {pageTitle}
                </h1>
                <p className="hidden truncate text-xs text-muted-foreground md:block">
                  {pageSubtitle}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="hidden md:flex items-center">
            <div className="glass-panel relative rounded-2xl border border-border/60">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search PRs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                className="h-10 w-56 border-0 bg-transparent pl-9 text-sm shadow-none focus-visible:ring-0 lg:w-72"
              />
            </div>
          </div>

          {/* Notification bell */}
          <NotificationBell />

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl border border-border/60 bg-background/70"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border border-border/60 bg-background/70">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    <span className="text-xs font-semibold">{getUserInitials()}</span>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-medium">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || 'user@example.com'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-sm" onClick={() => navigate('/profile')}>
                <User className="mr-2 h-3.5 w-3.5" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer text-sm" onClick={() => navigate('/settings')}>
                <SettingsIcon className="mr-2 h-3.5 w-3.5" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-sm text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
