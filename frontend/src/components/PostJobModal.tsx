import { useMemo, useState } from 'react'
import { X, Plus, Trash2, Briefcase, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ALL_SKILLS, MAJORS } from '../types/student'

interface PostJobModalProps {
  onClose: () => void
  onSuccess: () => void
}

const JOB_TYPES = ['Internship', 'Full-time', 'Part-time', 'Contract']
const COMMON_LOCATIONS = [
  'Remote',
  'San Francisco, CA',
  'New York, NY',
  'Seattle, WA',
  'Los Angeles, CA',
  'Austin, TX',
  'Boston, MA',
  'Chicago, IL',
  'San Jose, CA',
  'Palo Alto, CA',
]

const COMMON_MAJORS = [
  ...MAJORS,
  'Statistics',
  'Information Systems',
  'Computer Engineering',
  'Industrial Engineering',
  'Civil Engineering',
  'Bioengineering',
  'Chemical Engineering',
  'Cognitive Science',
  'Operations Research',
  'Finance',
  'Accounting',
  'Marketing',
  'Psychology',
  'Design',
]
const SORTED_LOCATIONS = [...COMMON_LOCATIONS].sort((a, b) => a.localeCompare(b))
const SORTED_MAJORS = [...COMMON_MAJORS].sort((a, b) => a.localeCompare(b))

