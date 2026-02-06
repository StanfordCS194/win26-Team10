import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import RecruiterDashboard from './pages/RecruiterDashboard'
import StudentPage from './pages/StudentPage'
import SignupRecruiter from './pages/Signup-Recruiter'
import SignupCandidate from './pages/Signup-Candidate'
import Navigation from './layouts/Navigation'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Navigation />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup-recruiter" element={<SignupRecruiter />} />
            <Route path="/signup-candidate" element={<SignupCandidate />} />
            <Route
              path="/recruiter"
              element={
                <ProtectedRoute allowRole="employer">
                  <RecruiterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student"
              element={
                <ProtectedRoute allowRole="candidate">
                  <StudentPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
