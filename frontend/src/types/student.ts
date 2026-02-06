export interface Student {
  id: string
  firstName: string
  lastName: string
  email: string
  gpa: number
  major: string
  graduationYear: number
  skills: string[]
  transcriptUploaded: boolean
}

export interface Filters {
  search: string
  minGpa: number
  maxGpa: number
  major: string
  graduationYear: string
  skills: string[]
}

export const MAJORS = [
  'Computer Science',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Mathematics',
  'Physics',
  'Data Science',
  'Business Administration',
  'Economics',
] as const

export const GRADUATION_YEARS = ['2025', '2026', '2027', '2028'] as const

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