export default function PostJobModal({ onClose, onSuccess }: PostJobModalProps) {
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [locationSelectValue, setLocationSelectValue] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [type, setType] = useState('Internship')
  const [compensation, setCompensation] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [customSkill, setCustomSkill] = useState('')
  const [preferredMajors, setPreferredMajors] = useState<string[]>([])
  const [majorSelectValue, setMajorSelectValue] = useState('')
  const [customMajor, setCustomMajor] = useState('')
  const [preferredGradYears, setPreferredGradYears] = useState<string[]>([])
  const [minGpa, setMinGpa] = useState('')
  const [benefits, setBenefits] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const gradYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, index) => String(currentYear + index))
  }, [])

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  const addCustomSkill = () => {
    const value = customSkill.trim()
    if (!value) return
    setSelectedSkills(prev => (prev.includes(value) ? prev : [...prev, value]))
    setCustomSkill('')
  }

  const addMajor = (major: string) => {
    const value = major.trim()
    if (!value) return
    setPreferredMajors(prev => (prev.includes(value) ? prev : [...prev, value]))
    setMajorSelectValue('')
    setCustomMajor('')
  }

  const removeMajor = (major: string) => {
    setPreferredMajors(prev => prev.filter(m => m !== major))
  }

  const addLocation = (location: string) => {
    const value = location.trim()
    if (!value) return
    setSelectedLocations(prev => (prev.includes(value) ? prev : [...prev, value]))
    setLocationSelectValue('')
    setCustomLocation('')
  }

  const removeLocation = (location: string) => {
    setSelectedLocations(prev => prev.filter(l => l !== location))
  }

  const toggleGradYear = (year: string) => {
    setPreferredGradYears(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    )
  }

  const handleListChange = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    setter(prev => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }

  const addListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => [...prev, ''])
  }

  const removeListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number
  ) => {
    setter(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim() || !company.trim() || selectedLocations.length === 0 || !description.trim()) {
      setError('Please fill in all required fields (Title, Company, at least one Location, Description).')
      return
    }

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const { error: insertError } = await supabase.from('jobs').insert({
        recruiter_id: session?.user?.id ?? null,
        title: title.trim(),
        company: company.trim(),
        location: selectedLocations.join(', '),
        type,
        salary_display: compensation.trim() || null,
        description: description.trim(),
        skills: selectedSkills,
        preferred_majors: preferredMajors,
        preferred_grad_years: preferredGradYears,
        min_gpa: minGpa ? parseFloat(minGpa) : null,
        benefits: benefits.filter(b => b.trim()),
        is_active: true,
      })

      if (insertError) throw insertError

      setSuccess(true)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post job. Please try again.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="post-job-overlay" onClick={onClose}>
      <div className="post-job-modal" onClick={e => e.stopPropagation()}>
        <div className="post-job-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Briefcase size={20} style={{ color: '#2563eb' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>Post a Job</h2>
          </div>
          <button className="close-feedback" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form className="post-job-body" onSubmit={handleSubmit}>
          {success && (
            <div className="success-banner">
              <CheckCircle size={18} />
              Job posted successfully! Closing...
            </div>
          )}

          {/* Basic Info */}
          <div className="form-section">
            <h3 className="section-title">Job Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Job Title *</label>
                <input
                  className="input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Software Engineer Intern"
                />
              </div>
              <div className="form-group">
                <label>Company *</label>
                <input
                  className="input"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="e.g. Google"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Location *</label>
                <div className="dynamic-list-item">
                  <select
                    className="select"
                    value={locationSelectValue}
                    onChange={e => addLocation(e.target.value)}
                  >
                    <option value="">Select location</option>
                    {SORTED_LOCATIONS.map(city => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="dynamic-list-item" style={{ marginTop: '0.5rem' }}>
                  <input
                    className="input"
                    value={customLocation}
                    onChange={e => setCustomLocation(e.target.value)}
                    placeholder="Custom location"
                  />
                  <button
                    type="button"
                    className="add-list-btn"
                    onClick={() => addLocation(customLocation)}
                  >
                    <Plus size={14} /> Add Custom
                  </button>
                </div>
                {selectedLocations.length > 0 && (
                  <div className="skills-selection" style={{ marginTop: '0.75rem' }}>
                    {selectedLocations.map(location => (
                      <button
                        key={location}
                        type="button"
                        className="skill-btn selected"
                        onClick={() => removeLocation(location)}
                        title="Remove location"
                      >
                        {location} <X size={14} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Job Type</label>
                <select className="select" value={type} onChange={e => setType(e.target.value)}>
                  {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Compensation (optional)</label>
              <input
                className="input"
                value={compensation}
                onChange={e => setCompensation(e.target.value)}
                placeholder="e.g. $120k-$150k or $8,000/mo"
              />
            </div>
            <div className="form-group">
              <label>Description *</label>
              <textarea
                className="input"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the role and what the candidate will work on..."
                rows={4}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {/* Candidate Qualifications */}
          <div className="form-section">
            <h3 className="section-title">Candidate Qualifications</h3>
            <p className="section-description">
              These are verified against student profiles. Students can filter jobs by how well they match.
            </p>
            <div className="form-group">
              <label>Preferred Majors</label>
              <div className="dynamic-list-item">
                <select
                  className="select"
                  value={majorSelectValue}
                  onChange={e => addMajor(e.target.value)}
                >
                  <option value="">Select major</option>
                  {SORTED_MAJORS.map(major => (
                    <option key={major} value={major}>
                      {major}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dynamic-list-item" style={{ marginTop: '0.5rem' }}>
                <input
                  className="input"
                  value={customMajor}
                  onChange={e => setCustomMajor(e.target.value)}
                  placeholder="Custom major"
                />
                <button
                  type="button"
                  className="add-list-btn"
                  onClick={() => addMajor(customMajor)}
                >
                  <Plus size={14} /> Add Custom
                </button>
              </div>
              {preferredMajors.length > 0 && (
                <div className="skills-selection" style={{ marginTop: '0.75rem' }}>
                  {preferredMajors.map(major => (
                    <button
                      key={major}
                      type="button"
                      className="skill-btn selected"
                      onClick={() => removeMajor(major)}
                      title="Remove major"
                    >
                      {major} <X size={14} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label>Graduation Years</label>
                <div className="skills-selection">
                  {gradYearOptions.map(year => (
                    <button
                      key={year}
                      type="button"
                      className={`skill-btn${preferredGradYears.includes(year) ? ' selected' : ''}`}
                      onClick={() => toggleGradYear(year)}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Minimum GPA</label>
                <input
                  className="input"
                  type="number"
                  value={minGpa}
                  onChange={e => setMinGpa(e.target.value)}
                  placeholder="e.g. 3.5"
                  min="0"
                  max="4"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="form-section">
            <h3 className="section-title">Required Skills</h3>
            <p className="section-description">Select skills or add your own manually.</p>
            <div className="skills-selection" style={{ marginBottom: '0.75rem' }}>
              {ALL_SKILLS.map(skill => (
                <button
                  key={skill}
                  type="button"
                  className={`skill-btn${selectedSkills.includes(skill) ? ' selected' : ''}`}
                  onClick={() => toggleSkill(skill)}
                >
                  {skill}
                </button>
              ))}
            </div>
            <div className="dynamic-list-item">
              <input
                className="input"
                value={customSkill}
                onChange={e => setCustomSkill(e.target.value)}
                placeholder="Add custom skill"
              />
              <button type="button" className="add-list-btn" onClick={addCustomSkill}>
                <Plus size={14} /> Add Skill
              </button>
            </div>
            {selectedSkills.length > 0 && (
              <div className="skills-selection" style={{ marginTop: '0.75rem' }}>
                {selectedSkills.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    className="skill-btn selected"
                    onClick={() => toggleSkill(skill)}
                    title="Remove skill"
                  >
                    {skill} <X size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Benefits */}
          <div className="form-section">
            <h3 className="section-title">Benefits</h3>
            {benefits.map((benefit, i) => (
              <div key={i} className="dynamic-list-item">
                <input
                  className="input"
                  value={benefit}
                  onChange={e => handleListChange(setBenefits, i, e.target.value)}
                  placeholder={`Benefit ${i + 1}`}
                />
                {benefits.length > 1 && (
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => removeListItem(setBenefits, i)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="add-list-btn"
              onClick={() => addListItem(setBenefits)}
            >
              <Plus size={14} /> Add Benefit
            </button>
          </div>

          {error && (
            <div className="auth-error-message" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div className="post-job-footer">
            <button type="button" className="edit-profile-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={submitting || success}>
              {submitting ? 'Posting...' : 'Post Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
