import { BrowserRouter, Routes, Route } from 'react-router-dom'
import React, { Suspense } from 'react'
import StudentPage from './pages/StudentPage'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import SignupStudent from './pages/SignupStudent'
import SignupRecruiter from './pages/SignupRecruiter'
import ProtectedRoute from './components/ProtectedRoute'
import Navigation from './layouts/Navigation'
const RecruiterDashboard = React.lazy(() => import('./pages/RecruiterDashboard') as any);

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
            <Route
              path="/student"
              element={
                <ProtectedRoute allowType="student">
                  <StudentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter"
              element={
                <ProtectedRoute allowType="recruiter">
                  <Suspense fallback={<div>Loading...</div>}>
                    <RecruiterDashboard />
                  </Suspense>
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
