import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users, MessageSquare, Send, ChevronLeft, Loader2, AlertCircle } from 'lucide-react'
import { Filters, Student } from '../types/student'
import { mockStudents } from '../data/mockStudents'
import FilterSidebar from '../components/FilterSidebar'
import StudentList from '../components/StudentList'
import { supabase } from '../lib/supabase'
import {
  getMyConversations,
  getMessages,
  sendMessage as sendMessageApi,
  getLatestMessagePerConversation,
  subscribeToNewMessages,
} from '../lib/messaging'
import type { Conversation, Message } from '../types/messaging'

const initialFilters: Filters = {
  search: '',
  minGpa: 0,
  maxGpa: 4,
  major: '',
  graduationYear: '',
  skills: [],
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://api-production-d25a.up.railway.app'

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

    if (filters.major && student.major !== filters.major) {
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

export default function RecruiterDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [complete, setComplete] = useState<Array<any> | null>(null)
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
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        throw new Error('You must be logged in to access transcripts.')
      }
      if (session?.user?.id) setRecruiterId(session.user.id)

      const users = await fetch(`${API_BASE}/get_users`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!users.ok) {
        throw new Error(await users.text())
      }

      const allUsers = await users.json()
      const allStudents = allUsers.filter((user: any) => user.type === 'student')
      const studentsWithApplicants = await Promise.all(
        allStudents.map(async (student: any) => {
          const applicantRes = await fetch(`${API_BASE}/get_specific_profile/${student.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const applicant = applicantRes.ok ? await applicantRes.json() : null
          return { ...student, applicant }
        })
      )
      setComplete(studentsWithApplicants);
    }
    load();
  }, []);

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
        setLatestMessages(latest)
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
  const loadedStudents = []
  if (complete != null) {
    const allStudents = complete
    for (const student of allStudents) {
      const applicant = student.applicant
      if (!applicant) continue
      const newStudent = {
        id: student.id,
        firstName: applicant.first_name ?? '',
        lastName: applicant.last_name ?? '',
        email: applicant.email ?? '',
        gpa: applicant.gpa ?? -1,
        major: applicant.major ?? '',
        graduationYear: applicant.graduation_year ?? 0,
        skills: applicant.skills ?? [],
        transcriptUploaded: !!applicant.latest_repr_path,
        transcript: null,
      }
      loadedStudents.push(newStudent)
    }
  }
  const mockStudentsIDs = []
  for (const student of mockStudents) {
    mockStudentsIDs.push(student.id)
  }
  for (const student of loadedStudents) {
    if (!mockStudentsIDs.includes(student.id)) {
      mockStudents.push(student)
    }
  }
  const filteredStudents = useMemo(
    () => filterStudents(mockStudents, filters),
    [filters, complete]
  )
  if (!complete) return <div>Loading...</div>

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
            <p className="dashboard-subtitle">
              Showing {filteredStudents.length} of {mockStudents.length} students
            </p>
          )}
        </div>

        {viewMode === 'directory' && (
          <>
            <StudentList
              students={filteredStudents}
              isRecruiter
              onOpenConversation={setOpenConversationId}
            />
          </>
        )}

        {viewMode === 'messages' && (
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
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`conversation-row ${selectedConversationId === c.id ? 'selected' : ''}`}
                    onClick={() => setSelectedConversationId(c.id)}
                  >
                    <span className="conversation-name">{studentNames[c.student_id] ?? 'Student'}</span>
                    {latestMessages[c.id] && (
                      <span className="conversation-preview">
                        {latestMessages[c.id].body.slice(0, 40)}
                        {latestMessages[c.id].body.length > 40 ? '…' : ''}
                      </span>
                    )}
                  </button>
                ))
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
                    <span className="thread-title">{selectedStudentName}</span>
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
                    <input
                      type="text"
                      className="thread-input"
                      placeholder="Type a message..."
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
        )}
      </main>
    </div>
  )
}
