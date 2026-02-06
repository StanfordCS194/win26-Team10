import { SmallTranscript } from '../types/student'

interface StudentTranscriptCardProps {
    transcript: SmallTranscript
}

export default function StudentTranscriptCard({ transcript }: StudentTranscriptCardProps) {
    return (
        <div className="student-transcript-card">
            <h3 className="section-title">Condensed Transcript</h3>
            <div className="student-transcript-info">
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
                <div className="info-box">
                    Units Attempted: {transcript.units_attempted}
                </div>
                <div className="info-box">
                    Units Earned: {transcript.units_earned}
                </div>
                <div className="info-box">
                    Units Toward Degree: {transcript.units_toward_degree}
                </div>
            </div>
        </div>
    )
}