import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

type UserType = 'student' | 'recruiter'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowType: UserType
}

export default function ProtectedRoute({ children, allowType }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)
  const userTypeRef = useRef<UserType | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadTypeForUser(u: User | null) {
      if (!u) {
        if (!cancelled) {
          setUserType(null)
          userTypeRef.current = null
          userIdRef.current = null
          setLoading(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('type')
        .eq('id', u.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Failed to load user type:', error)
        if (!cancelled) {
          setUserType(null)
          userTypeRef.current = null
        }
      } else {
        const t = data?.type
        const resolvedType = t === 'student' || t === 'recruiter' ? t : null
        if (resolvedType) {
          setUserType(resolvedType)
          userTypeRef.current = resolvedType
        } else {
          setUserType(null)
          userTypeRef.current = null
        }
      }
      if (!cancelled) setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      if (cancelled) return
      setUser(u)
      userIdRef.current = u?.id ?? null
      loadTypeForUser(u)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      if (cancelled) return
      setUser(u)

      const nextUserId = u?.id ?? null
      const isSameUser = userIdRef.current === nextUserId
      userIdRef.current = nextUserId

      // Token refresh happens often (including tab switches). Avoid remount flicker/state loss.
      if (event === 'TOKEN_REFRESHED' && isSameUser && userTypeRef.current) {
        return
      }

      setLoading(true)
      loadTypeForUser(u)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '1.125rem',
          color: '#6b7280',
        }}
      >
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (!userType) {
    return <Navigate to="/" replace />
  }

  if (userType !== allowType) {
    return (
      <Navigate to={userType === 'student' ? '/student' : '/recruiter'} replace />
    )
  }

  return <>{children}</>
}
