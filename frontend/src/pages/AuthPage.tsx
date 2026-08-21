import { useState, useEffect, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import type { Page } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

type AuthPageProps = {
  initialMode: 'login' | 'signup'
  showPage: (page: Page) => void
  onLoginSuccess: (user: { name: string; email: string }) => void
}

export function AuthPage({ initialMode, showPage, onLoginSuccess }: AuthPageProps) {
  const { login, signup, loginWithGoogle } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [googleSdkReady, setGoogleSdkReady] = useState(false)
  
  // Check if VITE_GOOGLE_CLIENT_ID environment variable is set
  const client_id = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // Initialize real Google Identity Services if client ID exists
  useEffect(() => {
    if (!client_id) return

    const checkGoogleSdk = setInterval(() => {
      const google = (window as any).google
      if (google && google.accounts) {
        clearInterval(checkGoogleSdk)
        try {
          google.accounts.id.initialize({
            client_id: client_id,
            callback: async (response: any) => {
              try {
                setLoading(true)
                setError('')
                await loginWithGoogle(response.credential)
                
                // Decode standard JWT credential token returned by Google to pass to legacy handler
                const base64Url = response.credential.split('.')[1]
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
                const jsonPayload = decodeURIComponent(
                  atob(base64)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
                )
                const payload = JSON.parse(jsonPayload)

                onLoginSuccess({
                  name: payload.name || payload.given_name || 'Google User',
                  email: payload.email
                })
                showPage('dashboard')
              } catch (err: any) {
                console.error('Google Sign-In failed:', err)
                setError(err.message || 'Google Sign-In failed.')
              } finally {
                setLoading(false)
              }
            }
          })
          setGoogleSdkReady(true)
        } catch (err) {
          console.error('Google Sign-In SDK Initialization failed:', err)
        }
      }
    }, 100)

    return () => clearInterval(checkGoogleSdk)
  }, [client_id])

  // Render Google button whenever SDK is ready or mode changes
  useEffect(() => {
    if (!client_id || !googleSdkReady) return

    const google = (window as any).google
    if (google && google.accounts) {
      const timer = setTimeout(() => {
        const btnContainer = document.getElementById('real-google-btn-container')
        if (btnContainer) {
          try {
            google.accounts.id.renderButton(
              btnContainer,
              { 
                theme: 'outline', 
                size: 'large', 
                width: 380, 
                shape: 'rectangular',
                text: mode === 'signup' ? 'signup_with' : 'signin_with'
              }
            )
          } catch (err) {
            console.error('Google Sign-In button rendering failed:', err)
          }
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [client_id, googleSdkReady, mode])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email || !password || (mode === 'signup' && !name)) {
      setError('Please fill in all fields.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        await signup(name, email, password)
        onLoginSuccess({ name, email })
      } else {
        await login(email, password)
        onLoginSuccess({ name: email.split('@')[0], email })
      }
      showPage('dashboard')
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page-container">
      <div className="auth-card-wrapper light-theme">
        <div className="auth-form-panel">
          <div className="auth-brand-logo" onClick={() => showPage('home')}>
            <img src="/logo.png" alt="NephroCare" className="auth-logo-img" />
            <span className="auth-logo-text">NephroCare</span>
          </div>

          <div className="auth-form-header">
            <div className="auth-tabs">
              <button 
                type="button"
                className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
                onClick={() => { setMode('login'); setError(''); }}
              >
                Log In
              </button>
              <button 
                type="button"
                className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => { setMode('signup'); setError(''); }}
              >
                Sign Up
              </button>
            </div>
            <p className="auth-subtitle">
              {mode === 'login' 
                ? 'Welcome back! Log in to access your personal dashboard.' 
                : 'Create an account to track kidney function and save clinical reports.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error-msg">{error}</div>}
            
            {mode === 'signup' && (
              <div className="form-group">
                <label htmlFor="name-input">Full Name</label>
                <input 
                  id="name-input"
                  type="text" 
                  placeholder="e.g. Jane Doe" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email-input">Email Address</label>
              <input 
                id="email-input"
                type="email" 
                placeholder="e.g. jane@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password-input">Password</label>
              <div className="password-input-wrapper" style={{ position: 'relative' }}>
                <input 
                  id="password-input"
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <div className="form-options">
                <label className="remember-me">
                  <input type="checkbox" /> Remember me
                </label>
                <button type="button" className="forgot-pwd-btn">Forgot password?</button>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <span className="auth-spinner"></span>
              ) : mode === 'login' ? (
                'Log In'
              ) : (
                'Create Account'
              )}
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            {client_id ? (
              /* Official Google Identity Services Button Container */
              <div className="gsi-container" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <div id="real-google-btn-container" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}></div>
              </div>
            ) : (
              <div className="google-fallback-wrapper" style={{ textAlign: 'center', color: '#888', fontSize: '13px', margin: '15px 0' }}>
                Google Sign-In is unavailable. Please configure VITE_GOOGLE_CLIENT_ID in your .env file.
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  )
}
