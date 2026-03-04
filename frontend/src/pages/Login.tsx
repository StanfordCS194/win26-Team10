import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Loader2, ArrowRight, LayoutDashboard } from 'lucide-react'

const GoogleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={{ marginRight: '0.5rem' }}
  >
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.3-1.9 3.1l3.1 2.4C20.6 18.1 21.5 15.7 21.5 13c0-.7-.1-1.3-.2-1.8H12z"
    />
    <path
      fill="#34A853"
      d="M6.6 14.3l-.9.7-2.5 2C5 19.9 8.3 21.5 12 21.5c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 1-3.6 1-2.8 0-5.1-1.9-5.9-4.4z"
    />
    <path
      fill="#FBBC05"
      d="M3.2 7.6A8.46 8.46 0 0 0 2.5 10c0 .8.1 1.6.4 2.4 0 .1.4 1.1.9 1.9l3-2.3c-.2-.6-.4-1.2-.4-2 0-.7.1-1.3.4-1.9z"
    />
    <path
      fill="#4285F4"
      d="M12 4.5c1.5 0 2.8.5 3.8 1.4l2.8-2.8C16.9 1.7 14.7.9 12 .9 8.3.9 5 2.5 3.2 5.1l3.6 2.8C7 6.4 9.2 4.5 12 4.5z"
    />
  </svg>
)

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        redirectByType(session.user.id)
      } else {
        setCheckingAuth(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        redirectByType(session.user.id)
      } else {
        setCheckingAuth(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  async function redirectByType(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('type')
      .eq('id', userId)
      .maybeSingle()

    const userType = data?.type
    if (userType === 'recruiter') {
      navigate('/recruiter', { replace: true })
    } else if (userType === 'student') {
      navigate('/student', { replace: true })
    } else {
      setCheckingAuth(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      })

      if (authError) {
        throw authError
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'An error occurred during Google sign-in',
      )
      console.error('Google sign-in error:', err)
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Failed to sign in')
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('type')
        .eq('id', authData.user.id)
        .maybeSingle()

      const userType = userRow?.type
      if (userType === 'recruiter') {
        navigate('/recruiter')
      } else if (userType === 'student') {
        navigate('/student')
      } else {
        navigate('/')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during login')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="loading-screen">
        <Loader2 className="animate-spin" size={48} color="#2563eb" />
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-split-container">
        {/* Left Side: Visual/Info */}
        <div className="auth-info-side student-theme">
          <div className="auth-info-content">
            <div className="auth-badge">
              <LayoutDashboard size={20} />
              <span>Welcome Back</span>
            </div>
            <h1 className="auth-info-title">Continue Your Journey</h1>
            <p className="auth-info-text">
              Log in to access your personalized dashboard and stay connected with the latest opportunities.
            </p>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="auth-form-side">
          <div className="auth-form-container">
            <div className="auth-form-header">
              <h2 className="auth-form-title">Welcome Back</h2>
              <p className="auth-form-subtitle">Please enter your details to sign in.</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {error && (
                <div className="auth-error-message">
                  {error}
                </div>
              )}

              <div className="form-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <Mail className="input-icon" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-with-icon">
                  <Lock className="input-icon" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-submit-btn student-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="auth-submit-btn google-btn"
                style={{ marginTop: '0.75rem' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Signing in with Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </form>

            <div className="auth-form-footer">
              <p>
                Don&apos;t have an account? 
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <Link to="/signup-student" className="auth-link">As Student</Link>
                  <span style={{ color: '#d1d5db' }}>|</span>
                  <Link to="/signup-recruiter" className="auth-link">As Recruiter</Link>
                </div>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
