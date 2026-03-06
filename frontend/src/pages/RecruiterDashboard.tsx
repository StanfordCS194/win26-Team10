import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Plus, CheckCircle } from 'lucide-react'
import { Filters, Student } from '../types/student'
import { mockStudents } from '../data/mockStudents'
import FilterSidebar from '../components/FilterSidebar'
import StudentList from '../components/StudentList'
import PostJobModal from '../components/PostJobModal'
import { supabase } from '../lib/supabase'

const POST_JOB_OPEN_KEY = 'postJobModalOpen'

type CompanyMembershipRow = {
  company_id: string
  status: 'pending' | 'approved' | 'rejected'
  companies: { id: string; name: string } | null
}

type CompanyJobRow = {
  id: string
  title: string
  location: string
  type: string
  created_at: string
  is_active: boolean
  preferred_majors: string[] | null
  preferred_grad_years: string[] | null
  min_gpa: number | null
}

type ApplicantRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  major: string | null
  graduation_year: string | null
  gpa: number | null
  skills: string[] | null
  latest_repr_path: string | null
}

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

function mapApplicantToStudent(row: ApplicantRow): Student {
  return {
    id: row.id,
    firstName: row.first_name || 'Unknown',
    lastName: row.last_name || 'Student',
    email: row.email || '',
    gpa: row.gpa ?? 0,
    major: row.major || 'Undeclared',
    graduationYear: parseInt(row.graduation_year || '0') || 0,
    skills: row.skills || [],
    transcriptUploaded: !!row.latest_repr_path,
    transcript: row.latest_repr_path ? 'supabase' : null,
  }
}

function mergeWithMockStudents(dbStudents: Student[]): Student[] {
  const byId = new Map<string, Student>()
  for (const student of dbStudents) {
    byId.set(student.id, student)
  }
  for (const mockStudent of mockStudents) {
    if (!byId.has(mockStudent.id)) {
      byId.set(mockStudent.id, mockStudent)
    }
  }
  return Array.from(byId.values())
}

function isStudentQualified(student: Student, job: CompanyJobRow | null): boolean {
  if (!job) return true

  if (job.preferred_majors && job.preferred_majors.length > 0) {
    if (!job.preferred_majors.includes(student.major)) return false
  }

  if (job.preferred_grad_years && job.preferred_grad_years.length > 0) {
    if (!job.preferred_grad_years.includes(String(student.graduationYear))) return false
  }

  if (job.min_gpa != null) {
    if (student.gpa < job.min_gpa) return false
  }

  return true
}

