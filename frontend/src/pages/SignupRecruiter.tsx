import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Briefcase, ArrowRight, CheckCircle, Mail, Lock, Loader2, Building2 } from 'lucide-react'

export default function SignupRecruiter() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/recruiter', { replace: true })
      } else {
        setCheckingAuth(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate('/recruiter', { replace: true })
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

      // Trigger creates users row with default type 'student'; set to recruiter
      const { error: updateError } = await supabase
        .from('users')
        .update({ type: 'recruiter' })
        .eq('id', authData.user.id)

      if (updateError) throw updateError

      navigate('/recruiter')
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
        <div className="auth-info-side recruiter-theme">
          <div className="auth-info-content">
            <div className="auth-badge">
              <Briefcase size={20} />
              <span>For Recruiters</span>
            </div>
            <h1 className="auth-info-title">Find Your Next Top Hire</h1>
            <p className="auth-info-text">
              Access a curated pool of exceptional student talent ready to make an impact.
            </p>
            
            <div className="auth-feature-list">
              <div className="auth-feature-item">
                <CheckCircle size={20} className="text-success" />
                <span>Advanced student filtering & search</span>
              </div>
              <div className="auth-feature-item">
                <CheckCircle size={20} className="text-success" />
                <span>Direct access to verified transcripts</span>
              </div>
              <div className="auth-feature-item">
                <CheckCircle size={20} className="text-success" />
                <span>Streamlined candidate management</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="auth-form-side">
          <div className="auth-form-container">
            <div className="auth-form-header">
              <h2 className="auth-form-title">Recruiter Registration</h2>
              <p className="auth-form-subtitle">Hire the best emerging talent today.</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {error && (
                <div className="auth-error-message">
                  {error}
                </div>
              )}

              <div className="form-group">
                <label>Work Email</label>
                <div className="input-with-icon">
                  <Mail className="input-icon" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@company.com"
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
                className="auth-submit-btn recruiter-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Sign Up as Recruiter</span>
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
