import type { ReactNode } from 'react'
import { createContext, useContext, useState, useEffect } from 'react'

export type User = {
  id: string
  email: string
  name: string
  avatar?: string
}

export type AuthContextType = {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  loginWithGoogle: (token: string) => Promise<void>
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
  
  // Log API URL for debugging
  useEffect(() => {
    console.log('Auth API URL:', API_BASE_URL)
  }, [API_BASE_URL])

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        if (token) {
          const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (response.ok) {
            const userData: User = await response.json()
            setUser(userData)
          } else {
            localStorage.removeItem('auth_token')
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err)
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMsg = data.error || `Login failed with status ${response.status}`
        console.error('Login failed:', errorMsg, data)
        throw new Error(errorMsg)
      }

      const { user: userData, token }: { user: User; token: string } = await response.json()
      localStorage.setItem('auth_token', token)
      setUser(userData)
      console.log('Login successful:', userData.email)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      console.error('Login error:', message, err)
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (name: string, email: string, password: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMsg = data.error || `Signup failed with status ${response.status}`
        console.error('Signup failed:', errorMsg, data)
        throw new Error(errorMsg)
      }

      const { user: userData, token }: { user: User; token: string } = await response.json()
      localStorage.setItem('auth_token', token)
      setUser(userData)
      console.log('Signup successful:', userData.email)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed'
      console.error('Signup error:', message, err)
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithGoogle = async (token: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Google login failed')
      }

      const { user: userData, token: authToken }: { user: User; token: string } = await response.json()
      localStorage.setItem('auth_token', authToken)
      setUser(userData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google login failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    setUser(null)
    setError(null)
  }

  const clearError = () => setError(null)

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        loginWithGoogle,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
