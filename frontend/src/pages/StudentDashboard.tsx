import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, GraduationCap, Briefcase, Building2, DollarSign, Clock, ChevronRight, CheckCircle, ChevronDown, MapPin, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface StudentProfile {
  firstName: string
  lastName: string
  major: string
  graduationYear: string
  gpa: string
}

interface Job {
  id: string
  title: string
  company: string
  location: string
  type: string
  salary: string
  salaryMin: number
  posted: string
  description: string
  skills: string[]
  requirements: string[]
  benefits: string[]
}

const mockJobs: Job[] = [
  {
    id: '1',
    title: 'Software Engineer Intern',
    company: 'Google',
    location: 'Mountain View, CA',
    type: 'Internship',
    salary: '$8,000/mo',
    salaryMin: 8000,
    posted: '2 days ago',
    description: 'Join our team to build scalable systems and work on products used by billions of people worldwide.',
    skills: ['Python', 'Java', 'Distributed Systems'],
    requirements: ['Currently pursuing BS/MS in Computer Science', 'Strong coding skills', 'Experience with data structures and algorithms'],
    benefits: ['Free meals', 'Housing stipend', 'Mentorship program'],
  },
  {
    id: '2',
    title: 'Frontend Developer',
    company: 'Stripe',
    location: 'San Francisco, CA',
    type: 'Full-time',
    salary: '$150k - $200k',
    salaryMin: 150000,
    posted: '1 week ago',
    description: 'Build beautiful, performant interfaces for the future of online payments.',
    skills: ['React', 'TypeScript', 'CSS'],
    requirements: ['3+ years of frontend experience', 'Strong understanding of web fundamentals', 'Experience with design systems'],
    benefits: ['Competitive equity', 'Remote-friendly', 'Learning & development budget'],
  },
  {
    id: '3',
    title: 'Data Science Intern',
    company: 'Meta',
    location: 'Menlo Park, CA',
    type: 'Internship',
    salary: '$9,500/mo',
    salaryMin: 9500,
    posted: '3 days ago',
    description: 'Apply ML techniques to solve problems at massive scale across Facebook, Instagram, and WhatsApp.',
    skills: ['Python', 'Machine Learning', 'SQL'],
    requirements: ['Pursuing degree in CS, Statistics, or related field', 'Experience with ML frameworks', 'Strong analytical skills'],
    benefits: ['Relocation assistance', 'Wellness programs', 'Team events'],
  },
  {
    id: '4',
    title: 'Backend Engineer',
    company: 'Airbnb',
    location: 'Remote',
    type: 'Full-time',
    salary: '$140k - $180k',
    salaryMin: 140000,
    posted: '5 days ago',
    description: 'Design and implement services that power the global travel platform serving millions of guests.',
    skills: ['Go', 'Kubernetes', 'PostgreSQL'],
    requirements: ['5+ years backend experience', 'Experience with microservices', 'Strong system design skills'],
    benefits: ['Travel credits', 'Flexible PTO', 'Home office setup'],
  },
  {
    id: '5',
    title: 'Product Manager Intern',
    company: 'Microsoft',
    location: 'Redmond, WA',
    type: 'Internship',
    salary: '$7,500/mo',
    salaryMin: 7500,
    posted: '1 day ago',
    description: 'Drive product strategy and work with engineering teams to ship features used by enterprises worldwide.',
    skills: ['Product Strategy', 'Data Analysis', 'Communication'],
    requirements: ['Pursuing MBA or related degree', 'Strong communication skills', 'Technical background preferred'],
    benefits: ['Housing provided', 'Networking events', 'Full-time conversion opportunity'],
  },
  {
    id: '6',
    title: 'Machine Learning Engineer',
    company: 'OpenAI',
    location: 'San Francisco, CA',
    type: 'Full-time',
    salary: '$200k - $350k',
    salaryMin: 200000,
    posted: '4 days ago',
    description: 'Work on cutting-edge AI research and build systems that push the boundaries of machine learning.',
    skills: ['Python', 'PyTorch', 'Deep Learning'],
    requirements: ['PhD or equivalent experience', 'Publications in top ML venues', 'Strong engineering skills'],
    benefits: ['Compute credits', 'Research freedom', 'Top-tier compensation'],
  },
]

