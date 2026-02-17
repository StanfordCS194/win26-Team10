import { Link } from 'react-router-dom'
import { Briefcase, GraduationCap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="student-page">
      <div className="student-page-container">
        <h1 className="page-title">Welcome to TalentMatch</h1>
        <p className="page-description">
          Get started by choosing how you&apos;d like to use our platform.
        </p>

        <div className="landing-login-row">
          <Link to="/login" className="landing-login-btn">
            Log In
          </Link>
        </div>

        <div className="landing-choice-grid">
          <Link to="/signup-recruiter" className="landing-choice-card">
            <Briefcase size={48} className="landing-choice-icon" />
            <h2 className="landing-choice-title">I&apos;m a Recruiter</h2>
            <p className="landing-choice-description">
              Post jobs and find talented candidates for your team.
            </p>
            <span className="landing-choice-cta">Sign up as Recruiter</span>
          </Link>

          <Link to="/signup-student" className="landing-choice-card">
            <GraduationCap size={48} className="landing-choice-icon" />
            <h2 className="landing-choice-title">I&apos;m a Student</h2>
            <p className="landing-choice-description">
              Build your profile and get discovered by recruiters.
            </p>
            <span className="landing-choice-cta">Sign up as Student</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
