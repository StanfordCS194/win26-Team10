import { useState } from 'react'
import { SmallTranscript, Student } from '../types/student'
import stanfordRatings from '../data/stanford_ratings.json'

const SKILL_LABELS: Record<string, string> = {
  technical_domain_skill: 'Technical',
  problem_solving: 'Problem Solving',
  communication: 'Communication',
  execution: 'Execution',
  collaboration: 'Collaboration',
}

const SKILL_DEFINITIONS: Record<string, string> = {
  technical_domain_skill: 'How strong they are at the core hard skills for the role (based on relevant coursework).',
  problem_solving: 'Ability to analyze, learn quickly, and handle ambiguity (often reflected in difficult math/CS/engineering courses).',
  communication: 'Written, verbal, clarity, stakeholder management (reflected in humanities, writing, or project-based courses).',
  execution: 'Reliability, speed, follow-through, attention to detail (reflected in labs, large projects, and consistent performance).',
  collaboration: 'Teamwork, empathy, feedback, cross-functional work (reflected in group projects or specific collaborative courses).',
}

interface StudentTranscriptCardProps {
    transcript: SmallTranscript
    student: Student
    skillScores?: Record<string, { score: number; justification?: string }> | null
}

const percentageToColor = (percentage: number) => {
  const minColor = { r: 255, g: 0, b: 0 };
  const maxColor = { r: 0, g: 128, b: 0 };

  const colorIndex = {
    r: Math.floor(((maxColor.r - minColor.r) / 100) * percentage) + minColor.r,
    g: Math.floor(((maxColor.g - minColor.g) / 100) * percentage) + minColor.g,
    b: Math.floor(((maxColor.b - minColor.b) / 100) * percentage) + minColor.b
  };

  const colorHex = `#${((1 << 24) + (colorIndex.r << 16) + (colorIndex.g << 8) + colorIndex.b).toString(16).slice(1)}`;

  return colorHex;
};

