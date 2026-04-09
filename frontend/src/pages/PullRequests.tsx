import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowUpDown, GitPullRequest, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { usePullRequests } from '@/hooks/usePullRequests'
import { cn } from '@/lib/utils'

type PRStatus = 'Waiting' | 'Reviewing' | 'Completed' | 'Failed'
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

const ITEMS_PER_PAGE = 10

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getRiskVariant(risk: RiskLevel | string) {
  switch (risk) {
    case 'HIGH': return 'destructive'
    case 'MEDIUM': return 'default'
    case 'LOW': return 'secondary'
    default: return 'secondary'
  }
}

function getStatusVariant(status: PRStatus | string) {
  switch (status) {
    case 'Completed': return 'default'
    case 'Reviewing': return 'secondary'
    case 'Waiting': return 'outline'
    case 'Failed': return 'destructive'
    default: return 'outline'
  }
}

export function PullRequests() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [repoFilter, setRepoFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)

  // Sync search query from URL params (e.g. from header search)
  useEffect(() => {
    const urlSearch = searchParams.get('search')
    if (urlSearch && urlSearch !== searchQuery) {
      setSearchQuery(urlSearch)
    }
  }, [searchParams])

  // Debounce search query for API calls
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data: prResponse, isLoading, error, refetch } = usePullRequests({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    risk: riskFilter !== 'all' ? riskFilter : undefined,
    repo: repoFilter !== 'all' ? repoFilter : undefined,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  })

  const allPRs = prResponse?.data || []
  const pagination = prResponse?.pagination

  const uniqueRepos = useMemo(() => {
    return Array.from(new Set(allPRs.map(pr => pr.repo))).sort()
  }, [allPRs])

  const sortedPRs = useMemo(() => {
    const sorted = [...allPRs]
    sorted.sort((a, b) => {
      const dateA = new Date(a.lastRun).getTime()
      const dateB = new Date(b.lastRun).getTime()
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })
    return sorted
  }, [allPRs, sortOrder])

  const totalPages = pagination?.totalPages || 1
  const totalItems = pagination?.total || sortedPRs.length

  const handleFilterChange = () => setCurrentPage(1)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 md:flex-row">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-[160px]" />
              <Skeleton className="h-9 w-[160px]" />
              <Skeleton className="h-9 w-[160px]" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-28 hidden sm:block" />
                <Skeleton className="h-4 w-16 hidden md:block" />
                <Skeleton className="h-5 w-18" />
                <Skeleton className="h-5 w-14 hidden lg:block" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-28 hidden md:block" />
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
          <h1 className="text-2xl font-bold tracking-tight">Pull Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and review pull requests</p>
        </div>
        <ErrorState
          title="Failed to load pull requests"
          description={error.message || 'Could not fetch pull request data.'}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col gap-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <Card className="overflow-hidden border-border/60 bg-card shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-2.5 py-1 text-primary text-xs">
              Review queue
            </Badge>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Pull Requests</h1>
          </div>
          <p className="hidden flex-1 min-w-[200px] text-sm text-muted-foreground sm:block">
            Filter the queue and jump straight into a review.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex h-9 items-center rounded-xl border border-border/60 bg-background/70 px-3">
              <span className="text-[11px] uppercase tracking-[0.14em] mr-2">Visible</span>
              <span className="text-base font-semibold text-foreground">{totalItems}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-2 rounded-xl px-3">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="glass-panel border-border/60">
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by title or repository..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange() }}
                className="h-10 rounded-2xl border-border/60 bg-background/70 pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); handleFilterChange() }}>
              <SelectTrigger className="h-10 w-full rounded-2xl border-border/60 bg-background/70 md:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Waiting">Waiting</SelectItem>
                <SelectItem value="Reviewing">Reviewing</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={(v) => { setRiskFilter(v); handleFilterChange() }}>
              <SelectTrigger className="h-10 w-full rounded-2xl border-border/60 bg-background/70 md:w-[150px]">
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
              </SelectContent>
            </Select>
            <Select value={repoFilter} onValueChange={(v) => { setRepoFilter(v); handleFilterChange() }}>
              <SelectTrigger className="h-10 w-full rounded-2xl border-border/60 bg-background/70 md:w-[180px]">
                <SelectValue placeholder="Repository" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Repos</SelectItem>
                {uniqueRepos.map((repo) => (
                  <SelectItem key={repo} value={repo}>{repo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count & sort */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Showing <span className="font-medium text-foreground">{sortedPRs.length}</span> of {totalItems} pull requests
        </p>
        <Button variant="ghost" size="sm" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="h-9 gap-1.5 rounded-2xl text-xs">
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortOrder === 'asc' ? 'Oldest' : 'Newest'}
        </Button>
      </div>

      {/* Table */}
      <Card className="glass-panel min-h-0 flex-1 overflow-hidden border-border/60">
        <CardContent className="flex h-full min-h-0 flex-col p-0">
          {sortedPRs.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={GitPullRequest}
                title="No pull requests found"
                description="No pull requests match your current filters. Try adjusting your search criteria."
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="h-10 min-w-[180px] px-3 text-xs">PR Title</TableHead>
                    <TableHead className="hidden h-10 px-3 text-xs sm:table-cell">Repository</TableHead>
                    <TableHead className="hidden h-10 px-3 text-xs md:table-cell">Author</TableHead>
                    <TableHead className="h-10 px-3 text-xs">Status</TableHead>
                    <TableHead className="hidden h-10 px-3 text-xs lg:table-cell">Risk</TableHead>
                    <TableHead className="h-10 px-3 text-xs">Issues</TableHead>
                    <TableHead className="hidden h-10 px-3 text-xs md:table-cell">Last Run</TableHead>
                    <TableHead className="h-10 px-3 text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {sortedPRs.map((pr, index) => (
                      <motion.tr
                        key={pr.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b last:border-0"
                      >
                        <TableCell className="px-3 py-2.5 font-medium">
                          <span className="truncate block max-w-[180px]" title={pr.title}>{pr.title}</span>
                        </TableCell>
                        <TableCell className="hidden px-3 py-2.5 text-sm text-muted-foreground sm:table-cell">{pr.repo}</TableCell>
                        <TableCell className="hidden px-3 py-2.5 text-sm text-muted-foreground md:table-cell">{pr.author}</TableCell>
                        <TableCell className="px-3 py-2.5">
                          <Badge variant={getStatusVariant(pr.status)}>{pr.status}</Badge>
                        </TableCell>
                        <TableCell className="hidden px-3 py-2.5 lg:table-cell">
                          <Badge variant={getRiskVariant(pr.risk)}>{pr.risk}</Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className={cn(
                              'text-sm font-medium',
                              pr.issues > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                            )}>
                              {pr.issues}
                            </span>
                            {(pr.fixedIssues ?? 0) > 0 && (
                              <Badge variant="default" className="bg-green-600 text-[10px] px-1 py-0 h-4">
                                {pr.fixedIssues} fixed
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
                          {formatDate(pr.lastRun)}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl px-3 text-xs"
                            onClick={() => navigate(`/pull-requests/${pr.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="pt-1">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      isActive={currentPage === page}
                      onClick={() => setCurrentPage(page)}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return <PaginationItem key={page}><PaginationEllipsis /></PaginationItem>
              }
              return null
            })}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </motion.div>
  )
}
