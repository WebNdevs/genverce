import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import { SettingsService } from '../settings/settings.service';
import sharp from 'sharp';
import { detectProvider } from './ai-providers.config';
import { GeneratePostParams, GeneratedPostResult } from './dto/generate-post.dto';

interface ChatConfig {
  providerId: string;
  providerName: string;
  apiKey: string;
  model: string;
  baseURL: string;
  extraHeaders?: Record<string, string>;
  format: 'openai' | 'anthropic';
}

interface CustomChatInput {
  chatProvider?: string | null;
  chatApiUrl?: string | null;
  chatApiKey?: string | null;
  chatModel?: string | null;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string; imageUrl?: string };

@Injectable()
export class AiService {
  private trimText(input: string, maxChars: number): string {
    const s = String(input ?? '');
    if (s.length <= maxChars) return s;
    return s.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
  }

  private applyInputBudget(
    systemPrompt: string,
    messages: ChatMessage[],
    opts?: {
      maxSystemChars?: number;
      maxMessageChars?: number;
      maxTotalChars?: number;
      maxMessages?: number;
    },
  ): { systemPrompt: string; messages: ChatMessage[] } {
    const maxSystemChars = opts?.maxSystemChars ?? 8000;
    const maxMessageChars = opts?.maxMessageChars ?? 2500;
    const maxTotalChars = opts?.maxTotalChars ?? 24000;
    const maxMessages = opts?.maxMessages ?? 16;

    const sys = this.trimText(systemPrompt, maxSystemChars);
    const msgIn = messages.slice(-maxMessages);
    const msgTrimmed = msgIn.map((m) => ({
      ...m,
      content: this.trimText(m.content ?? '', maxMessageChars),
    }));

    let budget = Math.max(0, maxTotalChars - sys.length);
    const out: ChatMessage[] = [];
    for (let i = msgTrimmed.length - 1; i >= 0; i -= 1) {
      const m = msgTrimmed[i];
      const cLen = (m.content ?? '').length;
      const imgLen = (m.imageUrl ?? '').length;
      const cost = cLen + (imgLen > 0 ? Math.min(600, imgLen) : 0);
      if (out.length > 0 && budget - cost < 0) break;
      if (budget - cost < 0 && out.length === 0) {
        out.push({
          ...m,
          content: this.trimText(m.content ?? '', Math.max(0, budget - (imgLen > 0 ? Math.min(600, imgLen) : 0))),
        });
        break;
      }
      out.push(m);
      budget -= cost;
    }
    out.reverse();
    return { systemPrompt: sys, messages: out };
  }

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {}

  private async getChatConfig(customChat?: CustomChatInput): Promise<ChatConfig> {
    const settings = await this.settingsService.get();

    const rawProvider = (customChat?.chatProvider ?? settings.chatProvider)?.trim() ?? '';
    const rawUrl = (customChat?.chatApiUrl ?? settings.chatApiUrl)?.trim() ?? '';
    const rawModel = (customChat?.chatModel ?? settings.chatModel)?.trim() ?? '';
    const rawKey = (customChat?.chatApiKey ?? settings.chatApiKey)?.trim() ?? '';

    const providerDef = detectProvider(rawProvider, rawUrl, rawModel, {
      anthropicKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
      openaiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });

    let baseURL = providerDef.defaultBaseURL;
    if (providerDef.requiresCustomUrl || (rawUrl && providerDef.id === 'custom')) {
      baseURL = rawUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '') || providerDef.defaultBaseURL;
    } else if (rawUrl && rawUrl !== providerDef.defaultBaseURL && rawUrl.length > 5) {
      baseURL = rawUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
    }

    let apiKey = rawKey;
    if (!apiKey) {
      if (providerDef.id === 'anthropic') {
        apiKey = this.configService.get<string>('ANTHROPIC_API_KEY') || this.configService.get<string>('OPENAI_API_KEY') || '';
      } else {
        apiKey = this.configService.get<string>('OPENAI_API_KEY') || this.configService.get<string>('ANTHROPIC_API_KEY') || '';
      }
    }

    const model = rawModel || providerDef.defaultModel;

