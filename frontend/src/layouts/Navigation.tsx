import { Link, useLocation } from 'react-router-dom'
import { Users, UserCircle } from 'lucide-react'

export default function Navigation() {
  const location = useLocation()

  const linkClass = (path: string) =>
    `nav-link ${location.pathname === path ? 'active' : ''}`

  return (
    <nav className="nav">
      <div className="nav-container">
        <div className="nav-logo">TalentMatch</div>
        <div className="nav-links">
          <Link to="/" className={linkClass('/')}>
            <Users size={18} />
            Recruiter
          </Link>
          <Link to="/student" className={linkClass('/student')}>
            <UserCircle size={18} />
            Student
          </Link>
        </div>
      </div>
    </nav>
  )
}
