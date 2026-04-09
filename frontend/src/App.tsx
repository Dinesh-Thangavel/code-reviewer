import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './lib/theme-provider'
import { AuthProvider } from './lib/auth-provider'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Toaster } from './components/ui/toaster'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { AuthCallback } from './pages/AuthCallback'
import { Dashboard } from './pages/Dashboard'
import { PullRequests } from './pages/PullRequests'
import { PRDetail } from './pages/PRDetail'
import { Repositories } from './pages/Repositories'
import { Insights } from './pages/Insights'
import { Settings } from './pages/Settings'
import { Profile } from './pages/Profile'
import { Audit } from './pages/Audit'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function AppContent() {
  // Enable keyboard shortcuts globally
  useKeyboardShortcuts()

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="pull-requests" element={<PullRequests />} />
        <Route path="pull-requests/:id" element={<PRDetail />} />
          <Route path="repositories" element={<Repositories />} />
          <Route path="insights" element={<Insights />} />
          <Route path="audit" element={<Audit />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
      </Route>

      {/* Redirect root to dashboard if authenticated, otherwise to login */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="ai-code-review-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
