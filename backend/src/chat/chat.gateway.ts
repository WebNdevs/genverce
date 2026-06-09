import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { NotificationService } from '../notification/notification.service';
import { AiService } from '../ai/ai.service';
import { FaqService } from '../faq/faq.service';
import { join } from 'path';

interface SendMessagePayload {
  chatId: string;
  influencerId: string;
  content: string;
  imageUrl?: string;
  userId: string;
}

interface AdminSendMessagePayload {
  chatId: string;
  content: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeChatsByUserId = new Map<string, Set<string>>();
  private socketActiveChat = new Map<string, { userId: string; chatId: string }>();

  constructor(
    private chatService: ChatService,
    private notificationService: NotificationService,
    private aiService: AiService,
    private faqService: FaqService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  private async getUserIdFromSocket(client: Socket): Promise<string> {
    const existing = (client.data as any)?.userId;
    if (typeof existing === 'string' && existing.trim()) return existing.trim();

    const raw = (client.handshake as any)?.auth?.token;
    const token = typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '').trim() : '';
    if (!token) return '';
    try {
      const secret = this.configService.get<string>('JWT_SECRET') || '';
      const decoded: any = await this.jwtService.verifyAsync(token, secret ? { secret } : undefined);
      const userId = typeof decoded?.sub === 'string' ? decoded.sub : '';
      if (userId) (client.data as any).userId = userId;
      return userId;
    } catch {
      return '';
    }
  }

  private setActiveChatForSocket(socketId: string, userId: string, chatId: string) {
    const prev = this.socketActiveChat.get(socketId);
    if (prev) {
      const set = this.activeChatsByUserId.get(prev.userId);
      if (set) {
        set.delete(prev.chatId);
        if (set.size === 0) this.activeChatsByUserId.delete(prev.userId);
      }
    }

    this.socketActiveChat.set(socketId, { userId, chatId });
    const set = this.activeChatsByUserId.get(userId) ?? new Set<string>();
    set.add(chatId);
    this.activeChatsByUserId.set(userId, set);
  }

  private clearActiveChatForSocket(socketId: string) {
    const prev = this.socketActiveChat.get(socketId);
    if (!prev) return;
    this.socketActiveChat.delete(socketId);
    const set = this.activeChatsByUserId.get(prev.userId);
    if (!set) return;
    set.delete(prev.chatId);
    if (set.size === 0) this.activeChatsByUserId.delete(prev.userId);
  }

  private shouldNotifyUser(userId: string, chatId: string): boolean {
    const set = this.activeChatsByUserId.get(userId);
    return !(set && set.has(chatId));
  }

  private chatNotificationsEnabled(): boolean {
    const raw =
      this.configService.get<string>('DISABLE_CHAT_NOTIFICATIONS') ??
      this.configService.get<string>('CHAT_NOTIFICATIONS_DISABLED') ??
      'false';
    return String(raw).toLowerCase() !== 'true';
  }

  private truncateText(input: string, maxChars: number): string {
    const s = String(input ?? '');
    if (s.length <= maxChars) return s;
    return s.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
  }

  private isQuotaError(error: any): boolean {
    const status = Number(error?.status || error?.response?.status || error?.response?.statusCode) || 0;
    const msg =
      String(error?.message || '') ||
      String(error?.response?.data?.error?.message || error?.response?.data?.message || '');
    return status === 429 || /\binsufficient[_\s-]?quota\b/i.test(msg) || /\brate limit\b/i.test(msg);
  }

  private formatPostFallback(format: string, brand: string, audienceCta: string, constraints: string): string {
    const f = (format || 'post').trim();
    const b = brand ? ` for ${brand}` : '';
    const lines: string[] = [];
    lines.push(`Here’s a draft ${f}${b}:`);
    lines.push('');
    lines.push(`Hook:`);
    lines.push(brand ? `${brand} is built for people who want results without the overwhelm.` : `Here’s the one shift that makes this easier:`);
    lines.push('');
    lines.push(`Main:`);
    lines.push(
      `If you’re ${audienceCta ? this.truncateText(audienceCta, 120) : 'trying to make progress but keep stalling'}, focus on one clear outcome, one simple next step, and one reason it matters.`,
    );
    lines.push(
      constraints
        ? `Tone/points to include: ${this.truncateText(constraints, 220)}`
        : `Tone/points to include: (add your key points + preferred tone here)`,
    );
    lines.push('');
    lines.push(`CTA:`);
    lines.push(audienceCta ? `If this resonates, ${this.truncateText(audienceCta, 120)}.` : `Want me to tailor this to your exact audience and offer?`);
    return lines.join('\n');
  }

  private async quotaHelpSuffix(): Promise<string> {
    try {
      const info = await this.aiService.getActiveChatProviderInfo();
      const base = info.baseURL ? ` (${info.baseURL})` : '';
      return ` Provider: ${info.provider}${base}. Model: ${info.model}.`;
    } catch {
      return '';
    }
  }

  private compactChatMessages(messages: Array<{ role: 'user' | 'assistant'; content: string; imageUrl?: string }>) {
    const maxMessages = 14;
    const maxCharsPerMessage = 1800;
    const maxTotalChars = 14000;

    const trimmed = messages
      .slice(-maxMessages)
      .map((m) => ({ ...m, content: this.truncateText(m.content ?? '', maxCharsPerMessage) }));

    let budget = maxTotalChars;
    const out: typeof trimmed = [];
    for (let i = trimmed.length - 1; i >= 0; i -= 1) {
      const m = trimmed[i];
      const cost = (m.content ?? '').length + (m.imageUrl ? Math.min(400, m.imageUrl.length) : 0);
      if (out.length > 0 && budget - cost < 0) break;
      if (budget - cost < 0 && out.length === 0) {
        out.push({ ...m, content: this.truncateText(m.content ?? '', Math.max(0, budget - (m.imageUrl ? Math.min(400, m.imageUrl.length) : 0))) });
        break;
      }
      out.push(m);
      budget -= cost;
    }
    out.reverse();
    const firstUserIdx = out.findIndex((m) => m.role === 'user');
    return firstUserIdx >= 0 ? out.slice(firstUserIdx) : out;
  }

