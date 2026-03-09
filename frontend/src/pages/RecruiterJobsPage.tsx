import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Briefcase, Building2, ChevronDown, DollarSign, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatSalaryForDisplay } from '../lib/salary'

type CompanyMembershipRow = {
  company_id: string
  status: 'pending' | 'approved' | 'rejected'
  companies: { id: string; name: string } | null
}

type RecruiterJobRow = {
  id: string
  title: string
  company: string
  location: string
  type: string
  salary_display: string | null
  description: string
  skills: string[] | null
  benefits: string[] | null
  preferred_majors: string[] | null
  preferred_grad_years: string[] | null
  min_gpa: number | null
  created_at: string
  is_active: boolean
}

type RecruiterJob = {
  id: string
  title: string
  company: string
  location: string
  type: string
  salary: string
  description: string
  skills: string[]
  benefits: string[]
  preferred_majors: string[]
  preferred_grad_years: string[]
  min_gpa: number | null
  posted: string
}

function formatPosted(createdAt: string): string {
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const hourMs = 60 * 60 * 1000

  if (diffMs < hourMs) {
    const mins = Math.max(1, Math.floor(diffMs / (60 * 1000)))
    return `${mins} min ago`
  }
  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  const days = Math.floor(diffMs / dayMs)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function mapJob(row: RecruiterJobRow): RecruiterJob {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    type: row.type,
    salary: formatSalaryForDisplay(row.salary_display || 'Compensation not listed'),
    description: row.description,
    skills: row.skills ?? [],
    benefits: row.benefits ?? [],
    preferred_majors: row.preferred_majors ?? [],
    preferred_grad_years: row.preferred_grad_years ?? [],
    min_gpa: row.min_gpa,
    posted: formatPosted(row.created_at),
  }
}

function formatCompensationWithIcon(salary: string): string {
  return salary.replace(/^\$+\s*/, '')
}

export default function RecruiterJobsPage() {
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [jobs, setJobs] = useState<RecruiterJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const userId = session?.user?.id
        if (!userId) {
          setError('You must be signed in.')
          setLoading(false)
          return
        }

        const { data: membership, error: membershipError } = await supabase
          .from('company_memberships')
          .select('company_id, status, companies(id, name)')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle()

        if (membershipError) throw membershipError
        const resolvedMembership = membership as CompanyMembershipRow | null
        if (!resolvedMembership?.company_id) {
          setError('No approved company is linked to this recruiter account yet.')
          setLoading(false)
          return
        }

        setCompanyName(resolvedMembership.companies?.name ?? null)

        const { data: rows, error: jobsError } = await supabase
          .from('jobs')
          .select(
            'id, title, company, location, type, salary_display, description, skills, benefits, preferred_majors, preferred_grad_years, min_gpa, created_at, is_active'
          )
          .eq('company_id', resolvedMembership.company_id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (jobsError) throw jobsError
        setJobs(((rows || []) as RecruiterJobRow[]).map(mapJob))
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to load company jobs.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const allJobTypes = useMemo(
    () => [...new Set(jobs.map(j => j.type))].sort((a, b) => a.localeCompare(b)),
    [jobs]
  )

  const filteredJobs = jobs.filter(job => {
    if (
      search &&
      !job.title.toLowerCase().includes(search.toLowerCase()) &&
      !job.location.toLowerCase().includes(search.toLowerCase())
    ) {
      return false
    }
    if (selectedTypes.length > 0 && !selectedTypes.includes(job.type)) {
      return false
    }
    return true
  })

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type))
    } else {
      setSelectedTypes([...selectedTypes, type])
    }
  }

  const toggleExpanded = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId)
  }

  return (
    <div className="student-dashboard">
      <div className="student-dashboard-container">
        <div className="jobs-section">
          <div className="jobs-header">
            <div className="jobs-header-top">
              <h2 className="jobs-title">
                <Briefcase size={24} />
                My Company Live Jobs
              </h2>
            </div>
            <p className="jobs-count">{companyName ?? 'No company linked'}</p>
          </div>

          {loading ? (
            <div className="dashboard-loading">Loading jobs...</div>
          ) : error ? (
            <div className="no-jobs">
              <p>{error}</p>
            </div>
          ) : (
            <>
              <div className="jobs-filters">
                <div className="filter-search">
                  <input
                    type="text"
                    placeholder="Search by job title or location..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label>Job Type</label>
                  <div className="filter-tags">
                    {allJobTypes.map(type => (
                      <button
                        key={type}
                        className={`filter-tag ${selectedTypes.includes(type) ? 'selected' : ''}`}
                        onClick={() => toggleType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="jobs-list">
                {filteredJobs.length === 0 ? (
                  <div className="no-jobs">
                    <p>No live jobs found for this company.</p>
                  </div>
                ) : (
                  filteredJobs.map(job => {
                    const isExpanded = expandedJob === job.id
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
                                  {formatCompensationWithIcon(job.salary)}
                                </p>
                              </div>
                            </div>

                            {job.preferred_majors.length > 0 && (
                              <div className="job-detail-section">
                                <h4>Preferred Majors</h4>
                                <div className="job-skills-detail">
                                  {job.preferred_majors.map(major => (
                                    <span key={major} className="job-skill-tag">
                                      {major}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {job.preferred_grad_years.length > 0 && (
                              <div className="job-detail-section">
                                <h4>Preferred Graduation Years</h4>
                                <div className="job-skills-detail">
                                  {job.preferred_grad_years.map(year => (
                                    <span key={year} className="job-skill-tag">
                                      {year}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {job.min_gpa != null && (
                              <div className="job-detail-section">
                                <h4>Minimum GPA</h4>
                                <p>{job.min_gpa}</p>
                              </div>
                            )}

                            {job.skills.length > 0 && (
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
                            )}

                            {job.benefits.length > 0 && (
                              <div className="job-detail-section">
                                <h4>Benefits</h4>
                                <ul className="job-benefits">
                                  {job.benefits.map((benefit, i) => (
                                    <li key={i}>{benefit}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
