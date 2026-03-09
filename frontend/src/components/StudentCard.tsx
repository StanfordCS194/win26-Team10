import { useState } from 'react'
import { Mail, GraduationCap, FileCheck, FileText, CheckCircle, ChevronDown, ChevronUp, MessageCircle, User, Eye } from 'lucide-react'
import { Student } from '../types/student'
import StudentTranscriptCard from './StudentTranscriptCard'
import { createRoot } from 'react-dom/client'
import { supabase } from '../lib/supabase'
import { getOrCreateConversation } from '../lib/messaging'
import { createResumeViewer } from './ResumeViewer'
import type { ApplicationDetails } from './StudentList'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://api-production-d25a.up.railway.app'

interface StudentCardProps {
  student: Student
  /** When true, show Message button (recruiter view) */
  isRecruiter?: boolean
  /** Called after conversation is created or opened; pass conversation id to open Messages view */
  onOpenConversation?: (conversationId: string) => void
  hasApplied?: boolean
  applicationDetails?: ApplicationDetails | null
}

function getGpaClass(gpa: number): string {
  if (gpa >= 3.5) return 'gpa-high'
  if (gpa >= 3.0) return 'gpa-medium'
  return 'gpa-low'
}

export default function StudentCard({ student, isRecruiter, onOpenConversation, hasApplied, applicationDetails }: StudentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const showApplicationDetails = hasApplied && applicationDetails

  const handleMessage = async () => {
    if (!onOpenConversation) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) return
    try {
      const conversation = await getOrCreateConversation(session.user.id, student.id)
      onOpenConversation(conversation.id)
    } catch (err) {
      console.error('Failed to open conversation:', err)
    }
  }

  return (
    <div className={`student-card ${expanded ? 'expanded' : ''} ${hasApplied ? 'has-applied' : ''}`}>
      {hasApplied && (
        <div className="student-card-applied-badge" title="Applied to selected job">
          <CheckCircle size={20} />
        </div>
      )}
      {/* Header */}
      <div className="card-header">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            <User size={24} />
          </div>
          <div>
            <h3 className="student-name">
              {student.firstName} {student.lastName}
            </h3>
            <p className="student-email">
              <Mail size={14} />
              {student.email}
            </p>
          </div>
        </div>
        <span className={`gpa-badge ${getGpaClass(student.gpa)}`}>
          {student.gpa.toFixed(2)} GPA
        </span>
      </div>

      {/* Major & Year */}
      <div className="card-info">
        <span>
          <GraduationCap size={16} />
          {student.degree ? `${student.degree} in ${student.major}` : student.major}
        </span>
        <span className="divider">|</span>
        {student.graduationYear !== 0 ? (
          <span>Class of {student.graduationYear}</span>
        ) : (
          <span>Unknown Graduation Year</span>
        )}
      </div>

      {/* Skills */}
      <div className="card-skills">
        {student.skills.map((skill) => (
          <span key={skill} className="card-skill">
            {skill}
          </span>
        ))}
      </div>

      {showApplicationDetails && (
        <>
          <button
            type="button"
            className="student-card-expand-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                Hide application details <ChevronUp size={16} />
              </>
            ) : (
              <>
                View application details <ChevronDown size={16} />
              </>
            )}
          </button>
          {expanded && applicationDetails && (
            <div className="student-card-application-details">
              {applicationDetails.work_authorization && (
                <div className="application-detail-row">
                  <strong>Work Authorization:</strong>
                  <span>{applicationDetails.work_authorization}</span>
                </div>
              )}
              {applicationDetails.message_to_recruiter && (
                <div className="application-detail-row">
                  <strong>Message to Recruiter:</strong>
                  <p className="application-message">{applicationDetails.message_to_recruiter}</p>
                </div>
              )}
              {!applicationDetails.work_authorization && !applicationDetails.message_to_recruiter && (
                <p className="application-detail-empty">No additional details provided</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Transcript & Resume Status + View Profile */}
      <div className="card-footer">
        <div className="card-footer-docs">
          {student.transcriptUploaded && (
            <div className="transcript-status uploaded non-clickable">
              <FileCheck size={16} />
              Transcript
            </div>
          )}
          {student.resumeUploaded && (
            <div className="transcript-status uploaded non-clickable">
              <FileText size={16} />
              Resume
            </div>
          )}
        </div>
        
        <button
          type="button"
          className="student-card-message-btn"
          onClick={async () => {
            const popup = document.createElement('div')
            popup.className = 'popup'
            const popupBackground = document.createElement('div')
            popupBackground.className = 'popup-background'
            popupBackground.onclick = function() {
              popup.remove()
            }
            popup.appendChild(popupBackground)
            const popupContainer = document.createElement('div')
            popupContainer.className = 'popup-container'
            popup.appendChild(popupContainer)
            
            const root = createRoot(popupContainer);
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            if (!token) {
              popup.remove()
              alert('You must be logged in to access transcripts.')
              return
            }

            let skillScores: Record<string, { score: number; justification?: string }> | null = null
            let resumeAnalysis: any = null
            try {
              const detailRes = await fetch(`${API_BASE}/transcript/detail/${student.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (detailRes.ok) {
                const detail = await detailRes.json()
                student.transcript_analysis = detail?.transcript_analysis
                student.transcript_stats = detail?.transcript_stats
                student.transcript_raw = detail?.transcript_raw
                student.resume_analysis = detail?.resume_analysis
                resumeAnalysis = detail?.resume_analysis
                const cats = detail?.transcript_analysis?.categories
                if (cats && typeof cats === 'object') {
                  skillScores = {}
                  for (const [k, v] of Object.entries(cats)) {
                    const val = v as { score?: number; justification?: string }
                    if (v && typeof v === 'object' && 'score' in v && typeof val.score === 'number') {
                      skillScores[k] = {
                        score: val.score,
                        justification: typeof val.justification === 'string' ? val.justification : undefined
                      }
                    }
                  }
                  if (Object.keys(skillScores).length === 0) skillScores = null
                }
              }
            } catch (_) {
              /* ignore */
            }

            const handleMessage = async () => {
              if (!onOpenConversation) return
              try {
                const conversation = await getOrCreateConversation(session.user.id, student.id)
                popup.remove()
                onOpenConversation(conversation.id)
              } catch (err) {
                console.error('Failed to open conversation:', err)
              }
            }

            if (student.transcript_raw) {
              const programs = []
              for (const program of student.transcript_raw.programs) {
                programs.push(program.degree + ' ' + program.name)
              }
              const transcript = {
                id: student.transcript_raw.student.student_id,
                fullName: student.transcript_raw.student.name,
                institution: student.transcript_raw.institution.name,
                programs: programs,
                gpa: student.transcript_raw.career_totals.undergraduate.gpa,
                units_attempted: student.transcript_raw.career_totals.undergraduate.units_attempted,
                units_earned: student.transcript_raw.career_totals.undergraduate.units_earned,
                units_toward_degree: student.transcript_raw.career_totals.undergraduate.units_toward_degree
              }
              root.render(<StudentTranscriptCard transcript={transcript} student={student} skillScores={skillScores} resumeAnalysis={resumeAnalysis} onMessage={isRecruiter ? handleMessage : undefined} />);
            } else if (typeof(student.transcript) === 'object') {
              root.render(<StudentTranscriptCard transcript={student.transcript as any} student={student} skillScores={skillScores} resumeAnalysis={resumeAnalysis} onMessage={isRecruiter ? handleMessage : undefined} />);
            }

            popup.style.display = 'flex'
            document.body.appendChild(popup)
          }}
          aria-label={`View profile of ${student.firstName} ${student.lastName}`}
        >
          <Eye size={16} />
          View Profile
        </button>
      </div>
    </div>
  )
}
