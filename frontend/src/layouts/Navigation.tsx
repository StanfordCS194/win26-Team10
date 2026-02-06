import { Link, useLocation } from 'react-router-dom'
import { Users, UserCircle } from 'lucide-react'

export default function Navigation() {
  const location = useLocation()

  const linkClass = (path: string) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
      location.pathname === path
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-900">TalentMatch</span>
        </div>
        <div className="flex items-center gap-2">
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
