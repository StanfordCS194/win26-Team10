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
    <div className="student-page">
      <div className="student-page-container">
        <h1 className="page-title">Student Profile</h1>
        <p className="page-description">
          Fill in your information and upload your transcript to be visible to recruiters.
        </p>

        {/* Personal Information */}
        <section className="form-section">
          <h2 className="section-title">Personal Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => updateProfile('firstName', e.target.value)}
                className="input"
                placeholder="John"
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => updateProfile('lastName', e.target.value)}
                className="input"
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => updateProfile('email', e.target.value)}
              className="input"
              placeholder="john.doe@stanford.edu"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Major</label>
              <select
                value={profile.major}
                onChange={(e) => updateProfile('major', e.target.value)}
                className="select"
              >
                <option value="">Select major</option>
                {MAJORS.map((major) => (
                  <option key={major} value={major}>
                    {major}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Graduation Year</label>
              <select
                value={profile.graduationYear}
                onChange={(e) => updateProfile('graduationYear', e.target.value)}
                className="select"
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

          <div className="form-group">
            <label>GPA</label>
            <input
              type="number"
              min="0"
              max="4"
              step="0.01"
              value={profile.gpa}
              onChange={(e) => updateProfile('gpa', e.target.value)}
              className="input input-small"
              placeholder="3.50"
            />
          </div>
        </section>

        {/* Skills */}
        <section className="form-section">
          <h2 className="section-title">Skills</h2>
          <p className="section-description">
            Select the skills that best describe your expertise.
          </p>
          <div className="skills-selection">
            {ALL_SKILLS.map((skill) => {
              const isSelected = profile.skills.includes(skill)
              return (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`skill-btn ${isSelected ? 'selected' : ''}`}
                >
                  {isSelected ? <Check size={14} /> : <Plus size={14} />}
                  {skill}
                </button>
              )
            })}
          </div>
        </section>

        {/* Transcript Upload */}
        <section className="form-section">
          <h2 className="section-title">Transcript</h2>

          {!uploadedFile ? (
            <label className="upload-area">
              <Upload size={32} />
              <span>Click to upload transcript</span>
              <small>PDF, PNG, or JPG (max 10MB)</small>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
              />
            </label>
          ) : (
            <div className="uploaded-file">
              <div className="file-info">
                <FileText size={24} />
                <div>
                  <p className="file-name">{uploadedFile.name}</p>
                  <p className="file-size">{formatFileSize(uploadedFile.size)}</p>
                </div>
              </div>
              <button onClick={removeFile} className="remove-file-btn">
                <X size={20} />
              </button>
            </div>
          )}
        </section>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className={`save-btn ${saved ? 'success' : 'primary'}`}
        >
          {saved ? (
            <>
              <Check size={20} />
              Saved!
            </>
          ) : (
            'Save Profile'
          )}
        </button>
      </div>
    </div>
  )
}
