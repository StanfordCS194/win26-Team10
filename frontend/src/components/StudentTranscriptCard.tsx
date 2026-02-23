import { SmallTranscript } from '../types/student'

interface StudentTranscriptCardProps {
    transcript: SmallTranscript
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

export default function StudentTranscriptCard({ transcript }: StudentTranscriptCardProps) {
    return (
        <div className="student-transcript-card">
            <h3 className="section-title">Condensed Transcript</h3>
            <div className="info-box">
                Full Name: {transcript.fullName}
            </div>
            <div className="info-box">
                Institution: {transcript.institution}
            </div>
            <div className="info-box">
                Programs: {transcript.programs.join(', ')}
            </div>
            <div className="info-box">
                GPA: {transcript.gpa}
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
                    <label>Computer Science</label>
                    <div className="progress-bar">
                        <div className="progress" style={{ width: '50%', backgroundColor: 'green', borderRadius: '5px' }}></div>
                    </div>
                    <label>Math</label>
                    <div className="progress-bar">
                        <div className="progress" style={{ width: '20%', backgroundColor: 'green', borderRadius: '5px' }}></div>
                    </div>
                    <label>Physics</label>
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
                    <label>Poor performance rate</label>
                    <div className="progress-bar">
                        <div className="progress" style=
                            {{
                                width: `${Math.min(transcript.units_attempted / 180 * 100, 100)}%`, 
                                background: `${percentageToColor(Math.min(transcript.units_attempted / 180 * 100, 100))}`,
                                borderRadius: '5px'
                            }}
                        ></div>
                    </div>
                    <p>Classes with poor performance: AAA101, BBB102</p>
                    <p>Quarters with poor performance: Spring 2024</p>
                </div>
                <div className="info-box">
                    <h2>Anomalies</h2>
                    <p>Program does not match transcript (Mathematics vs. Undeclared Undergraduate)</p>
                </div>
            </div>
        </div>
    )
}