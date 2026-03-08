import { useState } from 'react'

export default function RecruiterProfilePage() {
  const [tab, setTab] = useState<'profile' | 'settings'>('profile')

  return (
    <div className="recruiter-profile-page">
      <h1 className="recruiter-profile-title">Profile & Settings</h1>
      <div className="recruiter-profile-tabs">
        <button
          type="button"
          className={`recruiter-profile-tab ${tab === 'profile' ? 'active' : ''}`}
          onClick={() => setTab('profile')}
        >
          Profile
        </button>
        <button
          type="button"
          className={`recruiter-profile-tab ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
      </div>
      {tab === 'profile' && (
        <div className="recruiter-profile-content">
          <p>Profile content coming next.</p>
        </div>
      )}
      {tab === 'settings' && (
        <div className="recruiter-profile-content">
          <p>Settings content coming next.</p>
        </div>
      )}
    </div>
  )
}
