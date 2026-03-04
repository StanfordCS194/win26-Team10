import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, X, Check, Plus, AlertCircle, Loader2 } from 'lucide-react'
import { MAJORS, GRADUATION_YEARS, ALL_SKILLS } from '../types/student'
import { supabase } from '../lib/supabase'
import universities from '../data/universities.json'

interface StudentProfile {
  firstName: string
  lastName: string
  school: string
  major: string
  graduationYear: string
  gpa: string
  skills: string[]
  isComplete?: boolean
  updatedAt?: string
  latestReprPath?: string
}

interface UploadedFile {
  name: string
  size: number
  type: string
  preview: string | null
}

type ParseJobResponse = {
  job_id: string
  status: string
  storage_path: string
}

type JobStatusResponse = {
  job_id: string
  status: string
  storage_path?: string
  error?: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Minimal typing for the standardized transcript (docs/TRANSCRIPT_SCHEMA.md)
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
  student: { name: string; student_id?: string | null; additional?: Record<string, any> | null }
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

export default function StudentPage() {
  const [profile, setProfile] = useState<StudentProfile>(initialProfile)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  //const [uploadedPdfFile, setUploadedPdfFile] = useState<File | null>(null)
  const setUploadedPdfFile = useState<File | null>(null)[1]
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()

  // Parse/job state
  //const [jobId, setJobId] = useState<string | null>(null)
  const setJobId = useState<string | null>(null)[1]
  const [parseStatus, setParseStatus] = useState<string | null>(null)
  const [transcriptJson, setTranscriptJson] = useState<any>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // School autocomplete state
  const [schoolInput, setSchoolInput] = useState('')
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false)
  const [filteredSchools, setFilteredSchools] = useState<string[]>([])
  const schoolInputRef = useRef<HTMLInputElement>(null)
  const schoolDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  // Initialize school input when profile loads
  useEffect(() => {
    if (profile.school) {
      setSchoolInput(profile.school)
    }
  }, [profile.school])

  // Filter schools based on input
  useEffect(() => {
    if (schoolInput.trim()) {
      const filtered = universities.filter((school) =>
        school.toLowerCase().includes(schoolInput.toLowerCase())
      )
      setFilteredSchools(filtered.slice(0, 10)) // Show max 10 results
    } else {
      setFilteredSchools([])
    }
  }, [schoolInput])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        schoolDropdownRef.current &&
        !schoolDropdownRef.current.contains(event.target as Node) &&
        schoolInputRef.current &&
        !schoolInputRef.current.contains(event.target as Node)
      ) {
        setShowSchoolDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const res = await fetch(`${API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setProfile({
          firstName: data.first_name ?? '',
          lastName: data.last_name ?? '',
          school: data.school ?? '',
          major: data.major ?? '',
          graduationYear: data.graduation_year ?? '',
          gpa: data.gpa ? String(data.gpa) : '',
          skills: data.skills ?? [],
          isComplete: data.is_complete ?? false,
          updatedAt: data.updated_at,
          latestReprPath: data.latest_repr_path,
        })
        if (data.latest_repr_path) {
          fetchTranscript(token)
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    }
  }

  const fetchTranscript = async (token: string) => {
    try {
      const transcriptRes = await fetch(`${API_BASE}/get_latest_transcript`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (transcriptRes.ok) {
        const raw = await transcriptRes.json()
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        setTranscriptJson(parsed)
      }
    } catch (err) {
      console.error('Failed to fetch transcript:', err)
    }
  }

  const updateProfile = <K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) => {
    setProfile({ ...profile, [key]: value })
    setSaved(false)
  }

  const toggleSkill = (skill: string) => {
    const newSkills = profile.skills.includes(skill)
      ? profile.skills.filter((s) => s !== skill)
      : [...profile.skills, skill]
    updateProfile('skills', newSkills)
  }

  const runParseFlow = async (file: File) => {
    setParseError(null)
    setTranscriptJson(null)
    setJobId(null)
    setParseStatus('uploading')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      throw new Error('You must be logged in to parse a transcript.')
    }

    // 1) Upload PDF → POST /parse (multipart form field name: "file")
    const form = new FormData()
    form.append('file', file)

    const parseRes = await fetch(`${API_BASE}/parse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    })

    if (!parseRes.ok) {
      throw new Error(await parseRes.text())
    }

    const parseBody = (await parseRes.json()) as ParseJobResponse
    setJobId(parseBody.job_id)
    setParseStatus(parseBody.status)

    // 2) Poll status until succeeded/failed
    while (true) {
      await new Promise((r) => setTimeout(r, 1500))

      const statusRes = await fetch(`${API_BASE}/parse/${parseBody.job_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!statusRes.ok) {
        throw new Error(await statusRes.text())
      }

      const statusBody = (await statusRes.json()) as JobStatusResponse
      setParseStatus(statusBody.status)

      if (statusBody.status === 'failed') {
        throw new Error(statusBody.error ?? 'Parse failed')
      }
      if (statusBody.status === 'succeeded') {
        break
      }
    }

    // 3) Fetch transcript JSON
    const transcriptRes = await fetch(`${API_BASE}/get_latest_transcript`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!transcriptRes.ok) {
      throw new Error(await transcriptRes.text())
    }

    // backend currently returns JSONResponse(content=<string>), so handle both string and object
    const raw = await transcriptRes.json()
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    setTranscriptJson(parsed)
    setParseStatus('done')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0]
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      file = e.dataTransfer.files[0]
    }

    if (!file) return

    // Backend currently only accepts PDFs
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setParseError('Backend currently only accepts PDF files for parsing.')
      return
    }

    setUploadedPdfFile(file)

    // Keep showing the selected file in UI
    const reader = new FileReader()
    reader.onload = () => {
      setUploadedFile({
        name: file!.name,
        size: file!.size,
        type: file!.type,
        preview: null,
      })
      setSaved(false)
      // Automatically start parsing
      runParseFlow(file!).catch((err) => {
        setParseStatus(null)
        setParseError(err?.message ? String(err.message) : String(err))
      })
    }
    reader.readAsDataURL(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e)
  }

  const removeFile = () => {
    setUploadedFile(null)
    setUploadedPdfFile(null)
    setSaved(false)
    setJobId(null)
    setParseStatus(null)
    setTranscriptJson(null)
    setParseError(null)
  }

  const handleSave = async () => {
    setValidationErrors([])
    const errors: string[] = []

    if (!profile.firstName) errors.push('First name is required')
    if (!profile.lastName) errors.push('Last name is required')
    if (!profile.school) errors.push('School is required')
    if (!profile.major) errors.push('Major is required')
    if (!profile.graduationYear) errors.push('Graduation year is required')
    if (!profile.gpa) errors.push('GPA is required')
    if (profile.skills.length === 0) errors.push('At least one skill is required')

    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('You must be logged in to save your profile.')

      const res = await fetch(`${API_BASE}/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: profile.firstName,
          last_name: profile.lastName,
          school: profile.school,
          major: profile.major,
          graduation_year: profile.graduationYear,
          gpa: parseFloat(profile.gpa),
          skills: profile.skills,
        }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const updated = await res.json()
      setProfile({
        ...profile,
        isComplete: updated.is_complete,
      })
      setSaved(true)
      localStorage.setItem('studentProfile', JSON.stringify({
        firstName: profile.firstName,
        lastName: profile.lastName,
        school: profile.school,
        major: profile.major,
        graduationYear: profile.graduationYear,
        gpa: profile.gpa,
      }))
      setTimeout(() => {
        navigate('/student/dashboard')
      }, 500)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const transcript = transcriptJson as StandardizedTranscript | null

  return (
    <div className="student-page">
      <div className="student-page-container">
        <h1 className="page-title">
          Student Profile
          {profile.isComplete && (
            <span className="badge success" style={{ marginLeft: 12, fontSize: '0.5em', verticalAlign: 'middle' }}>
              <Check size={14} style={{ marginRight: 4 }} />
              Complete
            </span>
          )}
        </h1>
        <p className="page-description">
          Fill in your information and upload your transcript to be visible to recruiters.
        </p>

        {validationErrors.length > 0 && (
          <div className="error-box" style={{ marginBottom: 24, padding: 16, backgroundColor: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#c53030', marginBottom: 8, fontWeight: 600 }}>
              <AlertCircle size={20} style={{ marginRight: 8 }} />
              Please fix the following errors:
            </div>
            <ul style={{ margin: 0, paddingLeft: 24, color: '#c53030' }}>
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Personal Information */}
        <section className="form-section">
          <h2 className="section-title">Personal Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => updateProfile('firstName', e.target.value)}
                className="input"
                placeholder="John"
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => updateProfile('lastName', e.target.value)}
                className="input"
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <label>School</label>
            <input
              ref={schoolInputRef}
              type="text"
              value={schoolInput}
              onChange={(e) => {
                setSchoolInput(e.target.value)
                setShowSchoolDropdown(true)
              }}
              onFocus={() => setShowSchoolDropdown(true)}
              className="input"
              placeholder="Start typing your school name..."
              autoComplete="off"
            />
            {showSchoolDropdown && filteredSchools.length > 0 && (
              <div
                ref={schoolDropdownRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginTop: '4px',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  zIndex: 1000,
                }}
              >
                {filteredSchools.map((school) => (
                  <div
                    key={school}
                    onClick={() => {
                      setSchoolInput(school)
                      updateProfile('school', school)
                      setShowSchoolDropdown(false)
                    }}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white'
                    }}
                  >
                    {school}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Major</label>
              <select
                value={profile.major}
                onChange={(e) => updateProfile('major', e.target.value)}
                className="select"
              >
                <option value="">Select major</option>
                {MAJORS.map((major) => (
                  <option key={major} value={major}>
                    {major}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Graduation Year</label>
              <select
                value={profile.graduationYear}
                onChange={(e) => updateProfile('graduationYear', e.target.value)}
                className="select"
              >
                <option value="">Select year</option>
                {GRADUATION_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>GPA</label>
            <input
              type="number"
              min="0"
              max="4"
              step="0.01"
              value={profile.gpa}
              onChange={(e) => updateProfile('gpa', e.target.value)}
              className="input input-small"
              placeholder="3.50"
            />
          </div>
        </section>

        {/* Skills */}
        <section className="form-section">
          <h2 className="section-title">Skills</h2>
          <p className="section-description">
            Select the skills that best describe your expertise.
          </p>
          <div className="skills-selection">
            {ALL_SKILLS.map((skill) => {
              const isSelected = profile.skills.includes(skill)
              return (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`skill-btn ${isSelected ? 'selected' : ''}`}
                >
                  {isSelected ? <Check size={14} /> : <Plus size={14} />}
                  {skill}
                </button>
              )
            })}
          </div>
        </section>

        {/* Transcript Upload */}
        <section className="form-section">
          <h2 className="section-title">Transcript</h2>
          
          {profile.latestReprPath && !parseStatus && !uploadedFile && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '10px 16px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bcf0da',
              marginBottom: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="#16a34a" />
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#16a34a' }}>
                  Transcript on file (updated {new Date(profile.updatedAt!).toLocaleDateString()})
                </span>
              </div>
              <Check size={18} color="#16a34a" />
            </div>
          )}

          {!uploadedFile ? (
            <label 
              className={`upload-area ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragging ? '2px dashed #4a90e2' : '2px dashed #ccc',
                backgroundColor: isDragging ? '#f0f7ff' : 'transparent',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                borderRadius: '8px',
                gap: '8px'
              }}
            >
              <Upload size={32} color={isDragging ? '#4a90e2' : '#666'} />
              <span style={{ color: isDragging ? '#4a90e2' : 'inherit', fontWeight: 500 }}>
                {isDragging ? 'Drop transcript here' : 'Click or drag to upload transcript'}
              </span>
              <small style={{ color: '#666' }}>PDF (max 10MB)</small>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          ) : (
            <div className="uploaded-file" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div className="file-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 8, 
                  backgroundColor: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: '1px solid #e2e8f0'
                }}>
                  <FileText size={24} color="#4a90e2" />
                </div>
                <div>
                  <p className="file-name" style={{ margin: 0, fontWeight: 500, color: '#1e293b' }}>{uploadedFile.name}</p>
                  <p className="file-size" style={{ margin: 0, fontSize: '0.85em', color: '#64748b' }}>{formatFileSize(uploadedFile.size)}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {parseStatus === 'done' && <Check size={20} color="#10b981" />}
                <button 
                  onClick={removeFile} 
                  className="remove-file-btn"
                  style={{
                    padding: 8,
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    transition: 'all 0.2s'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Parse status + results */}
          {parseError && <p className="section-description" style={{ color: 'crimson', marginTop: 8 }}>{parseError}</p>}
          {parseStatus && parseStatus !== 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: '#4a90e2' }}>
              <Loader2 className="animate-spin" size={20} />
              <p className="section-description" style={{ margin: 0 }}>
                {parseStatus === 'uploading' ? 'Uploading...' : 
                 parseStatus === 'queued' ? 'Queued for processing...' : 
                 parseStatus === 'running' ? 'Parsing transcript...' : 
                 `Status: ${parseStatus}`}
              </p>
            </div>
          )}

          {/* Nicely formatted transcript view */}
          {transcript && (
            <div style={{ marginTop: 16 }}>
              <div className="form-section" style={{ padding: 0, border: 'none' }}>
                <h3 className="section-title" style={{ marginBottom: 8 }}>Transcript Parse</h3>
                <p className="section-description" style={{ marginTop: 0 }}>
                  Schema v{transcript.schema_version} • Extracted {new Date(transcript.extracted_at).toLocaleString()}
                </p>

                {/* Summary cards */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Student</label>
                    <div className="input" style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{transcript.student?.name ?? '—'}</div>
                      {transcript.student?.student_id && (
                        <div style={{ opacity: 0.8, marginTop: 4 }}>ID: {transcript.student.student_id}</div>
                      )}
                    </div>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Institution</label>
                    <div className="input" style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{transcript.institution?.name ?? '—'}</div>
                      {transcript.institution?.transcript_type && (
                        <div style={{ opacity: 0.8, marginTop: 4 }}>{transcript.institution.transcript_type}</div>
                      )}
                      {transcript.institution?.print_date && (
                        <div style={{ opacity: 0.8, marginTop: 4 }}>Printed: {transcript.institution.print_date}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Programs + totals */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Programs</label>
                    <div className="input" style={{ padding: 12 }}>
                      {transcript.programs?.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {transcript.programs.map((p, idx) => (
                            <li key={`${p.name}-${idx}`}>
                              {p.degree ? `${p.degree} ` : ''}
                              {p.name}
                              {p.level ? ` (${p.level})` : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ opacity: 0.8 }}>—</div>
                      )}
                    </div>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Career Totals</label>
                    <div className="input" style={{ padding: 12 }}>
                      {transcript.career_totals?.undergraduate?.gpa != null ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            UG GPA: {Number(transcript.career_totals.undergraduate.gpa).toFixed(3)}
                          </div>
                          <div style={{ opacity: 0.8, marginTop: 4 }}>
                            Units: {transcript.career_totals.undergraduate.units_earned ?? '—'} earned /{' '}
                            {transcript.career_totals.undergraduate.units_attempted ?? '—'} attempted
                          </div>
                        </div>
                      ) : (
                        <div style={{ opacity: 0.8 }}>—</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Terms */}
                <div className="form-group">
                  <label>Terms & Courses</label>
                  <div className="input" style={{ padding: 12 }}>
                    {transcript.terms?.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {transcript.terms.map((term, termIdx) => (
                          <div key={`${term.name}-${termIdx}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 600 }}>{term.name}</div>
                              {term.statistics && (
                                <div style={{ opacity: 0.85 }}>
                                  {term.statistics.term_gpa != null && (
                                    <span>Term GPA: {Number(term.statistics.term_gpa).toFixed(3)}</span>
                                  )}
                                  {term.statistics.cumulative_gpa != null && (
                                    <span>{term.statistics.term_gpa != null ? ' • ' : ''}Cum GPA: {Number(term.statistics.cumulative_gpa).toFixed(3)}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div style={{ overflowX: 'auto', marginTop: 8 }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ textAlign: 'left', opacity: 0.9 }}>
                                    <th style={{ padding: '6px 8px' }}>Course</th>
                                    <th style={{ padding: '6px 8px' }}>Title</th>
                                    <th style={{ padding: '6px 8px' }}>Units</th>
                                    <th style={{ padding: '6px 8px' }}>Grade</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {term.courses?.length ? (
                                    term.courses.map((c, courseIdx) => (
                                      <tr key={`${c.department}-${c.number}-${courseIdx}`} style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                                          {c.department} {c.number}
                                          {c.component ? ` (${c.component})` : ''}
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>{c.title ?? '—'}</td>
                                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                                          {c.units_earned ?? c.units_attempted ?? '—'}
                                        </td>
                                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{c.grade ?? '—'}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={4} style={{ padding: '6px 8px', opacity: 0.8 }}>
                                        No courses found for this term.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ opacity: 0.8 }}>No terms found.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className={`save-btn ${saved ? 'success' : 'primary'}`}
        >
          {loading ? (
            'Saving...'
          ) : saved ? (
            <>
              <Check size={20} />
              Saved!
            </>
          ) : (
            'Save Profile'
          )}
        </button>
      </div>
    </div>
  )
}