  private getDirectMemoryReply(question: string, details: any, influencerName?: string) {
    const q = (question ?? '').trim().toLowerCase();
    if (!q) return null;

    const isInfluencerNameQ =
      /\bwhat('?s|\s+is)\s+your\s+name\b/.test(q) ||
      /\bwho\s+are\s+you\b/.test(q) ||
      /\bwhat\s+should\s+i\s+call\s+you\b/.test(q) ||
      /\bwhat\s+do\s+i\s+call\s+you\b/.test(q);
    if (isInfluencerNameQ) {
      const v = typeof influencerName === 'string' ? influencerName.trim() : '';
      return v ? `I’m ${v}.` : `I’m here—what would you like to call me?`;
    }

    const isBrandQ =
      /\bwhat('?s|\s+is)\s+(my|our)\s+brand\s+name\b/.test(q) ||
      /\bwhat\s+do\s+you\s+have\s+as\s+(my|our)\s+brand\b/.test(q) ||
      /\bbrand\s+name\b/.test(q);
    if (isBrandQ) {
      const v = typeof details?.brandName === 'string' ? details.brandName.trim() : '';
      return v ? `Your brand name is “${v}”.` : `I don’t think you’ve told me your brand name yet—what should I call it?`;
    }

    const isClientNameQ =
      /\bwhat('?s|\s+is)\s+my\s+name\b/.test(q) ||
      /\bwho\s+am\s+i\b/.test(q) ||
      /\bwhat\s+do\s+you\s+call\s+me\b/.test(q);
    if (isClientNameQ) {
      const v = typeof details?.clientName === 'string' ? details.clientName.trim() : '';
      return v ? `You told me your name is ${v}.` : `I don’t think I caught your name yet—what should I call you?`;
    }

    const isProductQ =
      /\bwhat('?s|\s+is)\s+(my|our)\s+product\s+name\b/.test(q) ||
      /\bwhat('?s|\s+is)\s+(my|our)\s+app\s+called\b/.test(q) ||
      /\bproduct\s+name\b/.test(q);
    if (isProductQ) {
      const v = typeof details?.productName === 'string' ? details.productName.trim() : '';
      return v ? `Your product name is “${v}”.` : `I don’t think you’ve shared your product name yet—what is it?`;
    }

    const isWebsiteQ =
      /\bwhat('?s|\s+is)\s+(my|our)\s+(website|site|url)\b/.test(q) ||
      /\bwebsite\b/.test(q) ||
      /\bsite\b/.test(q);
    if (isWebsiteQ) {
      const v = typeof details?.website === 'string' ? details.website.trim() : '';
      return v ? `Your website is ${v}.` : `I don’t have your website saved yet—what’s the link?`;
    }

    const isEmailQ =
      /\bwhat('?s|\s+is)\s+my\s+email\b/.test(q) ||
      /\bemail\b/.test(q);
    if (isEmailQ) {
      const v = typeof details?.clientEmail === 'string' ? details.clientEmail.trim() : '';
      return v ? `Your email is ${v}.` : `I don’t have your email saved—what should I use?`;
    }

    const isAudienceQ =
      /\btarget\s+audience\b/.test(q) ||
      /\bwho\s+(is|are)\s+(my|our)\s+audience\b/.test(q);
    if (isAudienceQ) {
      const v = typeof details?.targetAudience === 'string' ? details.targetAudience.trim() : '';
      return v ? `Your target audience is ${v}.` : `I don’t think you’ve described your target audience yet—who are you trying to reach?`;
    }

    const isToneQ =
      /\bwhat('?s|\s+is)\s+(the\s+)?(tone|style|voice)\b/.test(q) ||
      /\bpreferred\s+tone\b/.test(q);
    if (isToneQ) {
      const v = typeof details?.tone === 'string' ? details.tone.trim() : '';
      return v ? `You said you want the tone to be ${v}.` : `What tone do you want—more friendly, bold, premium, or something else?`;
    }

    return null;
  }

  private toSafeChatError(error: any) {
    const code = error?.code;
    if (typeof code === 'string') {
      if (code === 'P2021' || code === 'P2022') {
        return 'Database tables are missing. Run Prisma migrate/db push.';
      }
      if (code === 'P1000' || code === 'P1001' || code === 'P1002' || code === 'P1003') {
        return 'Database connection failed. Check DATABASE_URL and database server.';
      }
    }

    const msg = String(error?.message ?? '');
    const lower = msg.toLowerCase();
    if (lower.includes('image generation is temporarily disabled')) {
      return 'Image generation is paused for now.';
    }
    if (lower.includes('billing hard limit') || lower.includes('insufficient_quota') || lower.includes('insufficient quota')) {
      return 'Image generation is unavailable because the billing limit has been reached.';
    }
    if (lower.includes('invalid x-api-key') || lower.includes('authentication') || lower.includes('unauthorized')) {
      return 'AI API key is invalid or missing.';
    }
    if (lower.includes('model') && (lower.includes('not found') || lower.includes('does not exist'))) {
      return 'AI model is not available. Check the configured model name.';
    }
    if (lower.includes('fetch failed') || lower.includes('enotfound') || lower.includes('econnrefused') || lower.includes('etimedout')) {
      return 'AI service is unreachable. Check network and API base URL.';
    }

    return 'Something went wrong. Please try again.';
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private typingDelayMs(content: string) {
    const text = (content ?? '').trim();
    if (!text) return 0;
    const len = text.length;
    let ms = 900 + len * 30;
    ms = Math.min(Math.max(ms, 1500), 5000);
    const jitter = Math.floor(Math.random() * 400);
    return ms + jitter;
  }

  private async addAssistantMessage(chatId: string, content: string, imageUrl?: string) {
    const delay = this.typingDelayMs(content);
    if (delay) await this.sleep(delay);
    return this.chatService.addMessage(chatId, 'ASSISTANT', content, imageUrl);
  }

  private isImageRequest(content: string): boolean {
    const lower = content.toLowerCase().trim();
    const imageKeywords = [
      'create image', 'generate image', 'make image', 'draw',
      'create an image', 'generate an image', 'make an image',
      'create a image', 'generate a image',
      'create picture', 'generate picture', 'make picture',
      'create a picture', 'generate a picture', 'make a picture',
      'show me image', 'create photo', 'generate photo',
      'create illustration', 'design image', 'render image', 'produce image',
      'poster',
      'banner',
      'flyer',
      'thumbnail',
      'logo',
      'cover image',
      'facebook ad',
      'fb ad',
      'ad creative',
      'social media creative',
    ];
    return imageKeywords.some((kw) => lower.includes(kw));
  }

  private detectIntent(content: string): 'image' | 'post' | 'video' | 'chat' {
    const text = (content || '').toLowerCase().trim();

    // IMAGE REQUESTS
    if (
      /\b(image|picture|photo|creative|design|graphic|visual|poster|banner|flyer|thumbnail|logo)\b/.test(text) ||
      /\b(post image|social media image|instagram image|facebook image|linkedin image)\b/.test(text) ||
      /\b(create|generate|make|design)\b.*\b(image|creative|poster|banner|thumbnail|logo)\b/.test(text)
    ) {
      return 'image';
    }

    // VIDEO REQUESTS
    if (
      /\b(video|reel|shorts|ugc|youtube video|video script|ad script)\b/.test(text)
    ) {
      return 'video';
    }

    // CONTENT WRITING REQUESTS
    if (
      /\b(caption|blog|article|newsletter|linkedin post|social post)\b/.test(text)
    ) {
      return 'post';
    }

    return 'chat';
  }

  private isImageReferenceRequest(content: string, hasImage: boolean): boolean {
    if (!hasImage) return false;
    const lower = (content ?? '').toLowerCase();
    const keywords = [
      'use this image',
      'use this',
      'use it',
      'use the image',
      'use attached',
      'use the attached',
      'using this image',
      'using the image',
      'using provided image',
      'using the provided image',
      'using my image',
      'with this image',
      'with the image',
      'reference',
      'as reference',
      'based on this',
      'based on the image',
      'inspired',
      'inspired by',
      'similar',
      'same style',
      'like this',
      'make it like this',
      'create something similar',
      'recreate',
      'replicate',
      'copy this style',
    ];
    return keywords.some((kw) => lower.includes(kw));
  }

  private isVideoRequest(content: string): boolean {
    const lower = content.toLowerCase();
    return (
      lower.includes('video') ||
      lower.includes('reel') ||
      lower.includes('tiktok') ||
      lower.includes('youtube') ||
      lower.includes('shorts') ||
      lower.includes('ugc') ||
      lower.includes('video script') ||
      lower.includes('ad script')
    );
  }

  private isPostRequest(content: string): boolean {
    const lower = content.toLowerCase();
    if (/\bposter\b/.test(lower)) return false;
    return (
      /\bblog\b/.test(lower) ||
      /\barticle\b/.test(lower) ||
      /\blinkedin\b/.test(lower) ||
      /\bcaption\b/.test(lower) ||
      /\bnewsletter\b/.test(lower) ||
      /\bpost\b/.test(lower) ||
      /\bsocial\s+post\b/.test(lower)
    );
  }

  private isPosterRequest(content: string): boolean {
    const lower = (content ?? '').toLowerCase();
    return /\bposter(s)?\b/.test(lower) || /\bflyer(s)?\b/.test(lower);
  }

  private parseNumberWord(v: string): number | null {
    const lower = (v ?? '').toLowerCase().trim();
    const map: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };
    if (map[lower]) return map[lower];
    const n = Number(lower);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private parsePosterCadence(content: string): { postersPerWeek: number } | null {
    const text = (content ?? '').toLowerCase();
    const m =
      text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+posters?\s+(?:every|per)\s+week\b/) ||
      text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+posters?\s+weekly\b/);
    if (!m?.[1]) return null;
    const n = this.parseNumberWord(m[1]);
    if (!n) return null;
    return { postersPerWeek: Math.min(10, Math.max(1, Math.floor(n))) };
  }

  private parsePosterCount(content: string): number | null {
    const text = (content ?? '').toLowerCase();
    const m = text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+posters?\b/);
    if (!m?.[1]) return null;
    const n = this.parseNumberWord(m[1]);
    if (!n) return null;
    return Math.min(10, Math.max(1, Math.floor(n)));
  }

  private parsePostCadence(content: string): { postsPerWeek: number } | null {
    const text = (content ?? '').toLowerCase();
    const m =
      text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+posts?\s+(?:every|per)\s+week\b/) ||
      text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+posts?\s+weekly\b/);
    if (!m?.[1]) return null;
    const n = this.parseNumberWord(m[1]);
    if (!n) return null;
    return { postsPerWeek: Math.min(10, Math.max(1, Math.floor(n))) };
  }

  private parsePostCount(content: string): number | null {
    const text = (content ?? '').toLowerCase();
    const m = text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+posts?\b/);
    if (!m?.[1]) return null;
    const n = this.parseNumberWord(m[1]);
    if (!n) return null;
    return Math.min(10, Math.max(1, Math.floor(n)));
  }

  private buildPosterPrompt(input: {
    brand?: string;
    productName?: string;
    website?: string;
    targetAudience?: string;
    tone?: string;
    sizeAndPlatform?: string;
    goal?: string;
    text?: string;
    style?: string;
    assets?: string;
    notes?: string;
  }) {
    const parts: string[] = [];
    if (input.sizeAndPlatform) parts.push(`ASSET/SIZE: ${input.sizeAndPlatform}`);
    if (input.goal) parts.push(`GOAL: ${input.goal}`);
    if (input.text) parts.push(`TEXT (exact, copy/paste): ${input.text}`);
    if (!input.text) parts.push(`TEXT: If exact copy is not provided, write minimal, high-converting copy (headline + 1 supporting line + CTA). Do not invent phone numbers, addresses, discounts, or claims.`);
    if (input.style) parts.push(`STYLE DIRECTION: ${input.style}`);
    if (input.assets) parts.push(`ASSETS TO USE: ${input.assets}`);
    if (input.notes) parts.push(`NOTES: ${input.notes}`);

    const brandLines: string[] = [];
    if (input.brand) brandLines.push(`Brand: ${input.brand}`);
    if (input.productName) brandLines.push(`Product: ${input.productName}`);
    if (input.website) brandLines.push(`Website: ${input.website}`);
    if (input.targetAudience) brandLines.push(`Target audience: ${input.targetAudience}`);
    if (input.tone) brandLines.push(`Tone: ${input.tone}`);

    return (
      `You are a senior graphic designer creating a premium, high-converting marketing poster.\n\n` +
      (brandLines.length ? `BRAND CONTEXT:\n${brandLines.map((l) => `- ${l}`).join('\n')}\n\n` : '') +
      `POSTER BRIEF:\n${parts.join('\n')}\n\n` +
      `LAYOUT BLUEPRINT:\n` +
      `- Use a clear grid system and strong visual hierarchy.\n` +
      `- Preferred structure: headline zone → supporting text → main visual/product → CTA button/label → footer (website/contact if provided).\n` +
      `- Keep safe margins 10–12% on all sides; never place text near the edge.\n` +
      `- If print-like (A4/A3), include bleed guidance: extend background to edge; keep text inside safe area.\n` +
      `- Balance negative space; avoid cramped layouts.\n\n` +
      `TYPOGRAPHY:\n` +
      `- Use 1–2 font families maximum with consistent weights.\n` +
      `- Text must be crisp, perfectly readable, and correctly spelled.\n` +
      `- Do not warp, melt, or stylize text in a way that reduces readability.\n` +
      `- Wrap only at word boundaries; no awkward word breaks.\n\n` +
      `COLOR & BRANDING:\n` +
      `- Use a cohesive palette; if brand colors are provided in STYLE/ASSETS, follow them.\n` +
      `- Maintain high contrast for text and CTA.\n` +
      `- Do not invent logos; only include a logo if provided.\n\n` +
      `IMAGERY & QUALITY:\n` +
      `- Use a single, clear focal point; avoid clutter and duplicate elements.\n` +
      `- Clean edges, no artifacts, no random extra text, no watermarks.\n` +
      `- Keep all key elements fully inside the frame.\n\n` +
      `OUTPUT RULES:\n` +
      `- Match the exact requested size/aspect ratio from ASSET/SIZE.\n` +
      `- Final result must look production-ready and professional.\n`
    );
  }

  private parsePosterTimeTo24h(text: string): { hour: number; minute: number } {
    const t = (text ?? '').toLowerCase();
    const m12 = t.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
    if (m12) {
      const base = Number(m12[1]);
      const minute = Number(m12[2] || '0');
      const ap = String(m12[3]).toLowerCase();
      let hour = base % 12;
      if (ap === 'pm') hour += 12;
      return { hour, minute };
    }
    const m24 = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (m24) return { hour: Number(m24[1]), minute: Number(m24[2]) };
    return { hour: 9, minute: 0 };
  }

  private parsePosterDayOfWeek(text: string): number {
    const t = (text ?? '').toLowerCase();
    if (/\bmonday\b|\bmon\b/.test(t)) return 1;
    if (/\btuesday\b|\btue\b|\btues\b/.test(t)) return 2;
    if (/\bwednesday\b|\bwed\b/.test(t)) return 3;
    if (/\bthursday\b|\bthu\b|\bthur\b|\bthurs\b/.test(t)) return 4;
    if (/\bfriday\b|\bfri\b/.test(t)) return 5;
    if (/\bsaturday\b|\bsat\b/.test(t)) return 6;
    if (/\bsunday\b|\bsun\b/.test(t)) return 0;
    return 1;
  }

  private timezoneOffsetMinutes(code: string): number {
    const tz = String(code || 'UTC').toUpperCase();
    const map: Record<string, number> = {
      UTC: 0,
      GMT: 0,
      IST: 330,
      EST: -300,
      EDT: -240,
      CST: -360,
      CDT: -300,
      MST: -420,
      MDT: -360,
      PST: -480,
      PDT: -420,
      CET: 60,
      CEST: 120,
    };
    return map[tz] ?? 0;
  }

  private parseTimezone(text: string): string {
    const t = (text ?? '').toUpperCase();
    const m = t.match(/\b(UTC|GMT|IST|EST|EDT|CST|CDT|MST|MDT|PST|PDT|CET|CEST)\b/);
    return m?.[1] || 'UTC';
  }

  private computeNextWeeklyRunAt(dayOfWeek: number, time: string, timezone: string, from = new Date()): string {
    const [hhRaw, mmRaw] = String(time || '09:00').split(':');
    const hh = Math.max(0, Math.min(23, Number(hhRaw || 9)));
    const mm = Math.max(0, Math.min(59, Number(mmRaw || 0)));
    const offset = this.timezoneOffsetMinutes(timezone);

    const localNowMs = from.getTime() + offset * 60_000;
    const localNow = new Date(localNowMs);
    const nowDow = localNow.getUTCDay();
    let daysAhead = (dayOfWeek - nowDow + 7) % 7;
    const nowMinutes = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
    const targetMinutes = hh * 60 + mm;
    if (daysAhead === 0 && targetMinutes <= nowMinutes) daysAhead = 7;

    const targetLocalMs = Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate() + daysAhead,
      hh,
      mm,
      0,
      0,
    );
    return new Date(targetLocalMs - offset * 60_000).toISOString();
  }

  private parsePosterSchedule(input: string, cadence: 'weekly' | 'oneoff') {
    const raw = String(input || '').trim();
    const timezone = this.parseTimezone(raw);
    const tm = this.parsePosterTimeTo24h(raw);
    const time = `${String(tm.hour).padStart(2, '0')}:${String(tm.minute).padStart(2, '0')}`;

    if (cadence === 'weekly') {
      const dayOfWeek = this.parsePosterDayOfWeek(raw);
      return {
        cadence: 'weekly',
        dayOfWeek,
        time,
        timezone,
        enabled: true,
        nextRunAt: this.computeNextWeeklyRunAt(dayOfWeek, time, timezone),
        raw,
      };
    }

    const dateMatch = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    const offset = this.timezoneOffsetMinutes(timezone);
    const now = new Date();
    const localNow = new Date(now.getTime() + offset * 60_000);
    const y = dateMatch ? Number(dateMatch[1]) : localNow.getUTCFullYear();
    const m = dateMatch ? Number(dateMatch[2]) - 1 : localNow.getUTCMonth();
    const d = dateMatch ? Number(dateMatch[3]) : localNow.getUTCDate() + 1;
    const targetLocalMs = Date.UTC(y, m, d, tm.hour, tm.minute, 0, 0);
    let nextMs = targetLocalMs - offset * 60_000;
    if (nextMs <= now.getTime()) nextMs = now.getTime() + 5 * 60_000;
    return {
      cadence: 'oneoff',
      date: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null,
      time,
      timezone,
      enabled: true,
      nextRunAt: new Date(nextMs).toISOString(),
      raw,
    };
  }

  private isDesignFeedback(content: string, hasImage: boolean): boolean {
    if (!hasImage) return false;
    const lower = (content ?? '').toLowerCase();
    const keywords = [
      'alignment',
      'align',
      'spacing',
      'margin',
      'padding',
      'cut',
      'cropped',
      'crop',
      'not visible',
      'partially visible',
      'breaking',
      'word break',
      'unbalanced',
      'balance',
      'composition',
      'proportion',
      'layout',
      'looks incomplete',
      'unprofessional',
      'not proper',
      'not good',
      'fix this',
      'improve this',
    ];
    return keywords.some((k) => lower.includes(k));
  }

  private isImageEditRequest(content: string): boolean {
    const text = (content ?? '').trim();
    if (!text) return false;
    const lower = text.toLowerCase();
    const patterns = [
      /\bchange\b.*\bcolor\b/,
      /\bchange\b.*\b(colour|color)\b.*\bto\b/,
      /\bchange\s+the\s+(colou?r|colors)\b/,
      /\bmake\s+it\s+(more\s+)?(orange|blue|red|green|purple|yellow|black|white)\b/,
      /\buse\s+(orange|blue|red|green|purple|yellow|black|white)\b/,
      /\bswap\b.*\b(colou?r|color)\b/,
      /\breplace\b.*\bblue\b.*\bwith\b.*\borange\b/,
      /\bfrom\s+blue\s+to\s+orange\b/,
      /\bturn\s+it\s+into\b/,
      /\bupdate\b.*\bpalette\b/,
      /\bkeep\s+everything\s+same\b.*\b(colou?r|color)\b/,
    ];
    return patterns.some((re) => re.test(lower));
  }

  private extractColorChange(content: string): { from?: string; to?: string } {
    const text = (content ?? '').toLowerCase();
    const m1 = text.match(/\bfrom\s+([a-z]+)\s+to\s+([a-z]+)\b/);
    if (m1) return { from: m1[1], to: m1[2] };
    const m2 = text.match(/\breplace\s+([a-z]+)\s+with\s+([a-z]+)\b/);
    if (m2) return { from: m2[1], to: m2[2] };
    const m3 = text.match(/\bchange\s+([a-z]+)\s+to\s+([a-z]+)\b/);
    if (m3) return { from: m3[1], to: m3[2] };
    return {};
  }

  private async tryGetLocalImageSize(imageUrl: string): Promise<string> {
    const normalized = String(imageUrl || '').trim();
    const idx = normalized.indexOf('/uploads/');
    if (idx < 0) return '';
    const filename = normalized.slice(idx + '/uploads/'.length).split('?')[0].split('#')[0];
    if (!filename) return '';
    const filePath = join(process.cwd(), 'uploads', filename);
    try {
      const sharp = (await import('sharp')).default as any;
      const meta = await sharp(filePath).metadata();
      if (!meta?.width || !meta?.height) return '';
      return `${meta.width}x${meta.height}`;
    } catch {
      return '';
    }
  }

  private isSizeQuestion(content: string): boolean {
    const lower = content.toLowerCase();
    return (
      /\bsize\b/.test(lower) ||
      /\bdimension(s)?\b/.test(lower) ||
      /\bresolution\b/.test(lower) ||
      /\baspect\s*ratio\b/.test(lower)
    );
  }

  private isSizeQuestionQuery(content: string): boolean {
    if (!this.isSizeQuestion(content)) return false;
    const lower = content.toLowerCase();
    return (
      content.includes('?') ||
      /\b(what|which|ideal|recommended|best|should|right|proper)\b/.test(lower) ||
      /\bhow\s+big\b/.test(lower) ||
      /\bsize\s+for\b/.test(lower)
    );
  }

  private isFullImageSpec(content: string): boolean {
    const lower = content.toLowerCase();
    const hasSize = /\b\d{3,4}\s*x\s*\d{3,4}\b/.test(lower) || /\bsize\s*:/i.test(content);
    const hasDesign = /\bdesign\s*:/i.test(content) || /\bbackground\s*:/i.test(content) || /\blayout\s*:/i.test(content);
    const hasCta = /\bcta\b/i.test(content) || /\bget started\b/i.test(lower) || /\bcall to action\b/i.test(content);
    const hasText = /\bheading\b/i.test(content) || /\bsubtext\b/i.test(content) || /\bheadline\b/i.test(content);
    const hasBullets = content.split('\n').some((l) => l.trim().startsWith('-') || l.trim().startsWith('•'));
    return (hasSize && (hasDesign || hasBullets) && (hasCta || hasText)) || (hasBullets && (hasSize || hasDesign) && (hasCta || hasText));
  }

  private toImageWorkflowData(content: string) {
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const bullets = lines
      .map((l) => (l.startsWith('-') ? l.slice(1).trim() : l.startsWith('•') ? l.slice(1).trim() : ''))
      .filter(Boolean);

    const sizeMatch = content.match(/\b(\d{3,4})\s*x\s*(\d{3,4})\b/i);
    const size = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : '';
    const platform = this.detectPlatform(content);
    const platformLabel = platform === 'generic' ? '' : platform;

    const asset = bullets.find((b) => /^size\s*:/i.test(b))
      ? `${platformLabel ? platformLabel + ' ' : ''}creative ${size ? size : ''}`.trim()
      : `${platformLabel ? platformLabel + ' ' : ''}poster ${size ? size : ''}`.trim();

    const styleParts = bullets.filter((b) => /^(design|background|colors|elements|layout|style)\s*:/i.test(b));
    const contentParts = bullets.filter((b) => /^(logo|heading|headline|subtext|cta)\s*:/i.test(b));
    const otherParts = bullets.filter((b) => !styleParts.includes(b) && !contentParts.includes(b));

    const style = [...styleParts, ...otherParts].join('\n');
    const constraints = contentParts.join('\n');

    const fallbackStyle = style || content;
    const fallbackConstraints = constraints || '';

    return {
      asset: asset || (platformLabel ? `${platformLabel} poster` : 'poster'),
      style: fallbackStyle,
      constraints: fallbackConstraints,
    };
  }

  private detectPlatform(content: string): 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok' | 'pinterest' | 'generic' {
    const lower = content.toLowerCase();
    if (/\bfacebook|fb\b/.test(lower)) return 'facebook';
    if (/\binstagram|ig\b/.test(lower)) return 'instagram';
    if (/\blinkedin\b/.test(lower)) return 'linkedin';
    if (/\btwitter\b/.test(lower) || /\bx\b/.test(lower)) return 'twitter';
    if (/\byoutube|yt\b/.test(lower)) return 'youtube';
    if (/\btiktok\b/.test(lower)) return 'tiktok';
    if (/\bpinterest\b/.test(lower)) return 'pinterest';
    return 'generic';
  }

  private inferStandardAsset(content: string): { asset: string; assumed: boolean } | null {
    const text = (content ?? '').trim();
    if (!text) return null;
    const lower = text.toLowerCase();
    const hasExplicitSize = /\b\d{3,4}\s*x\s*\d{3,4}\b/i.test(text) || /\bsize\s*:/i.test(text);
    if (hasExplicitSize) return null;

    const platform = this.detectPlatform(text);
    const isBanner = /\bbanner\b/.test(lower) || /\bcover\b/.test(lower) || /\bheader\b/.test(lower) || /\bhero\b/.test(lower) || /\bslider\b/.test(lower);
    const isAd = /\bad\b/.test(lower) || /\bads\b/.test(lower) || /\badvert\b/.test(lower) || /\badvertisement\b/.test(lower) || /\bcreative\b/.test(lower);
    const isWebsite = /\bwebsite\b/.test(lower) || /\blanding\b/.test(lower) || /\bhomepage\b/.test(lower) || /\bhome\s+page\b/.test(lower) || /\bhero\b/.test(lower) || /\bslider\b/.test(lower);
    const isStory = /\bstory\b/.test(lower) || /\breel\b/.test(lower);
    const isThumbnail = /\bthumbnail\b/.test(lower);

    if (platform === 'youtube' && (isBanner || /\bchannel\s+art\b/.test(lower))) return { asset: 'youtube banner 2560x1440 (safe center 1546x423)', assumed: true };
    if (platform === 'youtube' && isThumbnail) return { asset: 'youtube thumbnail 1280x720 (16:9)', assumed: true };
    if (platform === 'linkedin' && (isBanner || /\bcover\b/.test(lower))) return { asset: 'linkedin banner 1584x396', assumed: true };
    if (platform === 'twitter' && (isBanner || /\bheader\b/.test(lower))) return { asset: 'x (twitter) header 1500x500', assumed: true };
    if (platform === 'facebook' && /\bcover\b/.test(lower)) return { asset: 'facebook page cover 1640x624', assumed: true };
    if (platform === 'facebook' && (isStory || /\bstories\b/.test(lower))) return { asset: 'facebook story 1080x1920 (9:16)', assumed: true };
    if (platform === 'instagram' && (isStory || /\bstories\b/.test(lower))) return { asset: 'instagram story 1080x1920 (9:16)', assumed: true };
    if (platform === 'instagram' && /\bfeed\b/.test(lower)) return { asset: 'instagram feed post 1080x1350 (4:5)', assumed: true };
    if ((platform === 'facebook' || platform === 'instagram') && isAd) return { asset: `${platform} ad creative 1080x1080 (1:1)`, assumed: true };

    if (isWebsite && /\bslider\b/.test(lower)) return { asset: 'website slider banner 1920x600', assumed: true };
    if (isWebsite && /\bhero\b/.test(lower)) return { asset: 'website hero banner 1920x600', assumed: true };
    if (isWebsite && isBanner) return { asset: 'website banner 1920x600', assumed: true };
    if (isBanner) return { asset: 'banner 1920x600', assumed: true };

    return null;
  }

  private async generateImageWithReview(
    cfg: { imageApiUrl?: string | null; imageApiKey?: string | null; imageModel?: string | null },
    prompt: string,
    maxAttempts = 2,
  ): Promise<{ imageUrl: string; review: { pass: boolean; issues: string[]; fix: string } }> {
    const safeCfg = {
      imageApiUrl: cfg?.imageApiUrl || '',
      imageApiKey: cfg?.imageApiKey || '',
      imageModel: cfg?.imageModel || '',
    };
    if (!safeCfg.imageApiUrl || !safeCfg.imageApiKey || !safeCfg.imageModel) {
      throw new Error('Image generator is not configured');
    }

    const reviewSystem =
      `You are reviewing a marketing image for layout and readability.\n` +
      `Return ONLY valid JSON with this shape:\n` +
      `{"pass": boolean, "issues": string[], "fix": string}\n` +
      `Rules:\n` +
      `- pass=false if any text is cropped/cut, if margins are too tight, if word breaks look awkward, or if layout feels unbalanced.\n` +
      `- fix must be a short set of generator instructions to correct the issues (increase safe margins, adjust grid, reduce font size, rebalance columns, etc.).\n`;

    let lastUrl = '';
    let lastReview: { pass: boolean; issues: string[]; fix: string } = { pass: true, issues: [], fix: '' };
    let currentPrompt = prompt;

    for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt++) {
      lastUrl = await this.aiService.generateImage(safeCfg.imageApiUrl, safeCfg.imageApiKey, safeCfg.imageModel, currentPrompt);

      let reviewText = '';
      try {
        reviewText = await this.aiService.generateResponse(reviewSystem, [
          { role: 'user' as const, content: 'Review this image for layout/readability issues.', imageUrl: lastUrl },
        ]);
      } catch {
        return { imageUrl: lastUrl, review: { pass: true, issues: [], fix: '' } };
      }

      try {
        const parsed = JSON.parse(reviewText);
        lastReview = {
          pass: !!parsed?.pass,
          issues: Array.isArray(parsed?.issues) ? parsed.issues.map((x: any) => String(x)).filter(Boolean).slice(0, 8) : [],
          fix: typeof parsed?.fix === 'string' ? parsed.fix.trim() : '',
        };
      } catch {
        lastReview = { pass: true, issues: [], fix: '' };
      }

      if (lastReview.pass || attempt === maxAttempts) break;

      const fixBlock = lastReview.fix
        ? `\n\nFIX THE FOLLOWING ISSUES:\n${lastReview.fix}\n`
        : `\n\nFIX THE FOLLOWING ISSUES:\nIncrease safe margins, prevent any text cropping, rebalance layout, and improve spacing.\n`;

      currentPrompt =
        currentPrompt +
        fixBlock +
        `\nSTRICT LAYOUT:\n` +
        `- Keep safe margins 12% on all sides.\n` +
        `- Do not place any text within the outer safe margin.\n` +
        `- Avoid awkward word breaks; wrap only at spaces.\n` +
        `- Reduce font size if needed so nothing clips.\n`;
    }

    return { imageUrl: lastUrl, review: lastReview };
  }

