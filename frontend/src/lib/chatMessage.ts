export type ChatAttachment = {
  filename: string
  storage_path: string
}

export type ChatApplicationMessage = {
  job_id: string
  job_title: string
  message: string
  student_id: string
}

export type ChatJobShare = {
  job_id: string
  title: string
  company?: string
  location?: string
  type?: string
}

export type ParsedChatBody = {
  text: string
  attachments: ChatAttachment[]
  application?: ChatApplicationMessage
  job_share?: ChatJobShare
}

type WireChatBody = {
  v: 1
  kind?: 'chat' | 'application' | 'job_share'
  text?: string
  attachments?: ChatAttachment[]
  application?: ChatApplicationMessage
  job_share?: ChatJobShare
}

export function encodeChatBody(input: ParsedChatBody): string {
  const text = (input.text ?? '').trim()
  const attachments = Array.isArray(input.attachments) ? input.attachments : []
  const application = input.application
  const job_share = input.job_share

  const wire: WireChatBody = {
    v: 1,
    ...(application ? { kind: 'application', application } : {}),
    ...(job_share ? { kind: 'job_share', job_share } : {}),
    ...(text ? { text } : {}),
    ...(attachments.length ? { attachments } : {}),
  }
  return JSON.stringify(wire)
}

export function parseChatBody(raw: string): ParsedChatBody {
  if (typeof raw !== 'string') return { text: '', attachments: [] }

  const trimmed = raw.trim()
  if (!trimmed) return { text: '', attachments: [] }

  // Attempt JSON decode (for attachment messages).
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<WireChatBody> & Record<string, unknown>
      const text = typeof parsed.text === 'string' ? parsed.text : ''
      const attachmentsRaw = Array.isArray(parsed.attachments) ? parsed.attachments : []
      const attachments: ChatAttachment[] = attachmentsRaw
        .map((a) => {
          if (!a || typeof a !== 'object') return null
          const maybe = a as Record<string, unknown>
          const filename = typeof maybe.filename === 'string' ? maybe.filename : ''
          const storage_path = typeof maybe.storage_path === 'string' ? maybe.storage_path : ''
          if (!filename || !storage_path) return null
          return { filename, storage_path }
        })
        .filter(Boolean) as ChatAttachment[]

      let application: ChatApplicationMessage | undefined
      if (parsed && typeof parsed.application === 'object' && parsed.application) {
        const a = parsed.application as Record<string, unknown>
        const job_id = typeof a.job_id === 'string' ? a.job_id : ''
        const job_title = typeof a.job_title === 'string' ? a.job_title : ''
        const message = typeof a.message === 'string' ? a.message : ''
        const student_id = typeof a.student_id === 'string' ? a.student_id : ''
        if (job_id && job_title && message && student_id) {
          application = { job_id, job_title, message, student_id }
        }
      }

      let job_share: ChatJobShare | undefined
      if (parsed && typeof parsed.job_share === 'object' && parsed.job_share) {
        const j = parsed.job_share as Record<string, unknown>
        const job_id = typeof j.job_id === 'string' ? j.job_id : ''
        const title = typeof j.title === 'string' ? j.title : ''
        const company = typeof j.company === 'string' ? j.company : undefined
        const location = typeof j.location === 'string' ? j.location : undefined
        const type = typeof j.type === 'string' ? j.type : undefined
        if (job_id && title) {
          job_share = { job_id, title, company, location, type }
        }
      }

      return {
        text,
        attachments,
        ...(application ? { application } : {}),
        ...(job_share ? { job_share } : {}),
      }
    } catch {
      // Fall through to plain text.
    }
  }

  return { text: raw, attachments: [] }
}

export function getChatPreview(raw: string): string {
  const parsed = parseChatBody(raw)
  if (parsed.application) return `Message for ${parsed.application.job_title}`
  if (parsed.job_share) return `Shared job: ${parsed.job_share.title}`
  const text = parsed.text.trim()
  if (text) return text
  if (parsed.attachments.length === 1) return `📎 ${parsed.attachments[0].filename}`
  if (parsed.attachments.length > 1) return `📎 ${parsed.attachments.length} attachments`
  return ''
}

export function encodeApplicationMessage(input: ChatApplicationMessage): string {
  return encodeChatBody({ text: '', attachments: [], application: input })
}

export function encodeJobShareMessage(input: ChatJobShare, text?: string): string {
  return encodeChatBody({ text: text ?? '', attachments: [], job_share: input })
}

