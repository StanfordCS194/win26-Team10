import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, GraduationCap, Briefcase, Building2, DollarSign, Clock, ChevronRight, CheckCircle, ChevronDown, MapPin, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import mockJobs from '../data/mockJobs.json'

interface StudentProfile {
  firstName: string
  lastName: string
  major: string
  graduationYear: string
  gpa: string
  skills?: string[]
}

interface Job {
  id: string
  title: string
  company: string
  location: string
  type: string
  salary: string
  salaryMin: number
  posted: string
  description: string
  skills: string[]
  requirements: string[]
  benefits: string[]
  preferred_majors?: string[]
  preferred_grad_years?: string[]
  min_gpa?: number | null
}

interface Qualification {
  label: string
  met: boolean | null // null = can't determine (no profile data)
}

function getQualifications(job: Job, profile: StudentProfile | null): Qualification[] {
  const quals: Qualification[] = []

  if (job.preferred_majors && job.preferred_majors.length > 0) {
    const label =
      job.preferred_majors.length === 1
        ? job.preferred_majors[0]
        : job.preferred_majors.join(' or ')
    quals.push({
      label,
      met: profile?.major ? job.preferred_majors.includes(profile.major) : null,
    })
  }

  if (job.preferred_grad_years && job.preferred_grad_years.length > 0) {
    const label = `Class of ${job.preferred_grad_years.join('/')}`
    quals.push({
      label,
      met: profile?.graduationYear
        ? job.preferred_grad_years.includes(profile.graduationYear)
        : null,
    })
  }

  if (job.min_gpa != null && job.min_gpa > 0) {
    quals.push({
      label: `${job.min_gpa}+ GPA`,
      met: profile?.gpa ? parseFloat(profile.gpa) >= job.min_gpa : null,
    })
  }

  return quals
}

const ALL_COMPANIES = [...new Set((mockJobs as Job[]).map(j => j.company))]
const ALL_JOB_TYPES = ['Internship', 'Full-time']

