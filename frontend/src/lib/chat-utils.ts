// ═══════════════════════════════════════════
// Chat & Reply Utilities
// ═══════════════════════════════════════════

export interface ReplyTarget {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  senderName: string;
  content: string;
  imageUrl?: string;
}

export interface ParsedMessage {
  reply: {
    messageId?: string;
    senderName: string;
    content: string;
  } | null;
  body: string;
}

const REPLY_REGEX = /^\[reply(?::([a-zA-Z0-9_-]+))?(?::([^\]\n]+))?\]([\s\S]*?)\[\/reply\](?:\r?\n\r?\n|\r?\n)?/i;

export function serializeReplyMessage(
  body: string,
  replyTo?: { id?: string; senderName?: string; content?: string; imageUrl?: string } | null,
): string {
  const cleanBody = (body ?? '').trim();
  if (!replyTo) return cleanBody;

  const rawSnippet = (replyTo.content || (replyTo.imageUrl ? '📷 Image attachment' : '')).trim();
  // Strip nested reply markers from quoted text
  const cleanSnippet = rawSnippet.replace(REPLY_REGEX, '').trim();
  const sender = (replyTo.senderName || '').trim() || 'Message';
  const id = replyTo.id || '';

  return `[reply:${id}:${sender}]${cleanSnippet}[/reply]\n\n${cleanBody}`;
}

export function parseReplyMessage(rawText: string): ParsedMessage {
  const text = String(rawText ?? '');
  if (!text) return { reply: null, body: '' };

  const match = text.match(REPLY_REGEX);
  if (!match) return { reply: null, body: text };

  const messageId = match[1] || undefined;
  const senderName = (match[2] || '').trim() || 'Replied Message';
  const content = (match[3] || '').trim();
  const body = text.slice(match[0].length).trim();

  return {
    reply: {
      messageId,
      senderName,
      content,
    },
    body,
  };
}

export function truncateText(text: string, maxChars = 100): string {
  const s = String(text ?? '').trim();
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars - 1).trimEnd() + '…';
}
