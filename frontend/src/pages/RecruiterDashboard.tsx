import { useState, useMemo } from 'react'
import { Users } from 'lucide-react'
import { Filters, Student } from '../types/student'
import { mockStudents } from '../data/mockStudents'
import FilterSidebar from '../components/FilterSidebar'
import StudentList from '../components/StudentList'

const initialFilters: Filters = {
  search: '',
  minGpa: 0,
  maxGpa: 4,
  major: '',
  graduationYear: '',
  skills: [],
}

function filterStudents(students: Student[], filters: Filters): Student[] {
  return students.filter((student) => {
    // Search filter (name)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase()
      if (!fullName.includes(searchLower)) {
        return false
      }
    }

    // GPA range filter
    if (student.gpa < filters.minGpa || student.gpa > filters.maxGpa) {
      return false
    }

    // Major filter
    if (filters.major && student.major !== filters.major) {
      return false
    }

    // Graduation year filter
    if (filters.graduationYear && student.graduationYear !== parseInt(filters.graduationYear)) {
      return false
    }

    // Skills filter (student must have ALL selected skills)
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
  const [filters, setFilters] = useState<Filters>(initialFilters)

  const filteredStudents = useMemo(
    () => filterStudents(mockStudents, filters),
    [filters]
  )

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <FilterSidebar filters={filters} onFiltersChange={setFilters} />

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="text-blue-600" />
            Student Directory
          </h1>
          <p className="text-gray-600 mt-1">
            Showing {filteredStudents.length} of {mockStudents.length} students
          </p>
        </div>

        {/* Student Grid */}
        <StudentList students={filteredStudents} />
      </main>
    </div>
  )
}
