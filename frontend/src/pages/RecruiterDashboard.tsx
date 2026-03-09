import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Users, Plus, CheckCircle, MessageSquare, Send, ChevronLeft, Loader2, AlertCircle, Type, Paperclip } from 'lucide-react'
import { Filters, Student } from '../types/student'
import { mockStudents } from '../data/mockStudents'
import FilterSidebar from '../components/FilterSidebar'
import StudentList from '../components/StudentList'
import PostJobModal from '../components/PostJobModal'
import { supabase } from '../lib/supabase'
import {
  getMyConversations,
  getMessages,
  sendMessage as sendMessageApi,
  getLatestMessagePerConversation,
  subscribeToNewMessages,
} from '../lib/messaging'
import type { Conversation, Message } from '../types/messaging'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://api-production-d25a.up.railway.app'
const POST_JOB_OPEN_KEY = 'postJobModalOpen'

type CompanyMembershipRow = {
  company_id: string
  status: 'pending' | 'approved' | 'rejected'
  companies: { id: string; name: string } | null
}

type CompanyJobRow = {
  id: string
  title: string
  location: string
  type: string
  created_at: string
  is_active: boolean
  preferred_majors: string[] | null
  preferred_grad_years: string[] | null
  min_gpa: number | null
  required_work_authorization: string | null
}

type ApplicantRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  degree: string | null
  major: string | null
  graduation_year: string | null
  gpa: number | null
  skills: string[] | null
  latest_repr_path: string | null
  work_authorization: string | null
  resume_path: string | null
}

const initialFilters: Filters = {
  search: '',
  minGpa: 0.1,
  maxGpa: 4,
  majors: [],
  degrees: [],
  graduationYear: '',
  skills: [],
}


function filterStudents(students: Student[], filters: Filters): Student[] {
  return students.filter((student) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase()
      if (!fullName.includes(searchLower)) {
        return false
      }
    }

    if (student.gpa < filters.minGpa || student.gpa > filters.maxGpa) {
      return false
    }

    if (filters.majors.length > 0 && !filters.majors.includes(student.major)) {
      return false
    }

    if (filters.degrees.length > 0 && !filters.degrees.includes(student.degree || '')) {
      return false
    }

    if (filters.graduationYear && student.graduationYear !== parseInt(filters.graduationYear)) {
      return false
    }

    if (filters.skills.length > 0) {
      const hasAllSkills = filters.skills.every((skill) => student.skills.includes(skill))
      if (!hasAllSkills) {
        return false
      }
    }

    return true
  })
}

function mapApplicantToStudent(row: ApplicantRow): Student {
  return {
    id: row.id,
    firstName: row.first_name || 'Unknown',
    lastName: row.last_name || 'Student',
    email: row.email || '',
    gpa: row.gpa ?? 0,
    degree: row.degree ?? '',
    major: row.major || 'Undeclared',
    graduationYear: parseInt(row.graduation_year || '0') || 0,
    skills: row.skills || [],
    transcriptUploaded: !!row.latest_repr_path,
    transcript: row.latest_repr_path ? 'supabase' : null,
    resumeUploaded: !!row.resume_path,
    resumePath: row.resume_path ?? undefined,
    workAuthorization: row.work_authorization ?? null,
  }
}

function mergeWithMockStudents(dbStudents: Student[]): Student[] {
  const byId = new Map<string, Student>()
  for (const student of dbStudents) {
    byId.set(student.id, student)
  }
  for (const mockStudent of mockStudents) {
    if (!byId.has(mockStudent.id)) {
      byId.set(mockStudent.id, mockStudent)
    }
  }
  return Array.from(byId.values())
}

function isStudentQualified(student: Student, job: CompanyJobRow | null): boolean {
  if (!job) return true

  if (job.preferred_majors && job.preferred_majors.length > 0) {
    if (!job.preferred_majors.includes(student.major)) return false
  }

  if (job.preferred_grad_years && job.preferred_grad_years.length > 0) {
    if (!job.preferred_grad_years.includes(String(student.graduationYear))) return false
  }

  if (job.min_gpa != null) {
    if (student.gpa < job.min_gpa) return false
  }

  if (job.required_work_authorization) {
    if (!student.workAuthorization || student.workAuthorization !== job.required_work_authorization) {
      return false
    }
  }

  return true
}

