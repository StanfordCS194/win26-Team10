import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, GraduationCap, Briefcase, Building2, DollarSign, Clock, ChevronRight, CheckCircle, ChevronDown, MapPin, Search, X, MessageSquare, Send, ChevronLeft, Loader2, AlertCircle, Type, Paperclip } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getMyConversations, getMessages, sendMessage as sendMessageApi, getLatestMessagePerConversation, subscribeToNewMessages } from '../lib/messaging'
import type { Conversation, Message } from '../types/messaging'
import mockJobs from '../data/mockJobs.json'

interface StudentProfile {
  firstName: string
  lastName: string
  major: string
  graduationYear: string
  gpa: string
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

  // Messages
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

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        setEmail(session.user.email)
      }
      if (session?.user?.id) {
        setStudentId(session.user.id)
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
  }

  const toggleFilter = (value: string, selected: string[], setSelected: (v: string[]) => void) => {
    if (selected.includes(value)) {
      setSelected(selected.filter(v => v !== value))
    } else {
      setSelected([...selected, value])
    }
  }

  const filteredJobs = mockJobs.filter(job => {
    if (searchQuery && !job.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !job.company.toLowerCase().includes(searchQuery.toLowerCase())) {
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
    return true
  })

  const hasActiveFilters = searchQuery || selectedCompanies.length > 0 || selectedTypes.length > 0 || minPay
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
        setLatestMessages(latest)
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
    return (
      <div className="dashboard-loading">
        Loading...
      </div>
    )
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
                  <h2 className="profile-name">{profile.firstName} {profile.lastName}</h2>
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
                      <span className="profile-detail">
                        GPA: {profile.gpa}
                      </span>
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
          {viewMode === 'jobs' && (
            <span className="dashboard-subtitle student-dashboard-subtitle">
              {filteredJobs.length} of {mockJobs.length} jobs
            </span>
          )}
        </div>

        {viewMode === 'jobs' && (
          <div className="jobs-section">
          <div className="jobs-header">
            <h2 className="jobs-title">
              <Briefcase size={24} />
              Open Positions
            </h2>
            <span className="jobs-count">{filteredJobs.length} of {mockJobs.length} jobs</span>
          </div>
          <div className="jobs-filters">
            <div className="filter-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search jobs or companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="filter-groups">
              <div className="filter-group">
                <label>Company</label>
                <div className="filter-tags">
                  {ALL_COMPANIES.map(company => (
                    <button
                      key={company}
                      className={`filter-tag ${selectedCompanies.includes(company) ? 'selected' : ''}`}
                      onClick={() => toggleFilter(company, selectedCompanies, setSelectedCompanies)}
                    >
                      {company}
                    </button>
                  ))}
                </div>
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
                <label>Min Pay</label>
                <div className="filter-pay">
                  <DollarSign size={16} />
                  <input
                    type="number"
                    placeholder="e.g. 100000"
                    value={minPay}
                    onChange={(e) => setMinPay(e.target.value)}
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
              filteredJobs.map((job) => {
                const hasApplied = appliedJobs.has(job.id)
                const isExpanded = expandedJob === job.id
                return (
                  <div key={job.id} className={`job-card-compact ${isExpanded ? 'expanded' : ''}`}>
                    <div className="job-card-row" onClick={() => toggleExpanded(job.id)}>
                      <div className="job-company-logo">
                        <Building2 size={20} />
                      </div>
                      <div className="job-summary">
                        <span className="job-title-compact">{job.title}</span>
                        <span className="job-company-compact">{job.company}</span>
                      </div>
                      <span className={`job-type-badge ${job.type === 'Internship' ? 'internship' : 'fulltime'}`}>
                        {job.type}
                      </span>
                      <span className="job-salary-compact">{job.salary}</span>
                      <span className="job-posted-compact">{job.posted}</span>
                      {hasApplied ? (
                        <span className="applied-badge">
                          <CheckCircle size={16} />
                          Applied
                        </span>
                      ) : (
                        <button 
                          className="apply-btn-compact"
                          onClick={(e) => handleApply(job.id, e)}
                          disabled={!profileComplete}
                          title={!profileComplete ? 'Complete your profile to apply' : ''}
                        >
                          Apply
                        </button>
                      )}
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

                        <div className="job-detail-section">
                          <h4>Required Skills</h4>
                          <div className="job-skills-detail">
                            {job.skills.map(skill => (
                              <span key={skill} className="job-skill-tag">{skill}</span>
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
    </div>
  )
}
