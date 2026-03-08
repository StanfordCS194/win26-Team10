import { Users } from 'lucide-react'
import { Student } from '../types/student'
import StudentCard from './StudentCard'

export interface ApplicationDetails {
  work_authorization: string | null
  message_to_recruiter: string | null
}

interface StudentListProps {
  students: Student[]
  /** Recruiter view: show Message button and open conversation on click */
  isRecruiter?: boolean
  onOpenConversation?: (conversationId: string) => void
  /** When set, show applied badge and application details per student */
  appliedStudentIds?: Set<string>
  applicationDetailsMap?: Map<string, ApplicationDetails>
  hasSelectedJob?: boolean
}

export default function StudentList({
  students,
  isRecruiter,
  onOpenConversation,
  appliedStudentIds = new Set(),
  applicationDetailsMap = new Map(),
  hasSelectedJob = false,
}: StudentListProps) {
  if (students.length === 0) {
    return (
      <div className="empty-state">
        <Users size={48} />
        <p>No students match your filters</p>
        <span>Try adjusting your search criteria</span>
      </div>
    )
  }

  return (
    <div className="student-grid">
      {students.map((student) => (
        <StudentCard
          key={student.id}
          student={student}
          isRecruiter={isRecruiter}
          onOpenConversation={onOpenConversation}
          hasApplied={hasSelectedJob && appliedStudentIds.has(student.id)}
          applicationDetails={applicationDetailsMap.get(student.id)}
        />
      ))}
    </div>
  )
}
