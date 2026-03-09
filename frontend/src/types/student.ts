export interface Student {
  id: string
  firstName: string
  lastName: string
  email: string
  gpa: number
  major: string
  degree?: string
  graduationYear: number
  skills: string[]
  transcriptUploaded: boolean
  transcript: SmallTranscript | null | string
  resumeUploaded: boolean
  resumePath?: string
  workAuthorization?: string | null
  transcript_raw?: any | null
  transcript_stats?: any | null
  transcript_analysis?: any | null
}

export const WORK_AUTH_OPTIONS = [
  'US Citizen or National',
  'Permanent Resident (Green Card)',
  'H-1B Visa',
  'F-1 / OPT',
  'Other work authorization',
] as const

export interface SmallTranscript {
  id: string
  fullName: string
  institution: string
  programs: string[]
  gpa: string
  units_attempted: number
  units_earned: number
  units_toward_degree: number
}

export interface Filters {
  search: string
  minGpa: number
  maxGpa: number
  majors: string[]
  degrees: string[]
  graduationYear: string
  skills: string[]
}

export const DEGREE_OPTIONS = [
  'AA',
  'AS',
  'BA',
  'BArch',
  'BBA',
  'BEng',
  'BFA',
  'BMus',
  'BS',
  'BSN',
  'EdD',
  'JD',
  'LLM',
  'MA',
  'MArch',
  'MBA',
  'MEd',
  'MEng',
  'MFA',
  'MLIS',
  'MPA',
  'MPH',
  'MPP',
  'MS',
  'MSW',
  'PhD',
  'Undeclared',
] as const

export const MAJORS = [
  'Accounting',
  'Actuarial Science',
  'Aerospace Engineering',
  'Agricultural Engineering',
  'Agricultural Science',
  'American Studies',
  'Anthropology',
  'Applied Mathematics',
  'Applied Physics',
  'Architecture',
  'Art History',
  'Biochemistry',
  'Bioengineering',
  'Biology',
  'Biomedical Engineering',
  'Biophysics',
  'Business Administration',
  'Business Analytics',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Classics',
  'Cognitive Science',
  'Communication',
  'Computer Engineering',
  'Computer Science',
  'Construction Management',
  'Criminal Justice',
  'Cybersecurity',
  'Data Science',
  'Design',
  'Earth Science',
  'Economics',
  'Education',
  'Electrical Engineering',
  'Engineering Management',
  'English',
  'Entrepreneurship',
  'Environmental Engineering',
  'Environmental Science',
  'Film Studies',
  'Finance',
  'Game Design',
  'Gender Studies',
  'Geography',
  'Geology',
  'Graphic Design',
  'Health Sciences',
  'History',
  'Hospitality Management',
  'Human Biology',
  'Human-Computer Interaction',
  'Industrial Engineering',
  'Information Systems',
  'Information Technology',
  'International Relations',
  'Journalism',
  'Kinesiology',
  'Linguistics',
  'Management Information Systems',
  'Marketing',
  'Materials Science and Engineering',
  'Mathematics',
  'Mechanical Engineering',
  'Media Studies',
  'Molecular Biology',
  'Neuroscience',
  'Nursing',
  'Nutrition',
  'Operations Management',
  'Operations Research',
  'Philosophy',
  'Physics',
  'Political Science',
  'Pre-Law',
  'Pre-Med',
  'Psychology',
  'Public Health',
  'Public Policy',
  'Robotics',
  'Social Work',
  'Sociology',
  'Software Engineering',
  'Statistics',
  'Supply Chain Management',
  'Theater',
  'Urban Planning',
  'Undeclared',
] as const

export const GRADUATION_YEARS = Array.from({ length: 36 }, (_, i) => String(2000 + i))

export const ALL_SKILLS = [
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Java',
  'C++',
  'Machine Learning',
  'SQL',
  'AWS',
  'Docker',
  'Kubernetes',
  'TensorFlow',
  'PyTorch',
  'Data Analysis',
  'Figma',
] as const
