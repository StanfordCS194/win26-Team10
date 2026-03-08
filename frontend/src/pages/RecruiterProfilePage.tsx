import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'

const BUCKET = 'recruiter-photos'
const MAX_PHOTO_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

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
  const [specializations, setSpecializations] = useState<string[]>([])
  const [specInput, setSpecInput] = useState('')
  const [profilePhotoPath, setProfilePhotoPath] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
          .select('user_id, full_name, job_title, location, profile_photo_path, specializations')
          .eq('user_id', uid)
          .maybeSingle()

        if (profileErr) throw profileErr
        const p = profile as RecruiterProfileRow | null
        if (!cancelled && p) {
          setFullName(p.full_name ?? '')
          setJobTitle(p.job_title ?? '')
          setLocation(p.location ?? '')
          setSpecializations(Array.isArray(p.specializations) ? p.specializations : [])
          setProfilePhotoPath(p.profile_photo_path ?? null)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string')
              ? (e as { message: string }).message
              : e instanceof Error
                ? e.message
                : 'Failed to load profile.'
          setProfileError(message)
        }
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [])

  const addSpecialization = () => {
    const v = specInput.trim()
    if (!v || specializations.includes(v)) return
    setSpecializations((prev) => [...prev, v])
    setSpecInput('')
  }

  const removeSpecialization = (s: string) => {
    setSpecializations((prev) => prev.filter((x) => x !== s))
  }

  const handleSpecKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSpecialization()
    }
  }

  function getPhotoUrl(): string | null {
    if (!profilePhotoPath || !userId) return null
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(profilePhotoPath)
    return data.publicUrl
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !userId) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoError('Please choose a JPG or PNG image.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(`Image must be ${MAX_PHOTO_BYTES / (1024 * 1024)}MB or smaller.`)
      return
    }
    setPhotoError(null)
    setPhotoUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/avatar.${ext}`
    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      setProfilePhotoPath(path)
      const { error: updateError } = await supabase
        .from('recruiter_profiles')
        .upsert({ user_id: userId, profile_photo_path: path }, { onConflict: 'user_id' })
      if (updateError) throw updateError
    } catch (err: unknown) {
      const msg =
        (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string')
          ? (err as { message: string }).message
          : 'Failed to upload photo.'
      setPhotoError(msg)
    } finally {
      setPhotoUploading(false)
    }
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
          profile_photo_path: profilePhotoPath || null,
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
        {profileError.includes('recruiter_profiles') && (
          <p className="recruiter-profile-muted" style={{ marginTop: '0.5rem' }}>
            If you use Supabase migrations, run the migration that creates the recruiter_profiles table (e.g. 20260309000001_add_recruiter_profiles.sql).
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="recruiter-profile-page">
      <div className="recruiter-profile-main">
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
                {getPhotoUrl() ? (
                  <img src={getPhotoUrl()!} alt="" className="recruiter-profile-photo-img" />
                ) : (
                  <span>Photo</span>
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="recruiter-profile-file-input"
                  onChange={handlePhotoChange}
                  aria-label="Upload profile photo"
                />
                <button
                  type="button"
                  className="recruiter-profile-upload-btn"
                  disabled={photoUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoUploading ? 'Uploading…' : 'Upload photo'}
                </button>
                {photoError && <p className="recruiter-profile-error">{photoError}</p>}
                <p className="recruiter-profile-photo-hint">JPG/JPEG or PNG, max 10MB</p>
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
              <label>Specializations</label>
              <div className="recruiter-profile-spec-input-wrap">
                <input
                  type="text"
                  value={specInput}
                  onChange={(e) => setSpecInput(e.target.value)}
                  onKeyDown={handleSpecKeyDown}
                  placeholder="Type and press Enter to add"
                  className="recruiter-profile-spec-input"
                />
                <button type="button" className="recruiter-profile-spec-add-btn" onClick={addSpecialization}>
                  Add
                </button>
              </div>
              <div className="recruiter-profile-specializations">
                {specializations.map((s) => (
                  <span key={s} className="recruiter-profile-spec-tag">
                    {s}
                    <button
                      type="button"
                      className="recruiter-profile-spec-remove"
                      onClick={() => removeSpecialization(s)}
                      aria-label={`Remove ${s}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
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
    </div>
  )
}
