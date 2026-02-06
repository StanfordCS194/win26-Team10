import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowRole: 'employer' | 'candidate'
}

export default function ProtectedRoute({ children, allowRole }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<'employer' | 'candidate' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadRoleForUser(u: User | null) {
      if (!u) {
        if (!cancelled) {
          setRole(null)
          setLoading(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', u.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Failed to load profile role:', error)
        setRole(null)
      } else {
        const r = data?.role
        setRole(r === 'employer' || r === 'candidate' ? r : null)
      }

      setLoading(false)
    }

    // Check current session + role
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      if (cancelled) return
      setUser(u)
      loadRoleForUser(u)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      if (cancelled) return
      setUser(u)
      setLoading(true)
      loadRoleForUser(u)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.125rem',
        color: '#6b7280'
      }}>
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  // If logged in but role is missing/unknown, send them to signup to complete profile
  if (!role) {
    return <Navigate to="/" replace />
  }

  if (role !== allowRole) {
    return <Navigate to={role === 'candidate' ? '/student' : '/recruiter'} replace />
  }

  return <>{children}</>
}
