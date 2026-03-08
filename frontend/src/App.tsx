import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import { ApplyModalProvider } from './contexts/ApplyModalContext'
import RecruiterDashboard from './pages/RecruiterDashboard'
import RecruiterJobsPage from './pages/RecruiterJobsPage'
import RecruiterProfilePage from './pages/RecruiterProfilePage'
import RecruiterLayout from './layouts/RecruiterLayout'
import StudentPage from './pages/StudentPage'
import StudentDashboard from './pages/StudentDashboard'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import SignupStudent from './pages/SignupStudent'
import SignupRecruiter from './pages/SignupRecruiter'
import ProtectedRoute from './components/ProtectedRoute'
import Navigation from './layouts/Navigation'
import FeedbackSidebar from './components/FeedbackSidebar'

function App() {
  return (
    <BrowserRouter>
      <ApplyModalProvider>
      <div className="app-container">
        <Navigation />
        <FeedbackSidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup-student" element={<SignupStudent />} />
            <Route path="/signup-recruiter" element={<SignupRecruiter />} />
            <Route
              path="/student"
              element={
                <ProtectedRoute allowType="student">
                  {localStorage.getItem('profileCompleted') === 'true' 
                    ? <Navigate to="/student/dashboard" replace />
                    : <StudentPage />
                  }
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/profile"
              element={
                <ProtectedRoute allowType="student">
                  <StudentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute allowType="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter"
              element={
                <ProtectedRoute allowType="recruiter">
                  <RecruiterLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Suspense fallback={<div>Loading...</div>}><RecruiterDashboard /></Suspense>} />
              <Route path="jobs" element={<RecruiterJobsPage />} />
              <Route path="profile" element={<RecruiterProfilePage />} />
            </Route>
          </Routes>
        </div>
      </div>
      </ApplyModalProvider>
    </BrowserRouter>
  )
}

export default App
