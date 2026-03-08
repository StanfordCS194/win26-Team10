import { NavLink, Outlet } from 'react-router-dom'
import { Users, Briefcase, Mail } from 'lucide-react'

export default function RecruiterLayout() {
  return (
    <div className="recruiter-layout">
      <aside className="recruiter-sidebar">
        <nav className="recruiter-sidebar-nav">
          <NavLink
            to="/recruiter"
            end
            className={({ isActive }) => `recruiter-sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Users size={20} />
            <span>Candidates</span>
          </NavLink>
          <NavLink
            to="/recruiter/jobs"
            className={({ isActive }) => `recruiter-sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Briefcase size={20} />
            <span>Jobs</span>
          </NavLink>
          <NavLink
            to="/recruiter"
            className={({ isActive }) => `recruiter-sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Mail size={20} />
            <span>Inbox</span>
          </NavLink>
        </nav>
      </aside>
      <main className="recruiter-layout-main">
        <Outlet />
      </main>
    </div>
  )
}
