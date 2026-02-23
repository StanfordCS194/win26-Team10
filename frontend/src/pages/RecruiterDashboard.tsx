import { useState, useMemo } from 'react'
import { Users } from 'lucide-react'
import { Filters, Student } from '../types/student'
import { mockStudents } from '../data/mockStudents'
import FilterSidebar from '../components/FilterSidebar'
import StudentList from '../components/StudentList'
import { supabase } from '../lib/supabase'

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

export default async function RecruiterDashboard() {
  const [filters, setFilters] = useState<Filters>(initialFilters)

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    throw new Error('You must be logged in to access transcripts.')
  }

  const transcriptRes = await fetch(`${API_BASE}/get_all_latest_transcripts`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!transcriptRes.ok) {
    throw new Error(await transcriptRes.text())
  }
  
  const loadedStudents = []
  const allTranscripts = await transcriptRes.json()
  for (const student in allTranscripts) {
    const transcript = allTranscripts[student]
    const programs = []
    for (const program of transcript.programs) {
      programs.push(program.degree + ' ' + program.name)
    }
    const newStudent = {
      id: student,
      firstName: 'FIRST NAME',
      lastName: 'LAST NAME',
      email: 'EMAIL',
      gpa: 3.92,
      major: 'MAJOR',
      graduationYear: 2026,
      skills: ['Python', 'React', 'Machine Learning', 'TensorFlow'],
      transcriptUploaded: true,
      transcript: {
        id: transcript.student.student_id,
        fullName: transcript.student.name,
        institution: transcript.institution.name,
        programs: programs,
        gpa: transcript.career_totals.undergraduate.gpa,
        units_attempted: transcript.career_totals.undergraduate.units_attempted,
        units_earned: transcript.career_totals.undergraduate.units_earned,
        units_toward_degree: transcript.career_totals.undergraduate.units_toward_degree
      },
    }
    loadedStudents.push(newStudent)
  }

  mockStudents.push(...loadedStudents)

  const filteredStudents = useMemo(
    () => filterStudents(mockStudents, filters),
    [filters]
  )

  return (
    <div className="dashboard">
      <FilterSidebar filters={filters} onFiltersChange={setFilters} />

      <main className="dashboard-main">
        <div className="dashboard-header">
          <h1 className="dashboard-title">
            <Users />
            Student Directory
          </h1>
          <p className="dashboard-subtitle">
            Showing {filteredStudents.length} of {mockStudents.length} students
          </p>
        </div>

        <StudentList students={filteredStudents} />
      </main>
    </div>
  )
}
