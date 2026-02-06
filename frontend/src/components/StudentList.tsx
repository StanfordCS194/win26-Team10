import { Users } from 'lucide-react'
import { Student } from '../types/student'
import StudentCard from './StudentCard'

interface StudentListProps {
  students: Student[]
}

export default function StudentList({ students }: StudentListProps) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Users size={48} className="mb-4 opacity-50" />
        <p className="text-lg">No students match your filters</p>
        <p className="text-sm">Try adjusting your search criteria</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {students.map((student) => (
        <StudentCard key={student.id} student={student} />
      ))}
    </div>
  )
}
