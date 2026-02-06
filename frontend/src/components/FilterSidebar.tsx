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
    <aside className="w-72 bg-white border-r border-gray-200 p-5 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <X size={14} />
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search by name
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search students..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* GPA Range */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          GPA Range
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            max="4"
            step="0.1"
            value={filters.minGpa}
            onChange={(e) => updateFilter('minGpa', parseFloat(e.target.value) || 0)}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
          />
          <span className="text-gray-500">to</span>
          <input
            type="number"
            min="0"
            max="4"
            step="0.1"
            value={filters.maxGpa}
            onChange={(e) => updateFilter('maxGpa', parseFloat(e.target.value) || 4)}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
          />
        </div>
      </div>

      {/* Major */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Major
        </label>
        <select
          value={filters.major}
          onChange={(e) => updateFilter('major', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
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
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Graduation Year
        </label>
        <select
          value={filters.graduationYear}
          onChange={(e) => updateFilter('graduationYear', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
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
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Skills
        </label>
        <div className="flex flex-wrap gap-2">
          {ALL_SKILLS.map((skill) => {
            const isSelected = filters.skills.includes(skill)
            return (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
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
