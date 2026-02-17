import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RecruiterDashboard from './pages/RecruiterDashboard'
import StudentPage from './pages/StudentPage'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import SignupStudent from './pages/SignupStudent'
import SignupRecruiter from './pages/SignupRecruiter'
import Navigation from './layouts/Navigation'

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Navigation />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup-student" element={<SignupStudent />} />
            <Route path="/signup-recruiter" element={<SignupRecruiter />} />
            <Route path="/student" element={<StudentPage />} />
            <Route path="/recruiter" element={<RecruiterDashboard />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
