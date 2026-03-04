import { useState, useMemo/*, useEffect*/} from 'react'
import { Users, Plus, CheckCircle } from 'lucide-react'
import { Filters, Student } from '../types/student'
import { mockStudents } from '../data/mockStudents'
import FilterSidebar from '../components/FilterSidebar'
import StudentList from '../components/StudentList'
import PostJobModal from '../components/PostJobModal'
//import { supabase } from '../lib/supabase'

const initialFilters: Filters = {
  search: '',
  minGpa: 0,
  maxGpa: 4,
  major: '',
  graduationYear: '',
  skills: [],
}

//const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://api-production-d25a.up.railway.app'

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
  //const [complete, setComplete] = useState<Array<any> | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [showPostJob, setShowPostJob] = useState(false)
  const [jobPostedBanner, setJobPostedBanner] = useState(false)
  /*useEffect(() => {
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
      
      const allStudents = await users.json()
      setComplete(allStudents);
    }
    load();
  }, []);
  const loadedStudents = []
  if (complete != null) {
    const allStudents = complete
    for (const student of allStudents) {
      const newStudent = {
        id: student.id,
        firstName: 'FIRST NAME',
        lastName: 'LAST NAME',
        email: 'EMAIL',
        gpa: 3.92,
        major: 'MAJOR',
        graduationYear: 2026,
        skills: ['Python', 'React', 'Machine Learning', 'TensorFlow'],
        transcriptUploaded: false,
        transcript: null, //"supabase",
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
  }*/ // TODO: fix student duplication
  const filteredStudents = useMemo(
    () => filterStudents(mockStudents, filters),
    [filters]
  )
  const handleJobSuccess = () => {
    setJobPostedBanner(true)
    setTimeout(() => setJobPostedBanner(false), 4000)
  }

  //if (!complete) return <div>Loading...</div>;
  return (
    <div className="dashboard">
      <FilterSidebar filters={filters} onFiltersChange={setFilters} />

      <main className="dashboard-main">
        <div className="dashboard-header">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1 className="dashboard-title">
                <Users />
                Student Directory
              </h1>
              <p className="dashboard-subtitle">
                Showing {filteredStudents.length} of {mockStudents.length} students
              </p>
            </div>
            <button className="post-job-btn" onClick={() => setShowPostJob(true)}>
              <Plus size={16} />
              Post a Job
            </button>
          </div>

          {jobPostedBanner && (
            <div className="success-banner" style={{ marginTop: '1rem' }}>
              <CheckCircle size={18} />
              Job posted successfully!
            </div>
          )}
        </div>

        <StudentList students={filteredStudents} />
      </main>

      {showPostJob && (
        <PostJobModal
          onClose={() => setShowPostJob(false)}
          onSuccess={handleJobSuccess}
        />
      )}
    </div>
  )
}
