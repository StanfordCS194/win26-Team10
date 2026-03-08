import { useState } from 'react'
import { SmallTranscript, Student } from '../types/student'

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
      <h2 style={{ width: '100%', textAlign: 'left', margin: 0, lineHeight: 1.2 }}>Skill Scores</h2>
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

export default function StudentTranscriptCard({ transcript, student, skillScores }: StudentTranscriptCardProps) {
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
                <div className="info-box">
                    <h2>Major</h2>
                    <label>Graduation progress: {Math.min(transcript.units_attempted / 180 * 100, 100).toFixed(0)}% ({transcript.units_attempted}/180)</label>
                    <div className="progress-bar">
                        <div className="progress" style=
                            {{
                                width: `${Math.min(transcript.units_attempted / 180 * 100, 100)}%`, 
                                background: `${percentageToColor(Math.min(transcript.units_attempted / 180 * 100, 100))}`,
                                borderRadius: '5px'
                            }}
                        ></div>
                    </div>
                    <label>{student.major}</label>
                    <div className="progress-bar">
                        <div className="progress" style={{ width: '50%', backgroundColor: 'green', borderRadius: '5px' }}></div>
                    </div>
                    <label>{student.major === "Computer Science" ? "Math" : "Computer Science"}</label>
                    <div className="progress-bar">
                        <div className="progress" style={{ width: '20%', backgroundColor: 'green', borderRadius: '5px' }}></div>
                    </div>
                </div>
                <div className="info-box">
                    <h2>Performance</h2>
                    <p>GPA: {transcript.gpa}</p>
                    <label>Adjusted GPA: {(Math.min(parseFloat(transcript.gpa), 4) * 3.9/4 + Math.max(parseFloat(transcript.gpa) - 4, 0) * 0.1/0.3).toFixed(3)}</label>
                    <div className="progress-bar">
                        <div className="progress" style=
                            {{
                                width: `${Math.min((Math.min(parseFloat(transcript.gpa), 4) * 3.9/4 + Math.max(parseFloat(transcript.gpa) - 4, 0) * 0.1/0.3) / 4 * 100, 100)}%`, 
                                background: `${percentageToColor(Math.min((Math.min(parseFloat(transcript.gpa), 4) * 3.9/4 + Math.max(parseFloat(transcript.gpa) - 4, 0) * 0.1/0.3) / 4 * 100, 100))}`,
                                borderRadius: '5px'
                            }}
                        ></div>
                    </div>
                    <label>Course difficulty</label>
                    <div className="progress-bar">
                        <div className="progress" style={{ width: '50%', backgroundColor: percentageToColor(50), borderRadius: '5px' }}></div>
                    </div>
                </div>
                <div className="info-box">
                    <h2>Weaknesses</h2>
                    <label>Poor performance rate: {(20*(4.1 - parseFloat(transcript.gpa))).toFixed(0)}%</label>
                    <div className="progress-bar">
                        <div className="progress" style=
                            {{
                                width: `${Math.min((20*(4.1 - parseFloat(transcript.gpa))) / 30 * 100, 100)}%`, 
                                background: `${percentageToColor(100 - Math.min((20*(4.1 - parseFloat(transcript.gpa))) / 30 * 100, 100))}`,
                                borderRadius: '5px'
                            }}
                        ></div>
                    </div>
                    <p>Classes with poor performance: AAA101, BBB102</p>
                    <p>Quarters with poor performance: Spring 2024</p>
                </div>
                <div className="info-box">
                    <h2>Anomalies</h2>
                    {Math.abs(student.gpa - parseFloat(transcript.gpa)) > 0.006 && (
                        <p>Student GPA does not match transcript GPA ({student.gpa} vs. {transcript.gpa})</p>
                    )}
                    {!transcript.programs.join(', ').toLowerCase().includes(student.major.toLowerCase()) ? (
                        <p>Major does not match transcript ({student.major} vs. {transcript.programs.join(', ')})</p>
                    ) : null}
                    {(student.graduationYear - 2026) * 18*3 + 18 + transcript.units_attempted < 180 && (
                        <p>Not on track to graduate by {student.graduationYear}</p>
                    )}
                </div>
            </div>
            <div className="info-box" style={{ padding: '1.25rem 1.25rem 0 1.25rem', marginBottom: 0 }}>
                {radarData.length >= 3 ? (
                    <RadarChart data={radarData} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: '0.9rem' }}>
                        <h2>Skill Scores</h2>
                        <p style={{ margin: 0 }}>Skill scores not yet available</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>Transcript analysis may still be processing</p>
                    </div>
                )}
            </div>
            </div>
        </div>
    )
}