const ALL_COMPANIES = [...new Set(mockJobs.map(j => j.company))]
const ALL_JOB_TYPES = ['Internship', 'Full-time']

export default function StudentDashboard() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState('')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const navigate = useNavigate()

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [minPay, setMinPay] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        setEmail(session.user.email)
      }

      const savedProfile = localStorage.getItem('studentProfile')
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile))
      }

      const savedApplied = localStorage.getItem('appliedJobs')
      if (savedApplied) {
        setAppliedJobs(new Set(JSON.parse(savedApplied)))
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const handleApply = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newApplied = new Set(appliedJobs)
    newApplied.add(jobId)
    setAppliedJobs(newApplied)
    localStorage.setItem('appliedJobs', JSON.stringify([...newApplied]))
  }

  const toggleExpanded = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCompanies([])
    setSelectedTypes([])
    setMinPay('')
  }

  const toggleFilter = (value: string, selected: string[], setSelected: (v: string[]) => void) => {
    if (selected.includes(value)) {
      setSelected(selected.filter(v => v !== value))
    } else {
      setSelected([...selected, value])
    }
  }

  const filteredJobs = mockJobs.filter(job => {
    if (searchQuery && !job.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !job.company.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (selectedCompanies.length > 0 && !selectedCompanies.includes(job.company)) {
      return false
    }
    if (selectedTypes.length > 0 && !selectedTypes.includes(job.type)) {
      return false
    }
    if (minPay) {
      const minPayNum = parseInt(minPay)
      if (!isNaN(minPayNum) && job.salaryMin < minPayNum) {
        return false
      }
    }
    return true
  })

  const hasActiveFilters = searchQuery || selectedCompanies.length > 0 || selectedTypes.length > 0 || minPay
  const profileComplete = profile && profile.firstName && profile.lastName && profile.major

  if (loading) {
    return (
      <div className="dashboard-loading">
        Loading...
      </div>
    )
  }

  return (
    <div className="student-dashboard">
      <div className="student-dashboard-container">
        <div className="dashboard-top-section">
          <div className="profile-card">
            {profileComplete ? (
              <>
                <div className="profile-avatar">
                  <User size={32} />
                </div>
                <div className="profile-info">
                  <h2 className="profile-name">{profile.firstName} {profile.lastName}</h2>
                  <div className="profile-details">
                    <span className="profile-detail">
                      <GraduationCap size={16} />
                      {profile.major}
                    </span>
                    {profile.graduationYear && (
                      <span className="profile-detail">
                        <Clock size={16} />
                        Class of {profile.graduationYear}
                      </span>
                    )}
                    {profile.gpa && (
                      <span className="profile-detail">
                        GPA: {profile.gpa}
                      </span>
                    )}
                  </div>
                  <p className="profile-email">{email}</p>
                </div>
                <button 
                  className="edit-profile-btn"
                  onClick={() => navigate('/student/profile')}
                >
                  Edit Profile
                </button>
              </>
            ) : (
              <div className="profile-incomplete">
                <div className="incomplete-icon">
                  <User size={32} />
                </div>
                <div className="incomplete-content">
                  <h3>Complete Your Profile</h3>
                  <p>Add your information to be visible to recruiters and apply for jobs.</p>
                </div>
                <button 
                  className="complete-setup-btn"
                  onClick={() => navigate('/student/profile')}
                >
                  Complete Setup
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="jobs-section">
          <div className="jobs-header">
            <h2 className="jobs-title">
              <Briefcase size={24} />
              Open Positions
            </h2>
            <span className="jobs-count">{filteredJobs.length} of {mockJobs.length} jobs</span>
          </div>

          {/* Filters */}
          <div className="jobs-filters">
            <div className="filter-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search jobs or companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="filter-groups">
              <div className="filter-group">
                <label>Company</label>
                <div className="filter-tags">
                  {ALL_COMPANIES.map(company => (
                    <button
                      key={company}
                      className={`filter-tag ${selectedCompanies.includes(company) ? 'selected' : ''}`}
                      onClick={() => toggleFilter(company, selectedCompanies, setSelectedCompanies)}
                    >
                      {company}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label>Job Type</label>
                <div className="filter-tags">
                  {ALL_JOB_TYPES.map(type => (
                    <button
                      key={type}
                      className={`filter-tag ${selectedTypes.includes(type) ? 'selected' : ''}`}
                      onClick={() => toggleFilter(type, selectedTypes, setSelectedTypes)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label>Min Pay</label>
                <div className="filter-pay">
                  <DollarSign size={16} />
                  <input
                    type="number"
                    placeholder="e.g. 100000"
                    value={minPay}
                    onChange={(e) => setMinPay(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearFilters}>
                <X size={16} />
                Clear all filters
              </button>
            )}
          </div>

          {/* Job Listings */}
          <div className="jobs-list">
            {filteredJobs.length === 0 ? (
              <div className="no-jobs">
                <p>No jobs match your filters</p>
                <button onClick={clearFilters}>Clear filters</button>
              </div>
            ) : (
              filteredJobs.map((job) => {
                const hasApplied = appliedJobs.has(job.id)
                const isExpanded = expandedJob === job.id
                return (
                  <div key={job.id} className={`job-card-compact ${isExpanded ? 'expanded' : ''}`}>
                    <div className="job-card-row" onClick={() => toggleExpanded(job.id)}>
                      <div className="job-company-logo">
                        <Building2 size={20} />
                      </div>
                      <div className="job-summary">
                        <span className="job-title-compact">{job.title}</span>
                        <span className="job-company-compact">{job.company}</span>
                      </div>
                      <span className={`job-type-badge ${job.type === 'Internship' ? 'internship' : 'fulltime'}`}>
                        {job.type}
                      </span>
                      <span className="job-salary-compact">{job.salary}</span>
                      <span className="job-posted-compact">{job.posted}</span>
                      {hasApplied ? (
                        <span className="applied-badge">
                          <CheckCircle size={16} />
                          Applied
                        </span>
                      ) : (
                        <button 
                          className="apply-btn-compact"
                          onClick={(e) => handleApply(job.id, e)}
                          disabled={!profileComplete}
                          title={!profileComplete ? 'Complete your profile to apply' : ''}
                        >
                          Apply
                        </button>
                      )}
                      <ChevronDown size={20} className={`expand-icon ${isExpanded ? 'rotated' : ''}`} />
                    </div>

                    {isExpanded && (
                      <div className="job-card-details">
                        <div className="job-detail-section">
                          <h4>Description</h4>
                          <p>{job.description}</p>
                        </div>

                        <div className="job-detail-row">
                          <div className="job-detail-section">
                            <h4>Location</h4>
                            <p className="job-location-detail">
                              <MapPin size={16} />
                              {job.location}
                            </p>
                          </div>
                          <div className="job-detail-section">
                            <h4>Compensation</h4>
                            <p className="job-pay-detail">
                              <DollarSign size={16} />
                              {job.salary}
                            </p>
                          </div>
                        </div>

                        <div className="job-detail-section">
                          <h4>Required Skills</h4>
                          <div className="job-skills-detail">
                            {job.skills.map(skill => (
                              <span key={skill} className="job-skill-tag">{skill}</span>
                            ))}
                          </div>
                        </div>

                        <div className="job-detail-section">
                          <h4>Requirements</h4>
                          <ul className="job-requirements">
                            {job.requirements.map((req, i) => (
                              <li key={i}>{req}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="job-detail-section">
                          <h4>Benefits</h4>
                          <ul className="job-benefits">
                            {job.benefits.map((benefit, i) => (
                              <li key={i}>{benefit}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
