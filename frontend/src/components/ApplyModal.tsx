import { useState } from 'react'
import { X, Send, Briefcase } from 'lucide-react'
import { supabase } from '../lib/supabase'

const EEO_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic or Latino',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Decline to answer',
] as const

const WORK_AUTH_OPTIONS = [
  'US Citizen or National',
  'Permanent Resident (Green Card)',
  'H-1B Visa',
  'F-1 / OPT',
  'Other work authorization',
  'Decline to answer',
] as const

const DISABILITY_OPTIONS = [
  'Yes, I have a disability (or previously had a disability)',
  'No, I don\'t have a disability',
  'Decline to answer',
] as const

const VETERAN_OPTIONS = [
  'I am a veteran',
  'I am not a veteran',
  'Decline to answer',
] as const

const MAX_MESSAGE_WORDS = 200

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

interface Job {
  id: string
  title: string
  company: string
  location: string
}

interface ApplyModalProps {
  job: Job
  onClose: () => void
  onSuccess: () => void
  studentId: string
}

function parseLocations(locationText: string): string[] {
  if (!locationText?.trim()) return []
  const s = locationText.trim()
  if (s.includes(' | ')) return s.split(' | ').map(x => x.trim()).filter(Boolean)
  if (s.includes('; ')) return s.split('; ').map(x => x.trim()).filter(Boolean)
  return [s]
}

export default function ApplyModal({
  job,
  onClose,
  onSuccess,
  studentId,
}: ApplyModalProps) {
  const locations = parseLocations(job.location)
  const hasMultipleLocations = locations.length > 1

  const [eeo, setEeo] = useState<string>('')
  const [workAuth, setWorkAuth] = useState<string>('')
  const [disability, setDisability] = useState<string>('')
  const [veteran, setVeteran] = useState<string>('')
  const [locationPreference, setLocationPreference] = useState<string>(
    hasMultipleLocations ? locations[0] : ''
  )
  const [messageToRecruiter, setMessageToRecruiter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const messageWordCount = countWords(messageToRecruiter)

  const validateForm = (e: React.FormEvent): boolean => {
    e.preventDefault()
    if (!eeo) {
      setError('Please select a Race/Ethnicity.')
      return false
    }
    if (!workAuth) {
      setError('Please select a Visa / Work Authorization.')
      return false
    }
    if (!disability) {
      setError('Please select a Disability Status.')
      return false
    }
    if (!veteran) {
      setError('Please select a Veteran Status.')
      return false
    }
    if (messageWordCount > MAX_MESSAGE_WORDS) {
      setError(`Message must be ${MAX_MESSAGE_WORDS} words or fewer.`)
      return false
    }
    setError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm(e)) return

    setSubmitting(true)

    try {
      const { error: insertError } = await supabase.from('job_applications').insert({
        job_id: job.id,
        student_id: studentId,
        eeo_response: eeo,
        work_authorization: workAuth || null,
        disability_status: disability || null,
        veteran_status: veteran || null,
        location_preference: hasMultipleLocations ? locationPreference : null,
        message_to_recruiter: messageToRecruiter.trim() || null,
      })

      if (insertError) {
        if (insertError.code === '23505') {
          onSuccess()
          onClose()
          return
        }
        setError('Something went wrong. Please try again.')
        return
      }

      onSuccess()
      onClose()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="post-job-overlay"
      role="dialog"
      aria-modal
      aria-labelledby="apply-modal-title"
    >
      <div className="post-job-modal">
        <div className="post-job-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Briefcase size={20} style={{ color: '#2563eb' }} />
            <h2 id="apply-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
              Apply to {job.title}
            </h2>
          </div>
          <button className="close-feedback" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form className="post-job-body" onSubmit={handleSubmit}>
          <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.9375rem' }}>
            {job.company}
          </p>

          {error && (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <div className="form-section">
            <h3 className="section-title">Visa / Work Authorization</h3>
            <div className="form-group">
              <label>Work Authorization *</label>
              <select
                className="select"
                value={workAuth}
                onChange={e => setWorkAuth(e.target.value)}
                required
              >
                <option value="">Select an option</option>
                {WORK_AUTH_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Equal Employment Opportunity</h3>
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem' }}>
              This information is voluntary and will be kept confidential.
            </p>
            <div className="form-group">
              <label>Race/Ethnicity *</label>
              <select
                className="select"
                value={eeo}
                onChange={e => setEeo(e.target.value)}
                required
              >
                <option value="">Select an option</option>
                {EEO_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Disability Status *</label>
              <select
                className="select"
                value={disability}
                onChange={e => setDisability(e.target.value)}
              >
                <option value="">Select an option</option>
                {DISABILITY_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Veteran Status *</label>
              <select
                className="select"
                value={veteran}
                onChange={e => setVeteran(e.target.value)}
              >
                <option value="">Select an option</option>
                {VETERAN_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasMultipleLocations && (
            <div className="form-section">
              <h3 className="section-title">Preferred Location</h3>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                This role is available in multiple locations.
              </p>
              <div className="form-group">
                <label>Select your preferred location</label>
                <select
                  className="select"
                  value={locationPreference}
                  onChange={e => setLocationPreference(e.target.value)}
                >
                  {locations.map(loc => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-section">
            <h3 className="section-title">Message to Recruiter (optional)</h3>
            <div className="form-group">
              <textarea
                className="input apply-message-input"
                value={messageToRecruiter}
                onChange={e => setMessageToRecruiter(e.target.value)}
                placeholder="Type message here"
                rows={3}
              />
              {messageToRecruiter.trim() && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: messageWordCount > MAX_MESSAGE_WORDS ? '#b91c1c' : '#6b7280',
                    marginTop: '0.25rem',
                  }}
                >
                  {messageWordCount} / {MAX_MESSAGE_WORDS} words
                </span>
              )}
            </div>
          </div>

          <div className="post-job-footer">
            <button
              type="button"
              className="edit-profile-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={submitting || messageWordCount > MAX_MESSAGE_WORDS}
            >
              {submitting ? (
                'Submitting...'
              ) : (
                <>
                  <Send size={16} />
                  Submit Application
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
