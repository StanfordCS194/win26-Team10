import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '1.125rem',
          color: '#6b7280',
        }}
      >
        Loading...
      </div>
    )
  }

  return (
    <div className="student-page">
      <div className="student-page-container">
        <h1 className="page-title">Log In</h1>
        <p className="page-description">
          Sign in to your account to continue.
        </p>

        <form onSubmit={handleSubmit} className="form-section">
          {error && (
            <div
              style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: '0.5rem',
                color: '#991b1b',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="save-btn primary"
            style={{ marginTop: '1rem' }}
          >
            {loading ? 'Signing in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  )
}
