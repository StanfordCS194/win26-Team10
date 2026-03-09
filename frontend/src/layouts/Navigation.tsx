import { useEffect, useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, Sparkles, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

type UserType = 'student' | 'recruiter'

function getInitials(displayName: string | null, email: string | undefined): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) {
      const a = parts[0].charAt(0)
      const b = parts[parts.length - 1].charAt(0)
      return (a + b).toUpperCase().slice(0, 2)
    }
    return displayName.slice(0, 2).toUpperCase()
  }
  if (email) {
    const local = email.split('@')[0]
    if (local.length >= 2) return local.slice(0, 2).toUpperCase()
    return local.charAt(0).toUpperCase()
  }
  return '?'
}

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [signedIn, setSignedIn] = useState(false)
  const [userType, setUserType] = useState<UserType | null>(null)
  const [initials, setInitials] = useState<string>('?')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(!!session?.user)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user)
    })

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Load user type and display name for avatar initials when signed in
  useEffect(() => {
    if (!signedIn) {
      setUserType(null)
      setInitials('?')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const uid = session?.user?.id
        const email = session?.user?.email ?? undefined
        if (!uid || cancelled) return

        const { data: userRow } = await supabase
          .from('users')
          .select('type')
          .eq('id', uid)
          .maybeSingle()

        const type = userRow?.type === 'student' || userRow?.type === 'recruiter' ? userRow.type : null
        if (!cancelled) setUserType(type)

        let displayName: string | null = null
        if (type === 'student') {
          const { data: app } = await supabase
            .from('applicants')
            .select('first_name, last_name')
            .eq('user_id', uid)
            .maybeSingle()
          const a = app as { first_name?: string; last_name?: string } | null
          if (a?.first_name || a?.last_name) {
            displayName = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || null
          }
        } else if (type === 'recruiter') {
          const { data: rp } = await supabase
            .from('recruiter_profiles')
            .select('full_name')
            .eq('user_id', uid)
            .maybeSingle()
          const r = rp as { full_name?: string | null } | null
          if (r?.full_name) displayName = r.full_name
        }
        if (!cancelled) setInitials(getInitials(displayName, email))
      } catch {
        if (!cancelled) setInitials(getInitials(null, undefined))
      }
    })()
    return () => { cancelled = true }
  }, [signedIn])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [menuOpen])

  async function handleLogout() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    navigate('/')
  }

  const profilePath = userType === 'student' ? '/student/profile' : userType === 'recruiter' ? '/recruiter/profile' : null

  const isAuthPage = ['/login', '/signup-student', '/signup-recruiter'].includes(location.pathname)

  return (
    <nav className={`nav-new ${scrolled ? 'scrolled' : ''} ${isAuthPage ? 'auth-nav' : ''}`}>
      <div className="nav-container-new">
        <Link to="/" className="nav-logo-new">
          <div className="logo-icon">
            <Sparkles size={24} />
          </div>
          <span>TalentMatch</span>
        </Link>

        {/* Desktop Links */}
        <div className="nav-links-new">
          {signedIn ? (
            <div className="nav-user-menu" ref={menuRef}>
              <button
                type="button"
                className="nav-avatar-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label="User menu"
              >
                {initials}
              </button>
              {menuOpen && (
                <div className="nav-avatar-dropdown">
                  {profilePath && (
                    <Link
                      to={profilePath}
                      className="nav-avatar-dropdown-item"
                      onClick={() => setMenuOpen(false)}
                    >
                      <User size={18} />
                      <span>Profile</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    className="nav-avatar-dropdown-item"
                    onClick={handleLogout}
                  >
                    <LogOut size={18} />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="nav-auth-group">
              <Link to="/login" className="nav-link-new">Log in</Link>
              <Link to="/signup-student" className="nav-btn-primary-new">Get Started</Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="mobile-menu">
          {signedIn ? (
            <>
              {profilePath && (
                <Link to={profilePath} onClick={() => setIsMenuOpen(false)} className="mobile-menu-link">
                  <User size={18} />
                  Profile
                </Link>
              )}
              <button onClick={handleLogout} className="mobile-menu-link">
                <LogOut size={18} />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setIsMenuOpen(false)} className="mobile-menu-link">Log in</Link>
              <Link to="/signup-student" onClick={() => setIsMenuOpen(false)} className="mobile-menu-link primary">Get Started</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
