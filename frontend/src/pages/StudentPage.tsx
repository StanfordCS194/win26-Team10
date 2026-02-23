import { useState } from 'react'
import { Upload, FileText, X, Check, Plus } from 'lucide-react'
import { MAJORS, GRADUATION_YEARS, ALL_SKILLS } from '../types/student'
import { supabase } from '../lib/supabase'

interface StudentProfile {
  firstName: string
  lastName: string
  email: string
  major: string
  graduationYear: string
  gpa: string
  skills: string[]
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

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://api-production-d25a.up.railway.app'

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
  email: '',
  major: '',
  graduationYear: '',
  gpa: '',
  skills: [],
}

export default function StudentPage() {
  const [profile, setProfile] = useState<StudentProfile>(initialProfile)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [uploadedPdfFile, setUploadedPdfFile] = useState<File | null>(null)
  const [saved, setSaved] = useState(false)

  // Parse/job state
  const [jobId, setJobId] = useState<string | null>(null)
  const [parseStatus, setParseStatus] = useState<string | null>(null)
  const [transcriptJson, setTranscriptJson] = useState<any>(null)
  const [parseError, setParseError] = useState<string | null>(null)

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
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
        name: file.name,
        size: file.size,
        type: file.type,
        preview: null,
      })
      setSaved(false)
    }
    reader.readAsDataURL(file)
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

  const handleSave = () => {
    console.log('Saving profile:', profile)
    console.log('Uploaded file:', uploadedFile)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
        <h1 className="page-title">Student Profile</h1>
        <p className="page-description">
          Fill in your information and upload your transcript to be visible to recruiters.
        </p>

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

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => updateProfile('email', e.target.value)}
              className="input"
              placeholder="john.doe@stanford.edu"
            />
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

          {!uploadedFile ? (
            <label className="upload-area">
              <Upload size={32} />
              <span>Click to upload transcript</span>
              <small>PDF (max 10MB)</small>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
              />
            </label>
          ) : (
            <div className="uploaded-file">
              <div className="file-info">
                <FileText size={24} />
                <div>
                  <p className="file-name">{uploadedFile.name}</p>
                  <p className="file-size">{formatFileSize(uploadedFile.size)}</p>
                </div>
              </div>
              <button onClick={removeFile} className="remove-file-btn">
                <X size={20} />
              </button>
            </div>
          )}

          {/* Parse status + results */}
          {parseError && <p className="section-description" style={{ color: 'crimson' }}>{parseError}</p>}
          {parseStatus && (
            <p className="section-description">
              Parse status: <strong>{parseStatus}</strong>
            </p>
          )}

          {/* Parse action (separate from file selection) */}
          {uploadedPdfFile && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => {
                  runParseFlow(uploadedPdfFile).catch((err) => {
                    setParseStatus(null)
                    setParseError(err?.message ? String(err.message) : String(err))
                  })
                }}
                className="save-btn primary"
                disabled={parseStatus === 'uploading' || parseStatus === 'queued' || parseStatus === 'running'}
              >
                Parse transcript
              </button>
            </div>
          )}

          {/* Nicely formatted transcript view */}
          {transcript && (
            <div style={{ marginTop: 16 }}>
              <div className="form-section" style={{ padding: 0, border: 'none' }}>
                <h3 className="section-title" style={{ marginBottom: 8 }}>Parsed Results</h3>
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

                {/* Raw fallback */}
                <details style={{ marginTop: 12 }}>
                  <summary style={{ cursor: 'pointer' }}>View raw JSON</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                    {JSON.stringify(transcriptJson, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          )}
        </section>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className={`save-btn ${saved ? 'success' : 'primary'}`}
        >
          {saved ? (
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
