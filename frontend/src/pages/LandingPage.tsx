import { Link } from 'react-router-dom'
import { Briefcase, GraduationCap, CheckCircle, Search, Users, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <h1 className="hero-title">
            Connecting <span className="text-primary">Future Talent</span> with <span className="text-primary">Great Opportunities</span>
          </h1>
          <p className="hero-subtitle">
            The premier recruitment platform focused on matching ambitious students with industry-leading jobs and helping recruiters find the best emerging talent.
          </p>
          <div className="hero-cta-row">
            <Link to="/signup-student" className="btn-primary">
              I&apos;m a Student
            </Link>
            <Link to="/signup-recruiter" className="btn-secondary">
              I&apos;m a Recruiter
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="section-heading">Why Choose TalentMatch?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <Search className="feature-icon" />
              </div>
              <h3 className="feature-title">Smart Matching</h3>
              <p className="feature-text">
                Our algorithms connect students with roles that perfectly match their skills and aspirations.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <Users className="feature-icon" />
              </div>
              <h3 className="feature-title">Top Talent Pool</h3>
              <p className="feature-text">
                Recruiters gain access to a curated pool of high-achieving students from top universities.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <Zap className="feature-icon" />
              </div>
              <h3 className="feature-title">Fast-Track Hiring</h3>
              <p className="feature-text">
                Streamlined communication and application processes to get you hired or find your next hire faster.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Role Selection Section */}
      <section className="roles-section">
        <div className="roles-container">
          <h2 className="section-heading">Get Started Today</h2>
          <div className="landing-choice-grid">
            <Link to="/signup-recruiter" className="landing-choice-card">
              <Briefcase size={48} className="landing-choice-icon" />
              <h2 className="landing-choice-title">For Recruiters</h2>
              <p className="landing-choice-description">
                Post jobs, browse student profiles, and find the perfect fit for your team&apos;s needs.
              </p>
              <div className="role-features">
                <div className="role-feature-item"><CheckCircle size={16} /> Verified Student Data</div>
                <div className="role-feature-item"><CheckCircle size={16} /> Advanced Filtering</div>
                <div className="role-feature-item"><CheckCircle size={16} /> Direct Messaging</div>
              </div>
              <span className="landing-choice-cta">Start Recruiting</span>
            </Link>

            <Link to="/signup-student" className="landing-choice-card">
              <GraduationCap size={48} className="landing-choice-icon" />
              <h2 className="landing-choice-title">For Students</h2>
              <p className="landing-choice-description">
                Build a professional profile, showcase your achievements, and get discovered by top employers.
              </p>
              <div className="role-features">
                <div className="role-feature-item"><CheckCircle size={16} /> Personalized Job Alerts</div>
                <div className="role-feature-item"><CheckCircle size={16} /> Skill Assessments</div>
                <div className="role-feature-item"><CheckCircle size={16} /> Career Resources</div>
              </div>
              <span className="landing-choice-cta">Join as Student</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer-like CTA */}
      <section className="final-cta-section">
        <div className="final-cta-container">
          <h2>Ready to transform your career or team?</h2>
          <Link to="/login" className="landing-login-btn">
            Log In to Your Account
          </Link>
        </div>
      </section>
    </div>
  )
}
