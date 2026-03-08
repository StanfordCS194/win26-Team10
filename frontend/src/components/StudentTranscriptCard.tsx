import { SmallTranscript, Student } from '../types/student'

const SKILL_LABELS: Record<string, string> = {
  technical_domain_skill: 'Technical',
  problem_solving: 'Problem Solving',
  communication: 'Communication',
  execution: 'Execution',
  collaboration: 'Collaboration',
}

interface StudentTranscriptCardProps {
    transcript: SmallTranscript
    student: Student
    skillScores?: Record<string, { score: number }> | null
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

function RadarChart({ data }: { data: Array<{ key: string; score: number }> }) {
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
    return { x: cx + maxRadius * Math.cos(a), y: cy + maxRadius * Math.sin(a), label: SKILL_LABELS[data[i].key] ?? data[i].key.replace(/_/g, ' ') }
  })
  const points = data.map((d, i) => {
    const r = (d.score / 10) * maxRadius
    const a = -Math.PI / 2 + i * angleStep
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
  const gridLevels = [2, 4, 6, 8, 10]
  const viewSize = size + padding * 2
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
      <h2 style={{ width: '100%', textAlign: 'left', margin: '0 0 4px 0' }}>Skill Scores</h2>
      <svg width={viewSize} height={viewSize} viewBox={`0 0 ${viewSize} ${viewSize}`} style={{ flexShrink: 0 }}>
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
          <text
            key={i}
            x={cx + (maxRadius + labelOffset) * ((ax.x - cx) / maxRadius)}
            y={cy + (maxRadius + labelOffset) * ((ax.y - cy) / maxRadius)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fill="#1f2937"
            fontWeight={500}
          >
            {ax.label}
          </text>
        ))}
      </svg>
    </div>
  )
}

export default function StudentTranscriptCard({ transcript, student, skillScores }: StudentTranscriptCardProps) {
    const radarData = skillScores
      ? (['technical_domain_skill', 'problem_solving', 'communication', 'execution', 'collaboration'] as const)
          .filter((k) => skillScores[k] != null)
          .map((k) => ({ key: k, score: skillScores[k]!.score }))
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
            <div className="info-box">
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