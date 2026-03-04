import { Mail, GraduationCap, FileCheck, FileText } from 'lucide-react'
import { Student } from '../types/student'
import StudentTranscriptCard from './StudentTranscriptCard'
import { createRoot } from 'react-dom/client';
import { supabase } from '../lib/supabase'
import { createResumeViewer } from './ResumeViewer'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://api-production-d25a.up.railway.app'

interface StudentCardProps {
  student: Student
}

function getGpaClass(gpa: number): string {
  if (gpa >= 3.5) return 'gpa-high'
  if (gpa >= 3.0) return 'gpa-medium'
  return 'gpa-low'
}

export default function StudentCard({ student }: StudentCardProps) {
  return (
    <div className="student-card">
      {/* Header */}
      <div className="card-header">
        <div>
          <h3 className="student-name">
            {student.firstName} {student.lastName}
          </h3>
          <p className="student-email">
            <Mail size={14} />
            {student.email}
          </p>
        </div>
        <span className={`gpa-badge ${getGpaClass(student.gpa)}`}>
          {student.gpa.toFixed(2)} GPA
        </span>
      </div>

      {/* Major & Year */}
      <div className="card-info">
        <span>
          <GraduationCap size={16} />
          {student.major}
        </span>
        <span className="divider">|</span>
        <span>Class of {student.graduationYear}</span>
      </div>

      {/* Skills */}
      <div className="card-skills">
        {student.skills.map((skill) => (
          <span key={skill} className="card-skill">
            {skill}
          </span>
        ))}
      </div>

      {/* Transcript & Resume Status */}
      <div className="card-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {student.transcriptUploaded && (
          <div className="transcript-status uploaded" onClick={async () => {
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
            if (student.transcript != null){
              const root = createRoot(popupContainer);
              if (typeof(student.transcript) === 'string') {
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token
                if (!token) {
                  throw new Error('You must be logged in to access transcripts.')
                }
                const transcriptRes = await fetch(`${API_BASE}/get_specific_transcript/${student.id}`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                if (!transcriptRes.ok) {
                  throw new Error(await transcriptRes.text())
                }
                const rawTranscript = await transcriptRes.json()
                const programs = []
                for (const program of rawTranscript.programs) {
                  programs.push(program.degree + ' ' + program.name)
                }
                const transcript = {
                  id: rawTranscript.student.student_id,
                  fullName: rawTranscript.student.name,
                  institution: rawTranscript.institution.name,
                  programs: programs,
                  gpa: rawTranscript.career_totals.undergraduate.gpa,
                  units_attempted: rawTranscript.career_totals.undergraduate.units_attempted,
                  units_earned: rawTranscript.career_totals.undergraduate.units_earned,
                  units_toward_degree: rawTranscript.career_totals.undergraduate.units_toward_degree
                }
                root.render(<StudentTranscriptCard transcript={transcript} student={student}/>);
              } else {
                root.render(<StudentTranscriptCard transcript={student.transcript} student={student}/>);
              }
            }
            popup.style.display = 'flex'
            document.body.appendChild(popup)
          }}>
            <FileCheck size={16} />
            Transcript uploaded
          </div>
        )}
        
        {/* Resume Status */}
        {student.resumeUploaded && (
          <div className="transcript-status uploaded" onClick={async () => {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            if (!token) {
              alert('You must be logged in to view resumes.')
              return
            }
            
            try {
              const resumeRes = await fetch(`${API_BASE}/get_resume/${student.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              
              if (!resumeRes.ok) {
                throw new Error(await resumeRes.text())
              }
              
              // Get the blob and create a URL
              const blob = await resumeRes.blob()
              const url = window.URL.createObjectURL(blob)
              
              // Create and show popup
              const popup = createResumeViewer(url, () => {
                window.URL.revokeObjectURL(url)
              })
              document.body.appendChild(popup)
            } catch (err) {
              alert('Failed to load resume: ' + (err instanceof Error ? err.message : String(err)))
            }
          }}>
            <FileText size={16} />
            Resume uploaded
          </div>
        )}
      </div>
    </div>
  )
}
