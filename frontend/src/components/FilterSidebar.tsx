import { Search, X } from 'lucide-react'
import { Filters, MAJORS, GRADUATION_YEARS, ALL_SKILLS } from '../types/student'

interface FilterSidebarProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

export default function FilterSidebar({ filters, onFiltersChange }: FilterSidebarProps) {
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleSkill = (skill: string) => {
    const newSkills = filters.skills.includes(skill)
      ? filters.skills.filter((s) => s !== skill)
      : [...filters.skills, skill]
    updateFilter('skills', newSkills)
  }

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      minGpa: 0,
      maxGpa: 4,
      major: '',
      graduationYear: '',
      skills: [],
    })
  }

  const hasActiveFilters =
    filters.search ||
    filters.minGpa > 0 ||
    filters.maxGpa < 4 ||
    filters.major ||
    filters.graduationYear ||
    filters.skills.length > 0

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Filters</h2>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="clear-btn">
            <X size={14} />
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      <div className="filter-section">
        <label className="filter-label">Search by name</label>
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search students..."
            className="search-input"
          />
        </div>
      </div>

      {/* GPA Range */}
      <div className="filter-section">
        <label className="filter-label">GPA Range</label>
        <div className="gpa-range">
          <input
            type="number"
            min="0"
            max="4"
            step="0.1"
            value={filters.minGpa}
            onChange={(e) => updateFilter('minGpa', parseFloat(e.target.value) || 0)}
            className="input input-small"
          />
          <span>to</span>
          <input
            type="number"
            min="0"
            max="4"
            step="0.1"
            value={filters.maxGpa}
            onChange={(e) => updateFilter('maxGpa', parseFloat(e.target.value) || 4)}
            className="input input-small"
          />
        </div>
      </div>

      {/* Major */}
      <div className="filter-section">
        <label className="filter-label">Major</label>
        <select
          value={filters.major}
          onChange={(e) => updateFilter('major', e.target.value)}
          className="select"
        >
          <option value="">All Majors</option>
          {MAJORS.map((major) => (
            <option key={major} value={major}>
              {major}
            </option>
          ))}
        </select>
      </div>

      {/* Graduation Year */}
      <div className="filter-section">
        <label className="filter-label">Graduation Year</label>
        <select
          value={filters.graduationYear}
          onChange={(e) => updateFilter('graduationYear', e.target.value)}
          className="select"
        >
          <option value="">All Years</option>
          {GRADUATION_YEARS.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Skills */}
      <div className="filter-section">
        <label className="filter-label">Skills</label>
        <div className="skills-grid">
          {ALL_SKILLS.map((skill) => {
            const isSelected = filters.skills.includes(skill)
            return (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`skill-tag ${isSelected ? 'selected' : ''}`}
              >
                {skill}
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
