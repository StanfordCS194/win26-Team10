import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RecruiterDashboard from './pages/RecruiterDashboard'
import StudentPage from './pages/StudentPage'
import Navigation from './layouts/Navigation'

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Navigation />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<RecruiterDashboard />} />
            <Route path="/student" element={<StudentPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
