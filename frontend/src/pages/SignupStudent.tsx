import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { GraduationCap, ArrowRight, CheckCircle, Mail, Lock, Loader2 } from 'lucide-react'

export default function SignupStudent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
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
                disabled={loading}
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