function RadarChart({ data }: { data: Array<{ key: string; score: number; justification?: string }> }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  if (data.length < 3) return null
  const size = 520
  const padding = 70
  const cx = padding + (size - 2 * padding) / 2
  const cy = padding + (size - 2 * padding) / 2
  const maxRadius = (size - 2 * padding) / 2 - 12
  const labelOffset = 28
  const angleStep = (2 * Math.PI) / data.length
  const axes = data.map((_, i) => {
    const a = -Math.PI / 2 + i * angleStep
    return {
      x: cx + maxRadius * Math.cos(a),
      y: cy + maxRadius * Math.sin(a),
      label: SKILL_LABELS[data[i].key] ?? data[i].key.replace(/_/g, ' '),
      tx: cx + (maxRadius + labelOffset) * Math.cos(a),
      ty: cy + (maxRadius + labelOffset) * Math.sin(a)
    }
  })
  const points = data.map((d, i) => {
    const r = (d.score / 10) * maxRadius
    const a = -Math.PI / 2 + i * angleStep
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
  const gridLevels = [2, 4, 6, 8, 10]
  const viewSize = size + padding * 2
  const viewHeight = 535
  const hoverRadius = 24
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', position: 'relative' }}>
      <h2 className = "info-box-title" style={{ width: '100%', textAlign: 'left', margin: 0, lineHeight: 1.2 }}>Skill Scores</h2>
      <svg width={viewSize} height={viewHeight} viewBox={`0 0 ${viewSize} ${viewHeight}`} style={{ flexShrink: 0 }} preserveAspectRatio="xMidYMid meet">
        {gridLevels.map((level, idx) => {
          const r = (level / 10) * maxRadius
          const pts = data.map((_, i) => {
            const a = -Math.PI / 2 + i * angleStep
            return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
          }).join(' ')
          return (
            <polygon
              key={idx}
              points={pts}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={0.5}
            />
          )
        })}
        {axes.map((ax, i) => (
          <line key={i} x1={cx} y1={cy} x2={ax.x} y2={ax.y} stroke="#e5e7eb" strokeWidth={0.5} />
        ))}
        <polygon
          points={points}
          fill="rgba(55, 48, 163, 0.4)"
          stroke="#3730a3"
          strokeWidth={2}
        />
        {axes.map((ax, i) => (
          <g
            key={i}
            style={{ cursor: data[i].justification ? 'pointer' : 'default' }}
            onMouseEnter={(e) => {
              if (data[i].justification) {
                setHoveredIndex(i)
                const svg = (e.target as SVGElement).ownerSVGElement
                const rect = svg?.getBoundingClientRect()
                if (rect && svg) {
                  const scaleX = rect.width / viewSize
                  const scaleY = rect.height / viewSize
                  setTooltipPos({
                    x: rect.left + ax.tx * scaleX,
                    y: rect.top + ax.ty * scaleY
                  })
                }
              }
            }}
            onMouseLeave={() => setHoveredIndex(null)}
            onMouseMove={(e) => {
              if (hoveredIndex === i && data[i].justification) {
                const svg = (e.target as SVGElement).ownerSVGElement
                const rect = svg?.getBoundingClientRect()
                if (rect && svg) {
                  const scaleX = rect.width / viewSize
                  const scaleY = rect.height / viewSize
                  setTooltipPos({
                    x: rect.left + ax.tx * scaleX,
                    y: rect.top + ax.ty * scaleY
                  })
                }
              }
            }}
          >
            <circle
              cx={ax.tx}
              cy={ax.ty}
              r={hoverRadius}
              fill="transparent"
            />
            <text
              x={ax.tx}
              y={ax.ty}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fill={hoveredIndex === i ? '#3730a3' : '#1f2937'}
              fontWeight={hoveredIndex === i ? 600 : 500}
              pointerEvents="none"
            >
              {ax.label}
            </text>
          </g>
        ))}
      </svg>
      {hoveredIndex !== null && data[hoveredIndex].justification && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%) translateY(-12px)',
            minWidth: 280,
            maxWidth: 420,
            maxHeight: 320,
            overflowY: 'auto',
            padding: '12px 14px',
            background: '#1f2937',
            color: '#f9fafb',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          <strong style={{ display: 'block', marginBottom: 6, color: '#e5e7eb', fontSize: '0.9rem' }}>
            {SKILL_LABELS[data[hoveredIndex].key] ?? data[hoveredIndex].key.replace(/_/g, ' ')} ({data[hoveredIndex].score}/10)
          </strong>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
            {SKILL_DEFINITIONS[data[hoveredIndex].key] ?? ''}
          </p>
          <p style={{ margin: 0 }}>
            {data[hoveredIndex].justification}
          </p>
        </div>
      )}
    </div>
  )
}

const getPredictedMajorStats = (student: Student) => {
    if (student.transcript_stats) {
        const common = student.transcript_stats.common_departments
        if (common) {
            const entries = Object.entries(common as Record<string, number>)
            return entries.sort((a, b) => b[1] - a[1]).slice(0, 2)
        }
    }
    return null
}

const calculateCourseDifficulty = (student: Student) => {
    let totalUnits = 0;
    let totalDifficulty = 0;

    const terms = student.transcript_raw?.terms;
    if (!Array.isArray(terms)) return 5; // probably bad data but might as well show something

    for (const term of terms) {
        if (!Array.isArray(term?.courses)) continue;
        for (const course of term.courses) {
            if (!course.department || !course.number) continue;
            const courseCode = course.department + course.number;
            const rating = (stanfordRatings as Record<string, number>)[courseCode];
            if (rating !== undefined) {
                totalDifficulty += rating * (course.units_earned || 0);
                totalUnits += course.units_earned || 0;
            }
        }
    }

    return totalUnits > 0 ? totalDifficulty / totalUnits : 5;
}

