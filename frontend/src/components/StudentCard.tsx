import { Mail, GraduationCap, FileCheck, FileX } from 'lucide-react'
import { Student } from '../types/student'

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

      {/* Transcript Status */}
      <div className="card-footer">
        {student.transcriptUploaded ? (
          <span className="transcript-status uploaded">
            <FileCheck size={16} />
            Transcript uploaded
          </span>
        ) : (
          <span className="transcript-status missing">
            <FileX size={16} />
            No transcript
          </span>
        )}
      </div>
    </div>
  )
}
