import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Users, UserCircle, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(!!session?.user)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  const linkClass = (path: string) =>
    `nav-link ${location.pathname === path ? 'active' : ''}`

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          TalentMatch
        </Link>
        <div className="nav-links">
          <Link to="/recruiter" className={linkClass('/recruiter')}>
            <Users size={18} />
            Recruiter
          </Link>
          <Link to="/student" className={linkClass('/student')}>
            <UserCircle size={18} />
            Student
          </Link>
          {signedIn ? (
            <button
              type="button"
              onClick={handleLogout}
              className="nav-link nav-link-button"
              aria-label="Log out"
            >
              <LogOut size={18} />
              Log out
            </button>
          ) : (
            <Link to="/login" className={linkClass('/login')}>
              Log in
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