    return {
      providerId: providerDef.id,
      providerName: providerDef.name,
      apiKey,
      model,
      baseURL,
      extraHeaders: providerDef.extraHeaders,
      format: providerDef.format,
    };
  }

  async isEnabled(customChat?: CustomChatInput): Promise<boolean> {
    const config = await this.getChatConfig(customChat);
    return !!config.apiKey;
  }

  async getActiveChatProviderInfo(customChat?: CustomChatInput): Promise<{ provider: string; model: string; baseURL: string }> {
    const config = await this.getChatConfig(customChat);
    let base = '';
    if (config.baseURL) {
      try {
        base = new URL(config.baseURL).host;
      } catch {
        base = config.baseURL;
      }
    }
    return { provider: config.providerName, model: config.model, baseURL: base };
  }

  private imageGenerationEnabled(): boolean {
    const raw =
      process.env.DISABLE_IMAGE_GENERATION ??
      process.env.IMAGE_GENERATION_DISABLED ??
      this.configService.get<string>('DISABLE_IMAGE_GENERATION') ??
      this.configService.get<string>('IMAGE_GENERATION_DISABLED');
    if (raw === undefined || raw === null || raw === '') return true;
    return String(raw).toLowerCase() !== 'true';
  }

  private isQuotaOrRateLimitError(err: any): boolean {
    const status =
      Number(err?.status || err?.response?.status || err?.response?.statusCode || err?.response?.data?.status) || 0;
    const msg =
      String(err?.message || '') ||
      String(err?.error?.message || '') ||
      String(err?.response?.data?.error?.message || err?.response?.data?.message || '');
    if (status === 429) return true;
    return /\binsufficient[_\s-]?quota\b/i.test(msg) || /\brate limit\b/i.test(msg) || /\btoo many requests\b/i.test(msg);
  }

  private withOpenAiModel(config: ChatConfig, model: string): ChatConfig {
    return { ...config, model };
  }

  private async callOpenAI(
    config: ChatConfig,
    systemPrompt: string,
    messages: ChatMessage[],
    maxTokens: number,
  ): Promise<string> {
    const budgeted = this.applyInputBudget(systemPrompt, messages);

    // Native Anthropic API handler
    if (config.format === 'anthropic' && config.baseURL.includes('anthropic.com')) {
      try {
        const fetchUrl = `${config.baseURL.replace(/\/$/, '')}/messages`;
        const res = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            ...(config.extraHeaders || {}),
          },
          body: JSON.stringify({
            model: config.model,
            system: budgeted.systemPrompt,
            messages: budgeted.messages.map((m) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content || ' ',
            })),
            max_tokens: maxTokens,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Anthropic API error (${res.status}): ${errText}`);
        }

        const data: any = await res.json();
        const responseText = data?.content?.[0]?.text;
        if (typeof responseText === 'string') return responseText;
        throw new Error('Invalid Anthropic API response format');
      } catch (err) {
        console.error('[AI Service] Anthropic native call error:', err);
        throw err;
      }
    }

    // OpenAI SDK for OpenAI, Gemini, Grok, DeepSeek, OpenRouter, Custom
    const client = new OpenAI({
      apiKey: config.apiKey || 'dummy-key',
      baseURL: config.baseURL || undefined,
      defaultHeaders: config.extraHeaders,
    });

    const toDataUrlIfLocal = async (url: string) => {
      const normalized = url.trim();
      const idx = normalized.indexOf('/uploads/');
      const isLocal = idx >= 0;

      if (!isLocal) return { url: normalized, mediaType: '' };

      const filename = normalized.slice(idx + '/uploads/'.length).split('?')[0].split('#')[0];
      const filePath = join(process.cwd(), 'uploads', filename);

      try {
        const buf = readFileSync(filePath);
        const resized = await sharp(buf)
          .rotate()
          .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 72, mozjpeg: true })
          .toBuffer();
        const b64 = resized.toString('base64');
        return { url: `data:image/jpeg;base64,${b64}`, mediaType: 'image/jpeg' };
      } catch (err) {
        console.error(`[AI Service] Failed to read local file ${filePath}:`, err);
        return { url: normalized, mediaType: '' };
      }
    };

    try {
      const openAiMessages = await Promise.all(
        budgeted.messages.map(async (m) => {
          if (!m.imageUrl || m.role !== 'user') {
            const content = m.content?.trim()
              ? m.imageUrl && m.role === 'assistant'
                ? `${m.content}\n[Image generated: ${m.imageUrl}]`
                : m.content
              : m.imageUrl && m.role === 'assistant'
                ? `[Image generated: ${m.imageUrl}]`
                : '';
            return { role: m.role, content: content || ' ' };
          }
          const img = await toDataUrlIfLocal(m.imageUrl);
          const parts: any[] = [];
          if (m.content?.trim()) {
            parts.push({ type: 'text', text: m.content });
          } else {
            parts.push({ type: 'text', text: 'Attached image' });
          }
          parts.push({ type: 'image_url', image_url: { url: img.url } });
          return { role: m.role, content: parts };
        }),
      );
      const isReasoning = /^o\d/i.test(config.model || '');
      const basePayload: any = {
        model: config.model,
        messages: [
          { role: 'system', content: budgeted.systemPrompt },
          ...openAiMessages,
        ],
      };

      let response: any;
      try {
        response = await client.chat.completions.create({
          ...basePayload,
          ...(isReasoning ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
        });
      } catch (err: any) {
        const errMsg = String(err?.message || err || '');
        if (
          errMsg.includes('max_completion_tokens') ||
          errMsg.includes('max_tokens') ||
          errMsg.includes('unrecognized request argument') ||
          errMsg.includes('extra fields not permitted')
        ) {
          response = await client.chat.completions.create({
            ...basePayload,
            ...(isReasoning ? { max_tokens: maxTokens } : { max_completion_tokens: maxTokens }),
          });
        } else {
          throw err;
        }
      }

      return response.choices[0]?.message?.content ?? 'I apologize, I could not generate a response.';
    } catch (error) {
      console.error('[AI Service] OpenAI error:', error);
      throw error;
    }
  }

  async generateResponse(
    systemPrompt: string,
    messages: ChatMessage[],
    maxTokens = 512,
    customChat?: CustomChatInput,
  ): Promise<string> {
    const config = await this.getChatConfig(customChat);
    try {
      return await this.callOpenAI(config, systemPrompt, messages, maxTokens);
    } catch (err: any) {
      if (!this.isQuotaOrRateLimitError(err)) throw err;

      const mini = this.withOpenAiModel(config, 'gpt-4o-mini');
      if (mini.model !== config.model) {
        try {
          return await this.callOpenAI(mini, systemPrompt, messages, Math.min(300, maxTokens));
        } catch {}
      }
      throw err;
    }
  }

  async isTopicRelevant(
    influencerSystemPrompt: string,
    topic: string | null,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    customChat?: CustomChatInput,
  ): Promise<boolean> {
    const text = (message ?? '').trim().toLowerCase().replace(/[^\w\s]/g, '');
    const greetingPattern = /^(hi|hey+|hello|hola|howdy|greetings|good morning|good afternoon|good evening|whats up|sup|yo|hi there|hello there|how are you)\b/i;
    if (text.length <= 30 && greetingPattern.test(text)) {
      return true;
    }

    const config = await this.getChatConfig(customChat);
    const topicLine = topic
      ? `DEFINED TOPIC/SCOPE: "${topic}"\nThe assistant is ONLY permitted to answer questions within this topic.`
      : 'Analyze if the user question is appropriate for a brand ambassador or marketing assistant.';

    const system =
      `You are a topic-relevance classifier for an AI Influencer.\n` +
      `${topicLine}\n\n` +
      `INFLUENCER PERSONALITY:\n${influencerSystemPrompt.slice(0, 1500)}\n\n` +
      `Task: Decide if the user's latest message is on-topic and appropriate for this influencer.\n` +
      `Greetings, pleasantries, follow-ups, and questions referring to prior chat context are ALWAYS relevant.\n` +
      `Reply with ONLY "YES" if it is relevant/appropriate, or "NO" if it is completely off-topic or inappropriate.`;

    const recentHistory = history.slice(-4).map((h) => ({
      role: h.role,
      content: h.content,
    }));

    try {
      const response = await this.callOpenAI(
        config,
        system,
        [...recentHistory, { role: 'user', content: message }],
        10,
      );
      const clean = response.trim().toUpperCase();
      return clean.startsWith('YES') || clean.includes('YES');
    } catch (err) {
      console.error('[AI Service] Topic relevance check error:', err);
      return true; // Fallback to relevant on error
    }
  }

  /**
   * Intelligently analyzes recent conversation messages and extracts high-value,
   * reusable client and project memories without requiring explicit save commands.
   */
  async extractConversationMemory(params: {
    recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
    existingMemory?: { details?: any; facts?: any[] };
    customChat?: CustomChatInput;
  }): Promise<any | null> {
    const { recentMessages, existingMemory, customChat } = params;
    if (!recentMessages || recentMessages.length === 0) return null;

    const config = await this.getChatConfig(customChat);
    if (!config.apiKey) return null;

    const existingDetailsSummary = existingMemory?.details
      ? JSON.stringify(existingMemory.details, null, 2).slice(0, 2000)
      : '{}';

    const system =
      `You are an expert conversation memory extraction agent for an AI Influencer Platform.\n` +
      `Your goal is to automatically identify and extract high-value client and project information that should be remembered for future conversations.\n` +
      `The client will NEVER explicitly say "remember this". You must use your own judgment to extract genuinely important, reusable facts.\n\n` +
      `CURRENT STORED MEMORY:\n${existingDetailsSummary}\n\n` +
      `CRITERIA FOR WHAT TO EXTRACT:\n` +
      `1. Brand & Profile: Brand name, product name, website, client name, email, target audience, industry, mission.\n` +
      `2. Project Requirements & Specs: Deliverable count, formats (e.g. 9:16 vertical, 16:9), video length, deadlines, budgets, target platforms (Instagram, TikTok, YouTube).\n` +
      `3. Preferences & Guidelines: Tone of voice, aesthetic style, recurring instructions, strict DOs and DONTs (e.g. "never use emojis", "always mention 20% discount").\n` +
      `4. Decisions & Approvals: Approved concepts/scripts, rejected ideas/approaches, selected package/pricing, final decisions.\n` +
      `5. Technical Context: Tools, integrations, tech stack, links/assets, platforms (e.g. Shopify, Next.js, Figma).\n` +
      `6. Tasks & Milestones: Pending action items (e.g. "waiting for client logo"), completed deliverables, next steps.\n` +
      `7. Feedback & Corrections: Specific client critique, revision rules, adjustments made.\n\n` +
      `DO NOT EXTRACT:\n` +
      `- Temporary chit-chat, greetings ("hi", "hello"), acknowledgments ("ok", "thanks"), transient debugging, or trivial single-use details.\n` +
      `- Do not duplicate existing memory if unchanged. If the user updated or corrected previous info (e.g. changed deadline or brand tone), provide the UPDATED value.\n\n` +
      `OUTPUT FORMAT:\n` +
      `Return ONLY a raw JSON object (no markdown fence, no other text) with any of these optional keys that apply:\n` +
      `{\n` +
      `  "brandAndProfile": { "brandName": "", "productName": "", "website": "", "clientName": "", "clientEmail": "", "targetAudience": "", "tone": "", "industry": "" },\n` +
      `  "requirements": [{ "key": "e.g. Video Length", "value": "30 seconds" }],\n` +
      `  "preferences": [{ "key": "e.g. Emoji Policy", "value": "Do not use emojis", "type": "constraint" }],\n` +
      `  "decisions": [{ "key": "e.g. Script Hook", "value": "Selected Hook B (split screen)", "status": "approved" }],\n` +
      `  "technicalContext": [{ "key": "e.g. E-commerce Platform", "value": "Shopify" }],\n` +
      `  "tasks": [{ "task": "e.g. Send brand logo PNG", "status": "pending" }],\n` +
      `  "feedback": [{ "feedback": "Make CTA more urgent", "adjustment": "Added countdown mention" }],\n` +
      `  "notes": ["Important persistent note"]\n` +
      `}\n` +
      `If there is no new or updated meaningful information to store, return an empty object {}.`;

    try {
      const msgs: ChatMessage[] = recentMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content || '',
      }));

      const raw = await this.callOpenAI(config, system, msgs, 600);
      const clean = (raw ?? '').trim();
      if (!clean || clean === '{}') return null;

      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  async generateImage(
    customApiUrl: string,
    customApiKey: string,
    customModel: string,
    prompt: string,
  ): Promise<string> {
    if (!this.imageGenerationEnabled()) {
      throw new Error('Image generation is temporarily disabled by configuration');
    }

    let apiUrl = (customApiUrl || '').trim();
    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
    if (apiUrl && !/\/images\/generations$/i.test(apiUrl)) {
      apiUrl = `${apiUrl}/images/generations`;
    }

    const apiKey = (customApiKey || '').trim();
    const model = (customModel || '').trim() || 'gpt-image-1';

    if (apiUrl && apiKey) {
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            prompt,
            n: 1,
            size: '1024x1024',
          }),
        });

        if (res.ok) {
          const data: any = await res.json();
          // Check for direct URL
          const url = data?.data?.[0]?.url || data?.url;
          if (url && typeof url === 'string') return url;

          // Check for base64
          const b64 = data?.data?.[0]?.b64_json || data?.b64_json || data?.data?.[0]?.base64;
          if (b64 && typeof b64 === 'string') {
            const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
            const uploadDir = join(process.cwd(), 'uploads');
            if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
            const filePath = join(uploadDir, filename);
            writeFileSync(filePath, Buffer.from(b64, 'base64'));
            const serverUrl = process.env.API_URL || 'http://localhost:4000';
            return `${serverUrl}/uploads/${filename}`;
          }
        } else {
          const errText = await res.text();
          console.warn(`[AI Service] Custom image API warning (${res.status}): ${errText}`);
        }
      } catch (err: any) {
        console.warn('[AI Service] Primary image generation attempt failed, falling back:', err.message);
      }
    }

    // Reliable fallback visual generator via Pollinations
    try {
      const cleanPrompt = prompt.slice(0, 300).replace(/[^a-zA-Z0-9\s,.-]/g, ' ').trim();
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt || 'cinematic digital art')}?width=1024&height=1024&nologo=true&seed=${Date.now() % 10000}`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const arrayBuf = await fallbackRes.arrayBuffer();
        const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        const uploadDir = join(process.cwd(), 'uploads');
        if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
        const filePath = join(uploadDir, filename);
        writeFileSync(filePath, Buffer.from(arrayBuf));
        const serverUrl = process.env.API_URL || 'http://localhost:4000';
        return `${serverUrl}/uploads/${filename}`;
      }
    } catch (fallbackErr) {
      console.error('[AI Service] Fallback image generation error:', fallbackErr);
    }

    throw new Error('Image generation could not produce a visual at this time.');
  }

  async generateVideoScript(
    influencerName: string,
    brief: {
      productName: string;
      keyMessage: string;
      targetAudience: string;
      tone: string;
      inclusions: string[];
      additionalNotes: string;
    },
    customChat?: CustomChatInput,
  ): Promise<string> {
    const config = await this.getChatConfig(customChat);

    const system =
      `You are ${influencerName}, a professional content creator.\n` +
      `Write a engaging, high-converting video script based on the client's brief.\n` +
      `Include timestamps, visual cues in [brackets], and exact voiceover lines.`;

    const userPrompt =
      `PRODUCT: ${brief.productName}\n` +
      `KEY MESSAGE: ${brief.keyMessage}\n` +
      `TARGET AUDIENCE: ${brief.targetAudience}\n` +
      `TONE: ${brief.tone}\n` +
      `MUST INCLUDE: ${brief.inclusions.join(', ')}\n` +
      `NOTES: ${brief.additionalNotes}`;

    return this.callOpenAI(
      config,
      system,
      [{ role: 'user', content: userPrompt }],
      800,
    );
  }

  private async getPostConfig(customPost?: {
    postApiUrl?: string | null;
    postApiKey?: string | null;
    postModel?: string | null;
    chatApiUrl?: string | null;
    chatApiKey?: string | null;
    chatModel?: string | null;
    chatProvider?: string | null;
  }): Promise<ChatConfig> {
    const rawPostUrl = customPost?.postApiUrl?.trim();
    const rawPostKey = customPost?.postApiKey?.trim();
    const rawPostModel = customPost?.postModel?.trim();

    if (rawPostUrl || rawPostKey || rawPostModel) {
      const providerDef = detectProvider(customPost?.chatProvider, rawPostUrl, rawPostModel, {
        anthropicKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
        openaiKey: this.configService.get<string>('OPENAI_API_KEY'),
      });

      let baseURL = providerDef.defaultBaseURL;
      if (providerDef.requiresCustomUrl || (rawPostUrl && providerDef.id === 'custom')) {
        baseURL = (rawPostUrl || '').replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '') || providerDef.defaultBaseURL;
      } else if (rawPostUrl && rawPostUrl !== providerDef.defaultBaseURL && rawPostUrl.length > 5) {
        baseURL = rawPostUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
      }

      let apiKey = rawPostKey || '';
      if (!apiKey) {
        if (providerDef.id === 'anthropic') {
          apiKey = this.configService.get<string>('ANTHROPIC_API_KEY') || this.configService.get<string>('OPENAI_API_KEY') || '';
        } else {
          apiKey = this.configService.get<string>('OPENAI_API_KEY') || this.configService.get<string>('ANTHROPIC_API_KEY') || '';
        }
      }

      const model = rawPostModel || providerDef.defaultModel;

      return {
        providerId: providerDef.id,
        providerName: providerDef.name,
        apiKey,
        model,
        baseURL,
        extraHeaders: providerDef.extraHeaders,
        format: providerDef.format,
      };
    }

    return this.getChatConfig({
      chatProvider: customPost?.chatProvider,
      chatApiUrl: customPost?.chatApiUrl,
      chatApiKey: customPost?.chatApiKey,
      chatModel: customPost?.chatModel,
    });
  }

  async generatePost(params: GeneratePostParams): Promise<GeneratedPostResult> {
    const { influencer, aiConfig, input } = params;
    const influencerName = influencer?.name?.trim() || 'AI Influencer';
    const personaPrompt = influencer?.systemPrompt?.trim() || '';
    const contentStyle = influencer?.contentStyle?.trim() || 'Professional & Engaging';
    const industries = Array.isArray(influencer?.industries)
      ? influencer.industries.filter(Boolean).join(', ')
      : typeof influencer?.industries === 'string'
        ? influencer.industries
        : '';
    const platforms = input.platforms && input.platforms.length > 0 ? input.platforms : ['Instagram', 'LinkedIn'];
    const tone = input.tone?.trim() || influencer?.tone?.trim() || 'Engaging & Authentic';

    const config = await this.getPostConfig(aiConfig || undefined);

    const systemPrompt =
      `You are ${influencerName}, a premier AI content creator on Genverce.\n` +
      (personaPrompt ? `YOUR IDENTITY & PERSONALITY:\n${personaPrompt}\n\n` : '') +
      `CONTENT STYLE: ${contentStyle}\n` +
      `SPECIALIZED INDUSTRIES: ${industries || 'General Marketing'}\n\n` +
      `TASK: Execute the Post Creation workflow to craft a complete, high-converting post asset package.\n` +
      `TARGET PLATFORMS: ${platforms.join(', ')}\n\n` +
      `You MUST respond ONLY with a raw JSON object matching this exact schema (no markdown fences, no explanatory text):\n` +
      `{\n` +
      `  "title": "A captivating, high-impact headline/title (5-12 words)",\n` +
      `  "caption": "A fully polished, social-ready caption with hook, value body, clear line breaks, tasteful emojis, and strong call-to-action",\n` +
      `  "content": "The full post content formatted and structured for the target platform(s)",\n` +
      `  "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5", "#Tag6", "#Tag7", "#Tag8"],\n` +
      `  "imagePrompt": "A highly detailed, professional visual generation prompt to create a stunning, cinematic marketing image matching the post theme (photorealistic, 8k, modern aesthetic, clean composition, lighting and color palette details)"\n` +
      `}`;

    const userPromptLines: string[] = [
      `TOPIC: ${input.topic}`,
      input.postType ? `POST TYPE: ${input.postType}` : '',
      input.brandName ? `BRAND NAME: ${input.brandName}` : '',
      input.productName ? `PRODUCT / SERVICE: ${input.productName}` : '',
      input.website ? `WEBSITE: ${input.website}` : '',
      input.targetAudience ? `TARGET AUDIENCE: ${input.targetAudience}` : '',
      tone ? `TONE / VOICE: ${tone}` : '',
      input.callToAction ? `CALL TO ACTION: ${input.callToAction}` : '',
      input.keywords && input.keywords.length > 0 ? `KEYWORDS: ${input.keywords.join(', ')}` : '',
      input.inclusions && input.inclusions.length > 0 ? `MUST INCLUDE: ${input.inclusions.join(', ')}` : '',
      input.visualStyle ? `VISUAL PREFERENCES: ${input.visualStyle}` : '',
      `PLATFORMS: ${platforms.join(', ')}`,
    ].filter(Boolean);

    let rawText = '';
    try {
      rawText = await this.callOpenAI(
        config,
        systemPrompt,
        [{ role: 'user', content: userPromptLines.join('\n') }],
        1400,
      );
    } catch (err) {
      console.error('[AI Service] Post text generation error:', err);
      // If quota/rate limit error, try mini model fallback
      const mini = this.withOpenAiModel(config, 'gpt-4o-mini');
      if (mini.model !== config.model) {
        rawText = await this.callOpenAI(
          mini,
          systemPrompt,
          [{ role: 'user', content: userPromptLines.join('\n') }],
          1000,
        );
      } else {
        throw err;
      }
    }

    // Parse JSON output
    let parsed: {
      title?: string;
      caption?: string;
      content?: string;
      hashtags?: string[];
      imagePrompt?: string;
    } = {};

    try {
      const cleanJson = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      // Robust regex extraction fallback if LLM included conversational wrapper
      const titleMatch = rawText.match(/"title"\s*:\s*"([^"]+)"/i) || rawText.match(/^#+\s*(.+)$/m);
      const captionMatch = rawText.match(/"caption"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      const contentMatch = rawText.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      const promptMatch = rawText.match(/"imagePrompt"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      const tagsMatch = rawText.match(/#[a-zA-Z0-9_]+/g);

      parsed = {
        title: titleMatch?.[1] || `${input.topic} — by ${influencerName}`,
        caption: captionMatch ? captionMatch[1].replace(/\\n/g, '\n') : rawText,
        content: contentMatch ? contentMatch[1].replace(/\\n/g, '\n') : rawText,
        hashtags: tagsMatch ? Array.from(new Set(tagsMatch)) : ['#AIInfluencer', '#Marketing', '#Genverce'],
        imagePrompt: promptMatch ? promptMatch[1] : `Professional, high-quality promotional photo for ${input.topic}, vibrant cinematic lighting, modern minimalist design.`,
      };
    }

    const title = parsed.title?.trim() || `${input.topic}`;
    const caption = parsed.caption?.trim() || parsed.content?.trim() || rawText;
    const content = parsed.content?.trim() || parsed.caption?.trim() || rawText;
    const hashtags = Array.isArray(parsed.hashtags) && parsed.hashtags.length > 0
      ? parsed.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).filter(Boolean)
      : ['#AI', '#Marketing', '#Genverce'];
    const imagePrompt = parsed.imagePrompt?.trim() ||
      `Clean, hyperrealistic visual for ${input.topic}, modern cinematic lighting, 8k resolution, award-winning photography`;

    // Execute Visual Generation if enabled and configured
    let imageUrl: string | null = null;
    const shouldGenerateVisual = input.generateVisual !== false;
    const imgApiUrl = aiConfig?.imageApiUrl?.trim();
    const imgApiKey = aiConfig?.imageApiKey?.trim();
    const imgModel = aiConfig?.imageModel?.trim();

    if (shouldGenerateVisual && imgApiUrl && imgApiKey && imgModel && this.imageGenerationEnabled()) {
      try {
        imageUrl = await this.generateImage(imgApiUrl, imgApiKey, imgModel, imagePrompt);
      } catch (imgErr) {
        console.error('[AI Service] Post visual generation failed, continuing with post copy:', imgErr);
        imageUrl = null;
      }
    }

    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      id: postId,
      title,
      caption,
      content,
      hashtags,
      imageUrl,
      imagePrompt,
      platforms,
      topic: input.topic,
      tone,
      callToAction: input.callToAction?.trim() || undefined,
      createdAt: new Date().toISOString(),
      metadata: {
        influencerId: influencer?.id,
        influencerName,
        postType: input.postType || 'social_post',
        brandName: input.brandName,
        productName: input.productName,
        website: input.website,
        generatedWithVisual: !!imageUrl,
      },
    };
  }
}

