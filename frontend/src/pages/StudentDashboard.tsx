import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, GraduationCap, Briefcase, Building2, DollarSign, Clock, ChevronRight, CheckCircle, ChevronDown, MapPin, Search, X, MessageSquare, Send, ChevronLeft, Loader2, AlertCircle, Type, Paperclip, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatSalaryForDisplay } from '../lib/salary'
import { useApplyModal } from '../contexts/ApplyModalContext'
import { getMyConversations, getMessages, sendMessage as sendMessageApi, getLatestMessagePerConversation, subscribeToNewMessages } from '../lib/messaging'
import type { Conversation, Message } from '../types/messaging'

interface StudentProfile {
  firstName: string
  lastName: string
  degree?: string
  major: string
  graduationYear: string
  gpa: string
  skills?: string[]
  workAuthorization?: string
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
  requirements?: string[]
  benefits?: string[]
  preferred_majors?: string[]
  preferred_grad_years?: string[]
  min_gpa?: number | null
  required_work_authorization?: string | null
}

interface JobRow {
  id: string
  title: string
  company: string
  location: string
  type: string
  salary_display: string | null
  salary_min: number | null
  description: string
  skills: string[] | null
  requirements: string[] | null
  benefits: string[] | null
  preferred_majors: string[] | null
  preferred_grad_years: string[] | null
  min_gpa: number | null
  required_work_authorization: string | null
  created_at: string | null
}

interface Qualification {
  label: string
  met: boolean | null // null = can't determine (no profile data)
}

function getQualifications(job: Job, profile: StudentProfile | null): Qualification[] {
  const quals: Qualification[] = []

  if (job.preferred_majors && job.preferred_majors.length > 0) {
    const profileMajor = profile?.major ? String(profile.major).trim() : null
    const matchedMajor = profileMajor
      ? job.preferred_majors.find(major => String(major).trim() === profileMajor)
      : null
    const shownMajor = matchedMajor ?? job.preferred_majors[0]
    const label = `Major: ${shownMajor}`
    quals.push({
      label,
      met: profileMajor ? job.preferred_majors.some(m => String(m).trim() === profileMajor) : null,
    })
  }

  if (job.preferred_grad_years && job.preferred_grad_years.length > 0) {
    const profileYear = profile?.graduationYear != null ? String(profile.graduationYear) : null
    const matchingYear = profileYear
      ? job.preferred_grad_years.find(year => String(year) === profileYear)
      : null
    const minimumYear = [...job.preferred_grad_years]
      .sort((a, b) => Number(a) - Number(b))[0]
    const shownYear = matchingYear ?? minimumYear
    const label = `Class of ${shownYear}`
    quals.push({
      label,
      met: profileYear
        ? job.preferred_grad_years.some(year => String(year) === profileYear)
        : null,
    })
  }

  if (job.min_gpa != null && job.min_gpa > 0) {
    quals.push({
      label: `${job.min_gpa}+ GPA`,
      met: profile?.gpa ? parseFloat(profile.gpa) >= job.min_gpa : null,
    })
  }

  if (job.required_work_authorization) {
    const profileWorkAuth = profile?.workAuthorization ? String(profile.workAuthorization).trim() : null
    quals.push({
      label: `Work Auth: ${job.required_work_authorization}`,
      met: profileWorkAuth ? profileWorkAuth === job.required_work_authorization : null,
    })
  }

  return quals
}

function getMismatchReasons(job: Job, profile: StudentProfile | null): string[] {
  const quals = getQualifications(job, profile)
  const reasons: string[] = []
  for (const q of quals) {
    if (q.met === false) {
      reasons.push(q.label)
    } else if (q.met === null && profile) {
      reasons.push(`${q.label} (not in your profile)`)
    } else if (q.met === null && !profile) {
      reasons.push(`${q.label} (complete your profile to check)`)
    }
  }
  return reasons
}

