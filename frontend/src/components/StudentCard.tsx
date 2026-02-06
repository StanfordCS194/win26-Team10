import { Mail, GraduationCap, FileCheck, FileX } from 'lucide-react'
import { Student } from '../types/student'

interface StudentCardProps {
  student: Student
}

function getGpaColor(gpa: number): string {
  if (gpa >= 3.5) return 'text-green-600 bg-green-50'
  if (gpa >= 3.0) return 'text-yellow-600 bg-yellow-50'
  return 'text-red-600 bg-red-50'
}

export default function StudentCard({ student }: StudentCardProps) {
  const gpaColorClass = getGpaColor(student.gpa)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {student.firstName} {student.lastName}
          </h3>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <Mail size={14} />
            {student.email}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${gpaColorClass}`}>
          {student.gpa.toFixed(2)} GPA
        </span>
      </div>

      {/* Major & Year */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <GraduationCap size={16} />
          {student.major}
        </span>
        <span className="text-gray-400">|</span>
        <span>Class of {student.graduationYear}</span>
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {student.skills.map((skill) => (
          <span
            key={skill}
            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
          >
            {skill}
          </span>
        ))}
      </div>

      {/* Transcript Status */}
      <div className="pt-3 border-t border-gray-100">
        {student.transcriptUploaded ? (
          <span className="flex items-center gap-2 text-sm text-green-600">
            <FileCheck size={16} />
            Transcript uploaded
          </span>
        ) : (
          <span className="flex items-center gap-2 text-sm text-gray-400">
            <FileX size={16} />
            No transcript
          </span>
        )}
      </div>
    </div>
  )
}
