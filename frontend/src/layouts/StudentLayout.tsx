import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Briefcase, Mail, GraduationCap, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

type PreviewData = {
  firstName: string
  lastName: string
  school: string
  major: string
  graduationYear: string
  gpa: string
  latestReprPath: string | null
  resumePath: string | null
}

export default function StudentLayout() {
  const location = useLocation()
  const isProfilePage = location.pathname === '/student/profile'

  const [preview, setPreview] = useState<PreviewData | null>(null)

  useEffect(() => {
    if (!isProfilePage) {
      setPreview(null)
      return
    }
    let cancelled = false
    async function fetchPreview() {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        if (!cancelled) setPreview(null)
        return
      }
      try {
        const res = await fetch(`${API_BASE}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        setPreview({
          firstName: data.first_name ?? '',
          lastName: data.last_name ?? '',
          school: data.school ?? '',
          major: data.major ?? '',
          graduationYear: data.graduation_year ?? '',
          gpa: data.gpa != null ? String(data.gpa) : '',
          latestReprPath: data.latest_repr_path ?? null,
          resumePath: data.resume_path ?? null,
        })
      } catch {
        if (!cancelled) setPreview(null)
      }
    }
    fetchPreview()
    const onSaved = () => {
      if (!cancelled && isProfilePage) fetchPreview()
    }
    window.addEventListener('student-profile-saved', onSaved)
    return () => {
      cancelled = true
      window.removeEventListener('student-profile-saved', onSaved)
    }
  }, [isProfilePage])

  return (
    <div className="student-layout">
      <aside className="student-sidebar">
        <nav className="student-sidebar-nav">
          <NavLink
            to="/student/dashboard"
            end
            className={({ isActive }) => `student-sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Briefcase size={20} />
            <span>Jobs</span>
          </NavLink>
          <NavLink
            to="/student/inbox"
            end
            className={({ isActive }) => `student-sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Mail size={20} />
            <span>Inbox</span>
          </NavLink>
        </nav>
      </aside>
      {isProfilePage && (
        <aside className="student-preview-panel">
          {preview && (
            <>
              <h2 className="student-profile-preview-name">
                {[preview.firstName, preview.lastName].filter(Boolean).join(' ') || 'Student Name'}
              </h2>
              <div className="student-profile-preview-row">
                <Building2 size={16} aria-hidden />
                <span>{preview.school || 'School'}</span>
              </div>
              <div className="student-profile-preview-row">
                <GraduationCap size={16} aria-hidden />
                <span>{preview.major || 'Major'}</span>
              </div>
              {preview.graduationYear && (
                <div className="student-profile-preview-row">
                  <span>Class of {preview.graduationYear}</span>
                </div>
              )}
              {preview.gpa && (
                <div className="student-profile-preview-row">
                  <span>GPA: {preview.gpa}</span>
                </div>
              )}
              <div className="student-profile-preview-badges">
                {preview.latestReprPath && (
                  <span className="student-profile-preview-badge">Transcript uploaded</span>
                )}
                {preview.resumePath && (
                  <span className="student-profile-preview-badge">Resume uploaded</span>
                )}
              </div>
            </>
          )}
        </aside>
      )}
      <main className="student-layout-main">
        <Outlet />
      </main>
    </div>
  )
}
