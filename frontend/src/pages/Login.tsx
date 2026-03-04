import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Loader2, ArrowRight, LayoutDashboard } from 'lucide-react'

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log('Attempting login with email:', email)
      
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        console.error('Auth error:', authError)
        throw authError
      }

      if (!authData.user) {
        throw new Error('Failed to sign in')
      }

      console.log('Auth successful, fetching user type...')
      
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('type')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (userError) {
        console.error('Error fetching user type:', userError)
        throw new Error(`Failed to fetch user profile: ${userError.message}`)
      }

      if (!userRow) {
        console.error('No user row found for:', authData.user.id)
        throw new Error('User profile not found. Please contact support.')
      }

      const userType = userRow.type
      console.log('User type:', userType)
      
      if (userType === 'recruiter') {
        navigate('/recruiter')
      } else if (userType === 'student') {
        navigate('/student')
      } else {
        navigate('/')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during login'
      setError(errorMessage)
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
