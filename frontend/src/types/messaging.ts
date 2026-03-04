export interface Conversation {
  id: string
  recruiter_id: string
  student_id: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

/** Conversation with optional display info for the other party */
export interface ConversationWithPreview extends Conversation {
  otherPartyName?: string
  lastMessagePreview?: string
  lastMessageAt?: string
}