  private scheduleBackgroundImage(
    chatId: string,
    ackText: string,
    task: () => Promise<{ caption: string; imageUrl?: string }>,
  ) {
    const run = async () => {
      const ack = await this.addAssistantMessage(chatId, ackText);
      this.server.to(chatId).emit('newMessage', ack);
      const delayMs = 900 + Math.floor(Math.random() * 800);
      await new Promise((r) => setTimeout(r, delayMs));

      try {
        const result = await task();
        const final = await this.addAssistantMessage(chatId, result.caption, result.imageUrl);
        this.server.to(chatId).emit('typing', { isTyping: false });
        this.server.to(chatId).emit('newMessage', final);

        const meta = await this.chatService.getChatMeta(chatId);
        if (meta && this.chatNotificationsEnabled() && this.shouldNotifyUser(meta.customerId, chatId)) {
          const preview = result.caption.length > 120 ? result.caption.slice(0, 120) + '…' : result.caption;
          await this.notificationService.create(meta.customerId, {
            title: `New message from ${meta.influencer.name}`,
            description: preview,
            href: `/chat/${meta.influencerId}`,
          });
        }
      } catch (error) {
        const reason = this.toSafeChatError(error);
        const msg =
          reason === 'AI API key is invalid or missing.'
            ? `I’m on it, but I can’t generate the image right now because the image service key isn’t set up correctly.`
            : reason === 'AI service is unreachable. Check network and API base URL.'
              ? `I started generating it, but I couldn’t reach the image generator just now. Want me to retry?`
              : `I started generating it, but it didn’t go through. Want me to try again?`;
        const fail = await this.addAssistantMessage(chatId, msg);
        this.server.to(chatId).emit('typing', { isTyping: false });
        this.server.to(chatId).emit('newMessage', fail);

        const meta = await this.chatService.getChatMeta(chatId);
        if (meta && this.chatNotificationsEnabled() && this.shouldNotifyUser(meta.customerId, chatId)) {
          const preview = msg.length > 120 ? msg.slice(0, 120) + '…' : msg;
          await this.notificationService.create(meta.customerId, {
            title: `New message from ${meta.influencer.name}`,
            description: preview,
            href: `/chat/${meta.influencerId}`,
          });
        }
      }
    };

    void run().catch((e) => {
      console.error('Background image job error:', e);
      this.server.to(chatId).emit('typing', { isTyping: false });
    });
  }

  private isPricingQuery(content: string): boolean {
    const lower = (content ?? '').toLowerCase();
    return (
      /\bprice\b/.test(lower) ||
      /\bpricing\b/.test(lower) ||
      /\bcost\b/.test(lower) ||
      /\brates?\b/.test(lower) ||
      /\bfees?\b/.test(lower) ||
      /\bcharges?\b/.test(lower) ||
      /\bhow\s+much\b/.test(lower) ||
      /\bpackages?\b/.test(lower) ||
      /\bplans?\b/.test(lower)
    );
  }

  private inferRequestedPackageType(content: string): string | null {
    const lower = (content ?? '').toLowerCase();
    if (/\bcustom\b/.test(lower)) return 'CUSTOM';
    if (/\b(pack\s*10|10\s*pack|ten\s*pack|10\s+videos?)\b/.test(lower)) return 'PACK_10';
    if (/\b(pack\s*5|5\s*pack|five\s*pack|5\s+videos?)\b/.test(lower)) return 'PACK_5';
    if (/\bmonthly\b/.test(lower) && /\bstarter\b/.test(lower)) return 'MONTHLY_STARTER';
    if (/\bmonthly\b/.test(lower) && /\bgrowth\b/.test(lower)) return 'MONTHLY_GROWTH';
    if (/\bstarter\b/.test(lower)) return 'MONTHLY_STARTER';
    if (/\bgrowth\b/.test(lower)) return 'MONTHLY_GROWTH';
    if (/\bsingle\b/.test(lower) || /\b1\s*video\b/.test(lower) || /\bone\s*video\b/.test(lower)) return 'SINGLE';
    if (/\bmonthly\b/.test(lower)) return 'MONTHLY_STARTER';
    return null;
  }