export default function RecruiterDashboard() {
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [showPostJob, setShowPostJob] = useState(
    () => sessionStorage.getItem(POST_JOB_OPEN_KEY) === 'true'
  )
  const [jobPostedBanner, setJobPostedBanner] = useState(false)

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyJobs, setCompanyJobs] = useState<CompanyJobRow[]>([])
  const [directoryStudents, setDirectoryStudents] = useState<Student[]>([])
  const [appliedStudentIds, setAppliedStudentIds] = useState<Set<string>>(new Set())
  const [applicationDetailsMap, setApplicationDetailsMap] = useState<Map<string, { work_authorization: string | null; message_to_recruiter: string | null }>>(new Map())

  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [showAppliedOnly, setShowAppliedOnly] = useState(false)
  const [showQualifiedOnly, setShowQualifiedOnly] = useState(false)

  const [companyJobsLoading, setCompanyJobsLoading] = useState(true)
  const [companyJobsError, setCompanyJobsError] = useState('')

  useEffect(() => {
    async function loadCompanyAndStudents() {
      setCompanyJobsLoading(true)
      setCompanyJobsError('')

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const userId = session?.user?.id
        if (!userId) {
          setCompanyJobsError('You must be signed in.')
          setCompanyJobsLoading(false)
          return
        }

        const { data: membership, error: membershipError } = await supabase
          .from('company_memberships')
          .select('company_id, status, companies(id, name)')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle()

        if (membershipError) throw membershipError

        const resolvedMembership = membership as CompanyMembershipRow | null
        const resolvedCompanyId = resolvedMembership?.company_id ?? null
        const resolvedCompanyName = resolvedMembership?.companies?.name ?? null

        setCompanyId(resolvedCompanyId)
        setCompanyName(resolvedCompanyName)

        if (!resolvedCompanyId) {
          setCompanyJobs([])
          setDirectoryStudents([])
          setCompanyJobsError('No approved company is linked to this recruiter account yet.')
          setCompanyJobsLoading(false)
          return
        }

        const { data: jobs, error: jobsError } = await supabase
          .from('jobs')
          .select('id, title, location, type, created_at, is_active, preferred_majors, preferred_grad_years, min_gpa')
          .eq('company_id', resolvedCompanyId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (jobsError) throw jobsError

        const companyJobsRows = (jobs || []) as CompanyJobRow[]
        setCompanyJobs(companyJobsRows)
        setSelectedJobId((prev) => {
          if (prev && companyJobsRows.some(job => job.id === prev)) return prev
          return companyJobsRows[0]?.id || ''
        })

        const { data: applicants, error: applicantsError } = await supabase
          .from('applicants')
          .select('id, first_name, last_name, email, major, graduation_year, gpa, skills, latest_repr_path')

        if (applicantsError) throw applicantsError

        const mappedStudents = ((applicants || []) as ApplicantRow[]).map(mapApplicantToStudent)
        setDirectoryStudents(mergeWithMockStudents(mappedStudents))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load company data.'
        setCompanyJobsError(message)
      } finally {
        setCompanyJobsLoading(false)
      }
    }

    loadCompanyAndStudents()
  }, [jobPostedBanner])

  useEffect(() => {
    async function loadApplicationsForSelectedJob() {
      if (!selectedJobId) {
        setAppliedStudentIds(new Set())
        setApplicationDetailsMap(new Map())
        setShowAppliedOnly(false)
        setShowQualifiedOnly(false)
        return
      }

      const { data, error } = await supabase
        .from('job_applications')
        .select('student_id, work_authorization, message_to_recruiter')
        .eq('job_id', selectedJobId)

      if (error) {
        console.error('Failed to load applications:', error)
        setAppliedStudentIds(new Set())
        setApplicationDetailsMap(new Map())
        return
      }

      const rows = data || []
      setAppliedStudentIds(new Set(rows.map(row => row.student_id as string)))
      const detailsMap = new Map<string, { work_authorization: string | null; message_to_recruiter: string | null }>()
      for (const row of rows) {
        detailsMap.set(row.student_id as string, {
          work_authorization: row.work_authorization ?? null,
          message_to_recruiter: row.message_to_recruiter ?? null,
        })
      }
      setApplicationDetailsMap(detailsMap)
    }

    loadApplicationsForSelectedJob()
  }, [selectedJobId])

  const selectedJob = useMemo(
    () => companyJobs.find(job => job.id === selectedJobId) ?? null,
    [companyJobs, selectedJobId]
  )

  const filteredStudents = useMemo(() => {
    let students = filterStudents(directoryStudents, filters)

    if (showAppliedOnly && selectedJobId) {
      students = students.filter(student => appliedStudentIds.has(student.id))
    }

    if (showQualifiedOnly) {
      students = students.filter(student => isStudentQualified(student, selectedJob))
    }

    return students
  }, [directoryStudents, filters, showAppliedOnly, showQualifiedOnly, selectedJobId, appliedStudentIds, selectedJob])

  const handleJobSuccess = () => {
    setJobPostedBanner(true)
    setTimeout(() => setJobPostedBanner(false), 4000)
  }

  const openPostJob = () => {
    sessionStorage.setItem(POST_JOB_OPEN_KEY, 'true')
    setShowPostJob(true)
  }

  const closePostJob = () => {
    sessionStorage.removeItem(POST_JOB_OPEN_KEY)
    setShowPostJob(false)
  }

  const hasSelectedJob = !!selectedJobId

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
                Showing {filteredStudents.length} of {directoryStudents.length} students
              </p>
              <p className="dashboard-subtitle">Company: {companyName ?? 'Not linked'}</p>
            </div>
            <button className="post-job-btn" onClick={openPostJob}>
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

        <div className="form-section" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>
            My Company Live Jobs
          </h3>
          {companyJobsLoading ? (
            <p className="section-description">Loading jobs...</p>
          ) : companyJobsError ? (
            <p className="section-description" style={{ color: '#b91c1c' }}>
              {companyJobsError}
            </p>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fff',
                }}
              >
                <p className="section-description" style={{ margin: 0 }}>
                  {companyJobs.length} live {companyJobs.length === 1 ? 'job' : 'jobs'} posted for{' '}
                  {companyName}.
                </p>
                <Link to="/recruiter/jobs" className="post-job-btn" style={{ textDecoration: 'none' }}>
                  View all
                </Link>
              </div>

              <div className="form-row" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="filter-label">Adapt directory to job</label>
                  <select
                    className="select"
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                  >
                    <option value="">
                      {companyJobs.length === 0 ? 'No live jobs available' : 'No job selected'}
                    </option>
                    {companyJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} ({job.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <button
                    className={`match-filter-btn${showAppliedOnly ? ' active' : ''}`}
                    onClick={() => setShowAppliedOnly(!showAppliedOnly)}
                    disabled={!hasSelectedJob}
                  >
                    Applied
                  </button>
                  <button
                    className={`match-filter-btn${showQualifiedOnly ? ' active' : ''}`}
                    onClick={() => setShowQualifiedOnly(!showQualifiedOnly)}
                    disabled={!hasSelectedJob}
                  >
                    Qualified
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <StudentList
          students={filteredStudents}
          appliedStudentIds={appliedStudentIds}
          applicationDetailsMap={applicationDetailsMap}
          hasSelectedJob={hasSelectedJob}
        />
      </main>

      {showPostJob && (
        <PostJobModal
          onClose={closePostJob}
          onSuccess={handleJobSuccess}
          companyId={companyId}
          companyName={companyName}
        />
      )}
    </div>
  )
}
