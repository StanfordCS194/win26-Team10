import { useState, useMemo, useEffect} from 'react'
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

export default function RecruiterDashboard() {
  const [complete, setComplete] = useState<Array<any> | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        throw new Error('You must be logged in to access transcripts.')
      }

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
  if (!complete) return <div>Loading...</div>;
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

        <StudentList
          students={filteredStudents}
          isRecruiter
          onOpenConversation={setOpenConversationId}
        />
      </main>
    </div>
  )
}
