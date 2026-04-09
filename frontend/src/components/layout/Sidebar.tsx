import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  GitPullRequest,
  FolderGit2,
  BarChart3,
  Settings,
  Shield,
  X,
  Code2,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-provider'

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
  },
  {
    title: 'Pull Requests',
    icon: GitPullRequest,
    path: '/pull-requests',
  },
  {
    title: 'Repositories',
    icon: FolderGit2,
    path: '/repositories',
  },
  {
    title: 'Insights',
    icon: BarChart3,
    path: '/insights',
  },
  {
    title: 'Audit',
    icon: Shield,
    path: '/audit',
  },
  {
    title: 'Settings',
    icon: Settings,
    path: '/settings',
  },
]

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

function UserProfileSection({ isCollapsed }: { isCollapsed: boolean }) {
  const { user } = useAuth()

  const getUserInitials = () => {
    if (!user) return 'U'
    const nameParts = user.name.split(' ')
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
    }
    return user.name.charAt(0).toUpperCase()
  }

  return (
    <div className={cn(
      "glass-panel flex items-center gap-3 rounded-2xl border border-border/60 px-3 py-3",
      isCollapsed && "lg:justify-center lg:px-0"
    )}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12">
        {user?.avatar ? (
          <img src={user.avatar} alt={user.name} className="h-full w-full rounded-2xl object-cover" />
        ) : (
          <span className="text-xs font-semibold text-primary">{getUserInitials()}</span>
        )}
      </div>
      {!isCollapsed && (
        <div className="overflow-hidden">
          <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email || 'user@example.com'}</p>
        </div>
      )}
    </div>
  )
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen overflow-hidden border-r border-border/70 bg-sidebar/95 text-sidebar-foreground shadow-xl transition-all duration-300 lg:sticky lg:z-20 lg:shadow-none',
          isCollapsed
            ? '-translate-x-full lg:translate-x-0 lg:w-[72px]'
            : 'w-64 lg:w-64'
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-background/30 via-transparent to-transparent">
          {/* Logo */}
          <div className="flex h-20 items-center justify-between border-b border-border/70 px-5">
            <div className={cn(
              "flex items-center gap-3 overflow-hidden transition-all",
              isCollapsed && "lg:justify-center lg:w-full lg:px-0"
            )}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
                <Code2 className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              {!isCollapsed && (
                <div className="truncate space-y-0.5">
                  <span className="block truncate text-base font-bold tracking-tight">
                    CodeReview AI
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Autonomous review workspace
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="hidden h-9 w-9 rounded-xl border border-border/60 bg-background/70 lg:inline-flex"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-8 w-8 shrink-0 lg:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = item.path === '/'
                ? location.pathname === '/' || location.pathname === '/dashboard'
                : location.pathname === item.path || location.pathname.startsWith(item.path + '/')

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'glass-panel border border-primary/15 bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-background/80 hover:text-accent-foreground',
                    isCollapsed && 'lg:justify-center lg:px-2'
                  )}
                  title={isCollapsed ? item.title : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-indicator"
                      className="absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-r-full"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {!isCollapsed && <span>{item.title}</span>}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-border/70 px-3 py-4">
            <UserProfileSection isCollapsed={isCollapsed} />
          </div>
        </div>
      </aside>
    </>
  )
}