export default function RecruiterDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'directory' | 'messages'>('directory')
  const [recruiterId, setRecruiterId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})
  const [latestMessages, setLatestMessages] = useState<Record<string, Message>>({})
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [messageDraft, setMessageDraft] = useState('')
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'archived'>('all')

  const [showPostJob, setShowPostJob] = useState(
    () => sessionStorage.getItem(POST_JOB_OPEN_KEY) === 'true'
  )
  const [jobPostedBanner, setJobPostedBanner] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyJobs, setCompanyJobs] = useState<CompanyJobRow[]>([])
  const [directoryStudents, setDirectoryStudents] = useState<Student[]>([])
  const [appliedStudentIds, setAppliedStudentIds] = useState<Set<string>>(new Set())
  const [applicationDetailsMap, setApplicationDetailsMap] = useState<Map<string, { work_authorization: string | null; message_to_recruiter: string | null }>>(new Map())
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [showAppliedOnly, setShowAppliedOnly] = useState(false)
  const [showQualifiedOnly, setShowQualifiedOnly] = useState(false)
  const [companyJobsLoading, setCompanyJobsLoading] = useState(true)
  const [companyJobsError, setCompanyJobsError] = useState('')

  // When openConversationId is set (from StudentCard or URL), switch to Messages and select it
  useEffect(() => {
    const fromUrl = searchParams.get('openConversation')
    const id = openConversationId || fromUrl
    if (id) {
      setViewMode('messages')
      setSelectedConversationId(id)
      setOpenConversationId(null)
      if (fromUrl) setSearchParams({}, { replace: true })
    }
  }, [openConversationId, searchParams, setSearchParams])

  useEffect(() => {
    async function loadCompanyAndStudents() {
      setCompanyJobsLoading(true)
      setCompanyJobsError('')

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const userId = session?.user?.id
        if (!userId) {
          setCompanyJobsError('You must be signed in.')
          setCompanyJobsLoading(false)
          return
        }
        setRecruiterId(userId)

        const { data: membership, error: membershipError } = await supabase
          .from('company_memberships')
          .select('company_id, status, companies(id, name)')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle()

        if (membershipError) throw membershipError

        const resolvedMembership = membership as CompanyMembershipRow | null
        const resolvedCompanyId = resolvedMembership?.company_id ?? null
        const resolvedCompanyName = resolvedMembership?.companies?.name ?? null

        setCompanyId(resolvedCompanyId)
        setCompanyName(resolvedCompanyName)

        if (!resolvedCompanyId) {
          setCompanyJobs([])
          setDirectoryStudents([])
          setCompanyJobsError('No approved company is linked to this recruiter account yet.')
          setCompanyJobsLoading(false)
          return
        }

        const { data: jobs, error: jobsError } = await supabase
          .from('jobs')
          .select('id, title, location, type, created_at, is_active, preferred_majors, preferred_grad_years, min_gpa, required_work_authorization')
          .eq('company_id', resolvedCompanyId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (jobsError) throw jobsError

        const companyJobsRows = (jobs || []) as CompanyJobRow[]
        setCompanyJobs(companyJobsRows)
        setSelectedJobId((prev) => {
          if (prev && companyJobsRows.some(job => job.id === prev)) return prev
          return companyJobsRows[0]?.id || ''
        })

        const { data: applicants, error: applicantsError } = await supabase
          .from('applicants')
          .select('id, first_name, last_name, email, degree, major, graduation_year, gpa, skills, latest_repr_path, work_authorization, resume_path')

        if (applicantsError) throw applicantsError

        const { data: studentUsers, error: studentUsersError } = await supabase
          .from('users')
          .select('id')
          .eq('type', 'student')

        if (studentUsersError) throw studentUsersError

        const studentUserIds = new Set((studentUsers || []).map((u: { id: string }) => u.id))
        const filteredApplicants = ((applicants || []) as ApplicantRow[]).filter(a => studentUserIds.has(a.id))
        const mappedStudents = filteredApplicants.map(mapApplicantToStudent)

        setDirectoryStudents(mergeWithMockStudents(mappedStudents))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load company data.'
        setCompanyJobsError(message)
      } finally {
        setCompanyJobsLoading(false)
      }
    }

    loadCompanyAndStudents()
  }, [jobPostedBanner])

  useEffect(() => {
    async function loadApplicationsForSelectedJob() {
      if (!selectedJobId) {
        setAppliedStudentIds(new Set())
        setApplicationDetailsMap(new Map())
        setShowAppliedOnly(false)
        setShowQualifiedOnly(false)
        return
      }

      const { data, error } = await supabase
        .from('job_applications')
        .select('student_id, work_authorization, message_to_recruiter')
        .eq('job_id', selectedJobId)

      if (error) {
        console.error('Failed to load applications:', error)
        setAppliedStudentIds(new Set())
        setApplicationDetailsMap(new Map())
        return
      }

      const rows = data || []
      setAppliedStudentIds(new Set(rows.map(row => row.student_id as string)))
      const detailsMap = new Map<string, { work_authorization: string | null; message_to_recruiter: string | null }>()
      for (const row of rows) {
        detailsMap.set(row.student_id as string, {
          work_authorization: row.work_authorization ?? null,
          message_to_recruiter: row.message_to_recruiter ?? null,
        })
      }
      setApplicationDetailsMap(detailsMap)
    }

    loadApplicationsForSelectedJob()
  }, [selectedJobId])

  // Load conversations and previews when in Messages view
  useEffect(() => {
    if (viewMode !== 'messages' || !recruiterId) return
    let cancelled = false
    setConversationsLoading(true)
    getMyConversations(recruiterId)
      .then((list) => {
        if (cancelled) return
        setConversations(list)
        const ids = list.map((c) => c.id)
        return getLatestMessagePerConversation(ids)
      })
      .then((latest) => {
        if (cancelled) return
        setLatestMessages(latest ?? {})
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load conversations', err)
      })
      .finally(() => {
        if (!cancelled) setConversationsLoading(false)
      })
    return () => { cancelled = true }
  }, [viewMode, recruiterId])

  // Load student names for conversation list (recruiter sees students)
  useEffect(() => {
    if (conversations.length === 0) return
    const studentIds = [...new Set(conversations.map((c) => c.student_id))]
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const names: Record<string, string> = {}
      await Promise.all(
        studentIds.map(async (id) => {
          const res = await fetch(`${API_BASE}/get_specific_profile/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) return
          const applicant = await res.json()
          const name = [applicant.first_name, applicant.last_name].filter(Boolean).join(' ') || 'Student'
          names[id] = name
        })
      )
      if (!cancelled) setStudentNames((prev) => ({ ...prev, ...names }))
    })()
    return () => { cancelled = true }
  }, [conversations])

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
    if (!selectedConversationId || !recruiterId || !messageDraft.trim()) return
    setSendError(null)
    try {
      const msg = await sendMessageApi(selectedConversationId, recruiterId, messageDraft.trim())
      setThreadMessages((prev) => [...prev, msg])
      setMessageDraft('')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send')
    }
  }

  const selectedConversation = selectedConversationId
    ? conversations.find((c) => c.id === selectedConversationId)
    : null
  const selectedStudentName = selectedConversation
    ? studentNames[selectedConversation.student_id] ?? 'Student'
    : ''

  const selectedJob = useMemo(
    () => companyJobs.find(job => job.id === selectedJobId) ?? null,
    [companyJobs, selectedJobId]
  )

  const filteredStudents = useMemo(() => {
    let students = filterStudents(directoryStudents, filters)

    if (showAppliedOnly && selectedJobId) {
      students = students.filter(student => appliedStudentIds.has(student.id))
    }

    if (showQualifiedOnly) {
      students = students.filter(student => isStudentQualified(student, selectedJob))
    }

    return students
  }, [directoryStudents, filters, showAppliedOnly, showQualifiedOnly, selectedJobId, appliedStudentIds, selectedJob])

  const handleJobSuccess = () => {
    setJobPostedBanner(true)
    setTimeout(() => setJobPostedBanner(false), 4000)
  }

  const openPostJob = () => {
    sessionStorage.setItem(POST_JOB_OPEN_KEY, 'true')
    setShowPostJob(true)
  }

  const closePostJob = () => {
    sessionStorage.removeItem(POST_JOB_OPEN_KEY)
    setShowPostJob(false)
  }

  const hasSelectedJob = !!selectedJobId

  return (
    <div className="dashboard">
      <FilterSidebar filters={filters} onFiltersChange={setFilters} />

      <main className="dashboard-main">
        <div className="dashboard-header dashboard-header-with-tabs">
          <div className="dashboard-tabs">
            <button
              type="button"
              className={`dashboard-tab ${viewMode === 'directory' ? 'active' : ''}`}
              onClick={() => setViewMode('directory')}
            >
              <Users size={18} />
              Student Directory
            </button>
            <button
              type="button"
              className={`dashboard-tab ${viewMode === 'messages' ? 'active' : ''}`}
              onClick={() => setViewMode('messages')}
            >
              <MessageSquare size={18} />
              Messages
            </button>
          </div>
          {viewMode === 'directory' && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <p className="dashboard-subtitle">
                    Showing {filteredStudents.length} of {directoryStudents.length} students
                  </p>
                  <p className="dashboard-subtitle">Company: {companyName ?? 'Not linked'}</p>
                </div>
                <button className="post-job-btn" onClick={openPostJob}>
                  <Plus size={16} />
                  Post a Job
                </button>
              </div>
              {jobPostedBanner && (
                <div className="success-banner" style={{ marginTop: '0.5rem' }}>
                  <CheckCircle size={18} />
                  Job posted successfully!
                </div>
              )}
            </>
          )}
        </div>

        {viewMode === 'directory' && (
          <>
            <div className="form-section" style={{ marginBottom: '1rem' }}>
              <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>
                My Company Live Jobs
              </h3>
              {companyJobsLoading ? (
                <p className="section-description">Loading jobs...</p>
              ) : companyJobsError ? (
                <p className="section-description" style={{ color: '#b91c1c' }}>
                  {companyJobsError}
                </p>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#fff',
                    }}
                  >
                    <p className="section-description" style={{ margin: 0 }}>
                      {companyJobs.length} live {companyJobs.length === 1 ? 'job' : 'jobs'} posted for{' '}
                      {companyName}.
                    </p>
                    <Link to="/recruiter/jobs" className="post-job-btn" style={{ textDecoration: 'none' }}>
                      View all
                    </Link>
                  </div>

                  <div className="form-row" style={{ marginTop: '1rem' }}>
                    <div className="form-group">
                      <label className="filter-label">Adapt directory to job</label>
                      <select
                        className="select"
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                      >
                        <option value="">
                          {companyJobs.length === 0 ? 'No live jobs available' : 'No job selected'}
                        </option>
                        {companyJobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title} ({job.type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <button
                        className={`match-filter-btn${showAppliedOnly ? ' active' : ''}`}
                        onClick={() => setShowAppliedOnly(!showAppliedOnly)}
                        disabled={!hasSelectedJob}
                      >
                        Applied
                      </button>
                      <button
                        className={`match-filter-btn${showQualifiedOnly ? ' active' : ''}`}
                        onClick={() => setShowQualifiedOnly(!showQualifiedOnly)}
                        disabled={!hasSelectedJob}
                      >
                        Qualified
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <StudentList
              students={filteredStudents}
              appliedStudentIds={appliedStudentIds}
              applicationDetailsMap={applicationDetailsMap}
              hasSelectedJob={hasSelectedJob}
              isRecruiter
              onOpenConversation={setOpenConversationId}
            />
          </>
        )}

        {viewMode === 'messages' && (
          <div className="recruiter-inbox-view">
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
            <div className="messages-view">
              <div className="conversations-list">
                {conversationsLoading ? (
                  <div className="messages-loading">
                    <Loader2 size={18} className="animate-spin" />
                    Loading conversations...
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="messages-empty">No conversations yet. Message a student from the directory.</div>
                ) : (
                  conversations.map((c) => {
                    const name = studentNames[c.student_id] ?? 'Student'
                    const initials = name === 'Student' ? 'S' : name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                    const latest = latestMessages[c.id]
                    const isUnread = latest && latest.sender_id !== recruiterId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`conversation-row ${selectedConversationId === c.id ? 'selected' : ''} ${isUnread ? 'has-unread' : ''}`}
                        onClick={() => setSelectedConversationId(c.id)}
                      >
                        {isUnread && <span className="unread-dot" aria-hidden />}
                        <span className="conversation-avatar" aria-hidden>{initials}</span>
                        <div className="conversation-row-content">
                          <span className="conversation-name">{name}</span>
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
                    Select a conversation or message a student from the directory.
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
                        <span className="thread-title">{selectedStudentName}</span>
                        <span className="thread-subtitle">Student</span>
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
                            className={`thread-message ${m.sender_id === recruiterId ? 'sent' : 'received'}`}
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
      </main>

      {showPostJob && (
        <PostJobModal
          onClose={closePostJob}
          onSuccess={handleJobSuccess}
          companyId={companyId}
          companyName={companyName}
        />
      )}
    </div>
  )
}
