import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { GraduationCap, ArrowRight, CheckCircle, Mail, Lock, Loader2 } from 'lucide-react'

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

export default function SignupStudent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/student', { replace: true })
      } else {
        setCheckingAuth(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate('/student', { replace: true })
      } else {
        setCheckingAuth(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create user account')

      // Trigger on auth.users creates users row with default type 'student'
      navigate('/student')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during signup')
      console.error('Signup error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setError(null)
    setGoogleLoading(true)

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
        err instanceof Error ? err.message : 'An error occurred during Google sign-up',
      )
      console.error('Google sign-up error (student):', err)
      setGoogleLoading(false)
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
              <GraduationCap size={20} />
              <span>For Students</span>
            </div>
            <h1 className="auth-info-title">Launch Your Career with TalentMatch</h1>
            <p className="auth-info-text">
              Join thousands of students who have found their dream roles through our platform.
            </p>
            
            <div className="auth-feature-list">
              <div className="auth-feature-item">
                <CheckCircle size={20} className="text-success" />
                <span>Get discovered by top-tier recruiters</span>
              </div>
              <div className="auth-feature-item">
                <CheckCircle size={20} className="text-success" />
                <span>Showcase your skills and projects</span>
              </div>
              <div className="auth-feature-item">
                <CheckCircle size={20} className="text-success" />
                <span>Access exclusive internship opportunities</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="auth-form-side">
          <div className="auth-form-container">
            <div className="auth-form-header">
              <h2 className="auth-form-title">Create Student Account</h2>
              <p className="auth-form-subtitle">Start your professional journey today.</p>
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
                    placeholder="you@university.edu"
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
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="auth-submit-btn student-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Sign Up as Student</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={loading || googleLoading}
                onClick={handleGoogleSignUp}
                className="auth-submit-btn google-btn"
                style={{ marginTop: '0.75rem' }}
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Continue with Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Sign Up with Google</span>
                  </>
                )}
              </button>
            </form>

            <div className="auth-form-footer">
              <p>
                Already have an account? <Link to="/login" className="auth-link">Log in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
