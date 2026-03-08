import { SmallTranscript, Student } from '../types/student'
//import stanfordRatings from '../data/stanford_ratings.json'

interface StudentTranscriptCardProps {
    transcript: SmallTranscript
    student: Student
}

/*type TranscriptCourse = {
  department: string
  number: string
  component?: string | null
  title?: string | null
  instructors?: string[] | null
  units_attempted?: number | null
  units_earned?: number | null
  grade?: string | null
  grade_points?: number | null
}*/

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

/*const calculateCourseDifficulty = (courses: Array<TranscriptCourse>) => {
    let totalUnits = 0;
    let totalDifficulty = 0;

    for (const course of courses) {
        const courseCode = course.department + course.number;
        const rating = (stanfordRatings as Record<string, number>)[courseCode];
        if (rating !== undefined) {
            totalDifficulty += rating;
            totalUnits += course.units_earned || 0;
        }
    }

    return totalUnits > 0 ? totalDifficulty / totalUnits : 5;
}*/

const getPredictedMajorStats = (student: Student) => {
    console.log(student.transcript_analysis)
    if (student.transcript_stats) {
        const common = student.transcript_stats.common_departments
        if (common) {
            const entries = Object.entries(common as Record<string, number>)
            return entries.sort((a, b) => b[1] - a[1]).slice(0, 2)
        }
    }
    return null
}

export default function StudentTranscriptCard({ transcript, student }: StudentTranscriptCardProps) {
    const predictedMajorStats = getPredictedMajorStats(student)
    return (
        <div className="student-transcript-card">
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
                    {predictedMajorStats ? (
                        <div>
                            <label>Predicted Major: {predictedMajorStats[0][0]} ({predictedMajorStats[0][1]} classes taken)</label>
                            <div className="progress-bar">
                                <div className="progress" style=
                                    {{
                                        width: `${Math.min(predictedMajorStats[0][1] / (predictedMajorStats[0][1] + predictedMajorStats[1][1] + 1) * 100, 100)}%`, 
                                        background: `${percentageToColor(Math.min(predictedMajorStats[0][1] / (predictedMajorStats[0][1] + predictedMajorStats[1][1] + 1) * 100, 100))}`,
                                        borderRadius: '5px'
                                    }}
                                ></div>
                            </div>
                            <label>Also Takes Classes in: {predictedMajorStats[1][0]} ({predictedMajorStats[1][1]} classes taken)</label>
                            <div className="progress-bar">
                                <div className="progress" style=
                                    {{
                                        width: `${Math.min(predictedMajorStats[1][1] / (predictedMajorStats[0][1] + predictedMajorStats[1][1] + 1) * 100, 100)}%`, 
                                        background: `${percentageToColor(Math.min(predictedMajorStats[1][1] / (predictedMajorStats[0][1] + predictedMajorStats[1][1] + 1) * 100, 100))}`,
                                        borderRadius: '5px'
                                    }}
                                ></div>
                            </div>
                        </div>
                    ) : (null)}
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
        </div>
    )
}