export default function StudentDashboard() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState('')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const navigate = useNavigate()

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [minPay, setMinPay] = useState('')
  const [showMatchOnly, setShowMatchOnly] = useState(false)

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        setEmail(session.user.email)
      }

      const savedProfile = localStorage.getItem('studentProfile')
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile))
      }

      const savedApplied = localStorage.getItem('appliedJobs')
      if (savedApplied) {
        setAppliedJobs(new Set(JSON.parse(savedApplied)))
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const handleApply = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newApplied = new Set(appliedJobs)
    newApplied.add(jobId)
    setAppliedJobs(newApplied)
    localStorage.setItem('appliedJobs', JSON.stringify([...newApplied]))
  }

  const toggleExpanded = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCompanies([])
    setSelectedTypes([])
    setMinPay('')
    setShowMatchOnly(false)
  }

  const toggleFilter = (value: string, selected: string[], setSelected: (v: string[]) => void) => {
    if (selected.includes(value)) {
      setSelected(selected.filter(v => v !== value))
    } else {
      setSelected([...selected, value])
    }
  }

  const filteredJobs = (mockJobs as Job[]).filter(job => {
    if (
      searchQuery &&
      !job.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !job.company.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }
    if (selectedCompanies.length > 0 && !selectedCompanies.includes(job.company)) {
      return false
    }
    if (selectedTypes.length > 0 && !selectedTypes.includes(job.type)) {
      return false
    }
    if (minPay) {
      const minPayNum = parseInt(minPay)
      if (!isNaN(minPayNum) && job.salaryMin < minPayNum) {
        return false
      }
    }
    if (showMatchOnly && profile) {
      const matchesMajor =
        !job.preferred_majors?.length || job.preferred_majors.includes(profile.major)
      const matchesYear =
        !job.preferred_grad_years?.length ||
        job.preferred_grad_years.includes(profile.graduationYear)
      const matchesGpa =
        job.min_gpa == null || parseFloat(profile.gpa || '0') >= job.min_gpa
      if (!matchesMajor || !matchesYear || !matchesGpa) return false
    }
    return true
  })

  const hasActiveFilters =
    searchQuery ||
    selectedCompanies.length > 0 ||
    selectedTypes.length > 0 ||
    minPay ||
    showMatchOnly

  const profileComplete = profile && profile.firstName && profile.lastName && profile.major

  if (loading) {
    return <div className="dashboard-loading">Loading...</div>
  }

  return (
    <div className="student-dashboard">
      <div className="student-dashboard-container">
        <div className="dashboard-top-section">
          <div className="profile-card">
            {profileComplete ? (
              <>
                <div className="profile-avatar">
                  <User size={32} />
                </div>
                <div className="profile-info">
                  <h2 className="profile-name">
                    {profile.firstName} {profile.lastName}
                  </h2>
                  <div className="profile-details">
                    <span className="profile-detail">
                      <GraduationCap size={16} />
                      {profile.major}
                    </span>
                    {profile.graduationYear && (
                      <span className="profile-detail">
                        <Clock size={16} />
                        Class of {profile.graduationYear}
                      </span>
                    )}
                    {profile.gpa && (
                      <span className="profile-detail">GPA: {profile.gpa}</span>
                    )}
                  </div>
                  <p className="profile-email">{email}</p>
                </div>
                <button
                  className="edit-profile-btn"
                  onClick={() => navigate('/student/profile')}
                >
                  Edit Profile
                </button>
              </>
            ) : (
              <div className="profile-incomplete">
                <div className="incomplete-icon">
                  <User size={32} />
                </div>
                <div className="incomplete-content">
                  <h3>Complete Your Profile</h3>
                  <p>Add your information to be visible to recruiters and apply for jobs.</p>
                </div>
                <button
                  className="complete-setup-btn"
                  onClick={() => navigate('/student/profile')}
                >
                  Complete Setup
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="jobs-section">
          <div className="jobs-header">
            <h2 className="jobs-title">
              <Briefcase size={24} />
              Open Positions
            </h2>
            <span className="jobs-count">
              {filteredJobs.length} of {mockJobs.length} jobs
            </span>
          </div>

          {/* Filters */}
          <div className="jobs-filters">
            <div className="filter-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search jobs or companies..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="filter-groups">
              <div className="filter-group">
                <label>Profile Match</label>
                <button
                  className={`match-filter-btn${showMatchOnly ? ' active' : ''}`}
                  onClick={() => setShowMatchOnly(!showMatchOnly)}
                  disabled={!profileComplete}
                  title={!profileComplete ? 'Complete your profile to use this filter' : ''}
                >
                  <CheckCircle size={14} />
                  Matches my profile
                </button>
              </div>

              <div className="filter-group">
                <label>Job Type</label>
                <div className="filter-tags">
                  {ALL_JOB_TYPES.map(type => (
                    <button
                      key={type}
                      className={`filter-tag ${selectedTypes.includes(type) ? 'selected' : ''}`}
                      onClick={() => toggleFilter(type, selectedTypes, setSelectedTypes)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label>Company</label>
                <div className="filter-tags">
                  {ALL_COMPANIES.map(company => (
                    <button
                      key={company}
                      className={`filter-tag ${selectedCompanies.includes(company) ? 'selected' : ''}`}
                      onClick={() =>
                        toggleFilter(company, selectedCompanies, setSelectedCompanies)
                      }
                    >
                      {company}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label>Min Pay</label>
                <div className="filter-pay">
                  <DollarSign size={16} />
                  <input
                    type="number"
                    placeholder="e.g. 100000"
                    value={minPay}
                    onChange={e => setMinPay(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearFilters}>
                <X size={16} />
                Clear all filters
              </button>
            )}
          </div>

          {/* Job Listings */}
          <div className="jobs-list">
            {filteredJobs.length === 0 ? (
              <div className="no-jobs">
                <p>No jobs match your filters</p>
                <button onClick={clearFilters}>Clear filters</button>
              </div>
            ) : (
              filteredJobs.map(job => {
                const hasApplied = appliedJobs.has(job.id)
                const isExpanded = expandedJob === job.id
                const quals = getQualifications(job, profile)
                const metCount = quals.filter(q => q.met === true).length
                const totalCount = quals.length

                return (
                  <div
                    key={job.id}
                    className={`job-card-compact ${isExpanded ? 'expanded' : ''}`}
                  >
                    <div className="job-card-row" onClick={() => toggleExpanded(job.id)}>
                      <div className="job-company-logo">
                        <Building2 size={20} />
                      </div>
                      <div className="job-summary">
                        <span className="job-title-compact">{job.title}</span>
                        <span className="job-company-compact">{job.company}</span>
                        {quals.length > 0 && (
                          <div className="job-qual-chips">
                            {quals.map((q, i) => (
                              <span
                                key={i}
                                className={`job-qual-chip ${
                                  q.met === true
                                    ? 'met'
                                    : q.met === false
                                    ? 'unmet'
                                    : 'unknown'
                                }`}
                              >
                                {q.met === true ? '✓' : q.met === false ? '⊘' : '·'} {q.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span
                        className={`job-type-badge ${
                          job.type === 'Internship' ? 'internship' : 'fulltime'
                        }`}
                      >
                        {job.type}
                      </span>
                      <span className="job-salary-compact">{job.salary}</span>
                      <span className="job-posted-compact">{job.posted}</span>
                      {totalCount > 0 && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color:
                              metCount === totalCount
                                ? '#15803d'
                                : metCount > 0
                                ? '#b45309'
                                : '#6b7280',
                            minWidth: '48px',
                            textAlign: 'right',
                          }}
                        >
                          {metCount}/{totalCount}
                        </span>
                      )}
                      {hasApplied ? (
                        <span className="applied-badge">
                          <CheckCircle size={16} />
                          Applied
                        </span>
                      ) : (
                        <button
                          className="apply-btn-compact"
                          onClick={e => handleApply(job.id, e)}
                          disabled={!profileComplete}
                          title={!profileComplete ? 'Complete your profile to apply' : ''}
                        >
                          Apply
                        </button>
                      )}
                      <ChevronDown
                        size={20}
                        className={`expand-icon ${isExpanded ? 'rotated' : ''}`}
                      />
                    </div>

                    {isExpanded && (
                      <div className="job-card-details">
                        <div className="job-detail-section">
                          <h4>Description</h4>
                          <p>{job.description}</p>
                        </div>

                        <div className="job-detail-row">
                          <div className="job-detail-section">
                            <h4>Location</h4>
                            <p className="job-location-detail">
                              <MapPin size={16} />
                              {job.location}
                            </p>
                          </div>
                          <div className="job-detail-section">
                            <h4>Compensation</h4>
                            <p className="job-pay-detail">
                              <DollarSign size={16} />
                              {job.salary}
                            </p>
                          </div>
                        </div>

                        {quals.length > 0 && (
                          <div className="job-detail-section">
                            <h4>What They're Looking For</h4>
                            {profile ? (
                              <p className="qual-match-summary">
                                {metCount === totalCount
                                  ? 'You meet all qualifications.'
                                  : metCount > 0
                                  ? `You match ${metCount} of ${totalCount} qualifications.`
                                  : "You don't meet the listed qualifications."}
                              </p>
                            ) : (
                              <p className="qual-match-summary">
                                Complete your profile to see how you match.
                              </p>
                            )}
                            <div className="qual-chips-expanded">
                              {quals.map((q, i) => (
                                <span
                                  key={i}
                                  className={`qual-chip-expanded ${
                                    q.met === true
                                      ? 'met'
                                      : q.met === false
                                      ? 'unmet'
                                      : 'unknown'
                                  }`}
                                >
                                  {q.met === true ? '✓' : q.met === false ? '⊘' : '·'} {q.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="job-detail-section">
                          <h4>Required Skills</h4>
                          <div className="job-skills-detail">
                            {job.skills.map(skill => (
                              <span key={skill} className="job-skill-tag">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="job-detail-section">
                          <h4>Requirements</h4>
                          <ul className="job-requirements">
                            {job.requirements.map((req, i) => (
                              <li key={i}>{req}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="job-detail-section">
                          <h4>Benefits</h4>
                          <ul className="job-benefits">
                            {job.benefits.map((benefit, i) => (
                              <li key={i}>{benefit}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
