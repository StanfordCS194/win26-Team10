import { supabase } from './supabase'
import type { Conversation, Message } from '../types/messaging'

export async function getMyConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`recruiter_id.eq.${userId},student_id.eq.${userId}`)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Conversation[]
}

export async function getOrCreateConversation(
  recruiterId: string,
  studentId: string
): Promise<Conversation> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('recruiter_id', recruiterId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (existing) return existing as Conversation

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ recruiter_id: recruiterId, student_id: studentId })
    .select()
    .single()

  if (error) throw error
  return created as Conversation
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Message[]
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select()
    .single()

  if (error) throw error

  // Update conversation updated_at so it sorts to top
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data as Message
}

/** Get the latest message for each conversation (for previews) */
export async function getLatestMessagePerConversation(
  conversationIds: string[]
): Promise<Record<string, Message>> {
  if (conversationIds.length === 0) return {}

  const results: Record<string, Message> = {}
  for (const cid of conversationIds) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', cid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) results[cid] = data as Message
  }
  return results
}
