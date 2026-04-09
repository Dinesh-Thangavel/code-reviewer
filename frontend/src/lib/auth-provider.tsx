import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  githubConnected?: boolean
  githubUsername?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  signup: (name: string, email: string, password: string) => Promise<boolean>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  updateUser: (userData: Partial<User>) => void
  updateUserProfile: (userData: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_STORAGE_KEY = 'ai-code-review-token'
const USER_STORAGE_KEY = 'ai-code-review-user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Load auth state from localStorage on mount
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY)
        const storedUser = localStorage.getItem(USER_STORAGE_KEY)

        if (token && storedUser) {
          // Verify token is still valid by fetching current user
          try {
            const response = await api.get('/auth/me', {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })

            if (response.data.success) {
              setUser(response.data.user)
              // Update stored user data
              localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data.user))
            } else {
              // Token invalid, clear storage
              localStorage.removeItem(TOKEN_STORAGE_KEY)
              localStorage.removeItem(USER_STORAGE_KEY)
            }
          } catch (error) {
            // Token invalid or expired, clear storage
            localStorage.removeItem(TOKEN_STORAGE_KEY)
            localStorage.removeItem(USER_STORAGE_KEY)
          }
        }
      } catch (error) {
        console.error('Failed to load auth state:', error)
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(USER_STORAGE_KEY)
      } finally {
        setIsLoading(false)
      }
    }

    loadAuth()
  }, [])

  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      const response = await api.post('/auth/signup', {
        name,
        email,
        password,
      })

      if (response.data.success && response.data.token) {
        // Store token and user
        localStorage.setItem(TOKEN_STORAGE_KEY, response.data.token)
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data.user))
        setUser(response.data.user)

        // Set default auth header for future requests
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`

        toast({
          title: 'Account created',
          description: `Welcome, ${response.data.user.name}!`,
        })

        setIsLoading(false)
        return true
      }

      setIsLoading(false)
      return false
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.details?.[0]?.message ||
        error.message ||
        'Failed to create account'

      toast({
        title: 'Signup failed',
        description: errorMessage,
        variant: 'destructive',
      })
      setIsLoading(false)
      return false
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      })

      if (response.data.success && response.data.token) {
        // Store token and user
        localStorage.setItem(TOKEN_STORAGE_KEY, response.data.token)
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data.user))
        setUser(response.data.user)

        // Set default auth header for future requests
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`

        toast({
          title: 'Login successful',
          description: `Welcome back, ${response.data.user.name}!`,
        })

        setIsLoading(false)
        return true
      }

      setIsLoading(false)
      return false
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error ||
        error.message ||
        'Invalid email or password'

      toast({
        title: 'Login failed',
        description: errorMessage,
        variant: 'destructive',
      })
      setIsLoading(false)
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out.',
    })
  }

  const updateUser = (userData: Partial<User> | User) => {
    // If userData is a complete User object (from OAuth callback), use it directly
    // Otherwise, merge with existing user
    const updatedUser = user && 'id' in userData && userData.id === user.id
      ? { ...user, ...userData }
      : (userData as User)
    
    setUser(updatedUser)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser))
  }

  const updateUserProfile = async (userData: Partial<User>) => {
    if (!user) return

    try {
      const response = await api.put(
        '/auth/profile',
        userData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(TOKEN_STORAGE_KEY)}`,
          },
        }
      )

      if (response.data.success) {
        const updatedUser = response.data.user
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser))
        setUser(updatedUser)

        toast({
          title: 'Profile updated',
          description: 'Your profile has been updated successfully.',
        })
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error ||
        error.message ||
        'Failed to update profile'

      toast({
        title: 'Update failed',
        description: errorMessage,
        variant: 'destructive',
      })
      throw error
    }
  }

  // Set auth header on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signup,
        login,
        logout,
        updateUser,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