function formatPosted(createdAt: string | null): string {
  if (!createdAt) return 'Recently posted'
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const hourMs = 60 * 60 * 1000

  if (diffMs < hourMs) {
    const hours = Math.max(1, Math.floor(diffMs / (60 * 1000)))
    return `${hours} min ago`
  }
  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(diffMs / dayMs)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

function mapJobRow(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    type: row.type,
    salary: formatSalaryForDisplay(row.salary_display || 'Compensation not listed'),
    salaryMin: row.salary_min ?? 0,
    posted: formatPosted(row.created_at),
    description: row.description,
    skills: row.skills ?? [],
    requirements: row.requirements ?? [],
    benefits: row.benefits ?? [],
    preferred_majors: row.preferred_majors ?? [],
    preferred_grad_years: row.preferred_grad_years ?? [],
    min_gpa: row.min_gpa,
    required_work_authorization: row.required_work_authorization ?? null,
  }
}

export default function StudentDashboard() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsError, setJobsError] = useState('')
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set())
  const [studentUserId, setStudentUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'open' | 'applications'>('open')
  const [appliedJobsList, setAppliedJobsList] = useState<Job[]>([])
  const [mismatchConfirmJob, setMismatchConfirmJob] = useState<Job | null>(null)
  const { openApplyModal: openApplyModalCtx } = useApplyModal()
  const navigate = useNavigate()

  const [studentId, setStudentId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [latestMessages, setLatestMessages] = useState<Record<string, Message>>({})
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [messageDraft, setMessageDraft] = useState('')
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'jobs' | 'inbox'>('jobs')
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'archived'>('all')
  const [threadError, setThreadError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [minPay, setMinPay] = useState('')
  const [showMatchOnly, setShowMatchOnly] = useState(false)
  const [companySearchQuery, setCompanySearchQuery] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        setEmail(session.user.email)
      }
      if (session?.user?.id) {
        setStudentUserId(session.user.id)
        setStudentId(session.user.id)
      }

      const savedProfile = localStorage.getItem('studentProfile')
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile))
      }

      if (session?.user?.id) {
        const { data: applications, error: applicationsError } = await supabase
          .from('job_applications')
          .select('job_id')
          .eq('student_id', session.user.id)

        if (applicationsError) {
          console.error('Failed to load applied jobs:', applicationsError)
        } else {
          const appliedIds = new Set((applications || []).map(row => row.job_id as string))
          setAppliedJobs(appliedIds)

          if (appliedIds.size > 0) {
            const { data: appliedJobRows } = await supabase
              .from('jobs')
              .select('id, title, company, location, type, salary_display, salary_min, description, skills, requirements, benefits, preferred_majors, preferred_grad_years, min_gpa, required_work_authorization, created_at')
              .in('id', [...appliedIds])
              .order('created_at', { ascending: false })
            const rows = (appliedJobRows || []) as JobRow[]
            setAppliedJobsList(rows.map(mapJobRow))
          } else {
            setAppliedJobsList([])
          }
        }
      }

      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, company, location, type, salary_display, salary_min, description, skills, requirements, benefits, preferred_majors, preferred_grad_years, min_gpa, required_work_authorization, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to load jobs:', error)
        setJobsError('Unable to load jobs right now.')
      } else {
        const rows = (data || []) as JobRow[]
        setJobs(rows.map(mapJobRow))
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const openApplyModal = (job: Job, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!studentUserId || appliedJobs.has(job.id)) return
    const mismatchReasons = getMismatchReasons(job, profile)
    if (mismatchReasons.length > 0) {
      setMismatchConfirmJob(job)
    } else {
      openApplyModalCtx(job, studentUserId, () => {
        setAppliedJobs(prev => new Set(prev).add(job.id))
      })
    }
  }

  const confirmMismatchAndOpenApply = () => {
    if (!mismatchConfirmJob || !studentUserId) return
    const job = mismatchConfirmJob
    setMismatchConfirmJob(null)
    openApplyModalCtx(job, studentUserId, () => {
      setAppliedJobs(prev => new Set(prev).add(job.id))
    })
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
    setCompanySearchQuery('')
  }

  const toggleFilter = (value: string, selected: string[], setSelected: (v: string[]) => void) => {
    if (selected.includes(value)) {
      setSelected(selected.filter(v => v !== value))
    } else {
      setSelected([...selected, value])
    }
  }

  const allCompanies = useMemo(
    () => [...new Set(jobs.map(j => j.company))].sort((a, b) => a.localeCompare(b)),
    [jobs]
  )
  const allJobTypes = useMemo(
    () => [...new Set(jobs.map(j => j.type))].sort((a, b) => a.localeCompare(b)),
    [jobs]
  )

  const filteredCompanies = useMemo(
    () => allCompanies.filter(company =>
      company.toLowerCase().includes(companySearchQuery.toLowerCase())
    ),
    [allCompanies, companySearchQuery]
  )

  const unappliedJobsCount = jobs.length - appliedJobs.size

  const filteredJobs = jobs.filter(job => {
    if (appliedJobs.has(job.id)) {
      return false
    }
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
      const matchesWorkAuth =
        !job.required_work_authorization ||
        (profile.workAuthorization && profile.workAuthorization === job.required_work_authorization)
      if (!matchesMajor || !matchesYear || !matchesGpa || !matchesWorkAuth) return false
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

  // Load conversations for student (where they are student_id)
  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    setConversationsLoading(true)
    getMyConversations(studentId)
      .then((list) => {
        if (cancelled) return
        setConversations(list)
        const ids = list.map((c) => c.id)
        return getLatestMessagePerConversation(ids)
      })
      .then((latest) => {
        if (cancelled) return
        setLatestMessages(latest || {})
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load conversations', err)
      })
      .finally(() => {
        if (!cancelled) setConversationsLoading(false)
      })
    return () => { cancelled = true }
  }, [studentId])

  // Load thread messages when selection changes
  useEffect(() => {
    if (!selectedConversationId) {
      setThreadMessages([])
      setThreadError(null)
      setSendError(null)
      return
    }
    let cancelled = false
    setThreadError(null)
    setThreadLoading(true)
    getMessages(selectedConversationId)
      .then((msgs) => {
        if (!cancelled) setThreadMessages(msgs)
      })
      .catch((err) => {
        if (!cancelled) setThreadError(err instanceof Error ? err.message : 'Failed to load messages')
      })
      .finally(() => {
        if (!cancelled) setThreadLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedConversationId])

  // Real-time: subscribe to new messages in selected conversation
  useEffect(() => {
    if (!selectedConversationId) return
    const unsubscribe = subscribeToNewMessages(selectedConversationId, (message) => {
      setThreadMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev
        return [...prev, message]
      })
    })
    return unsubscribe
  }, [selectedConversationId])

  const handleSendMessage = async () => {
    if (!selectedConversationId || !studentId || !messageDraft.trim()) return
    setSendError(null)
    try {
      const msg = await sendMessageApi(selectedConversationId, studentId, messageDraft.trim())
      setThreadMessages((prev) => [...prev, msg])
      setMessageDraft('')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send')
    }
  }

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
                      {profile.degree ? `${profile.degree} in ${profile.major}` : profile.major}
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

        {/* Tab bar: Open Positions | Inbox */}
        <div className="dashboard-header dashboard-header-with-tabs student-dashboard-tabs">
          <div className="dashboard-tabs">
            <button
              type="button"
              className={`dashboard-tab ${viewMode === 'jobs' ? 'active' : ''}`}
              onClick={() => setViewMode('jobs')}
            >
              <Briefcase size={18} />
              Open Positions
            </button>
            <button
              type="button"
              className={`dashboard-tab ${viewMode === 'inbox' ? 'active' : ''}`}
              onClick={() => setViewMode('inbox')}
            >
              <MessageSquare size={18} />
              Inbox
              {conversations.length > 0 && (
                <span className="messages-badge">{conversations.length}</span>
              )}
            </button>
          </div>
        </div>

        {viewMode === 'jobs' && (
          <div className="jobs-section">
          <div className="jobs-header">
            <div className="jobs-header-top">
              <h2 className="jobs-title">
                <Briefcase size={24} />
                Jobs
              </h2>
              <div className="student-dashboard-tabs">
                <button
                  className={`student-tab ${activeTab === 'open' ? 'active' : ''}`}
                  onClick={() => setActiveTab('open')}
                >
                  Open Positions
                  <span className="tab-count">{unappliedJobsCount}</span>
                </button>
                <button
                  className={`student-tab ${activeTab === 'applications' ? 'active' : ''}`}
                  onClick={() => setActiveTab('applications')}
                >
                  My Applications
                  <span className="tab-count">{appliedJobsList.length}</span>
                </button>
              </div>
            </div>
            {activeTab === 'open' && (
              <span className="jobs-count">
                {filteredJobs.length} of {jobs.length} jobs
              </span>
            )}
          </div>

          {activeTab === 'open' && (
          <>
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
                  {allJobTypes.map(type => (
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
                
                {selectedCompanies.length > 0 && (
                  <div className="filter-tags">
                    {selectedCompanies.map(company => (
                      <button
                        key={company}
                        className="filter-tag selected"
                        onClick={() => toggleFilter(company, selectedCompanies, setSelectedCompanies)}
                      >
                        {company}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="company-search-container">
                  <div className="company-search-input">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Search companies..."
                      value={companySearchQuery}
                      onChange={e => setCompanySearchQuery(e.target.value)}
                    />
                    {companySearchQuery && (
                      <button 
                        className="clear-company-search" 
                        onClick={() => setCompanySearchQuery('')}
                        aria-label="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  
                  {companySearchQuery && (
                    <div className="company-dropdown">
                      {filteredCompanies.length === 0 ? (
                        <div className="company-dropdown-empty">No companies found</div>
                      ) : (
                        <>
                          {filteredCompanies.slice(0, 10).map(company => (
                            <button
                              key={company}
                              className={`company-dropdown-item ${selectedCompanies.includes(company) ? 'selected' : ''}`}
                              onClick={() => {
                                toggleFilter(company, selectedCompanies, setSelectedCompanies)
                                setCompanySearchQuery('')
                              }}
                            >
                              {selectedCompanies.includes(company) && <CheckCircle size={14} />}
                              {company}
                            </button>
                          ))}
                          {filteredCompanies.length > 10 && (
                            <div className="company-dropdown-more">
                              +{filteredCompanies.length - 10} more companies (keep typing to narrow)
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
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
                <p>{jobsError || 'No jobs match your filters'}</p>
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
                    className={`job-card-compact ${isExpanded ? 'expanded' : ''} ${hasApplied ? 'job-applied' : ''}`}
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
                          onClick={e => openApplyModal(job, e)}
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

                        {job.requirements && job.requirements.length > 0 && (
                          <div className="job-detail-section">
                            <h4>Requirements</h4>
                            <ul className="job-requirements">
                              {job.requirements.map((req, i) => (
                                <li key={i}>{req}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {job.benefits && job.benefits.length > 0 && (
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

          {activeTab === 'applications' && (
            <div className="jobs-list">
              {appliedJobsList.length === 0 ? (
                <div className="no-jobs">
                  <p>You haven&apos;t applied to any jobs yet.</p>
                  <button onClick={() => setActiveTab('open')}>Browse open positions</button>
                </div>
              ) : (
                appliedJobsList.map(job => {
                  const isExpanded = expandedJob === job.id
                  const quals = getQualifications(job, profile)
                  const metCount = quals.filter(q => q.met === true).length
                  const totalCount = quals.length

                  return (
                    <div
                      key={job.id}
                      className={`job-card-compact job-applied ${isExpanded ? 'expanded' : ''}`}
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
                                  className={`job-qual-chip ${q.met === true ? 'met' : q.met === false ? 'unmet' : 'unknown'}`}
                                >
                                  {q.met === true ? '✓' : q.met === false ? '⊘' : '·'} {q.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className={`job-type-badge ${job.type === 'Internship' ? 'internship' : 'fulltime'}`}>
                          {job.type}
                        </span>
                        <span className="job-salary-compact">{job.salary}</span>
                        <span className="job-posted-compact">{job.posted}</span>
                        {totalCount > 0 && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: metCount === totalCount ? '#15803d' : metCount > 0 ? '#b45309' : '#6b7280',
                              minWidth: '48px',
                              textAlign: 'right',
                            }}
                          >
                            {metCount}/{totalCount}
                          </span>
                        )}
                        <span className="applied-badge">
                          <CheckCircle size={16} />
                          Applied
                        </span>
                        <ChevronDown size={20} className={`expand-icon ${isExpanded ? 'rotated' : ''}`} />
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
                              <h4>What They&apos;re Looking For</h4>
                              {profile ? (
                                <p className="qual-match-summary">
                                  {metCount === totalCount ? 'You meet all qualifications.' : metCount > 0 ? `You match ${metCount} of ${totalCount} qualifications.` : "You don't meet the listed qualifications."}
                                </p>
                              ) : (
                                <p className="qual-match-summary">Complete your profile to see how you match.</p>
                              )}
                              <div className="qual-chips-expanded">
                                {quals.map((q, i) => (
                                  <span
                                    key={i}
                                    className={`qual-chip-expanded ${q.met === true ? 'met' : q.met === false ? 'unmet' : 'unknown'}`}
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
                                <span key={skill} className="job-skill-tag">{skill}</span>
                              ))}
                            </div>
                          </div>
                          {job.requirements && job.requirements.length > 0 && (
                            <div className="job-detail-section">
                              <h4>Requirements</h4>
                              <ul className="job-requirements">
                                {job.requirements.map((req, i) => (
                                  <li key={i}>{req}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {job.benefits && job.benefits.length > 0 && (
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
          )}
        </div>
        )}

        {viewMode === 'inbox' && (
          <div className="student-inbox-view">
            <h2 className="inbox-title">Inbox</h2>
            <div className="inbox-filters">
              <button
                type="button"
                className={`inbox-filter-btn ${inboxFilter === 'all' ? 'active' : ''}`}
                onClick={() => setInboxFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`inbox-filter-btn ${inboxFilter === 'unread' ? 'active' : ''}`}
                onClick={() => setInboxFilter('unread')}
              >
                Unread
              </button>
              <button
                type="button"
                className={`inbox-filter-btn ${inboxFilter === 'archived' ? 'active' : ''}`}
                onClick={() => setInboxFilter('archived')}
              >
                Archived
              </button>
            </div>
            <div className="messages-view student-messages-inner">
              <div className="conversations-list">
                {conversationsLoading ? (
                  <div className="messages-loading">
                    <Loader2 size={18} className="animate-spin" />
                    Loading conversations...
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="messages-empty">No messages yet. Recruiters can contact you from your profile.</div>
                ) : (
                  conversations.map((c) => {
                    const latest = latestMessages[c.id]
                    const isUnread = latest && latest.sender_id !== studentId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`conversation-row ${selectedConversationId === c.id ? 'selected' : ''} ${isUnread ? 'has-unread' : ''}`}
                        onClick={() => setSelectedConversationId(c.id)}
                      >
                        {isUnread && <span className="unread-dot" aria-hidden />}
                        <span className="conversation-avatar" aria-hidden>R</span>
                        <div className="conversation-row-content">
                          <span className="conversation-name">Recruiter</span>
                          {latest && (
                            <span className="conversation-preview">
                              {latest.body.slice(0, 40)}
                              {latest.body.length > 40 ? '…' : ''}
                            </span>
                          )}
                        </div>
                        {latest && (
                          <span className="conversation-date">
                            {new Date(latest.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
              <div className="thread-panel">
                {!selectedConversationId ? (
                  <div className="thread-placeholder">
                    Select a conversation to view messages and reply.
                  </div>
                ) : (
                  <>
                    <div className="thread-header">
                      <button
                        type="button"
                        className="thread-back"
                        onClick={() => setSelectedConversationId(null)}
                        aria-label="Back to list"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <div className="thread-header-info">
                        <span className="thread-title">Recruiter</span>
                        <span className="thread-subtitle">Recruiter</span>
                      </div>
                    </div>
                    <div className="thread-messages">
                      {threadError ? (
                        <div className="messages-error" role="alert">
                          <AlertCircle size={18} />
                          {threadError}
                          <button
                            type="button"
                            className="messages-retry"
                            onClick={() => {
                              setThreadError(null)
                              if (!selectedConversationId) return
                              setThreadLoading(true)
                              getMessages(selectedConversationId)
                                .then(setThreadMessages)
                                .catch((err) => setThreadError(err instanceof Error ? err.message : 'Failed to load messages'))
                                .finally(() => setThreadLoading(false))
                            }}
                          >
                            Retry
                          </button>
                        </div>
                      ) : threadLoading ? (
                        <div className="messages-loading">
                          <Loader2 size={18} className="animate-spin" />
                          Loading messages...
                        </div>
                      ) : (
                        threadMessages.map((m) => (
                          <div
                            key={m.id}
                            className={`thread-message ${m.sender_id === studentId ? 'sent' : 'received'}`}
                          >
                            <p className="thread-message-body">{m.body}</p>
                            <span className="thread-message-time">
                              {new Date(m.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    {sendError && (
                      <div className="messages-send-error" role="alert">
                        <AlertCircle size={16} />
                        {sendError}
                      </div>
                    )}
                    <form
                      className="thread-compose"
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleSendMessage()
                      }}
                    >
                      <div className="thread-compose-icons">
                        <button type="button" className="thread-compose-icon" aria-label="Format" disabled>
                          <Type size={18} />
                        </button>
                        <button type="button" className="thread-compose-icon" aria-label="Attach" disabled>
                          <Paperclip size={18} />
                        </button>
                      </div>
                      <input
                        type="text"
                        className="thread-input"
                        placeholder="Type a message"
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        aria-label="Message"
                      />
                      <button type="submit" className="thread-send" aria-label="Send">
                        <Send size={18} />
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {mismatchConfirmJob && (
        <div
          className="post-job-overlay"
          role="dialog"
          aria-modal
          aria-labelledby="mismatch-confirm-title"
        >
          <div className="post-job-modal" style={{ maxWidth: '28rem' }}>
            <div className="post-job-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={20} style={{ color: '#b45309' }} />
                <h2 id="mismatch-confirm-title" style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                  Profile Mismatch
                </h2>
              </div>
              <button className="close-feedback" onClick={() => setMismatchConfirmJob(null)} type="button">
                <X size={20} />
              </button>
            </div>
            <div className="post-job-body">
              <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.9375rem' }}>
                {mismatchConfirmJob.company} – {mismatchConfirmJob.title}
              </p>
              <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                <strong>Note:</strong> The job you are applying to does not match your current profile.
              </p>
              <p style={{ marginBottom: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                Reasons:
              </p>
              <ul style={{ margin: '0 0 1rem 1.25rem', padding: 0, fontSize: '0.875rem' }}>
                {getMismatchReasons(mismatchConfirmJob, profile).map((r, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>{r}</li>
                ))}
              </ul>
              <p style={{ marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Do you still want to apply?
              </p>
              <div className="post-job-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
                <button
                  type="button"
                  className="edit-profile-btn"
                  onClick={() => setMismatchConfirmJob(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="submit-btn"
                  onClick={confirmMismatchAndOpenApply}
                >
                  Yes, Continue to Application
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
