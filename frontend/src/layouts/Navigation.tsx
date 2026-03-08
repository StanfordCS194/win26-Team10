import { useEffect, useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, Sparkles, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

function getInitials(email: string | undefined): string {
  if (!email) return 'U'
  const part = email.split('@')[0] || ''
  const segments = part.split(/[._-]/).filter(Boolean)
  if (segments.length >= 2) {
    return (segments[0][0] + segments[segments.length - 1][0]).toUpperCase().slice(0, 2)
  }
  return part.slice(0, 2).toUpperCase() || 'U'
}

function getInitialsFromName(fullName: string | null | undefined): string | null {
  if (!fullName || !fullName.trim()) return null
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2)
  }
  return parts[0].slice(0, 2).toUpperCase() || null
}

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [signedIn, setSignedIn] = useState(false)
  const [userType, setUserType] = useState<'student' | 'recruiter' | null>(null)
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined)
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)

    async function loadUserMeta(session: { user: { id: string; email?: string } } | null) {
      if (!session?.user?.id) {
        setUserType(null)
        setUserDisplayName(null)
        return
      }
      const maxAttempts = 5
      const delayMs = 400
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data } = await supabase
          .from('users')
          .select('type')
          .eq('id', session.user.id)
          .maybeSingle()
        const t = data?.type
        if (t === 'student' || t === 'recruiter') {
          setUserType(t)
          if (t === 'recruiter') {
            const { data: profile } = await supabase
              .from('recruiter_profiles')
              .select('full_name')
              .eq('user_id', session.user.id)
              .maybeSingle()
            setUserDisplayName(profile?.full_name ?? null)
          } else {
            setUserDisplayName(null)
          }
          return
        }
        if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, delayMs))
      }
      setUserType(null)
      setUserDisplayName(null)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(!!session?.user)
      setUserEmail(session?.user?.email ?? undefined)
      if (!session?.user?.id) {
        setUserType(null)
        setUserDisplayName(null)
        return
      }
      loadUserMeta(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user)
      setUserEmail(session?.user?.email ?? undefined)
      if (!session?.user?.id) {
        setUserType(null)
        setUserDisplayName(null)
        return
      }
      loadUserMeta(session)
    })

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  async function handleLogout() {
    setDropdownOpen(false)
    setIsMenuOpen(false)
    await supabase.auth.signOut()
    navigate('/')
  }

  const profilePath = userType === 'recruiter' ? '/recruiter/profile' : userType === 'student' ? '/student/profile' : '/'

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

        {/* Desktop: avatar dropdown or auth links */}
        <div className="nav-links-new">
          {signedIn ? (
            <div className="nav-user-menu" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="nav-avatar-btn"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                aria-label="Profile and account menu"
              >
                <span className="nav-avatar-initials">{getInitialsFromName(userDisplayName) ?? getInitials(userEmail)}</span>
              </button>
              {dropdownOpen && (
                <div className="nav-avatar-dropdown">
                  <Link
                    to={profilePath}
                    className="nav-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User size={16} />
                    <span>Profile</span>
                  </Link>
                  <button type="button" className="nav-dropdown-item" onClick={handleLogout}>
                    <LogOut size={16} />
                    <span>Logout</span>
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
              <Link
                to={profilePath}
                onClick={() => setIsMenuOpen(false)}
                className="mobile-menu-link"
              >
                <User size={18} />
                Profile
              </Link>
              <button onClick={handleLogout} className="mobile-menu-link">
                <LogOut size={18} />
                Logout
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
