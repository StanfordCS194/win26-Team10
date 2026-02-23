import { useState, useEffect } from 'react'
import { X, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLocation } from 'react-router-dom'

export default function FeedbackSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('feedback').insert([
        {
          user_id: userId,
          message: message.trim(),
          rating,
          page_url: window.location.href
        }
      ])

      if (error) throw error

      setIsSuccess(true)
      setTimeout(() => {
        setIsOpen(false)
        // Reset form after closing
        setTimeout(() => {
          setIsSuccess(false)
          setMessage('')
          setRating(null)
        }, 300)
      }, 2000)
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleSidebar = () => setIsOpen(!isOpen)

  return (
    <>
      {/* Floating Toggle Button */}
      <button 
        className="feedback-toggle" 
        onClick={toggleSidebar}
        aria-label="Open feedback sidebar"
      >
        <MessageSquare size={18} />
        <span>Feedback</span>
      </button>

      {/* Overlay */}
      <div 
        className={`feedback-overlay ${isOpen ? 'show' : ''}`} 
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar */}
      <div className={`feedback-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="feedback-header">
          <h3>Feedback</h3>
          <button 
            className="close-feedback" 
            onClick={() => setIsOpen(false)}
            aria-label="Close feedback sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="feedback-content">
          {isSuccess ? (
            <div className="feedback-success">
              <div className="feedback-success-icon">
                <CheckCircle2 size={32} />
              </div>
              <h4>Thank you!</h4>
              <p>Your feedback has been submitted successfully.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="feedback-form">
              <div className="rating-group">
                <label>How would you rate your experience?</label>
                <div className="rating-options">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`rating-btn ${rating === num ? 'selected' : ''}`}
                      onClick={() => setRating(num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="message-group">
                <label htmlFor="feedback-message">What can we improve?</label>
                <textarea
                  id="feedback-message"
                  className="feedback-textarea"
                  placeholder="Tell us what's on your mind..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="submit-feedback-btn"
                disabled={isSubmitting || !message.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Feedback</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
