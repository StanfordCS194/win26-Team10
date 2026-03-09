import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Users, Briefcase, Mail, Building2, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'

const BUCKET = 'recruiter-photos'

type RecruiterProfileRow = {
  user_id: string
  full_name: string | null
  job_title: string | null
  location: string | null
  profile_photo_path: string | null
  specializations: string[] | null
}

type CompanyMembershipRow = {
  company_id: string
  companies: { id: string; name: string } | null
}

export default function RecruiterLayout() {
  const location = useLocation()
  const isProfilePage = location.pathname === '/recruiter/profile'

  const [preview, setPreview] = useState<{
    fullName: string
    jobTitle: string
    companyName: string | null
    location: string
    profilePhotoPath: string | null
    specializations: string[]
  } | null>(null)

  useEffect(() => {
    if (!isProfilePage) {
      setPreview(null)
      return
    }
    let cancelled = false
    function fetchPreview() {
      ;(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        const uid = session?.user?.id
        if (!uid) {
          if (!cancelled) setPreview(null)
          return
        }
        const { data: membership } = await supabase
          .from('company_memberships')
          .select('company_id, companies(id, name)')
          .eq('user_id', uid)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle()
        const m = membership as CompanyMembershipRow | null
        const companyName = m?.companies?.name ?? null

        const { data: profile } = await supabase
          .from('recruiter_profiles')
          .select('user_id, full_name, job_title, location, profile_photo_path, specializations')
          .eq('user_id', uid)
          .maybeSingle()
        const p = profile as RecruiterProfileRow | null
        if (cancelled) return
        setPreview({
          fullName: p?.full_name ?? '',
          jobTitle: p?.job_title ?? '',
          companyName,
          location: p?.location ?? '',
          profilePhotoPath: p?.profile_photo_path ?? null,
          specializations: Array.isArray(p?.specializations) ? p.specializations : [],
        })
      })()
    }
    fetchPreview()
    const onSaved = () => {
      if (!cancelled && isProfilePage) fetchPreview()
    }
    window.addEventListener('recruiter-profile-saved', onSaved)
    return () => {
      cancelled = true
      window.removeEventListener('recruiter-profile-saved', onSaved)
    }
  }, [isProfilePage])

  const photoUrl = preview?.profilePhotoPath
    ? supabase.storage.from(BUCKET).getPublicUrl(preview.profilePhotoPath).data.publicUrl
    : undefined

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
            to="/recruiter/inbox"
            end
            className={({ isActive }) => `recruiter-sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Mail size={20} />
            <span>Inbox</span>
          </NavLink>
        </nav>
      </aside>
      {isProfilePage && (
        <aside className="recruiter-preview-panel">
          {preview && (
            <>
              <div className="recruiter-profile-preview-photo">
                {photoUrl ? <img src={photoUrl} alt="" /> : <span>Photo</span>}
              </div>
              <h2 className="recruiter-profile-preview-name">
                {preview.fullName.trim() || 'Recruiter Name'}
              </h2>
              <p className="recruiter-profile-preview-title">
                {preview.jobTitle.trim() || 'Job title'}
              </p>
              <div className="recruiter-profile-preview-row">
                <Building2 size={16} aria-hidden />
                <span>{preview.companyName || 'CompanyName'}</span>
              </div>
              <div className="recruiter-profile-preview-row">
                <MapPin size={16} aria-hidden />
                <span>{preview.location.trim() || 'San Francisco, CA'}</span>
              </div>
              {preview.specializations.length > 0 && (
                <div className="recruiter-profile-preview-specs">
                  {preview.specializations.map((s) => (
                    <span key={s} className="recruiter-profile-preview-spec-tag">{s}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </aside>
      )}
      <main className="recruiter-layout-main">
        <Outlet />
      </main>
    </div>
  )
}