const calculateAdjustedGPA = (transcript: SmallTranscript, courseDifficulty: number) => {
    const gpa = parseFloat(transcript.gpa);
    const adjustedGPA = gpa + (courseDifficulty - 5) * 0.0725 //normalized relative to Stanford
    const schoolAdjustedGPA = Math.min(adjustedGPA, 4) * 3.9/4 + Math.max(adjustedGPA - 4, 0) * 0.1/0.3 //rough mapping to 4.0 scale
    return schoolAdjustedGPA
}

export default function StudentTranscriptCard({ transcript, student, skillScores }: StudentTranscriptCardProps) {
    const predictedMajorStats = getPredictedMajorStats(student)
    const courseDifficulty = calculateCourseDifficulty(student)
    const adjustedGPA = calculateAdjustedGPA(transcript, courseDifficulty)
    const scale = transcript.institution.includes('Stanford') ? 4.3 : 4.0
    const antiSkills = student.transcript_analysis?.class_anti_skills
    const programPerformance = student.transcript_analysis?.topic_rating?.program_performance
    const radarData = skillScores
      ? (['technical_domain_skill', 'problem_solving', 'communication', 'execution', 'collaboration'] as const)
          .filter((k) => skillScores[k] != null)
          .map((k) => ({ key: k, score: skillScores[k]!.score, justification: skillScores[k]!.justification }))
      : []
    return (
        <div className="student-transcript-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <h3 className="section-title">Condensed Transcript</h3>
            <div className="info-box">
                Full Name: {transcript.fullName}
            </div>
            <div className="info-box">
                Institution: {transcript.institution}
            </div>
            <div className="transcript-grid">
                <div className="info-box info-box-stats">
                    <h2 className="info-box-title">Major</h2>
                    <div className="stat-group">
                        <div className="stat-row">
                            <span className="stat-label">Graduation Progress</span>
                            <span className="stat-value">{Math.min(transcript.units_attempted / 180 * 100, 100).toFixed(0)}% <span className="stat-value-muted">({transcript.units_attempted}/180 units)</span></span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress" style={{ width: `${Math.min(transcript.units_attempted / 180 * 100, 100)}%`, background: percentageToColor(Math.min(transcript.units_attempted / 180 * 100, 100)), borderRadius: '5px' }}></div>
                        </div>
                    </div>
                    {predictedMajorStats ? (
                        <>
                            <div className="stat-group">
                                <div className="stat-row">
                                    <span className="stat-label">Predicted Major</span>
                                    <span className="stat-value">{predictedMajorStats[0][0]} <span className="stat-value-muted">({predictedMajorStats[0][1]} classes)</span></span>
                                </div>
                                <div className="progress-bar">
                                    <div className="progress" style={{ width: `${Math.min(predictedMajorStats[0][1] / (predictedMajorStats[0][1] + predictedMajorStats[1][1] + 1) * 100, 100)}%`, background: percentageToColor(Math.min(predictedMajorStats[0][1] / (predictedMajorStats[0][1] + predictedMajorStats[1][1] + 1) * 100, 100)), borderRadius: '5px' }}></div>
                                </div>
                            </div>
                            <div className="stat-group">
                                <div className="stat-row">
                                    <span className="stat-label">Also Takes Classes In</span>
                                    <span className="stat-value">{predictedMajorStats[1][0]} <span className="stat-value-muted">({predictedMajorStats[1][1]} classes)</span></span>
                                </div>
                                <div className="progress-bar">
                                    <div className="progress" style={{ width: `${Math.min(predictedMajorStats[1][1] / (predictedMajorStats[0][1] + predictedMajorStats[1][1] + 1) * 100, 100)}%`, background: percentageToColor(Math.min(predictedMajorStats[1][1] / (predictedMajorStats[0][1] + predictedMajorStats[1][1] + 1) * 100, 100)), borderRadius: '5px' }}></div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
                <div className="info-box info-box-stats">
                    <h2 className="info-box-title">Performance</h2>
                    <div className="stat-row">
                        <span className="stat-label">GPA (Raw)</span>
                        <span className="stat-value">{transcript.gpa} <span className="stat-value-muted">/ {scale.toFixed(3)}</span></span>
                    </div>
                    <div className="stat-group">
                        <div className="stat-row">
                            <span className="stat-label">Adjusted GPA</span>
                            <span className="stat-value">{adjustedGPA.toFixed(3)} <span className="stat-value-muted">/ 4.000</span></span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress" style={{ width: `${Math.min(adjustedGPA / 4 * 100, 100)}%`, background: percentageToColor(Math.min(adjustedGPA / 4 * 100, 100)), borderRadius: '5px' }}></div>
                        </div>
                    </div>
                    <div className="stat-group">
                        <div className="stat-row">
                            <span className="stat-label">Course Difficulty</span>
                            <span className="stat-value">{courseDifficulty.toFixed(1)} <span className="stat-value-muted">/ 10</span></span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress" style={{ width: `${Math.min(courseDifficulty / 10 * 100, 100)}%`, background: percentageToColor(Math.min(courseDifficulty / 10 * 100, 100)), borderRadius: '5px' }}></div>
                        </div>
                    </div>
                </div>
                <div className="info-box info-box-stats">
                    <h2 className="info-box-title">Weaknesses</h2>
                    {antiSkills && antiSkills.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                            {antiSkills.map((item: any, idx: number) => (
                                <div key={idx} style={{ borderLeft: '3px solid #ef4444', paddingLeft: '0.75rem' }}>
                                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '0.8rem', color: '#1f2937' }}>{item.class}</p>
                                    <div style={{ margin: '0 0 0.25rem 0', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                        {item.skills.map((skill: string, sIdx: number) => (
                                            <span key={sIdx} style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '9999px', padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 500 }}>
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.5rem', color: '#6b7280' }}>{item.reason}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="anomaly-clear">
                            <span>!</span>
                            <span>No weakness identified</span>
                        </div>
                    )}
                </div>
                <div className="info-box info-box-stats">
                    <h2 className="info-box-title">Anomalies</h2>
                    {(() => {
                        const anomalies: string[] = []
                        if (Math.abs(student.gpa - parseFloat(transcript.gpa)) > 0.006)
                            anomalies.push(`Reported GPA (${student.gpa.toFixed(3)}) does not match GPA on transcript (${transcript.gpa})`)
                        if (!transcript.programs.join(', ').toLowerCase().includes(student.major.toLowerCase()))
                            anomalies.push(`Major does not match transcript (${student.major} vs. ${transcript.programs.join(', ')})`)
                        if ((student.graduationYear - 2026) * 18 * 3 + 18 + transcript.units_attempted < 180)
                            anomalies.push(`Not on track to graduate by ${student.graduationYear}`)
                        return anomalies.length > 0 ? anomalies.map((msg, i) => (
                            <div key={i} className="anomaly-item">
                                <span className="anomaly-icon">⚠</span>
                                <span className="anomaly-text">{msg}</span>
                            </div>
                        )) : (
                            <div className="anomaly-clear">
                                <span>✓</span>
                                <span>No anomalies detected</span>
                            </div>
                        )
                    })()}
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
                <div className="info-box info-box-stats" style={{ padding: '1.25rem 1.25rem 0 1.25rem', marginBottom: 0, flex: 1 }}>
                    {radarData.length >= 3 ? (
                        <RadarChart data={radarData} />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: '0.9rem' }}>
                            <h2 className="info-box-title">Skill Scores</h2>
                            <p style={{ margin: 0 }}>Skill scores not yet available</p>
                            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>Transcript analysis may still be processing</p>
                        </div>
                    )}
                </div>
                <div className="info-box info-box-stats" style={{ padding: '1.25rem 1.25rem 0 1.25rem', marginBottom: 0, flex: 1 }}>
                    <h2 className="info-box-title">Transcript Analysis</h2>
                    {programPerformance ? (
                        <p>{programPerformance}</p>
                    ) : (
                        <p>Transcript analysis not yet available</p>
                    )}
                </div>
            </div>
            </div>
        </div>
    )
}