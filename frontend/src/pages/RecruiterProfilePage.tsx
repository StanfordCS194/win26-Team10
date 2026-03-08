import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SPECIALIZATION_OPTIONS = [
  'Engineering',
  'Product',
  'Design',
  'Data Science',
  'Marketing',
  'Sales',
  'Operations',
  'Finance',
  'HR',
  'Other',
]

type RecruiterProfileRow = {
  user_id: string
  full_name: string | null
  job_title: string | null
  location: string | null
  bio: string | null
  linkedin_url: string | null
  profile_photo_path: string | null
  specializations: string[] | null
}

type CompanyMembershipRow = {
  company_id: string
  companies: { id: string; name: string } | null
}

export default function RecruiterProfilePage() {
  const [tab, setTab] = useState<'profile' | 'settings'>('profile')

  // Session
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Profile data
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [location, setLocation] = useState('')
  const [bio, setBio] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [specializations, setSpecializations] = useState<string[]>([])

  // Loading & errors
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Settings: password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Load session, company, and recruiter profile
  useEffect(() => {
    let cancelled = false
    setProfileLoading(true)
    setProfileError(null)

    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const uid = session?.user?.id
        const em = session?.user?.email ?? null
        if (!cancelled) {
          setUserId(uid ?? null)
          setEmail(em ?? null)
        }
        if (!uid) {
          if (!cancelled) setProfileError('You must be signed in.')
          return
        }

        const { data: membership, error: membershipError } = await supabase
          .from('company_memberships')
          .select('company_id, companies(id, name)')
          .eq('user_id', uid)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle()

        if (membershipError) throw membershipError
        const m = membership as CompanyMembershipRow | null
        if (!cancelled) setCompanyName(m?.companies?.name ?? null)

        const { data: profile, error: profileErr } = await supabase
          .from('recruiter_profiles')
          .select('user_id, full_name, job_title, location, bio, linkedin_url, profile_photo_path, specializations')
          .eq('user_id', uid)
          .maybeSingle()

        if (profileErr) throw profileErr
        const p = profile as RecruiterProfileRow | null
        if (!cancelled && p) {
          setFullName(p.full_name ?? '')
          setJobTitle(p.job_title ?? '')
          setLocation(p.location ?? '')
          setBio(p.bio ?? '')
          setLinkedinUrl(p.linkedin_url ?? '')
          setSpecializations(Array.isArray(p.specializations) ? p.specializations : [])
        }
      } catch (e) {
        if (!cancelled) setProfileError(e instanceof Error ? e.message : 'Failed to load profile.')
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [])

  const toggleSpecialization = (s: string) => {
    setSpecializations((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setSaveLoading(true)
    setSaveError(null)
    try {
      const { error } = await supabase.from('recruiter_profiles').upsert(
        {
          user_id: userId,
          full_name: fullName || null,
          job_title: jobTitle || null,
          location: location || null,
          bio: bio || null,
          linkedin_url: linkedinUrl || null,
          profile_photo_path: null,
          specializations: specializations.length ? specializations : [],
        },
        { onConflict: 'user_id' }
      )
      if (error) throw error
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save profile.')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    setPasswordLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Failed to update password.')
    } finally {
      setPasswordLoading(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="recruiter-profile-page">
        <p className="recruiter-profile-loading">Loading profile…</p>
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="recruiter-profile-page">
        <p className="recruiter-profile-error">{profileError}</p>
      </div>
    )
  }

  return (
    <div className="recruiter-profile-page">
      <h1 className="recruiter-profile-title">Profile & Settings</h1>
      <div className="recruiter-profile-tabs">
        <button
          type="button"
          className={`recruiter-profile-tab ${tab === 'profile' ? 'active' : ''}`}
          onClick={() => setTab('profile')}
        >
          Profile
        </button>
        <button
          type="button"
          className={`recruiter-profile-tab ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
      </div>

      {tab === 'profile' && (
        <div className="recruiter-profile-content">
          <form onSubmit={handleSaveProfile} className="recruiter-profile-form">
            <div className="recruiter-profile-photo-row">
              <div className="recruiter-profile-photo-placeholder">
                <span>Photo</span>
              </div>
              <div>
                <button type="button" className="recruiter-profile-upload-btn" disabled>
                  Upload photo
                </button>
                <p className="recruiter-profile-photo-hint">JPG or PNG, max 2MB</p>
              </div>
            </div>

            <div className="recruiter-profile-field">
              <label htmlFor="profile-full-name">Full name</label>
              <input
                id="profile-full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="recruiter-profile-field">
              <label htmlFor="profile-job-title">Job title</label>
              <input
                id="profile-job-title"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Technical Recruiter"
              />
            </div>
            <div className="recruiter-profile-field">
              <label>Company</label>
              <input
                type="text"
                value={companyName ?? ''}
                readOnly
                disabled
                placeholder="Linked from your account"
                className="recruiter-profile-input-readonly"
              />
            </div>
            <div className="recruiter-profile-field">
              <label htmlFor="profile-location">Location</label>
              <input
                id="profile-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA"
              />
            </div>
            <div className="recruiter-profile-field">
              <label htmlFor="profile-bio">Bio</label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short bio"
                rows={3}
              />
            </div>
            <div className="recruiter-profile-field">
              <label htmlFor="profile-linkedin">LinkedIn URL</label>
              <input
                id="profile-linkedin"
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="recruiter-profile-field">
              <label>Specializations</label>
              <div className="recruiter-profile-specializations">
                {SPECIALIZATION_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`recruiter-profile-spec-tag ${specializations.includes(s) ? 'active' : ''}`}
                    onClick={() => toggleSpecialization(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {saveError && <p className="recruiter-profile-error">{saveError}</p>}
            <button type="submit" className="recruiter-profile-save-btn" disabled={saveLoading}>
              {saveLoading ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </div>
      )}

      {tab === 'settings' && (
        <div className="recruiter-profile-content">
          <section className="recruiter-settings-section">
            <h2 className="recruiter-settings-section-title">Account</h2>
            <div className="recruiter-profile-field">
              <label>Email</label>
              <input
                type="email"
                value={email ?? ''}
                readOnly
                disabled
                className="recruiter-profile-input-readonly"
              />
            </div>
          </section>

          <section className="recruiter-settings-section">
            <h2 className="recruiter-settings-section-title">Password</h2>
            <form onSubmit={handleUpdatePassword} className="recruiter-profile-form">
              <div className="recruiter-profile-field">
                <label htmlFor="settings-new-password">New password</label>
                <input
                  id="settings-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="recruiter-profile-field">
                <label htmlFor="settings-confirm-password">Confirm new password</label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>
              {passwordError && <p className="recruiter-profile-error">{passwordError}</p>}
              {passwordSuccess && <p className="recruiter-profile-success">Password updated.</p>}
              <button type="submit" className="recruiter-profile-save-btn" disabled={passwordLoading}>
                {passwordLoading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </section>

          <section className="recruiter-settings-section">
            <h2 className="recruiter-settings-section-title">Notifications</h2>
            <p className="recruiter-profile-muted">Notification preferences coming soon.</p>
          </section>
        </div>
      )}
    </div>
  )
}
