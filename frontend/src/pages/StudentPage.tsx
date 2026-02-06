import { useState } from 'react'
import { Upload, FileText, X, Check, Plus } from 'lucide-react'
import { MAJORS, GRADUATION_YEARS, ALL_SKILLS } from '../types/student'

interface StudentProfile {
  firstName: string
  lastName: string
  email: string
  major: string
  graduationYear: string
  gpa: string
  skills: string[]
}

interface UploadedFile {
  name: string
  size: number
  type: string
  preview: string | null
}

const initialProfile: StudentProfile = {
  firstName: '',
  lastName: '',
  email: '',
  major: '',
  graduationYear: '',
  gpa: '',
  skills: [],
}

export default function StudentPage() {
  const [profile, setProfile] = useState<StudentProfile>(initialProfile)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [saved, setSaved] = useState(false)

  const updateProfile = <K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) => {
    setProfile({ ...profile, [key]: value })
    setSaved(false)
  }

  const toggleSkill = (skill: string) => {
    const newSkills = profile.skills.includes(skill)
      ? profile.skills.filter((s) => s !== skill)
      : [...profile.skills, skill]
    updateProfile('skills', newSkills)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        preview: file.type === 'application/pdf' ? null : (reader.result as string),
      })
      setSaved(false)
    }
    reader.readAsDataURL(file)
  }

  const removeFile = () => {
    setUploadedFile(null)
    setSaved(false)
  }

  const handleSave = () => {
    // In a real app, this would send to the backend
    console.log('Saving profile:', profile)
    console.log('Uploaded file:', uploadedFile)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Profile</h1>
        <p className="text-gray-600 mb-8">
          Fill in your information and upload your transcript to be visible to recruiters.
        </p>

        {/* Personal Information */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => updateProfile('firstName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => updateProfile('lastName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => updateProfile('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="john.doe@stanford.edu"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Major
              </label>
              <select
                value={profile.major}
                onChange={(e) => updateProfile('major', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="">Select major</option>
                {MAJORS.map((major) => (
                  <option key={major} value={major}>
                    {major}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Graduation Year
              </label>
              <select
                value={profile.graduationYear}
                onChange={(e) => updateProfile('graduationYear', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="">Select year</option>
                {GRADUATION_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GPA
            </label>
            <input
              type="number"
              min="0"
              max="4"
              step="0.01"
              value={profile.gpa}
              onChange={(e) => updateProfile('gpa', e.target.value)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="3.50"
            />
          </div>
        </section>

        {/* Skills */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills</h2>
          <p className="text-sm text-gray-600 mb-4">
            Select the skills that best describe your expertise.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_SKILLS.map((skill) => {
              const isSelected = profile.skills.includes(skill)
              return (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {isSelected ? <Check size={14} /> : <Plus size={14} />}
                  {skill}
                </button>
              )
            })}
          </div>
        </section>

        {/* Transcript Upload */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Transcript</h2>

          {!uploadedFile ? (
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="text-gray-400 mb-2" size={32} />
              <span className="text-gray-600">Click to upload transcript</span>
              <span className="text-sm text-gray-400 mt-1">PDF, PNG, or JPG (max 10MB)</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <FileText className="text-blue-600" size={24} />
                <div>
                  <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(uploadedFile.size)}</p>
                </div>
              </div>
              <button
                onClick={removeFile}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          )}
        </section>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {saved ? (
            <span className="flex items-center justify-center gap-2">
              <Check size={20} />
              Saved!
            </span>
          ) : (
            'Save Profile'
          )}
        </button>
      </div>
    </div>
  )
}
