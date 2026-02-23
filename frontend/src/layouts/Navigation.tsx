import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [signedIn, setSignedIn] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

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

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

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
            <button
              type="button"
              onClick={handleLogout}
              className="nav-btn-logout"
            >
              <LogOut size={18} />
              <span>Log out</span>
            </button>
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
            <button onClick={handleLogout} className="mobile-menu-link">
              <LogOut size={18} />
              Log out
            </button>
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
