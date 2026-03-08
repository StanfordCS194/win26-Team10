import { useState, useEffect, useRef, useMemo } from 'react'
import { Upload, FileText, X, Check, AlertCircle, Loader2 } from 'lucide-react'
import { MAJORS, GRADUATION_YEARS, ALL_SKILLS, WORK_AUTH_OPTIONS } from '../types/student'
import { supabase } from '../lib/supabase'
import universities from '../data/universities.json'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface StudentProfile {
  firstName: string
  lastName: string
  school: string
  major: string
  graduationYear: string
  gpa: string
  skills: string[]
  workAuthorization?: string
  isComplete?: boolean
  updatedAt?: string
  latestReprPath?: string | null
  resumePath?: string | null
}

interface UploadedFile {
  name: string
  size: number
  type: string
  preview: string | null
}

type ParseJobResponse = { job_id: string; status: string; storage_path: string }
type JobStatusResponse = { job_id: string; status: string; storage_path?: string; error?: string }

type TranscriptCourse = {
  department: string
  number: string
  component?: string | null
  title?: string | null
  instructors?: string[] | null
  units_attempted?: number | null
  units_earned?: number | null
  grade?: string | null
  grade_points?: number | null
}
type TranscriptTerm = {
  name: string
  year?: string | null
  season?: string | null
  level?: string | null
  courses: TranscriptCourse[]
  statistics?: {
    term_gpa?: number | null
    cumulative_gpa?: number | null
    units_attempted?: number | null
    units_earned?: number | null
  } | null
}
type StandardizedTranscript = {
  schema_version: string
  source_format: string
  extracted_at: string
  student: { name: string; student_id?: string | null; additional?: Record<string, unknown> | null }
  institution: { name: string; location?: string | null; transcript_type?: string | null; print_date?: string | null }
  programs: Array<{ name: string; degree?: string | null; level?: string | null; status?: string | null; subplans?: string[] | null }>
  transfer_credits: Array<{ source: string; equivalency?: string | null; units?: number | null; applied_to?: string | null }>
  terms: TranscriptTerm[]
  career_totals?: {
    undergraduate?: { gpa?: number | null; units_attempted?: number | null; units_earned?: number | null } | null
    graduate?: { gpa?: number | null; units_attempted?: number | null; units_earned?: number | null } | null
  } | null
  notes?: string[] | null
}

const initialProfile: StudentProfile = {
  firstName: '',
  lastName: '',
  school: '',
  major: '',
  graduationYear: '',
  gpa: '',
  skills: [],
}

