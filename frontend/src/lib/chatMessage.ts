export type ChatAttachment = {
  filename: string
  storage_path: string
}

export type ParsedChatBody = {
  text: string
  attachments: ChatAttachment[]
}

type WireChatBody = {
  v: 1
  text?: string
  attachments?: ChatAttachment[]
}

export function encodeChatBody(input: ParsedChatBody): string {
  const text = (input.text ?? '').trim()
  const attachments = Array.isArray(input.attachments) ? input.attachments : []

  const wire: WireChatBody = {
    v: 1,
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
      return { text, attachments }
    } catch {
      // Fall through to plain text.
    }
  }

  return { text: raw, attachments: [] }
}

export function getChatPreview(raw: string): string {
  const parsed = parseChatBody(raw)
  const text = parsed.text.trim()
  if (text) return text
  if (parsed.attachments.length === 1) return `📎 ${parsed.attachments[0].filename}`
  if (parsed.attachments.length > 1) return `📎 ${parsed.attachments.length} attachments`
  return ''
}