  private fmtUsd(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '$0';
    const fixed = Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2);
    return `$${fixed}`;
  }

  private async buildPricingReply(influencerId: string, userMessage: string) {
    const packages = await this.chatService.getInfluencerActivePackages(influencerId);
    if (!Array.isArray(packages) || packages.length === 0) {
      return `I don’t have packages set up yet. Please try again later or ask the admin to add my packages.`;
    }

    const requestedType = this.inferRequestedPackageType(userMessage);
    const match = requestedType ? packages.find((p) => String(p.type) === requestedType) : null;
    if (match) {
      const suffix = match.isMonthly ? '/mo' : '';
      const count = Number(match.videoCount ?? 0);
      const countLabel = match.isMonthly ? 'videos/month' : 'videos';
      const desc = (match.description ?? '').toString().trim();
      const lines = [
        `${match.name} — ${this.fmtUsd(match.price)}${suffix}`,
        count > 0 ? `${count} ${countLabel}` : '',
        desc ? desc : '',
      ].filter(Boolean);
      return lines.join('\n');
    }

    const lines = packages.map((p) => {
      const suffix = p.isMonthly ? '/mo' : '';
      const count = Number(p.videoCount ?? 0);
      const countLabel = p.isMonthly ? 'videos/month' : 'videos';
      const desc = (p.description ?? '').toString().trim();
      const details = [count > 0 ? `${count} ${countLabel}` : '', desc].filter(Boolean).join(' — ');
      return `• ${p.name} — ${this.fmtUsd(p.price)}${suffix}${details ? ` (${details})` : ''}`;
    });

    return `Here are my current packages:\n${lines.join('\n')}\n\nIf you tell me what you need, I can point you to the best option.`;
  }

  private isAddressQuery(content: string): boolean {
    const lower = (content ?? '').toLowerCase();
    return (
      /\baddress\b/.test(lower) ||
      /\blocation\b/.test(lower) ||
      /\bwhere\s+are\s+you\b/.test(lower) ||
      /\bwhere\s+is\s+(your|the)\s+(office|studio|store|shop)\b/.test(lower) ||
      /\boffice\s+address\b/.test(lower) ||
      /\bvisit\b/.test(lower) ||
      /\bdirections\b/.test(lower)
    );
  }

  private isPincodeRequested(content: string): boolean {
    const lower = (content ?? '').toLowerCase();
    return /\b(pin\s*code|pincode|postal\s*code|zip\s*code|zipcode|zip)\b/.test(lower);
  }

  private normalizeText(v?: string | null) {
    return (v ?? '').toString().trim();
  }

  private inferIndianPincode(city: string, state: string) {
    const key = `${city}`.toLowerCase();
    const map: Record<string, string> = {
      'new delhi': '110001',
      'delhi': '110001',
      'mumbai': '400001',
      'bengaluru': '560001',
      'bangalore': '560001',
      'hyderabad': '500001',
      'chennai': '600001',
      'kolkata': '700001',
      'pune': '411001',
      'ahmedabad': '380001',
      'jaipur': '302001',
      'surat': '395003',
      'lucknow': '226001',
    };
    if (map[key]) return map[key];
    const s = `${state}`.toLowerCase();
    if (s.includes('delhi')) return '110001';
    if (s.includes('maharashtra')) return '400001';
    if (s.includes('karnataka')) return '560001';
    if (s.includes('telangana')) return '500001';
    if (s.includes('tamil nadu')) return '600001';
    if (s.includes('west bengal')) return '700001';
    if (s.includes('gujarat')) return '380001';
    if (s.includes('rajasthan')) return '302001';
    if (s.includes('uttar pradesh')) return '226001';
    return '110001';
  }

  private inferIndianLandmark(city: string) {
    const key = `${city}`.toLowerCase();
    const map: Record<string, string> = {
      'new delhi': 'Connaught Place',
      'delhi': 'Connaught Place',
      'mumbai': 'Bandra',
      'bengaluru': 'Indiranagar',
      'bangalore': 'Indiranagar',
      'hyderabad': 'HITEC City',
      'chennai': 'T. Nagar',
      'kolkata': 'Park Street',
      'pune': 'Koregaon Park',
      'ahmedabad': 'S.G. Highway',
      'jaipur': 'M.I. Road',
      'surat': 'Adajan',
      'lucknow': 'Gomti Nagar',
    };
    return map[key] ?? 'City Center';
  }

  private buildAddressReply(
    influencer: {
      name?: string | null;
      locationCity?: string | null;
      locationState?: string | null;
      locationCountry?: string | null;
      locationAddress?: string | null;
      locationPincode?: string | null;
    },
    includePincode: boolean,
  ) {
    const city = this.normalizeText(influencer.locationCity);
    const state = this.normalizeText(influencer.locationState);
    const country = this.normalizeText(influencer.locationCountry) || 'India';
    const address = this.normalizeText(influencer.locationAddress);
    const pincode = this.normalizeText(influencer.locationPincode);

    const finalCity = city || 'New Delhi';
    const finalState = state || 'Delhi';
    const finalPincode = includePincode ? (pincode || this.inferIndianPincode(finalCity, finalState)) : '';

    if (address) {
      const parts = [address, finalCity, finalState, finalPincode, country].filter(Boolean);
      return `You can find me here: ${parts.join(', ')}.`;
    }

    const landmark = this.inferIndianLandmark(finalCity);
    const generated = [
      `Near ${landmark}`,
      finalCity,
      finalState,
      finalPincode,
      country,
    ].filter(Boolean);
    return `I’m based near ${generated.join(', ')}.`;
  }

  private sizeGuidance(platform: string) {
    switch (platform) {
      case 'facebook':
        return (
          'Here are clean, current Facebook image sizes:\n' +
          '• Feed (recommended): 1200×1500 px (4:5)\n' +
          '• Square feed: 1200×1200 px (1:1)\n' +
          '• Horizontal feed: 1200×628 px (1.91:1)\n' +
          '• Story/Reel: 1080×1920 px (9:16)\n' +
          '• Page cover: upload 1640×624 px (safe center area ~ 1200×444)\n' +
          '• Event cover: 1920×1005 px (16:9)\n' +
          'Tip: Keep key text inside safe margins; use 1080 px min shortest side for crispness.'
        );
      case 'instagram':
        return (
          'Instagram sizes:\n' +
          '• Portrait feed: 1080×1350 px (4:5)\n' +
          '• Square feed: 1080×1080 px (1:1)\n' +
          '• Landscape feed: 1080×608 px (1.91:1)\n' +
          '• Story/Reel: 1080×1920 px (9:16)'
        );
      case 'linkedin':
        return (
          'LinkedIn sizes:\n' +
          '• Feed single image: 1200×1200 px (1:1) or 1200×627 px (1.91:1)\n' +
          '• Company cover: 1128×191 px\n' +
          '• Story: 1080×1920 px (9:16)'
        );
      case 'twitter':
        return (
          'X (Twitter) sizes:\n' +
          '• Feed image: 1600×900 px (16:9) or 1200×1200 px (1:1)\n' +
          '• Profile header: 1500×500 px'
        );
      case 'youtube':
        return (
          'YouTube sizes:\n' +
          '• Thumbnail: 1280×720 px (16:9)\n' +
          '• Channel art: 2560×1440 px (safe center 1546×423)\n' +
          '• Shorts cover: 1080×1920 px (9:16)'
        );
      case 'tiktok':
        return 'TikTok: 1080×1920 px (9:16) for videos and cover frames.';
      case 'pinterest':
        return 'Pinterest: 1000×1500 px (2:3) is a solid default; long pins 1000×2100 px.';
      default:
        return (
          'Common digital sizes:\n' +
          '• Portrait feed: 1080×1350 px (4:5)\n' +
          '• Square: 1080×1080 px (1:1)\n' +
          '• Story/Vertical: 1080×1920 px (9:16)\n' +
          'If you tell me the platform, I’ll give the exact spec.'
        );
    }
  }
  private extractImagePrompt(content: string): string {
    const lower = content.toLowerCase();
    const prefixes = [
      'create an image of', 'generate an image of', 'make an image of',
      'create a image of', 'generate a image of', 'make a image of',
      'create image of', 'generate image of', 'make image of',
      'create a picture of', 'generate a picture of', 'make a picture of',
      'create picture of', 'generate picture of',
      'create an image:', 'generate an image:', 'create image:', 'generate image:',
      'draw:', 'create:', 'generate:',
      'create an image', 'generate an image', 'make an image',
      'create a image', 'generate a image',
      'create image', 'generate image', 'make image', 'draw',
    ];
    for (const prefix of prefixes) {
      if (lower.startsWith(prefix)) {
        const prompt = content.slice(prefix.length).trim().replace(/^[:of\s]+/, '').trim();
        if (prompt) return prompt;
      }
    }
    return content.trim();
  }

  async handleConnection(client: Socket) {
    const userId = await this.getUserIdFromSocket(client);
    if (userId) (client.data as any).userId = userId;
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.clearActiveChatForSocket(client.id);
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('adminSendMessage')
  async handleAdminMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AdminSendMessagePayload,
  ) {
    const message = await this.chatService.addMessage(data.chatId, 'ASSISTANT', data.content);
    this.server.to(data.chatId).emit('newMessage', message);

    const meta = await this.chatService.getChatMeta(data.chatId);
    if (meta && this.chatNotificationsEnabled() && this.shouldNotifyUser(meta.customerId, data.chatId)) {
      const preview = data.content.length > 120 ? data.content.slice(0, 120) + '…' : data.content;
      await this.notificationService.create(meta.customerId, {
        title: `New message from ${meta.influencer.name}`,
        description: preview,
        href: `/chat/${meta.influencerId}`,
      });
    }
  }

  @SubscribeMessage('joinChat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; active?: boolean },
  ) {
    client.join(data.chatId);
    if (data?.active === true) {
      const userId = await this.getUserIdFromSocket(client);
      const chatId = typeof data?.chatId === 'string' ? data.chatId : '';
      if (userId && chatId) this.setActiveChatForSocket(client.id, userId, chatId);
    }
    return { event: 'joinedChat', data: { chatId: data.chatId } };
  }

  @SubscribeMessage('setActiveChat')
  async handleSetActiveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; userId: string },
  ) {
    const chatId = typeof data?.chatId === 'string' ? data.chatId : '';
    const userId = await this.getUserIdFromSocket(client);
    if (!chatId || !userId) return;
    this.setActiveChatForSocket(client.id, userId, chatId);
  }

  @SubscribeMessage('clearActiveChat')
  handleClearActiveChat(@ConnectedSocket() client: Socket) {
    this.clearActiveChatForSocket(client.id);
  }

  @SubscribeMessage('leaveChat')
  handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    client.leave(data.chatId);
    const prev = this.socketActiveChat.get(client.id);
    if (prev && prev.chatId === data.chatId) this.clearActiveChatForSocket(client.id);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessagePayload,
  ) {
    let userMessage: any;
    try {
      userMessage = await this.chatService.addMessage(data.chatId, 'USER', data.content, data.imageUrl);
    } catch (error) {
      console.error('Chat user message save error:', error);
      this.server.to(data.chatId).emit('typing', { isTyping: false });
      this.server.to(data.chatId).emit('chatError', { message: this.toSafeChatError(error) });
      return;
    }

    this.server.to(data.chatId).emit('newMessage', userMessage);
    this.server.to(data.chatId).emit('typing', { isTyping: true });

    try {
      const incoming = (data.content ?? '').trim();

      if (incoming && this.isPricingQuery(incoming)) {
        const reply = await this.buildPricingReply(data.influencerId, incoming);
        const aiMessage = await this.addAssistantMessage(data.chatId, reply);
        this.server.to(data.chatId).emit('typing', { isTyping: false });
        this.server.to(data.chatId).emit('newMessage', aiMessage);

        const meta = await this.chatService.getChatMeta(data.chatId);
        if (meta && this.chatNotificationsEnabled() && this.shouldNotifyUser(meta.customerId, data.chatId)) {
          const preview = reply.length > 120 ? reply.slice(0, 120) + '…' : reply;
          await this.notificationService.create(meta.customerId, {
            title: `New message from ${meta.influencer.name}`,
            description: preview,
            href: `/chat/${meta.influencerId}`,
          });
        }
        return;
      }

      // Check predefined responses first
      const predefinedAnswer = await this.faqService.findMatch(data.content);
      if (predefinedAnswer) {
        const aiMessage = await this.addAssistantMessage(data.chatId, predefinedAnswer);
        this.server.to(data.chatId).emit('typing', { isTyping: false });
        this.server.to(data.chatId).emit('newMessage', aiMessage);

        const meta = await this.chatService.getChatMeta(data.chatId);
        if (meta && this.chatNotificationsEnabled() && this.shouldNotifyUser(meta.customerId, data.chatId)) {
          const preview = predefinedAnswer.length > 120 ? predefinedAnswer.slice(0, 120) + '…' : predefinedAnswer;
          await this.notificationService.create(meta.customerId, {
            title: `New message from ${meta.influencer.name}`,
            description: preview,
            href: `/chat/${meta.influencerId}`,
          });
        }
        return;
      }

      // Load influencer AI context (persona, topic, service type, image config)
      const { name, industries, contentStyle, locationCity, locationState, locationCountry, locationAddress, locationPincode, systemPrompt, topic, outOfTopicMessage, serviceType, aiConfig } =
        await this.chatService.getInfluencerAIContext(data.influencerId);

      const lowerIncoming = incoming.toLowerCase();
      const hasIncomingImage = !!data.imageUrl;
      const intent = this.detectIntent(incoming);

      const wantsImage =
        intent === 'image' ||
        (hasIncomingImage && intent !== 'post');

      const wantsVideo = intent === 'video';
      const wantsPost = intent === 'post';
      const wantsPoster = this.isPosterRequest(incoming);

      if (serviceType === 'IMAGE_CREATION' && this.isDesignFeedback(incoming, hasIncomingImage)) {
        const cfg = aiConfig;
        if (!cfg?.imageApiKey || !cfg?.imageApiUrl || !cfg?.imageModel) {
          const msg =
            `Got it—I’ll fix the alignment/spacing and remake it cleanly, but I can’t generate images here yet because the image service isn’t configured.\n` +
            `If you’re the admin: go to Admin → Influencers → Edit → AI Services → Image and set Image API URL, Image API Key, and Image Model.`;
          const aiMessage = await this.addAssistantMessage(data.chatId, msg);
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        this.scheduleBackgroundImage(
          data.chatId,
          `Got it — I’ll remake this with proper safe margins and cleaner spacing. It may take a moment, I’ll share it shortly.`,
          async () => {
            const details = await this.chatService.getChatMemoryDetails(data.chatId);
            const brand = typeof (details as any)?.brandName === 'string' ? (details as any).brandName.trim() : '';
            const productName = typeof (details as any)?.productName === 'string' ? (details as any).productName.trim() : '';
            const targetAudience = typeof (details as any)?.targetAudience === 'string' ? (details as any).targetAudience.trim() : '';
            const tone = typeof (details as any)?.tone === 'string' ? (details as any).tone.trim() : '';
            const website = typeof (details as any)?.website === 'string' ? (details as any).website.trim() : '';
            const industriesStr = Array.isArray(industries)
              ? industries.filter(Boolean).join(', ')
              : typeof industries === 'string'
                ? industries
                : '';

            const extractSystem =
              `You are improving a marketing poster based on a screenshot.\n` +
              `Analyze the attached image and produce a clean remake spec.\n` +
              `Return plain text with:\n` +
              `- CONTENT: brand name, headline, subtext, CTA (rewrite cleanly if cut off)\n` +
              `- LAYOUT: describe a balanced grid (e.g., left text column + right illustration), safe margins, alignment\n` +
              `- STYLE: background, colors, typography style\n` +
              `- FIXES: what was wrong and how to fix it (no cropped text, better spacing, balanced columns)\n`;

            const remakeSpec = await this.aiService.generateResponse(extractSystem, [
              { role: 'user' as const, content: incoming || 'Fix this design.', imageUrl: data.imageUrl! },
            ]);

            const inferred = this.inferStandardAsset(incoming);
            const asset = inferred?.asset || 'facebook ad creative 1080x1080 (1:1)';

            const imagePrompt =
              `You are creating a high-quality marketing poster.\n\n` +
              `TASK:\nRemake the design to fix alignment/spacing issues while keeping the same message.\n\n` +
              `FEEDBACK FROM USER:\n${incoming}\n\n` +
              `BRAND CONTEXT:\n` +
              `${brand ? `- Brand name: ${brand}\n` : ''}` +
              `${productName ? `- Product name: ${productName}\n` : ''}` +
              `${website ? `- Website: ${website}\n` : ''}` +
              `${targetAudience ? `- Target audience: ${targetAudience}\n` : ''}` +
              `${tone ? `- Tone: ${tone}\n` : ''}` +
              `${industriesStr ? `- Industries: ${industriesStr}\n` : ''}` +
              `${contentStyle ? `- Creator style: ${contentStyle}\n` : ''}` +
              `\nREMIX SPEC FROM IMAGE:\n${remakeSpec}\n` +
              `\nDELIVERABLE:\n` +
              `- Asset/platform/size: ${asset}\n` +
              `- Keep all text fully inside safe margins.\n` +
              `\nQUALITY BAR:\n` +
              `- Perfect alignment and spacing; grid-based layout.\n` +
              `- Safe margins/padding 12% on all sides.\n` +
              `- Never crop text/letters; wrap only at spaces.\n` +
              `- Balance text and illustration so neither side feels heavier.\n` +
              `- Clean, professional, complete-looking composition.\n`;

            const result = await this.generateImageWithReview(cfg, imagePrompt, 2);
            return {
              caption: `Done — I remade it with proper safe margins and balanced layout so the text won’t clip. Want it more bold or more minimal?`,
              imageUrl: result.imageUrl,
            };
          },
        );
        return;
      }

      if (serviceType === 'IMAGE_CREATION' && !hasIncomingImage && this.isImageEditRequest(incoming)) {
        const last = await this.chatService.getLastAssistantImage(data.chatId);
        const lastUrl = typeof (last as any)?.imageUrl === 'string' ? String((last as any).imageUrl).trim() : '';
        if (lastUrl) {
          const cfg = aiConfig;
          if (!cfg?.imageApiKey || !cfg?.imageApiUrl || !cfg?.imageModel) {
            const msg =
              `Got it — I can regenerate the same design with your changes, but I can’t generate images here yet because the image service isn’t configured.\n` +
              `If you’re the admin: go to Admin → Influencers → Edit → AI Services → Image and set Image API URL, Image API Key, and Image Model.`;
            const aiMessage = await this.addAssistantMessage(data.chatId, msg);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          this.scheduleBackgroundImage(
            data.chatId,
            `Got it — I’ll update the design and regenerate it with that change. It may take a moment, I’ll share it shortly.`,
            async () => {
              const details = await this.chatService.getChatMemoryDetails(data.chatId);
              const brand = typeof (details as any)?.brandName === 'string' ? (details as any).brandName.trim() : '';
              const productName = typeof (details as any)?.productName === 'string' ? (details as any).productName.trim() : '';
              const targetAudience = typeof (details as any)?.targetAudience === 'string' ? (details as any).targetAudience.trim() : '';
              const tone = typeof (details as any)?.tone === 'string' ? (details as any).tone.trim() : '';
              const website = typeof (details as any)?.website === 'string' ? (details as any).website.trim() : '';
              const industriesStr = Array.isArray(industries)
                ? industries.filter(Boolean).join(', ')
                : typeof industries === 'string'
                  ? industries
                  : '';

              const size = await this.tryGetLocalImageSize(lastUrl);
              const change = this.extractColorChange(incoming);
              const changeLine =
                change.from && change.to
                  ? `Change the color palette: replace ${change.from} with ${change.to} (accents and dominant color theme).`
                  : `Apply this change request: ${incoming}`;

              const analysisSystem =
                `You are a senior graphic designer. Analyze the attached image and extract reusable design direction.\n` +
                `Return 10–14 concise lines covering: layout/composition, background style, color palette, typography style, icon/shape motifs, lighting/glow/shadow style, and overall vibe.\n` +
                `If there is text/logo, say “text/logo present” but don’t copy it verbatim.\n` +
                `End with one line starting with "PROMPT:" that is a generator-ready prompt to recreate a similar style (not an exact copy).`;

              let referenceNotes = '';
              try {
                referenceNotes = await this.aiService.generateResponse(analysisSystem, [
                  { role: 'user' as const, content: 'Analyze this image for style/layout reuse.', imageUrl: lastUrl },
                ]);
              } catch { }

              const imagePrompt =
                `You are creating a revised version of an existing marketing image.\n\n` +
                `REFERENCE:\n` +
                `- Use the attached image as the primary reference.\n` +
                `- Keep the same layout, spacing, and composition unless the change request requires otherwise.\n\n` +
                `CHANGE REQUEST:\n${changeLine}\n\n` +
                `BRAND CONTEXT:\n` +
                `${brand ? `- Brand name: ${brand}\n` : ''}` +
                `${productName ? `- Product name: ${productName}\n` : ''}` +
                `${website ? `- Website: ${website}\n` : ''}` +
                `${targetAudience ? `- Target audience: ${targetAudience}\n` : ''}` +
                `${tone ? `- Tone: ${tone}\n` : ''}` +
                `${industriesStr ? `- Industries: ${industriesStr}\n` : ''}` +
                `${contentStyle ? `- Creator style: ${contentStyle}\n` : ''}` +
                `${referenceNotes ? `\nREFERENCE IMAGE NOTES:\n${referenceNotes}\n` : ''}` +
                `\nDELIVERABLE:\n` +
                `${size ? `- Exact output size: ${size}\n` : `- Exact output size: match the reference image size\n`}` +
                `\nQUALITY BAR:\n` +
                `- Use a clear grid; keep safe margins/padding ~10–12% on all sides.\n` +
                `- Never crop text/letters. If space is tight, reduce font size or reflow lines—do not break words awkwardly.\n` +
                `- Keep the composition balanced (text block and visuals aligned and proportionate).\n` +
                `- Clean, professional, complete-looking result (no clutter).\n`;

              const result = await this.generateImageWithReview(cfg, imagePrompt, 2);
              return {
                caption: change.to
                  ? `Done — I regenerated it with a ${change.to} palette while keeping the same design structure. Want it more bright orange or more burnt orange?`
                  : `Done — I regenerated it with your requested update while keeping the same design structure. Want another variation?`,
                imageUrl: result.imageUrl,
              };
            },
          );
          return;
        }
      }

      const existingWorkflow = await this.chatService.getWorkflowState(data.chatId);
      if (existingWorkflow) {
        if (this.isAddressQuery(incoming)) {
          const includePincode = this.isPincodeRequested(incoming);
          const reply = this.buildAddressReply({
            name,
            locationCity,
            locationState,
            locationCountry,
            locationAddress,
            locationPincode,
          }, includePincode);
          const aiMessage = await this.addAssistantMessage(data.chatId, reply);
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
        if (lowerIncoming === 'cancel' || lowerIncoming === 'stop' || lowerIncoming === 'never mind') {
          await this.chatService.setWorkflowState(data.chatId, null);
          const aiMessage = await this.addAssistantMessage(data.chatId, `Got it—stopping that request.`);
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        const wf = existingWorkflow as any;
        const step = typeof wf.step === 'number' ? wf.step : 0;
        const kind = String(wf.kind || '');
        const wfData: any = wf.data && typeof wf.data === 'object' ? { ...(wf.data as any) } : {};
        const dataMap: Record<string, string> = wfData;

        if (kind === 'posterBatch') {
          const keys = ['sizeAndPlatform', 'goal', 'text', 'style', 'assets', 'notes', 'schedule'] as const;
          const postersPerPeriod =
            typeof wfData.postersPerPeriod === 'number' && Number.isFinite(wfData.postersPerPeriod)
              ? Math.min(10, Math.max(1, Math.floor(wfData.postersPerPeriod)))
              : 1;
          const cadence = wfData.cadence === 'weekly' ? 'weekly' : 'oneoff';
          const current =
            typeof wfData.current === 'number' && Number.isFinite(wfData.current)
              ? Math.max(0, Math.floor(wfData.current))
              : 0;
          const posters = Array.isArray(wfData.posters) ? [...wfData.posters] : [];
          const draft = wfData.draft && typeof wfData.draft === 'object' ? { ...(wfData.draft as any) } : {};

          const questions = [
            `Poster ${current + 1} of ${postersPerPeriod}: Where will this poster be used and what exact size do you need (e.g., 1080x1350 Instagram, 1080x1080, A4 print, 1920x1080)?`,
            `Poster ${current + 1}: What’s the goal/offer for this poster (what are we promoting and what should people do)?`,
            `Poster ${current + 1}: What exact text should appear (headline, subtext, CTA, contact/website)?`,
            `Poster ${current + 1}: What style do you want (colors, vibe, typography style, background, reference style)?`,
            `Poster ${current + 1}: Any assets to include (logo URL, product photos, brand colors, icons) or anything to avoid?`,
            `Poster ${current + 1}: Any extra notes (deadline, disclaimers, preferred layout like left text/right visuals)?`,
            cadence === 'weekly'
              ? `Poster ${current + 1}: What weekly posting schedule should I use? Share day + time + timezone (example: Monday 10:30 AM IST).`
              : `Poster ${current + 1}: When should I auto-create this poster? Share date + time + timezone (example: 2026-04-20 10:30 AM IST).`,
          ];

          const key = keys[Math.min(step, keys.length - 1)];
          if (incoming) {
            (draft as any)[key] = incoming;
          }

          const nextStep = step + 1;
          if (nextStep < questions.length) {
            await this.chatService.setWorkflowState(data.chatId, {
              kind: 'posterBatch',
              step: nextStep,
              data: { cadence, postersPerPeriod, current, posters, draft },
            });
            const aiMessage = await this.addAssistantMessage(data.chatId, questions[nextStep]);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          const details = await this.chatService.getChatMemoryDetails(data.chatId);
          const brand = typeof (details as any)?.brandName === 'string' ? (details as any).brandName.trim() : '';
          const productName = typeof (details as any)?.productName === 'string' ? (details as any).productName.trim() : '';
          const website = typeof (details as any)?.website === 'string' ? (details as any).website.trim() : '';
          const targetAudience = typeof (details as any)?.targetAudience === 'string' ? (details as any).targetAudience.trim() : '';
          const tone = typeof (details as any)?.tone === 'string' ? (details as any).tone.trim() : '';

          const basePrompt = this.buildPosterPrompt({
            brand,
            productName,
            website,
            targetAudience,
            tone,
            sizeAndPlatform: String((draft as any).sizeAndPlatform || ''),
            goal: String((draft as any).goal || ''),
            text: String((draft as any).text || ''),
            style: String((draft as any).style || ''),
            assets: String((draft as any).assets || ''),
            notes: String((draft as any).notes || ''),
          });

          let optimizedPrompt = basePrompt;
          try {
            let aiEnabled = false;
            try {
              aiEnabled = await this.aiService.isEnabled();
            } catch { }
            if (aiEnabled) {
              const system =
                `You are an expert prompt engineer for image generation.\n` +
                `Rewrite the user's poster prompt to maximize output quality and layout reliability.\n` +
                `Rules:\n` +
                `- Keep all requirements, sizes, and text constraints.\n` +
                `- Make layout explicit (grid, safe margins, hierarchy).\n` +
                `- Do not add new factual claims.\n` +
                `Return ONLY the improved prompt text (no markdown).\n`;
              const refined = await this.aiService.generateResponse(system, [
                { role: 'user' as const, content: basePrompt },
              ]);
              const cleaned = String(refined || '').trim();
              if (cleaned) optimizedPrompt = cleaned;
            }
          } catch { }

          const nowIso = new Date().toISOString();
          const schedule = this.parsePosterSchedule(String((draft as any).schedule || ''), cadence);
          posters.push({
            id: `poster-${nowIso}-${current + 1}`,
            index: current + 1,
            cadence,
            postersPerPeriod,
            createdAt: nowIso,
            requirements: draft,
            optimizedPrompt,
            schedule,
          });

          const nextIndex = current + 1;
          if (nextIndex < postersPerPeriod) {
            await this.chatService.setWorkflowState(data.chatId, {
              kind: 'posterBatch',
              step: 0,
              data: { cadence, postersPerPeriod, current: nextIndex, posters, draft: {} },
            });
            const aiMessage = await this.addAssistantMessage(data.chatId, questions[0].replace(`Poster ${current + 1}`, `Poster ${nextIndex + 1}`));
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          const plan: any = {
            cadence,
            ...(cadence === 'weekly' ? { postersPerWeek: postersPerPeriod } : { postersCount: postersPerPeriod }),
            posters,
            updatedAt: nowIso,
            automation: { enabled: true, mode: 'cron-worker' },
          };

          await this.chatService.updateChatMemoryDetails(data.chatId, { posterPlan: plan });
          await this.chatService.savePosterPlanToLatestProject(data.chatId, plan);
          await this.chatService.setWorkflowState(data.chatId, null);

          const doneText =
            cadence === 'weekly'
              ? `Perfect — I saved your weekly plan (${postersPerPeriod} posters/week) and created optimized prompts for each poster. When you request posters again, I can reuse these prompts.`
              : `Perfect — I saved your ${postersPerPeriod} poster requirements and created optimized prompts for each. I can reuse these prompts anytime.`;
          const aiMessage = await this.addAssistantMessage(data.chatId, doneText);
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        if (kind === 'image') {
          const keys = ['asset', 'style', 'constraints'] as const;
          const questions = [
            `Cool—what kind of image do you want (logo, banner, post, product shot), and where will you use it? Any size you need?`,
            `What vibe should it have, and what colors should I use (or avoid)?`,
            `Anything you want included (text/logo elements), and anything you definitely don’t want?`,
          ];
          if (data.imageUrl) (dataMap as any).referenceImageUrl = data.imageUrl;
          if (data.imageUrl && incoming && !this.isSizeQuestionQuery(incoming) && !this.isFullImageSpec(incoming)) {
            const cfg = aiConfig;
            const details = await this.chatService.getChatMemoryDetails(data.chatId);
            const brand = typeof (details as any)?.brandName === 'string' ? (details as any).brandName.trim() : '';
            const productName = typeof (details as any)?.productName === 'string' ? (details as any).productName.trim() : '';
            const targetAudience = typeof (details as any)?.targetAudience === 'string' ? (details as any).targetAudience.trim() : '';
            const tone = typeof (details as any)?.tone === 'string' ? (details as any).tone.trim() : '';
            const website = typeof (details as any)?.website === 'string' ? (details as any).website.trim() : '';
            const industriesStr = Array.isArray(industries)
              ? industries.filter(Boolean).join(', ')
              : typeof industries === 'string'
                ? industries
                : '';

            const platform = this.detectPlatform(incoming);
            const sizeMatch = incoming.match(/\b(\d{3,4})\s*x\s*(\d{3,4})\b/i);
            const size = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : (platform === 'facebook' ? '1080x1080' : '1080x1080');
            const asset = `${platform === 'generic' ? '' : platform + ' '}ad poster ${size}`.trim();

            const analysisSystem =
              `You are a senior graphic designer. Analyze the attached image and turn it into a generator-ready brief.\n` +
              `Return plain text with these lines:\n` +
              `SUBJECT: (what the image mainly shows)\n` +
              `STYLE: (colors, lighting, mood, background, composition)\n` +
              `TEXT: (any readable text, or "none")\n` +
              `PROMPT: (one prompt to recreate a similar visual, not an exact copy)`;

            let referenceNotes = '';
            try {
              referenceNotes = await this.aiService.generateResponse(analysisSystem, [
                { role: 'user' as const, content: incoming || 'Analyze the attached image.', imageUrl: data.imageUrl },
              ]);
            } catch { }

            const imagePrompt =
              `You are creating a high-quality Facebook ad/poster.\n\n` +
              `USER INSTRUCTION:\n${incoming}\n\n` +
              `BRAND CONTEXT:\n` +
              `${brand ? `- Brand name: ${brand}\n` : ''}` +
              `${productName ? `- Product name: ${productName}\n` : ''}` +
              `${website ? `- Website: ${website}\n` : ''}` +
              `${targetAudience ? `- Target audience: ${targetAudience}\n` : ''}` +
              `${tone ? `- Tone: ${tone}\n` : ''}` +
              `${industriesStr ? `- Industries: ${industriesStr}\n` : ''}` +
              `${contentStyle ? `- Creator style: ${contentStyle}\n` : ''}` +
              `${referenceNotes ? `\nREFERENCE IMAGE ANALYSIS:\n${referenceNotes}\n` : ''}` +
              `\nDELIVERABLE:\n` +
              `- Asset/platform/size: ${asset}\n` +
              `- Use the attached image as the primary reference for subject + style.\n` +
              `\nQUALITY BAR:\n` +
              `- Clean, premium composition; balanced spacing and alignment.\n` +
              `- If you include text, keep it minimal and perfectly readable (no warped/garbled text).\n` +
              `- Use a clear grid; keep safe margins/padding ~8–12% on all sides.\n` +
              `- Never crop text/letters. If space is tight, reduce font size or reflow lines—do not break words awkwardly.\n` +
              `- Keep the text block and illustration visually balanced with consistent column alignment and whitespace.\n` +
              `- No clutter, no random extra elements, no duplicated subjects.\n` +
              `- Keep all key elements fully inside the frame.\n`;

            await this.chatService.setWorkflowState(data.chatId, null);

            if (!cfg?.imageApiKey || !cfg?.imageApiUrl || !cfg?.imageModel) {
              const msg =
                `Got it—I’ll use your image as reference and create the Facebook ad/poster. I can’t generate it yet because the image service isn’t configured.\n` +
                `If you’re the admin: go to Admin → Influencers → Edit → AI Services → Image and set Image API URL, Image API Key, and Image Model.\n\n` +
                `Here’s the exact prompt I’d use:\n\n${imagePrompt}`;
              const aiMessage = await this.addAssistantMessage(data.chatId, msg);
              this.server.to(data.chatId).emit('typing', { isTyping: false });
              this.server.to(data.chatId).emit('newMessage', aiMessage);
              return;
            }

            this.scheduleBackgroundImage(
              data.chatId,
              `Got it — I’m creating that version now. It may take a moment, I’ll share it shortly.`,
              async () => {
                const result = await this.generateImageWithReview(cfg, imagePrompt, 2);
                const caption = brand
                  ? `Done—here’s a Facebook ad/poster concept for ${brand}, based on your image. Want a second variation (more bold / more minimal / more premium)?`
                  : `Done—here’s a Facebook ad/poster concept based on your image. Want a second variation (more bold / more minimal / more premium)?`;
                return { caption, imageUrl: result.imageUrl };
              },
            );
            return;
          }
          if (!dataMap.asset && incoming) {
            const inferred = this.inferStandardAsset(incoming);
            if (inferred?.asset) {
              dataMap.asset = inferred.asset;
              await this.chatService.setWorkflowState(data.chatId, { kind: 'image', step: 1, data: dataMap });
              const aiMessage = await this.addAssistantMessage(
                data.chatId,
                `Got it—I’ll assume a ${inferred.asset} (tell me if you meant a different size). What vibe should it have, and what colors should I use (or avoid)?`,
              );
              this.server.to(data.chatId).emit('typing', { isTyping: false });
              this.server.to(data.chatId).emit('newMessage', aiMessage);
              return;
            }
          }
          if (this.isFullImageSpec(incoming)) {
            const parsed = this.toImageWorkflowData(incoming);
            dataMap.asset = parsed.asset;
            dataMap.style = parsed.style;
            dataMap.constraints = parsed.constraints;
            const cfg = aiConfig;
            const details = await this.chatService.getChatMemoryDetails(data.chatId);
            const brand = typeof (details as any)?.brandName === 'string' ? (details as any).brandName.trim() : '';
            const productName = typeof (details as any)?.productName === 'string' ? (details as any).productName.trim() : '';
            const targetAudience = typeof (details as any)?.targetAudience === 'string' ? (details as any).targetAudience.trim() : '';
            const tone = typeof (details as any)?.tone === 'string' ? (details as any).tone.trim() : '';
            const website = typeof (details as any)?.website === 'string' ? (details as any).website.trim() : '';
            const industriesStr = Array.isArray(industries)
              ? industries.filter(Boolean).join(', ')
              : typeof industries === 'string'
                ? industries
                : '';

            const referenceImageUrl = typeof (dataMap as any).referenceImageUrl === 'string' ? (dataMap as any).referenceImageUrl.trim() : '';
            let referenceNotes = '';
            if (referenceImageUrl) {
              const analysisSystem =
                `You are a senior graphic designer. Analyze the attached image and extract reusable design direction.\n` +
                `Return 10–14 concise lines covering: layout/composition, background style, color palette (with hex if you can), typography style, icon/shape motifs, lighting/glow/shadow style, and overall vibe.\n` +
                `Do not mention policy. Do not guess brand name. If there is text/logo, say “text/logo present” but don’t copy it verbatim.\n` +
                `End with one line starting with "PROMPT:" that is a generator-ready prompt to recreate a similar style (not an exact copy).`;
              try {
                referenceNotes = await this.aiService.generateResponse(analysisSystem, [
                  { role: 'user', content: incoming || 'Analyze the attached image.', imageUrl: referenceImageUrl },
                ]);
              } catch { }
            }

            const imagePrompt =
              `You are creating a high-quality marketing image.\n\n` +
              `BRAND CONTEXT:\n` +
              `${brand ? `- Brand name: ${brand}\n` : ''}` +
              `${productName ? `- Product name: ${productName}\n` : ''}` +
              `${website ? `- Website: ${website}\n` : ''}` +
              `${targetAudience ? `- Target audience: ${targetAudience}\n` : ''}` +
              `${tone ? `- Tone: ${tone}\n` : ''}` +
              `${industriesStr ? `- Industries: ${industriesStr}\n` : ''}` +
              `${contentStyle ? `- Creator style: ${contentStyle}\n` : ''}` +
              `${referenceNotes ? `\nREFERENCE IMAGE NOTES:\n${referenceNotes}\n` : ''}` +
              `\nDELIVERABLE:\n` +
              `- Asset/platform/size: ${dataMap.asset || ''}\n` +
              `- Style/colors: ${dataMap.style || ''}\n` +
              `- Include/avoid: ${dataMap.constraints || ''}\n` +
              `\nQUALITY BAR:\n` +
              `- Clean, premium composition; balanced spacing and alignment.\n` +
              `- If you include text, keep it minimal and perfectly readable (no warped/garbled text).\n` +
              `- No clutter, no random extra elements, no duplicated subjects.\n` +
              `- Keep all key elements fully inside the frame.\n` +
              `- Follow the requested style/colors and respect all avoid constraints.\n`;

            await this.chatService.setWorkflowState(data.chatId, null);
            if (!cfg?.imageApiKey || !cfg?.imageApiUrl || !cfg?.imageModel) {
              const msg =
                `This is a great brief—thanks. I can’t generate the image yet because the image service isn’t configured.\n` +
                `If you’re the admin: go to Admin → Influencers → Edit → AI Services → Image and set Image API URL, Image API Key, and Image Model.\n\n` +
                `Here’s the exact prompt I’d use:\n\n${imagePrompt}`;
              const aiMessage = await this.addAssistantMessage(data.chatId, msg);
              this.server.to(data.chatId).emit('typing', { isTyping: false });
              this.server.to(data.chatId).emit('newMessage', aiMessage);
              return;
            }

            this.scheduleBackgroundImage(
              data.chatId,
              `Got it — I’m generating this now. It may take a moment, I’ll share it shortly.`,
              async () => {
                const result = await this.generateImageWithReview(cfg, imagePrompt, 2);
                const caption = brand
                  ? `Done—here’s a first version for ${brand}. Want a second variation (more bold / more minimal / more neon)?`
                  : `Done—here’s a first version. Want a second variation (more bold / more minimal / more neon)?`;
                return { caption, imageUrl: result.imageUrl };
              },
            );
            return;
          }
          if (this.isSizeQuestionQuery(incoming)) {
            const platform = this.detectPlatform(incoming);
            const guidance = this.sizeGuidance(platform);
            const aiMessage = await this.addAssistantMessage(data.chatId, guidance);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }
          const key = keys[Math.min(step, keys.length - 1)];
          if (incoming) {
            dataMap[key] = incoming;
          } else if (data.imageUrl) {
            if (key === 'asset' && !dataMap.asset) dataMap.asset = 'social media post 1080x1080';
            if (key === 'style' && !dataMap.style) dataMap.style = 'Use the attached image as the style reference.';
          }
          const nextStep = step + 1;
          if (nextStep < questions.length) {
            await this.chatService.setWorkflowState(data.chatId, { kind: 'image', step: nextStep, data: dataMap });
            const aiMessage = await this.addAssistantMessage(data.chatId, questions[nextStep]);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          const cfg = aiConfig;
          const details = await this.chatService.getChatMemoryDetails(data.chatId);
          const brand = typeof (details as any)?.brandName === 'string' ? (details as any).brandName.trim() : '';
          const productName = typeof (details as any)?.productName === 'string' ? (details as any).productName.trim() : '';
          const targetAudience = typeof (details as any)?.targetAudience === 'string' ? (details as any).targetAudience.trim() : '';
          const tone = typeof (details as any)?.tone === 'string' ? (details as any).tone.trim() : '';
          const website = typeof (details as any)?.website === 'string' ? (details as any).website.trim() : '';
          const industriesStr = Array.isArray(industries)
            ? industries.filter(Boolean).join(', ')
            : typeof industries === 'string'
              ? industries
              : '';

          const referenceImageUrl = typeof (dataMap as any).referenceImageUrl === 'string' ? (dataMap as any).referenceImageUrl.trim() : '';
          let referenceNotes = '';
          if (referenceImageUrl) {
            const analysisSystem =
              `You are a senior graphic designer. Analyze the attached image and extract reusable design direction.\n` +
              `Return 10–14 concise lines covering: layout/composition, background style, color palette (with hex if you can), typography style, icon/shape motifs, lighting/glow/shadow style, and overall vibe.\n` +
              `Do not mention policy. Do not guess brand name. If there is text/logo, say “text/logo present” but don’t copy it verbatim.\n` +
              `End with one line starting with "PROMPT:" that is a generator-ready prompt to recreate a similar style (not an exact copy).`;
            try {
              referenceNotes = await this.aiService.generateResponse(analysisSystem, [
                { role: 'user', content: incoming || 'Analyze the attached image.', imageUrl: referenceImageUrl },
              ]);
            } catch { }
          }

          const imagePrompt =
            `You are creating a high-quality marketing image.\n\n` +
            `BRAND CONTEXT:\n` +
            `${brand ? `- Brand name: ${brand}\n` : ''}` +
            `${productName ? `- Product name: ${productName}\n` : ''}` +
            `${website ? `- Website: ${website}\n` : ''}` +
            `${targetAudience ? `- Target audience: ${targetAudience}\n` : ''}` +
            `${tone ? `- Tone: ${tone}\n` : ''}` +
            `${industriesStr ? `- Industries: ${industriesStr}\n` : ''}` +
            `${contentStyle ? `- Creator style: ${contentStyle}\n` : ''}` +
            `${referenceNotes ? `\nREFERENCE IMAGE NOTES:\n${referenceNotes}\n` : ''}` +
            `\nDELIVERABLE:\n` +
            `- Asset/platform/size: ${dataMap.asset || ''}\n` +
            `- Style/colors: ${dataMap.style || ''}\n` +
            `- Include/avoid: ${dataMap.constraints || ''}\n` +
            `\nQUALITY BAR:\n` +
            `- Clean, premium composition; balanced spacing and alignment.\n` +
            `- If you include text, keep it minimal and perfectly readable (no warped/garbled text).\n` +
            `- Use a clear grid; keep safe margins/padding ~8–12% on all sides.\n` +
            `- Never crop text/letters. If space is tight, reduce font size or reflow lines—do not break words awkwardly.\n` +
            `- Keep the text block and illustration visually balanced with consistent column alignment and whitespace.\n` +
            `- No clutter, no random extra elements, no duplicated subjects.\n` +
            `- Keep all key elements fully inside the frame.\n` +
            `- Follow the requested style/colors and respect all avoid constraints.\n`;
          `- No clutter, no random extra elements, no duplicated subjects.\n` +
            `- Keep all key elements fully inside the frame.\n` +
            `- Follow the requested style/colors and respect all avoid constraints.\n`;

          await this.chatService.setWorkflowState(data.chatId, null);

          if (!cfg?.imageApiKey || !cfg?.imageApiUrl || !cfg?.imageModel) {
            const msg =
              `I’ve got everything I need, but I can’t generate images from here yet because the image service isn’t configured.\n` +
              `If you’re the admin: go to Admin → Influencers → Edit → AI Services → Image and set Image API URL, Image API Key, and Image Model.\n\n` +
              `In the meantime, here’s the exact prompt I’d use:\n\n${imagePrompt}`;
            const aiMessage = await this.addAssistantMessage(data.chatId, msg);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          this.scheduleBackgroundImage(
            data.chatId,
            `Got it — I’m creating the image now. It may take a moment, I’ll share it shortly.`,
            async () => {
              const result = await this.generateImageWithReview(cfg, imagePrompt, 2);
              const caption = brand
                ? `Alright—here’s a first concept for ${brand}. Want it more minimal, bold, or playful?`
                : `Alright—here’s a first concept. Want it more minimal, bold, or playful?`;
              return { caption, imageUrl: result.imageUrl };
            },
          );
          return;
        }

        if (kind === 'video') {
          const keys = ['brief', 'audience', 'tone'] as const;
          const questions = [
            `Nice—what’s the product/brand, and what’s the main message or goal for the video?`,
            `Where will it run (TikTok/IG/YT), roughly how long, and who’s it for?`,
            `What tone should it have, and what are 2–5 must-include points (comma-separated)?`,
          ];
          const key = keys[Math.min(step, keys.length - 1)];
          if (incoming) dataMap[key] = incoming;
          const nextStep = step + 1;
          if (nextStep < questions.length) {
            await this.chatService.setWorkflowState(data.chatId, { kind: 'video', step: nextStep, data: dataMap });
            const aiMessage = await this.addAssistantMessage(data.chatId, questions[nextStep]);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          await this.chatService.setWorkflowState(data.chatId, null);
          const details = await this.chatService.getChatMemoryDetails(data.chatId);
          const productName =
            (typeof (details as any)?.productName === 'string' && (details as any).productName.trim()) ||
            (typeof (details as any)?.brandName === 'string' && (details as any).brandName.trim()) ||
            'your product';

          const inclusions = String(dataMap.tone || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8);

          const script = await this.aiService.generateVideoScript(name, {
            productName,
            keyMessage: dataMap.brief || '',
            targetAudience: dataMap.audience || '',
            tone: dataMap.tone || '',
            inclusions,
            additionalNotes: '',
          });

          const aiMessage = await this.addAssistantMessage(data.chatId, script);
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        if (kind === 'post') {
          const keys = ['format', 'audience', 'constraints'] as const;
          const questions = [
            `Got it—what are we writing (blog post, LinkedIn post, caption), and what’s the topic?`,
            `Who’s it for, and what do you want the reader to do (CTA)?`,
            `Any key points to include + the tone you want?`,
          ];
          const key = keys[Math.min(step, keys.length - 1)];
          if (incoming) dataMap[key] = incoming;
          const nextStep = step + 1;
          if (nextStep < questions.length) {
            await this.chatService.setWorkflowState(data.chatId, { kind: 'post', step: nextStep, data: dataMap });
            const aiMessage = await this.addAssistantMessage(data.chatId, questions[nextStep]);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          await this.chatService.setWorkflowState(data.chatId, null);
          const details = await this.chatService.getChatMemoryDetails(data.chatId);
          const brand = typeof (details as any)?.brandName === 'string' ? (details as any).brandName.trim() : '';

          const prompt =
            `Write a ${dataMap.format || 'post'}.\n` +
            `${brand ? `Brand: ${brand}\n` : ''}` +
            `Audience/CTA: ${dataMap.audience || ''}\n` +
            `Constraints/tone/points: ${dataMap.constraints || ''}\n`;

          let responseText = '';
          try {
            responseText = await this.aiService.generateResponse(
              `You write marketing content. Keep it concise and aligned with the requested format, audience, CTA, and tone.`,
              [{ role: 'user' as const, content: prompt }],
              360,
            );
          } catch (err: any) {
            if (!this.isQuotaError(err)) throw err;
            const suffix = await this.quotaHelpSuffix();
            responseText =
              `The chat provider is rejecting requests with 429 (insufficient_quota / rate limit).${suffix}\n\n` +
              this.formatPostFallback(String(dataMap.format || ''), brand, String(dataMap.audience || ''), String(dataMap.constraints || ''));
          }

          const aiMessage = await this.addAssistantMessage(data.chatId, responseText);
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        if (kind === 'postBatch') {
          const postsPerPeriod =
            typeof wfData.postsPerPeriod === 'number' && Number.isFinite(wfData.postsPerPeriod)
              ? Math.min(10, Math.max(1, Math.floor(wfData.postsPerPeriod)))
              : 1;
          const cadence = wfData.cadence === 'weekly' ? 'weekly' : 'oneoff';
          const current =
            typeof wfData.current === 'number' && Number.isFinite(wfData.current)
              ? Math.max(0, Math.floor(wfData.current))
              : 0;
          const posts = Array.isArray(wfData.posts) ? [...wfData.posts] : [];
          const globals = wfData.globals && typeof wfData.globals === 'object' ? { ...(wfData.globals as any) } : {};
          const draft = wfData.draft && typeof wfData.draft === 'object' ? { ...(wfData.draft as any) } : {};
          const phase: 'globals' | 'post' = wfData.phase === 'post' ? 'post' : 'globals';

          const globalsKeys = ['platforms', 'postType', 'tone', 'mainKeyword', 'include', 'cta', 'length', 'reference', 'schedule'] as const;
          const globalsQuestions = [
            `On which platform(s) will you publish? (Website / Facebook / Instagram / LinkedIn, etc.)`,
            `What type of post do you want? (blog, social media, landing page update, etc.)`,
            `What tone should it have? (professional, casual, friendly)`,
            `What is the main keyword (if any)?`,
            `Any specific points, services, or products to include?`,
            `Do you want a CTA? If yes, what should it be?`,
            `Optional: Preferred post length (short / medium / long)?`,
            `Optional: Any reference or example (URL or paste text)?`,
            `Optional: Preferred posting days/timing? (day + time + timezone)`,
          ];

          const postKeys = ['topic', 'goal', 'audience'] as const;
          const postQuestions = [
            `Post ${current + 1} of ${postsPerPeriod}: What is the topic of this post?`,
            `Post ${current + 1}: What is the goal of this post? (traffic, leads, sales, awareness)`,
            `Post ${current + 1}: Who is your target audience?`,
          ];

          if (phase === 'globals') {
            const key = globalsKeys[Math.min(step, globalsKeys.length - 1)];
            if (incoming) (globals as any)[key] = incoming;
            const nextStep = step + 1;
            if (nextStep < globalsQuestions.length) {
              await this.chatService.setWorkflowState(data.chatId, {
                kind: 'postBatch',
                step: nextStep,
                data: { cadence, postsPerPeriod, current, posts, globals, draft, phase: 'globals' },
              });
              const aiMessage = await this.addAssistantMessage(data.chatId, globalsQuestions[nextStep]);
              this.server.to(data.chatId).emit('typing', { isTyping: false });
              this.server.to(data.chatId).emit('newMessage', aiMessage);
              return;
            }

            await this.chatService.setWorkflowState(data.chatId, {
              kind: 'postBatch',
              step: 0,
              data: { cadence, postsPerPeriod, current, posts, globals, draft: {}, phase: 'post' },
            });
            const aiMessage = await this.addAssistantMessage(data.chatId, postQuestions[0]);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          const key = postKeys[Math.min(step, postKeys.length - 1)];
          if (incoming) (draft as any)[key] = incoming;
          const nextStep = step + 1;
          if (nextStep < postQuestions.length) {
            await this.chatService.setWorkflowState(data.chatId, {
              kind: 'postBatch',
              step: nextStep,
              data: { cadence, postsPerPeriod, current, posts, globals, draft, phase: 'post' },
            });
            const aiMessage = await this.addAssistantMessage(data.chatId, postQuestions[nextStep]);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          const details = await this.chatService.getChatMemoryDetails(data.chatId);
          const brand = typeof (details as any)?.brandName === 'string' ? (details as any).brandName.trim() : '';
          const productName = typeof (details as any)?.productName === 'string' ? (details as any).productName.trim() : '';
          const website = typeof (details as any)?.website === 'string' ? (details as any).website.trim() : '';

          const targetAudienceSaved = typeof (details as any)?.targetAudience === 'string' ? (details as any).targetAudience.trim() : '';
          const toneSaved = typeof (details as any)?.tone === 'string' ? (details as any).tone.trim() : '';
          const tone = String((globals as any).tone || toneSaved);

          const requirements = {
            topic: String((draft as any).topic || ''),
            goal: String((draft as any).goal || ''),
            targetAudience: String((draft as any).audience || targetAudienceSaved || ''),
            platforms: String((globals as any).platforms || ''),
            postType: String((globals as any).postType || ''),
            tone,
            mainKeyword: String((globals as any).mainKeyword || ''),
            include: String((globals as any).include || ''),
            cta: String((globals as any).cta || ''),
            length: String((globals as any).length || ''),
            reference: String((globals as any).reference || ''),
            schedule: String((globals as any).schedule || ''),
          };

          const optimizedPrompt =
            `You are an expert website & social content strategist.\n` +
            `Write a high-quality, ready-to-publish ${requirements.postType || 'post'}.\n\n` +
            `BRAND CONTEXT:\n` +
            `${brand ? `- Brand: ${brand}\n` : ''}` +
            `${productName ? `- Product/Service: ${productName}\n` : ''}` +
            `${website ? `- Website: ${website}\n` : ''}` +
            `\nPUBLISHING:\n` +
            `${requirements.platforms ? `- Platforms: ${requirements.platforms}\n` : ''}` +
            `${requirements.schedule ? `- Schedule: ${requirements.schedule}\n` : ''}` +
            `\nPOST REQUIREMENTS:\n` +
            `- Topic: ${requirements.topic}\n` +
            `- Goal: ${requirements.goal}\n` +
            `- Target audience: ${requirements.targetAudience}\n` +
            `${requirements.tone ? `- Tone: ${requirements.tone}\n` : ''}` +
            `${requirements.mainKeyword ? `- Main keyword: ${requirements.mainKeyword}\n` : ''}` +
            `${requirements.include ? `- Include: ${requirements.include}\n` : ''}` +
            `${requirements.cta ? `- CTA: ${requirements.cta}\n` : ''}` +
            `${requirements.length ? `- Length: ${requirements.length}\n` : ''}` +
            `${requirements.reference ? `- Reference: ${requirements.reference}\n` : ''}` +
            `\nQUALITY RULES:\n` +
            `- Avoid generic filler. Make it specific and useful.\n` +
            `- Use clear structure: headline, subheads, concise paragraphs.\n` +
            `- If website/blog: include an SEO-friendly title and meta description.\n` +
            `- Integrate keywords naturally; no keyword stuffing.\n` +
            `- Do not invent facts, stats, prices, addresses, or guarantees.\n` +
            `- End with a clear CTA aligned to the goal.\n`;

          const nowIso = new Date().toISOString();
          posts.push({
            id: `post-${nowIso}-${current + 1}`,
            index: current + 1,
            cadence,
            postsPerPeriod,
            createdAt: nowIso,
            requirements,
            optimizedPrompt,
          });

          const nextIndex = current + 1;
          if (nextIndex < postsPerPeriod) {
            await this.chatService.setWorkflowState(data.chatId, {
              kind: 'postBatch',
              step: 0,
              data: { cadence, postsPerPeriod, current: nextIndex, posts, globals, draft: {}, phase: 'post' },
            });
            const aiMessage = await this.addAssistantMessage(
              data.chatId,
              postQuestions[0].replace(`Post ${current + 1}`, `Post ${nextIndex + 1}`),
            );
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          const plan: any = {
            cadence,
            ...(cadence === 'weekly' ? { postsPerWeek: postsPerPeriod } : { postsCount: postsPerPeriod }),
            platforms: String((globals as any).platforms || ''),
            postType: String((globals as any).postType || ''),
            tone: String((globals as any).tone || ''),
            mainKeyword: String((globals as any).mainKeyword || ''),
            include: String((globals as any).include || ''),
            cta: String((globals as any).cta || ''),
            length: String((globals as any).length || ''),
            reference: String((globals as any).reference || ''),
            schedule: String((globals as any).schedule || ''),
            posts,
            updatedAt: nowIso,
          };
          await this.chatService.updateChatMemoryDetails(data.chatId, { postPlan: plan });
          await this.chatService.savePostPlanToLatestProject(data.chatId, plan);
          await this.chatService.setWorkflowState(data.chatId, null);
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            cadence === 'weekly'
              ? `Perfect — I saved your weekly post plan (${postsPerPeriod} posts/week) with optimized prompts for each post.`
              : `Perfect — I saved your post plan with optimized prompts for each post.`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
      }

      const industriesList = Array.isArray(industries)
        ? industries.filter(Boolean).join(', ')
        : typeof industries === 'string'
          ? industries
          : '';

      if (this.isAddressQuery(incoming)) {
        const includePincode = this.isPincodeRequested(incoming);
        const reply = this.buildAddressReply({
          name,
          locationCity,
          locationState,
          locationCountry,
          locationAddress,
          locationPincode,
        }, includePincode);
        const aiMessage = await this.addAssistantMessage(data.chatId, reply);
        this.server.to(data.chatId).emit('typing', { isTyping: false });
        this.server.to(data.chatId).emit('newMessage', aiMessage);
        return;
      }

      const imageIntent = wantsImage || wantsPoster;
      const videoIntent = wantsVideo;
      const postIntent = wantsPost;
      if (serviceType === 'IMAGE_CREATION') {
        if (!imageIntent && videoIntent) {
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            `I can help—video creation needs the video-creator profile. Please switch to Video and I’ll take it from there.`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
        if (!imageIntent && postIntent) {
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            `I can help with that—please switch to the Post creator so I can collect the post details and write it properly.`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
      } else if (serviceType === 'VIDEO_CREATION') {
        if (!videoIntent && imageIntent) {
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            `I can help with that—please switch to the Image creator so I can handle the visual requirements.`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
        if (!videoIntent && postIntent) {
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            `I can help with that—please switch to the Post creator so I can collect the post details and write it properly.`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
      } else if (serviceType === 'POST_CREATION') {
        if (!postIntent && imageIntent) {
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            `I can help with that—please switch to the Image creator so I can handle the visual requirements.`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
        if (!postIntent && videoIntent) {
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            `I can help—video creation needs the video-creator profile. Please switch to Video and I’ll take it from there.`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
      } else {
        if (imageIntent) {
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            `I can help with that—please switch to the Image creator so I can handle the visual requirements.`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
        if (videoIntent) {
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            `I can help—video creation needs the video-creator profile. Please switch to Video and I’ll take it from there.`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
        if (postIntent) {
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            `I can help with that—please switch to the Post creator so I can collect the post details and write it properly.`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }
      }

      if (serviceType === 'IMAGE_CREATION' && (wantsImage || wantsPoster || this.isImageReferenceRequest(incoming, !!data.imageUrl))) {
        const details = await this.chatService.getChatMemoryDetails(data.chatId);
        const brand = typeof (details as any)?.brandName === 'string' ? (details as any).brandName.trim() : '';
        const hasImage = !!data.imageUrl;
        const wantsReference = this.isImageReferenceRequest(incoming, hasImage);

        if (this.isSizeQuestionQuery(incoming)) {
          const platform = this.detectPlatform(incoming);
          const guidance = this.sizeGuidance(platform);
          const aiMessage = await this.addAssistantMessage(data.chatId, guidance);
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        if (!hasImage && this.isPosterRequest(incoming)) {
          const cadence = this.parsePosterCadence(incoming);
          const postersPerPeriod = cadence?.postersPerWeek ?? this.parsePosterCount(incoming) ?? 1;
          const mode = cadence ? 'weekly' : 'oneoff';
          const nowIso = new Date().toISOString();
          const planMeta: any = {
            cadence: mode,
            ...(mode === 'weekly' ? { postersPerWeek: postersPerPeriod } : { postersCount: postersPerPeriod }),
            posters: [],
            updatedAt: nowIso,
          };
          await this.chatService.updateChatMemoryDetails(data.chatId, { posterPlan: planMeta });
          await this.chatService.savePosterPlanToLatestProject(data.chatId, planMeta);
          await this.chatService.setWorkflowState(data.chatId, {
            kind: 'posterBatch',
            step: 0,
            data: { cadence: mode, postersPerPeriod, current: 0, posters: [], draft: {} },
          });
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            mode === 'weekly'
              ? `Got it — ${postersPerPeriod} posters every week. Let’s collect the details for each poster one by one (including the weekly schedule time).\n\nPoster 1 of ${postersPerPeriod}: Where will this poster be used and what exact size do you need (e.g., 1080x1350 Instagram, 1080x1080, A4 print, 1920x1080)?`
              : `Got it — let’s create ${postersPerPeriod} poster${postersPerPeriod === 1 ? '' : 's'}. I’ll collect the details one by one (including the schedule time).\n\nPoster 1 of ${postersPerPeriod}: Where will this poster be used and what exact size do you need (e.g., 1080x1350 Instagram, 1080x1080, A4 print, 1920x1080)?`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        if (hasImage && (wantsReference || wantsImage) && !this.isFullImageSpec(incoming)) {
          const cfg = aiConfig;
          const productName = typeof (details as any)?.productName === 'string' ? (details as any).productName.trim() : '';
          const targetAudience = typeof (details as any)?.targetAudience === 'string' ? (details as any).targetAudience.trim() : '';
          const tone = typeof (details as any)?.tone === 'string' ? (details as any).tone.trim() : '';
          const website = typeof (details as any)?.website === 'string' ? (details as any).website.trim() : '';
          const industriesStr = Array.isArray(industries)
            ? industries.filter(Boolean).join(', ')
            : typeof industries === 'string'
              ? industries
              : '';

          const platform = this.detectPlatform(incoming);
          const sizeMatch = incoming.match(/\b(\d{3,4})\s*x\s*(\d{3,4})\b/i);
          const size = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : (platform === 'facebook' ? '1080x1080' : '1080x1080');
          const asset = `${platform === 'generic' ? '' : platform + ' '}ad poster ${size}`.trim();

          const analysisSystem =
            `You are a senior graphic designer. Analyze the attached image and turn it into a generator-ready brief.\n` +
            `Return plain text with these lines:\n` +
            `SUBJECT: (what the image mainly shows)\n` +
            `STYLE: (colors, lighting, mood, background, composition)\n` +
            `TEXT: (any readable text, or "none")\n` +
            `PROMPT: (one prompt to recreate a similar visual, not an exact copy)`;

          let referenceNotes = '';
          try {
            referenceNotes = await this.aiService.generateResponse(analysisSystem, [
              { role: 'user' as const, content: incoming || 'Analyze the attached image.', imageUrl: data.imageUrl },
            ]);
          } catch { }

          const imagePrompt =
            `You are creating a high-quality Facebook ad/poster.\n\n` +
            `USER INSTRUCTION:\n${incoming}\n\n` +
            `BRAND CONTEXT:\n` +
            `${brand ? `- Brand name: ${brand}\n` : ''}` +
            `${productName ? `- Product name: ${productName}\n` : ''}` +
            `${website ? `- Website: ${website}\n` : ''}` +
            `${targetAudience ? `- Target audience: ${targetAudience}\n` : ''}` +
            `${tone ? `- Tone: ${tone}\n` : ''}` +
            `${industriesStr ? `- Industries: ${industriesStr}\n` : ''}` +
            `${contentStyle ? `- Creator style: ${contentStyle}\n` : ''}` +
            `${referenceNotes ? `\nREFERENCE IMAGE ANALYSIS:\n${referenceNotes}\n` : ''}` +
            `\nDELIVERABLE:\n` +
            `- Asset/platform/size: ${asset}\n` +
            `- Use the attached image as the primary reference for subject + style.\n` +
            `\nQUALITY BAR:\n` +
            `- Clean, premium composition; balanced spacing and alignment.\n` +
            `- If you include text, keep it minimal and perfectly readable (no warped/garbled text).\n` +
            `- Use a clear grid; keep safe margins/padding ~8–12% on all sides.\n` +
            `- Never crop text/letters. If space is tight, reduce font size or reflow lines—do not break words awkwardly.\n` +
            `- Keep the text block and illustration visually balanced with consistent column alignment and whitespace.\n` +
            `- No clutter, no random extra elements, no duplicated subjects.\n` +
            `- Keep all key elements fully inside the frame.\n`;

          if (!cfg?.imageApiKey || !cfg?.imageApiUrl || !cfg?.imageModel) {
            const msg =
              `Got it—I can use your image as the style reference. I can’t generate the new image yet because the image service isn’t configured.\n` +
              `If you’re the admin: go to Admin → Influencers → Edit → AI Services → Image and set Image API URL, Image API Key, and Image Model.\n\n` +
              `Here’s the exact prompt I’d use:\n\n${imagePrompt}`;
            const aiMessage = await this.addAssistantMessage(data.chatId, msg);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          this.scheduleBackgroundImage(
            data.chatId,
            `Got it — I’m creating that version now. It may take a moment, I’ll share it shortly.`,
            async () => {
              const result = await this.generateImageWithReview(cfg, imagePrompt, 2);
              const caption = brand
                ? `Done—here’s a Facebook ad/poster concept for ${brand}, based on your image. Want a second variation (more bold / more minimal / more premium)?`
                : `Done—here’s a Facebook ad/poster concept based on your image. Want a second variation (more bold / more minimal / more premium)?`;
              return { caption, imageUrl: result.imageUrl };
            },
          );
          return;
        }

        if (this.isFullImageSpec(incoming)) {
          const cfg = aiConfig;
          const parsed = this.toImageWorkflowData(incoming);
          const merged = {
            asset: parsed.asset,
            style: parsed.style,
            constraints: parsed.constraints,
          };

          const productName = typeof (details as any)?.productName === 'string' ? (details as any).productName.trim() : '';
          const targetAudience = typeof (details as any)?.targetAudience === 'string' ? (details as any).targetAudience.trim() : '';
          const tone = typeof (details as any)?.tone === 'string' ? (details as any).tone.trim() : '';
          const website = typeof (details as any)?.website === 'string' ? (details as any).website.trim() : '';
          const industriesStr = Array.isArray(industries)
            ? industries.filter(Boolean).join(', ')
            : typeof industries === 'string'
              ? industries
              : '';

          let referenceNotes = '';
          if (data.imageUrl) {
            const analysisSystem =
              `You are a senior graphic designer. Analyze the attached image and extract reusable design direction.\n` +
              `Return 10–14 concise lines covering: layout/composition, background style, color palette (with hex if you can), typography style, icon/shape motifs, lighting/glow/shadow style, and overall vibe.\n` +
              `If there is text/logo, say “text/logo present” but don’t copy it verbatim.\n` +
              `End with one line starting with "PROMPT:" that is a generator-ready prompt to recreate a similar style (not an exact copy).`;
            try {
              referenceNotes = await this.aiService.generateResponse(analysisSystem, [
                { role: 'user' as const, content: incoming || 'Analyze the attached image.', imageUrl: data.imageUrl },
              ]);
            } catch { }
          }

          const imagePrompt =
            `You are creating a high-quality marketing image.\n\n` +
            `BRAND CONTEXT:\n` +
            `${brand ? `- Brand name: ${brand}\n` : ''}` +
            `${productName ? `- Product name: ${productName}\n` : ''}` +
            `${website ? `- Website: ${website}\n` : ''}` +
            `${targetAudience ? `- Target audience: ${targetAudience}\n` : ''}` +
            `${tone ? `- Tone: ${tone}\n` : ''}` +
            `${industriesStr ? `- Industries: ${industriesStr}\n` : ''}` +
            `${contentStyle ? `- Creator style: ${contentStyle}\n` : ''}` +
            `${referenceNotes ? `\nREFERENCE IMAGE NOTES:\n${referenceNotes}\n` : ''}` +
            `\nDELIVERABLE:\n` +
            `- Asset/platform/size: ${merged.asset}\n` +
            `- Style/colors: ${merged.style}\n` +
            `- Include/avoid: ${merged.constraints}\n` +
            `\nQUALITY BAR:\n` +
            `- Clean, premium composition; balanced spacing and alignment.\n` +
            `- If you include text, keep it minimal and perfectly readable (no warped/garbled text).\n` +
            `- Use a clear grid; keep safe margins/padding ~8–12% on all sides.\n` +
            `- Never crop text/letters. If space is tight, reduce font size or reflow lines—do not break words awkwardly.\n` +
            `- Keep the text block and illustration visually balanced with consistent column alignment and whitespace.\n` +
            `- No clutter, no random extra elements, no duplicated subjects.\n` +
            `- Keep all key elements fully inside the frame.\n` +
            `- Follow the requested style/colors and respect all avoid constraints.\n`;

          if (!cfg?.imageApiKey || !cfg?.imageApiUrl || !cfg?.imageModel) {
            const msg =
              `This is a great brief—thanks. I can’t generate the image yet because the image service isn’t configured.\n` +
              `If you’re the admin: go to Admin → Influencers → Edit → AI Services → Image and set Image API URL, Image API Key, and Image Model.\n\n` +
              `Here’s the exact prompt I’d use:\n\n${imagePrompt}`;
            const aiMessage = await this.addAssistantMessage(data.chatId, msg);
            this.server.to(data.chatId).emit('typing', { isTyping: false });
            this.server.to(data.chatId).emit('newMessage', aiMessage);
            return;
          }

          this.scheduleBackgroundImage(
            data.chatId,
            `Got it — I’m creating the image now. It may take a moment, I’ll share it shortly.`,
            async () => {
              const result = await this.generateImageWithReview(cfg, imagePrompt, 2);
              const caption = brand
                ? `Done—here’s a first version for ${brand}. Want a second variation (more bold / more minimal / more neon)?`
                : `Done—here’s a first version. Want a second variation (more bold / more minimal / more neon)?`;
              return { caption, imageUrl: result.imageUrl };
            },
          );
          return;
        }

        if (this.isSizeQuestionQuery(incoming)) {
          const platform = this.detectPlatform(incoming);
          const guidance = this.sizeGuidance(platform);
          const aiMessage = await this.addAssistantMessage(data.chatId, guidance);
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        if (lowerIncoming.includes('what') && (lowerIncoming.includes('need') || lowerIncoming.includes('details') || lowerIncoming.includes('info'))) {
          const msg =
            `For a clean image, I only need: (1) what asset it is + size/platform, ` +
            `(2) the style/vibe + colors, and (3) what to include/avoid.`;
          const aiMessage = await this.addAssistantMessage(data.chatId, msg);
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        const inferred = this.inferStandardAsset(incoming);
        if (inferred?.asset) {
          await this.chatService.setWorkflowState(data.chatId, { kind: 'image', step: 1, data: { asset: inferred.asset } as any });
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            brand
              ? `Got it for ${brand}—I’ll assume a ${inferred.asset} (tell me if you meant a different size). What vibe should it have, and what colors should I use (or avoid)?`
              : `Got it—I’ll assume a ${inferred.asset} (tell me if you meant a different size). What vibe should it have, and what colors should I use (or avoid)?`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        await this.chatService.setWorkflowState(data.chatId, { kind: 'image', step: 0, data: {} });
        const aiMessage = await this.addAssistantMessage(
          data.chatId,
          brand
            ? `Sure—let’s do it for ${brand}. First: what kind of image do you want (logo, banner, post, product shot), and where will you use it? Any size you need?`
            : `Sure—first: what kind of image do you want (logo, banner, post, product shot), and where will you use it? Any size you need?`,
        );
        this.server.to(data.chatId).emit('typing', { isTyping: false });
        this.server.to(data.chatId).emit('newMessage', aiMessage);
        return;
      }

      if (serviceType === 'VIDEO_CREATION' && wantsVideo) {
        await this.chatService.setWorkflowState(data.chatId, { kind: 'video', step: 0, data: {} });
        const aiMessage = await this.addAssistantMessage(
          data.chatId,
          `Cool—quick one: what’s the product/brand, and what’s the main message or goal for the video?`,
        );
        this.server.to(data.chatId).emit('typing', { isTyping: false });
        this.server.to(data.chatId).emit('newMessage', aiMessage);
        return;
      }

      if (serviceType === 'POST_CREATION' && wantsPost) {
        const cadence = this.parsePostCadence(incoming);
        const postsPerPeriod = cadence?.postsPerWeek ?? this.parsePostCount(incoming) ?? 1;
        const mode = cadence ? 'weekly' : 'oneoff';
        if (postsPerPeriod > 1 || cadence) {
          const nowIso = new Date().toISOString();
          const planMeta: any = {
            cadence: mode,
            ...(mode === 'weekly' ? { postsPerWeek: postsPerPeriod } : { postsCount: postsPerPeriod }),
            posts: [],
            updatedAt: nowIso,
          };
          await this.chatService.updateChatMemoryDetails(data.chatId, { postPlan: planMeta });
          await this.chatService.savePostPlanToLatestProject(data.chatId, planMeta);
          await this.chatService.setWorkflowState(data.chatId, {
            kind: 'postBatch',
            step: 0,
            data: { cadence: mode, postsPerPeriod, current: 0, posts: [], globals: {}, draft: {}, phase: 'globals' },
          });
          const aiMessage = await this.addAssistantMessage(
            data.chatId,
            mode === 'weekly'
              ? `Got it — ${postsPerPeriod} posts every week. I’ll collect the minimum required details step by step and save them for reuse.\n\nOn which platform(s) will you publish? (Website / Facebook / Instagram / LinkedIn, etc.)`
              : `Got it — let’s plan ${postsPerPeriod} post${postsPerPeriod === 1 ? '' : 's'}. I’ll collect the minimum required details step by step and save them for reuse.\n\nOn which platform(s) will you publish? (Website / Facebook / Instagram / LinkedIn, etc.)`,
          );
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
          return;
        }

        await this.chatService.setWorkflowState(data.chatId, { kind: 'post', step: 0, data: {} });
        const aiMessage = await this.addAssistantMessage(
          data.chatId,
          `Got it—what are we writing (blog post, LinkedIn post, caption), and what’s the topic?`,
        );
        this.server.to(data.chatId).emit('typing', { isTyping: false });
        this.server.to(data.chatId).emit('newMessage', aiMessage);
        return;
      }

      // Fetch conversation history once — reused for relevance check and response generation.
      // The current user message was already saved above, so it is included here.
      const rawHistory = await this.chatService.getRecentMessages(data.chatId);
      const allMessages = rawHistory.map((m) => ({
        role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
        content: m.content,
        imageUrl: m.imageUrl ?? undefined,
      }));
      const messages = this.compactChatMessages(allMessages);

      const details = await this.chatService.getChatMemoryDetails(data.chatId);
      const direct = this.getDirectMemoryReply(data.content, details, name);
      if (direct) {
        const aiMessage = await this.addAssistantMessage(data.chatId, direct);
        this.server.to(data.chatId).emit('typing', { isTyping: false });
        this.server.to(data.chatId).emit('newMessage', aiMessage);

        const meta = await this.chatService.getChatMeta(data.chatId);
        if (meta && this.chatNotificationsEnabled() && this.shouldNotifyUser(meta.customerId, data.chatId)) {
          const preview = direct.length > 120 ? direct.slice(0, 120) + '…' : direct;
          await this.notificationService.create(meta.customerId, {
            title: `New message from ${name}`,
            description: preview,
            href: `/chat/${meta.influencerId}`,
          });
        }
        return;
      }

      // Check if AI is configured before attempting a text response
      let aiEnabled = false;
      try {
        aiEnabled = await this.aiService.isEnabled(aiConfig ?? undefined);
      } catch { }
      if (!aiEnabled) {
        const defaultMessage =
          "I can’t reply properly right now—looks like my chat settings aren’t configured. Give it a minute and try again.";
        const aiMessage = await this.addAssistantMessage(data.chatId, defaultMessage);
        this.server.to(data.chatId).emit('typing', { isTyping: false });
        this.server.to(data.chatId).emit('newMessage', aiMessage);
        return;
      }

      // Only run the topic-relevance check on the very first user message.
      // Once a conversation is underway the AI's system prompt keeps it on-topic,
      // and the user must be able to ask about anything they already shared
      // (e.g. "what is my brand name?") without being incorrectly blocked.
      const priorUserMessages = messages.filter((m) => m.role === 'user');
      const isFirstMessage = priorUserMessages.length <= 1;
      const isRelevant = isFirstMessage
        ? await this.aiService.isTopicRelevant(systemPrompt, topic, data.content, [], aiConfig ?? undefined)
        : true;

      if (!isRelevant) {
        const fallback =
          outOfTopicMessage ||
          (topic
            ? `I can only help with questions related to ${topic}. Feel free to ask me anything about that!`
            : `That's outside my area of expertise. Feel free to ask me anything I can actually help with!`);
        const aiMessage = await this.addAssistantMessage(data.chatId, fallback);
        this.server.to(data.chatId).emit('typing', { isTyping: false });
        this.server.to(data.chatId).emit('newMessage', aiMessage);

        const meta = await this.chatService.getChatMeta(data.chatId);
        if (meta && this.chatNotificationsEnabled() && this.shouldNotifyUser(meta.customerId, data.chatId)) {
          const preview = fallback.length > 120 ? fallback.slice(0, 120) + '…' : fallback;
          await this.notificationService.create(meta.customerId, {
            title: `New message from ${name}`,
            description: preview,
            href: `/chat/${meta.influencerId}`,
          });
        }
        return;
      }

      // Always keep replies short and strictly within the influencer's defined scope.
      // Explicitly instruct the AI to use conversation history when the user refers back to it.
      const memory = await this.chatService.getChatMemoryForPrompt(data.chatId);
      let imageContext = '';
      if (data.imageUrl) {
        const visionSystem =
          `You analyze an attached image and extract only what matters for the user's request.\n` +
          `Return plain text with:\n` +
          `- one-sentence description,\n` +
          `- any readable text (if any),\n` +
          `- key style cues only if relevant.\n` +
          `Be concise and do not invent details.`;
        try {
          imageContext = await this.aiService.generateResponse(
            visionSystem,
            [{ role: 'user' as const, content: incoming || 'Analyze the attached image.', imageUrl: data.imageUrl }],
            220,
          );
        } catch { }
      }
      const compactMemory = memory ? this.truncateText(memory, 2400) : '';
      const compactImageContext = imageContext ? this.truncateText(imageContext, 900) : '';
      const fullSystemPrompt =
        `${this.truncateText(systemPrompt, 5000)}` +
        `\n\nPROFILE:\n` +
        `- Service type: ${serviceType}\n` +
        (industriesList ? `- Industries: ${industriesList}\n` : '') +
        (contentStyle ? `- Content style: ${contentStyle}\n` : '') +
        (compactMemory ? `\n\nCONTEXT MEMORY:\n${compactMemory}\n` : '\n') +
        (compactImageContext ? `\n\nIMAGE CONTEXT:\n${compactImageContext}\n` : '') +
        `\nREPLY RULES:\n` +
        `- Be concise (1–5 sentences) and only answer what was asked.\n` +
        `- Use prior messages when the user refers back.\n` +
        `- Ask at most one brief follow-up question if needed.\n` +
        `- If outside your expertise, say so in one sentence.\n` +
        `- Do not claim to be human.`;

      let responseText: string;
      try {
        responseText = await this.aiService.generateResponse(fullSystemPrompt, messages, 420, aiConfig ?? undefined);
      } catch (error) {
        console.error('AI generation error:', error);
        let providerInfo = '';
        try {
          const info = await this.aiService.getActiveChatProviderInfo(aiConfig ?? undefined);
          const base = info.baseURL ? ` (${info.baseURL})` : '';
          providerInfo = ` Provider: ${info.provider}${base}. Model: ${info.model}.`;
        } catch { }
        const status =
          Number((error as any)?.status || (error as any)?.response?.status || (error as any)?.response?.statusCode) || 0;
        const rawMsg =
          String((error as any)?.message || '') ||
          String((error as any)?.response?.data?.error?.message || (error as any)?.response?.data?.message || '');
        const isQuota =
          status === 429 || /\binsufficient[_\s-]?quota\b/i.test(rawMsg) || /\brate limit\b/i.test(rawMsg);
        const fallback = isQuota
          ? `The chat provider is rejecting requests with a 429 (insufficient_quota / rate limit). This is a billing/quota setting on the API key/project (or the key is for a different project), not the size of the message.${providerInfo} Please update the Chat API Key/URL/Model in Admin → Settings, or set OPENAI_API_KEY correctly on the server.`
          : "Sorry—something just glitched on my side. Can you send that again?";
        try {
          const aiMessage = await this.addAssistantMessage(data.chatId, fallback);
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('newMessage', aiMessage);
        } catch (err2) {
          this.server.to(data.chatId).emit('typing', { isTyping: false });
          this.server.to(data.chatId).emit('chatError', { message: this.toSafeChatError(err2) });
        }
        return;
      }

      const aiMessage = await this.addAssistantMessage(data.chatId, responseText);
      this.server.to(data.chatId).emit('typing', { isTyping: false });
      this.server.to(data.chatId).emit('newMessage', aiMessage);

      // Notify customer
      const meta = await this.chatService.getChatMeta(data.chatId);
      if (meta && this.chatNotificationsEnabled() && this.shouldNotifyUser(meta.customerId, data.chatId)) {
        const preview = responseText.length > 120 ? responseText.slice(0, 120) + '…' : responseText;
        await this.notificationService.create(meta.customerId, {
          title: `New message from ${name}`,
          description: preview,
          href: `/chat/${meta.influencerId}`,
        });
      }
    } catch (error) {
      console.error('Chat response error:', error);
      this.server.to(data.chatId).emit('typing', { isTyping: false });
      this.server.to(data.chatId).emit('chatError', {
        message: this.toSafeChatError(error),
      });
    }
  }
}