export default function StudentProfilePage() {
  const [tab, setTab] = useState<'profile' | 'settings' | 'transcript' | 'resume'>('profile')

  const [profile, setProfile] = useState<StudentProfile>(initialProfile)
  const [profileLoading, setProfileLoading] = useState(true)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [saveLoading, setSaveLoading] = useState(false)

  const [schoolInput, setSchoolInput] = useState('')
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false)
  const [filteredSchools, setFilteredSchools] = useState<string[]>([])
  const schoolInputRef = useRef<HTMLInputElement>(null)
  const schoolDropdownRef = useRef<HTMLDivElement>(null)

  const [skillInput, setSkillInput] = useState('')
  const [showSkillDropdown, setShowSkillDropdown] = useState(false)
  const skillDropdownRef = useRef<HTMLDivElement>(null)
  const skillInputRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [parseStatus, setParseStatus] = useState<string | null>(null)
  const [transcriptJson, setTranscriptJson] = useState<unknown>(null)
  const [transcriptStats, setTranscriptStats] = useState<unknown>(null)
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<unknown>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const [uploadedResume, setUploadedResume] = useState<UploadedFile | null>(null)
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  useEffect(() => {
    if (profile.school) setSchoolInput(profile.school)
  }, [profile.school])

  useEffect(() => {
    if (schoolInput.trim()) {
      const filtered = universities.filter((s) =>
        s.toLowerCase().includes(schoolInput.toLowerCase())
      )
      setFilteredSchools(filtered.slice(0, 10))
    } else {
      setFilteredSchools([])
    }
  }, [schoolInput])

  const filteredSkills = useMemo(() => {
    const q = skillInput.trim().toLowerCase()
    const selected = profile.skills || []
    if (!q) return []
    return ALL_SKILLS.filter(
      (s) => s.toLowerCase().includes(q) && !selected.includes(s)
    ).slice(0, 10)
  }, [skillInput, profile.skills])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        schoolDropdownRef.current && !schoolDropdownRef.current.contains(e.target as Node) &&
        schoolInputRef.current && !schoolInputRef.current.contains(e.target as Node)
      ) {
        setShowSchoolDropdown(false)
      }
      if (
        skillDropdownRef.current && !skillDropdownRef.current.contains(e.target as Node) &&
        skillInputRef.current && !skillInputRef.current.contains(e.target as Node)
      ) {
        setShowSkillDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (session?.user?.email) setEmail(session.user.email)
      if (!token) {
        setProfileLoading(false)
        return
      }
      const res = await fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setProfile({
          firstName: data.first_name ?? '',
          lastName: data.last_name ?? '',
          school: data.school ?? '',
          major: data.major ?? '',
          graduationYear: data.graduation_year ?? '',
          gpa: data.gpa != null ? String(data.gpa) : '',
          skills: data.skills ?? [],
          workAuthorization: data.work_authorization ?? '',
          isComplete: data.is_complete ?? false,
          updatedAt: data.updated_at,
          latestReprPath: data.latest_repr_path ?? null,
          resumePath: data.resume_path ?? null,
        })
        if (data.latest_repr_path) fetchTranscriptDetail(token)
        if (data.resume_path) {
          setUploadedResume({
            name: data.resume_path.split('/').pop() || 'resume',
            size: 0,
            type: data.resume_path.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            preview: null,
          })
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchTranscriptDetail = async (token: string) => {
    try {
      const detailRes = await fetch(`${API_BASE}/transcript/detail`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (detailRes.ok) {
        const detail = await detailRes.json()
        if (detail.transcript_raw) setTranscriptJson(detail.transcript_raw)
        if (detail.transcript_stats) setTranscriptStats(detail.transcript_stats)
        if (detail.transcript_analysis) setTranscriptAnalysis(detail.transcript_analysis)
        if (!detail.transcript_raw) {
          const transcriptRes = await fetch(`${API_BASE}/get_latest_transcript`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (transcriptRes.ok) {
            const raw = await transcriptRes.json()
            setTranscriptJson(typeof raw === 'string' ? JSON.parse(raw) : raw)
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch transcript detail:', err)
    }
  }

  const updateProfile = <K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }))
  }

  const addSkill = (skill: string) => {
    const allowed = [...ALL_SKILLS] as string[]
    if (!allowed.includes(skill) || (profile.skills || []).includes(skill)) return
    setProfile((p) => ({ ...p, skills: [...(p.skills || []), skill] }))
    setSkillInput('')
    setShowSkillDropdown(false)
  }

  const removeSkill = (skill: string) => {
    setProfile((p) => ({ ...p, skills: (p.skills || []).filter((s) => s !== skill) }))
  }

  const runParseFlow = async (file: File) => {
    setParseError(null)
    setTranscriptJson(null)
    setTranscriptStats(null)
    setTranscriptAnalysis(null)
    setParseStatus('uploading')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('You must be logged in to parse a transcript.')

    const form = new FormData()
    form.append('file', file)
    const parseRes = await fetch(`${API_BASE}/transcript/parse`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (!parseRes.ok) throw new Error(await parseRes.text())
    const parseBody = (await parseRes.json()) as ParseJobResponse
    setParseStatus(parseBody.status)

    while (true) {
      await new Promise((r) => setTimeout(r, 1500))
      const statusRes = await fetch(`${API_BASE}/transcript/parse/${parseBody.job_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!statusRes.ok) throw new Error(await statusRes.text())
      const statusBody = (await statusRes.json()) as JobStatusResponse
      setParseStatus(statusBody.status)
      if (statusBody.status === 'failed') throw new Error(statusBody.error ?? 'Parse failed')
      if (statusBody.status === 'succeeded') break
    }

    const detailRes = await fetch(`${API_BASE}/transcript/detail`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (detailRes.ok) {
      const detail = await detailRes.json()
      if (detail.transcript_raw) setTranscriptJson(detail.transcript_raw)
      if (detail.transcript_stats) setTranscriptStats(detail.transcript_stats)
      if (detail.transcript_analysis) setTranscriptAnalysis(detail.transcript_analysis)
      setParseStatus('done')
    } else {
      const transcriptRes = await fetch(`${API_BASE}/get_latest_transcript`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!transcriptRes.ok) throw new Error(await transcriptRes.text())
      const raw = await transcriptRes.json()
      setTranscriptJson(typeof raw === 'string' ? JSON.parse(raw) : raw)
      setParseStatus('done')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    const file = 'files' in e.target && e.target.files ? e.target.files[0] : 'dataTransfer' in e && e.dataTransfer.files ? e.dataTransfer.files[0] : undefined
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setParseError('Backend currently only accepts PDF files for parsing.')
      return
    }
    setUploadedFile({ name: file.name, size: file.size, type: file.type, preview: null })
    runParseFlow(file).catch((err) => {
      setParseStatus(null)
      setParseError(err?.message ? String(err.message) : String(err))
    })
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e) }

  const removeFile = () => {
    setUploadedFile(null)
    setParseStatus(null)
    setTranscriptJson(null)
    setTranscriptStats(null)
    setTranscriptAnalysis(null)
    setParseError(null)
  }

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fn = file.name.toLowerCase()
    if (!fn.endsWith('.pdf') && !fn.endsWith('.docx')) {
      setResumeError('Only PDF and DOCX files are supported')
      return
    }
    setUploadedResume({ name: file.name, size: file.size, type: file.type, preview: null })
    setResumeError(null)
    setResumeUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('You must be logged in to upload a resume.')
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_BASE}/upload_resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setProfile((p) => ({ ...p, resumePath: data.resume_path }))
      window.dispatchEvent(new CustomEvent('student-profile-saved'))
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Failed to upload resume')
      setUploadedResume(null)
    } finally {
      setResumeUploading(false)
    }
  }

  const removeResume = () => {
    setUploadedResume(null)
    setResumeError(null)
  }

  const handleSaveProfile = async () => {
    setValidationErrors([])
    const errors: string[] = []
    if (!profile.firstName) errors.push('First name is required')
    if (!profile.lastName) errors.push('Last name is required')
    if (!profile.school) errors.push('School is required')
    if (!profile.major) errors.push('Major is required')
    if (!profile.graduationYear) errors.push('Graduation year is required')
    if (!profile.gpa) errors.push('GPA is required')
    if ((profile.skills || []).length === 0) errors.push('At least one skill is required')
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    setSaveLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('You must be logged in to save your profile.')
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          first_name: profile.firstName,
          last_name: profile.lastName,
          school: profile.school,
          major: profile.major,
          graduation_year: profile.graduationYear,
          gpa: parseFloat(profile.gpa),
          skills: profile.skills || [],
          work_authorization: profile.workAuthorization || null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()
      setProfile((p) => ({ ...p, isComplete: updated.is_complete }))
      if (updated.is_complete) localStorage.setItem('profileCompleted', 'true')
      localStorage.setItem('studentProfile', JSON.stringify({
        firstName: profile.firstName,
        lastName: profile.lastName,
        school: profile.school,
        major: profile.major,
        graduationYear: profile.graduationYear,
        gpa: profile.gpa,
        workAuthorization: profile.workAuthorization || '',
      }))
      window.dispatchEvent(new CustomEvent('student-profile-saved'))
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const transcript = transcriptJson as StandardizedTranscript | null
  const stats = transcriptStats as {
    universal_scores?: { weighted_percentile?: number; weighted_gpa?: number }
    major_scores?: { weighted_percentile?: number; heuristic_note?: string }
  } | null
  const analysis = transcriptAnalysis as { topic_rating?: { program_performance?: string }; categories?: Record<string, { score: number }> } | null

  if (profileLoading) {
    return (
      <div className="student-profile-page">
        <p className="student-profile-loading">Loading profile…</p>
      </div>
    )
  }

  return (
    <div className="student-profile-page">
      <div className="student-profile-main">
        <h1 className="student-profile-title">Profile & Settings</h1>
        <div className="student-profile-tabs">
          <button type="button" className={`student-profile-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Profile</button>
          <button type="button" className={`student-profile-tab ${tab === 'transcript' ? 'active' : ''}`} onClick={() => setTab('transcript')}>Transcript</button>
          <button type="button" className={`student-profile-tab ${tab === 'resume' ? 'active' : ''}`} onClick={() => setTab('resume')}>Resume</button>
          <button type="button" className={`student-profile-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>Settings</button>
        </div>

        {tab === 'profile' && (
          <div className="student-profile-content">
            {validationErrors.length > 0 && (
              <div className="student-profile-error-box">
                <div className="student-profile-error-heading">
                  <AlertCircle size={20} /> Please fix the following errors:
                </div>
                <ul>
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="student-profile-form-section">
              <h2 className="student-profile-section-title">Personal Information</h2>
              <div className="student-profile-form-row">
                <div className="student-profile-field">
                  <label>First Name</label>
                  <input type="text" value={profile.firstName} onChange={(e) => updateProfile('firstName', e.target.value)} placeholder="John" />
                </div>
                <div className="student-profile-field">
                  <label>Last Name</label>
                  <input type="text" value={profile.lastName} onChange={(e) => updateProfile('lastName', e.target.value)} placeholder="Doe" />
                </div>
              </div>
              <div className="student-profile-field" style={{ position: 'relative' }}>
                <label>School</label>
                <input
                  ref={schoolInputRef}
                  type="text"
                  value={schoolInput}
                  onChange={(e) => { setSchoolInput(e.target.value); setShowSchoolDropdown(true) }}
                  onFocus={() => setShowSchoolDropdown(true)}
                  placeholder="Start typing your school name..."
                  autoComplete="off"
                />
                {showSchoolDropdown && filteredSchools.length > 0 && (
                  <div ref={schoolDropdownRef} className="student-profile-school-dropdown">
                    {filteredSchools.map((school) => (
                      <div
                        key={school}
                        onClick={() => { setSchoolInput(school); updateProfile('school', school); setShowSchoolDropdown(false) }}
                        className="student-profile-school-option"
                      >
                        {school}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="student-profile-form-row">
                <div className="student-profile-field">
                  <label>Major</label>
                  <select value={profile.major} onChange={(e) => updateProfile('major', e.target.value)}>
                    <option value="">Select major</option>
                    {MAJORS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="student-profile-field">
                  <label>Graduation Year</label>
                  <select value={profile.graduationYear} onChange={(e) => updateProfile('graduationYear', e.target.value)}>
                    <option value="">Select year</option>
                    {GRADUATION_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="student-profile-form-row">
                <div className="student-profile-field">
                  <label>GPA</label>
                  <input type="number" min={0} max={4} step={0.01} value={profile.gpa} onChange={(e) => updateProfile('gpa', e.target.value)} placeholder="3.50" />
                </div>
                <div className="student-profile-field">
                  <label>Work Authorization</label>
                  <select value={profile.workAuthorization ?? ''} onChange={(e) => updateProfile('workAuthorization', e.target.value)}>
                    <option value="">Select (optional)</option>
                    {WORK_AUTH_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="student-profile-form-section">
              <h2 className="student-profile-section-title">Skills</h2>
              <p className="student-profile-muted">Search and select from the list. Only predetermined options are saved.</p>
              <div className="student-profile-field" style={{ position: 'relative' }}>
                <input
                  ref={skillInputRef}
                  type="text"
                  value={skillInput}
                  onChange={(e) => { setSkillInput(e.target.value); setShowSkillDropdown(true) }}
                  onFocus={() => setShowSkillDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (filteredSkills.length > 0) addSkill(filteredSkills[0])
                    }
                  }}
                  placeholder="Search skills..."
                  autoComplete="off"
                  className="student-profile-skill-input"
                />
                {showSkillDropdown && (filteredSkills.length > 0 || skillInput.trim()) && (
                  <div ref={skillDropdownRef} className="student-profile-skill-dropdown">
                    {filteredSkills.length > 0 ? (
                      filteredSkills.map((skill) => (
                        <div
                          key={skill}
                          onClick={() => addSkill(skill)}
                          className="student-profile-skill-option"
                        >
                          {skill}
                        </div>
                      ))
                    ) : (
                      <div className="student-profile-skill-option student-profile-skill-no-match">
                        No matching skills. Choose from the list.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {((profile.skills || []).length > 0) && (
                <div className="student-profile-skills-tags">
                  {(profile.skills || []).map((skill) => (
                    <span key={skill} className="student-profile-skill-tag">
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="student-profile-skill-tag-remove"
                        aria-label={`Remove ${skill}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={handleSaveProfile} disabled={saveLoading} className="student-profile-save-btn">
              {saveLoading ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        )}

        {tab === 'settings' && (
          <div className="student-profile-content">
            <section className="student-settings-section">
              <h2 className="student-settings-section-title">Account</h2>
              <div className="student-profile-field">
                <label>Email</label>
                <input type="email" value={email ?? ''} readOnly disabled className="student-profile-input-readonly" />
              </div>
            </section>
            <section className="student-settings-section">
              <h2 className="student-settings-section-title">Password</h2>
              <form onSubmit={handleUpdatePassword} className="student-profile-form">
                <div className="student-profile-field">
                  <label htmlFor="settings-new-password">New password</label>
                  <input id="settings-new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
                </div>
                <div className="student-profile-field">
                  <label htmlFor="settings-confirm-password">Confirm new password</label>
                  <input id="settings-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" />
                </div>
                {passwordError && <p className="student-profile-error">{passwordError}</p>}
                {passwordSuccess && <p className="student-profile-success">Password updated.</p>}
                <button type="submit" disabled={passwordLoading} className="student-profile-save-btn">
                  {passwordLoading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </section>
            <section className="student-settings-section">
              <h2 className="student-settings-section-title">Notifications</h2>
              <p className="student-profile-muted">Notification preferences coming soon.</p>
            </section>
          </div>
        )}

        {tab === 'transcript' && (
          <div className="student-profile-content">
            <h2 className="student-profile-section-title">Transcript</h2>
            {profile.latestReprPath && !parseStatus && !uploadedFile && (
              <div className="student-profile-uploaded-badge">
                <FileText size={18} /> Transcript on file {profile.updatedAt && `(updated ${new Date(profile.updatedAt).toLocaleDateString()})`}
                <Check size={18} />
              </div>
            )}
            {!uploadedFile ? (
              <label
                className={`student-profile-upload-area ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload size={32} /> {isDragging ? 'Drop transcript here' : 'Click or drag to upload transcript'}
                <small>PDF (max 10MB)</small>
                <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            ) : (
              <div className="student-profile-uploaded-file">
                <div className="student-profile-file-info">
                  <FileText size={24} />
                  <div>
                    <p className="student-profile-file-name">{uploadedFile.name}</p>
                    <p className="student-profile-file-size">{formatFileSize(uploadedFile.size)}</p>
                  </div>
                </div>
                <div className="student-profile-file-actions">
                  {parseStatus === 'done' && <Check size={20} />}
                  <button type="button" onClick={removeFile} className="student-profile-remove-file" aria-label="Remove file"><X size={20} /></button>
                </div>
              </div>
            )}
            {parseError && <p className="student-profile-error">{parseError}</p>}
            {parseStatus && parseStatus !== 'done' && (
              <div className="student-profile-parse-status">
                <Loader2 className="animate-spin" size={20} />
                {parseStatus === 'uploading' ? 'Uploading…' : parseStatus === 'queued' ? 'Queued…' : parseStatus === 'running' ? 'Parsing…' : parseStatus}
              </div>
            )}
            {stats && (
              <div className="student-profile-stats-row">
                <h3 className="student-profile-section-title">Academic Performance</h3>
                <div className="student-profile-stats-cards">
                  <div className="student-profile-stat-card">
                    <span className="student-profile-stat-label">Universal Percentile</span>
                    <span className="student-profile-stat-value">{stats.universal_scores?.weighted_percentile ?? '—'}%</span>
                  </div>
                  <div className="student-profile-stat-card">
                    <span className="student-profile-stat-label">Major Percentile</span>
                    <span className="student-profile-stat-value">{stats.major_scores?.weighted_percentile ?? '—'}%</span>
                  </div>
                  <div className="student-profile-stat-card">
                    <span className="student-profile-stat-label">Weighted GPA</span>
                    <span className="student-profile-stat-value">{stats.universal_scores?.weighted_gpa?.toFixed(3) ?? '—'}</span>
                  </div>
                </div>
              </div>
            )}
            {transcript && (
              <div className="student-profile-transcript-detail">
                <h3 className="student-profile-section-title">Transcript Details</h3>
                {analysis?.topic_rating?.program_performance && (
                  <div className="student-profile-analysis-box">
                    <h4>Qualitative Analysis</h4>
                    <p>{analysis.topic_rating.program_performance}</p>
                    {analysis.categories && (
                      <div className="student-profile-analysis-categories">
                        {Object.entries(analysis.categories).map(([key, cat]) => (
                          <div key={key} className="student-profile-analysis-cat">
                            <span className="student-profile-analysis-cat-label">{key.replace(/_/g, ' ')}</span>
                            <span className="student-profile-analysis-cat-score">{cat.score}/10</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="student-profile-muted">Schema v{transcript.schema_version} • {transcript.extracted_at ? `Extracted ${new Date(transcript.extracted_at).toLocaleString()}` : 'Standardized Transcript'}</p>
                <div className="student-profile-form-row">
                  <div className="student-profile-field">
                    <label>Student</label>
                    <div className="student-profile-readonly-box">{transcript.student?.name ?? '—'}</div>
                  </div>
                  <div className="student-profile-field">
                    <label>Institution</label>
                    <div className="student-profile-readonly-box">{transcript.institution?.name ?? '—'}</div>
                  </div>
                </div>
                {transcript.terms?.length > 0 && (
                  <div className="student-profile-field">
                    <label>Terms & Courses</label>
                    <div className="student-profile-readonly-box student-profile-terms-box">
                      {transcript.terms.map((term, termIdx) => (
                        <div key={`${term.name}-${termIdx}`}>
                          <div className="student-profile-term-header">{term.name}</div>
                          <table className="student-profile-courses-table">
                            <thead>
                              <tr><th>Course</th><th>Title</th><th>Units</th><th>Grade</th></tr>
                            </thead>
                            <tbody>
                              {term.courses?.map((c, i) => (
                                <tr key={i}>
                                  <td>{c.department} {c.number}</td>
                                  <td>{c.title ?? '—'}</td>
                                  <td>{c.units_earned ?? c.units_attempted ?? '—'}</td>
                                  <td>{c.grade ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'resume' && (
          <div className="student-profile-content">
            <h2 className="student-profile-section-title">Resume</h2>
            <p className="student-profile-muted">Upload your resume (PDF or DOCX)</p>
            {profile.resumePath && !uploadedResume && (
              <div className="student-profile-uploaded-badge">
                <FileText size={18} /> Resume on file
                <Check size={18} />
              </div>
            )}
            {!uploadedResume ? (
              <label className="student-profile-upload-area">
                <Upload size={32} /> Click to upload resume
                <small>PDF or DOCX (max 10MB)</small>
                <input type="file" accept=".pdf,.docx" onChange={handleResumeUpload} style={{ display: 'none' }} />
              </label>
            ) : (
              <div className="student-profile-uploaded-file">
                <div className="student-profile-file-info">
                  <FileText size={24} />
                  <div>
                    <p className="student-profile-file-name">{uploadedResume.name}</p>
                    {uploadedResume.size > 0 && <p className="student-profile-file-size">{formatFileSize(uploadedResume.size)}</p>}
                  </div>
                </div>
                <div className="student-profile-file-actions">
                  {!resumeUploading && <Check size={20} />}
                  {resumeUploading && <Loader2 className="animate-spin" size={20} />}
                  <button type="button" onClick={removeResume} className="student-profile-remove-file" aria-label="Remove resume"><X size={20} /></button>
                </div>
              </div>
            )}
            {resumeError && <p className="student-profile-error">{resumeError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
