import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import ApplyModal from '../components/ApplyModal'

export interface ApplyModalJob {
  id: string
  title: string
  company: string
  location: string
  preferred_majors?: string[]
  preferred_grad_years?: string[]
  min_gpa?: number | null
}

interface ApplyModalContextValue {
  openApplyModal: (job: ApplyModalJob, studentId: string, onSuccess: () => void) => void
  closeApplyModal: () => void
}

const ApplyModalContext = createContext<ApplyModalContextValue | null>(null)

export function ApplyModalProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<ApplyModalJob | null>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [onSuccess, setOnSuccess] = useState<(() => void) | null>(null)

  const openApplyModal = useCallback(
    (j: ApplyModalJob, sid: string, onS: () => void) => {
      setJob(j)
      setStudentId(sid)
      setOnSuccess(() => onS)
    },
    []
  )

  const closeApplyModal = useCallback(() => {
    setJob(null)
    setStudentId(null)
    setOnSuccess(null)
  }, [])

  const handleSuccess = useCallback(() => {
    onSuccess?.()
  }, [onSuccess])

  const value: ApplyModalContextValue = {
    openApplyModal,
    closeApplyModal,
  }

  return (
    <ApplyModalContext.Provider value={value}>
      {children}
      {job && studentId && (
        <ApplyModal
          job={job}
          onClose={closeApplyModal}
          onSuccess={handleSuccess}
          studentId={studentId}
        />
      )}
    </ApplyModalContext.Provider>
  )
}

export function useApplyModal() {
  const ctx = useContext(ApplyModalContext)
  if (!ctx) throw new Error('useApplyModal must be used within ApplyModalProvider')
  return ctx
}
