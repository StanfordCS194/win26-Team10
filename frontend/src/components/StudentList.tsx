import { Users } from 'lucide-react'
import { Student } from '../types/student'
import StudentCard from './StudentCard'

interface StudentListProps {
  students: Student[]
  isRecruiter?: boolean
  onOpenConversation?: (conversationId: string) => void
}

export default function StudentList({ students, isRecruiter, onOpenConversation }: StudentListProps) {
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
        />
      ))}
    </div>
  )
}
