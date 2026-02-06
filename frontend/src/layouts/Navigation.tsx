import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Users, UserCircle, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const linkClass = (path: string) =>
    `nav-link ${location.pathname === path ? 'active' : ''}`

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/" className="nav-logo">TalentMatch</Link>
        <div className="nav-links">
          {user ? (
            <>
              <Link to="/recruiter" className={linkClass('/recruiter')}>
                <Users size={18} />
                Recruiter
              </Link>
              <Link to="/student" className={linkClass('/student')}>
                <UserCircle size={18} />
                Student
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="nav-link nav-logout-btn"
              >
                <LogOut size={18} />
                Log Out
              </button>
            </>
          ) : (
            <Link to="/login" className={linkClass('/login')}>
              Log In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
