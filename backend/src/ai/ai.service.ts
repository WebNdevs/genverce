import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { SettingsService } from '../settings/settings.service';
import sharp from 'sharp';

interface ChatConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
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

  private async getChatConfig(customChat?: { chatApiUrl?: string | null; chatApiKey?: string | null; chatModel?: string | null }): Promise<ChatConfig> {
    const settings = await this.settingsService.get();

    // Normalise the stored URL — strip trailing slashes and path suffixes
    // so both "https://api.openai.com/v1" and
    // "https://api.openai.com/v1/chat/completions" resolve to a usable base.
    const rawUrl = (customChat?.chatApiUrl ?? settings.chatApiUrl)?.trim() ?? '';
    const parsedBaseURL = rawUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '') || '';
    const baseURL = /anthropic|claude|haiku/i.test(parsedBaseURL) ? undefined : parsedBaseURL || undefined;

    const apiKey = (customChat?.chatApiKey ?? settings.chatApiKey ?? '').trim() || this.configService.get<string>('OPENAI_API_KEY') || '';

    const rawModel = (customChat?.chatModel ?? settings.chatModel ?? '').trim();
    const model =
      rawModel && !/anthropic|claude|haiku/i.test(rawModel) ? rawModel : 'gpt-4o-mini';

    return { apiKey, model, baseURL };
  }

  async isEnabled(customChat?: { chatApiUrl?: string | null; chatApiKey?: string | null; chatModel?: string | null }): Promise<boolean> {
    const config = await this.getChatConfig(customChat);
    return !!config.apiKey;
  }

  async getActiveChatProviderInfo(customChat?: { chatApiUrl?: string | null; chatApiKey?: string | null; chatModel?: string | null }): Promise<{ provider: 'openai'; model: string; baseURL: string }> {
    const config = await this.getChatConfig(customChat);
    let base = '';
    if (config.baseURL) {
      try {
        base = new URL(config.baseURL).host;
      } catch {
        base = config.baseURL;
      }
    }
    return { provider: 'openai', model: config.model, baseURL: base };
  }

  private imageGenerationEnabled(): boolean {
    const raw =
      this.configService.get<string>('DISABLE_IMAGE_GENERATION') ??
      this.configService.get<string>('IMAGE_GENERATION_DISABLED') ??
      'true';
    return String(raw).toLowerCase() !== 'true';
  }

  private isBillingHardLimitError(err: any): boolean {
    const msg =
      String(err?.message || '') ||
      String(err?.error?.message || '') ||
      String(err?.response?.data?.error?.message || '');
    return /billing hard limit/i.test(msg) || /\binsufficient[_\s-]?quota\b/i.test(msg);
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
    const client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });

    const toDataUrlIfLocal = async (url: string) => {
      const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:4000';
      const normalized = url.trim();
      const idx = normalized.indexOf('/uploads/');
      const isLocal = idx >= 0; // Just check if it contains /uploads/ for now
      
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
        return { url: normalized, mediaType: '' }; // fallback
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
      const response = await client.chat.completions.create({
        model: config.model,
        max_completion_tokens: maxTokens,
        messages: [
          { role: 'system', content: budgeted.systemPrompt },
          ...openAiMessages,
        ],
      });
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
    customChat?: { chatApiUrl?: string | null; chatApiKey?: string | null; chatModel?: string | null },
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
    customChat?: { chatApiUrl?: string | null; chatApiKey?: string | null; chatModel?: string | null },
  ): Promise<boolean> {
    const config = await this.getChatConfig(customChat);
    const topicLine = topic
      ? `Their dedicated topic is: "${topic}".`
      : 'Their area of expertise is defined entirely by their profile above.';

    // Include recent conversation turns so the classifier can resolve references
    // like "remember what you said about X?" or "going back to what we discussed"
    const priorTurns = history.slice(-4); // last 2 exchanges
    const historyBlock =
      priorTurns.length > 0
        ? '\n\nRecent conversation:\n' +
          priorTurns
            .map((m) => `${m.role === 'user' ? 'User' : 'Influencer'}: ${this.trimText(m.content ?? '', 400)}`)
            .join('\n')
        : '';

    const classifierSystem =
      'You are a relevance classifier for an AI influencer. Answer ONLY "yes" or "no". ' +
      '"yes" = the message is on-topic for this influencer, is a greeting/small talk, ' +
      'or is a follow-up / reference to something already discussed in the conversation. ' +
      '"no" = the message is completely unrelated to their expertise AND unrelated to the conversation so far.';

    const userMessage =
      `Influencer profile:\n${this.trimText(influencerSystemPrompt ?? '', 1500)}\n\n${topicLine}${historyBlock}\n\n` +
      `Latest user message: "${this.trimText(message ?? '', 600)}"\n\n` +
      `Is this message relevant to the influencer's area of expertise, a greeting/small talk, ` +
      `or a follow-up to the conversation above?`;

    const text = await this.callOpenAI(config, classifierSystem, [{ role: 'user', content: userMessage }], 10);
    return text.trim().toLowerCase().startsWith('y');
  }

  async generateImage(
    imageApiUrl: string,
    imageApiKey: string,
    imageModel: string,
    prompt: string,
  ): Promise<string> {
    if (!this.imageGenerationEnabled()) {
      throw new Error('Image generation is temporarily disabled.');
    }
    const baseURL = imageApiUrl
      .replace(/\/images\/generations\/?$/, '')
      .replace(/\/$/, '');

    const client = new OpenAI({ apiKey: imageApiKey, baseURL });
    const extractTargetSize = (p: string) => {
      const m1 = p.match(/asset\/platform\/size:\s*.*?(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
      if (m1) return { w: Number(m1[1]), h: Number(m1[2]) };
      const m2 = p.match(/\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/);
      if (m2) return { w: Number(m2[1]), h: Number(m2[2]) };
      return null;
    };

    let target = extractTargetSize(prompt);
    if (!target) {
      const lower = (prompt ?? '').toLowerCase();
      if (/\bwebsite\s+slider\b/.test(lower) || /\bhero\s+banner\b/.test(lower) || /\bwebsite\s+banner\b/.test(lower) || /\bbanner\b/.test(lower)) {
        target = { w: 1920, h: 600 };
      }
    }
    const requestedSize = target ? `${target.w}x${target.h}` : '';
    const targetRatio = target ? target.w / target.h : 0;

    const isBannerPrompt = (() => {
      const lower = (prompt ?? '').toLowerCase();
      return /\bwebsite\s+slider\b/.test(lower) || /\bhero\s+banner\b/.test(lower) || /\bwebsite\s+banner\b/.test(lower) || /\bbanner\b/.test(lower);
    })();

    const composedPrompt =
      target && (isBannerPrompt || targetRatio >= 2.2)
        ? `${prompt}\n\nCANVAS:\n- Exact output size: ${target.w}x${target.h} (wide horizontal banner)\n- Design must be composed for this wide layout; do not place a square/portrait design centered on the canvas.\n- Keep all text and logos inside safe margins; no cropped letters.\n`
        : prompt;

    const supportedSizesForModel = (model: string): string[] => {
      const m = (model || '').toLowerCase();
      if (m.includes('gpt-image-1')) return ['1536x1024', '1024x1024', '1024x1536'];
      if (m.includes('dall-e-3') || m.includes('dalle-3')) return ['1792x1024', '1024x1024', '1024x1792'];
      if (m.includes('dall-e-2') || m.includes('dalle-2')) return ['1024x1024'];
      return ['1792x1024', '1024x1024', '1024x1792'];
    };

    const pickSupportedSize = (model: string, w: number, h: number) => {
      const ratio = w / h;
      const sizes = supportedSizesForModel(model);

      const bestByRatio = (candidates: string[]) => {
        let best = candidates[0] || '';
        let bestDelta = Number.POSITIVE_INFINITY;
        for (const s of candidates) {
          const mm = s.match(/^(\d+)\s*x\s*(\d+)$/);
          if (!mm) continue;
          const sw = Number(mm[1]);
          const sh = Number(mm[2]);
          const d = Math.abs(sw / sh - ratio);
          if (d < bestDelta) {
            bestDelta = d;
            best = s;
          }
        }
        return best;
      };

      return bestByRatio(sizes);
    };

    const buildReq = (size?: string) => ({
      model: imageModel,
      prompt: composedPrompt,
      n: 1,
      ...(imageModel !== 'gpt-image-1' ? { response_format: 'url' } : {}),
      ...(size ? { size } : {}),
    });

    let response: any;
    const isOpenAIBase = baseURL.includes('openai.com');
    const supported = supportedSizesForModel(imageModel);
    const sizeToRequest =
      target && requestedSize
        ? isOpenAIBase
          ? supported.includes(requestedSize)
            ? requestedSize
            : pickSupportedSize(imageModel, target.w, target.h)
          : requestedSize
        : undefined;

    try {
      response = await (client.images.generate as any)(buildReq(sizeToRequest));
    } catch (error: any) {
      if (!target) throw error;
      if (this.isBillingHardLimitError(error)) throw error;
      console.error(`[AI Service] First generation attempt with size ${sizeToRequest} failed:`, error.message);
      try {
        if (isOpenAIBase) {
          const fallbackSize = pickSupportedSize(imageModel, target.w, target.h) || '1024x1024';
          response = await (client.images.generate as any)(buildReq(fallbackSize));
        } else {
          response = await (client.images.generate as any)(buildReq(undefined));
        }
      } catch (e2: any) {
        console.error(`[AI Service] Second generation attempt failed:`, e2.message);
        if (this.isBillingHardLimitError(e2)) throw e2;
        response = await (client.images.generate as any)(buildReq('1024x1024'));
      }
    }

    const item = response.data?.[0];
    if (!item) throw new Error('No image returned from API');

    const uploadsDir = join(process.cwd(), 'uploads');
    mkdirSync(uploadsDir, { recursive: true });
    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:4000';

    const resolveUrl = (u: string) => {
      const raw = String(u || '').trim();
      if (!raw) return '';
      if (raw.startsWith('data:')) return raw;
      if (/^https?:\/\//i.test(raw)) return raw;
      try {
        return new URL(raw, baseURL).toString();
      } catch {
        return raw;
      }
    };

    const extFromMime = (mime: string) => {
      const m = (mime || '').toLowerCase();
      if (m.includes('image/jpeg')) return '.jpg';
      if (m.includes('image/jpg')) return '.jpg';
      if (m.includes('image/webp')) return '.webp';
      if (m.includes('image/gif')) return '.gif';
      if (m.includes('image/png')) return '.png';
      return '.png';
    };

    const ensureTargetDimensions = async (buf: Buffer) => {
      if (!target || !target.w || !target.h) return { buf, ext: '' };
      try {
        const meta = await sharp(buf).metadata();
        if (meta.width === target.w && meta.height === target.h) return { buf, ext: '' };

        const background = await sharp(buf)
          .resize(target.w, target.h, { fit: 'cover' })
          .blur(18)
          .toBuffer();

        const foreground = await sharp(buf)
          .resize(target.w, target.h, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .toBuffer();

        const out = await sharp(background)
          .composite([{ input: foreground, gravity: 'center' }])
          .png()
          .toBuffer();

        return { buf: out, ext: '.png' };
      } catch (e) {
        try {
          const out = await sharp(buf)
            .resize(target.w, target.h, { fit: 'fill' })
            .png()
            .toBuffer();
          return { buf: out, ext: '.png' };
        } catch (e2) {
          console.error('[AI Service] Failed to enforce target dimensions:', e2);
          return { buf, ext: '' };
        }
      }
    };

    const saveBuffer = (buf: Buffer, ext: string) => {
      const safeExt = ext?.startsWith('.') ? ext : '.png';
      const filename = `${uuidv4()}${safeExt}`;
      writeFileSync(join(uploadsDir, filename), buf);
      return `${apiUrl}/uploads/${filename}`;
    };

    if (item.url) {
      const resolved = resolveUrl(String(item.url));
      if (resolved.startsWith('data:')) {
        const m = resolved.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) throw new Error('Invalid data URL from image API');
        const mime = m[1] || 'image/png';
        const b64 = m[2] || '';
        const raw = Buffer.from(b64, 'base64');
        const shaped = await ensureTargetDimensions(raw);
        const ext = shaped.ext || extFromMime(mime);
        return saveBuffer(shaped.buf, ext);
      }

      const download = async (u: string) => {
        const hasFetch = typeof (globalThis as any).fetch === 'function';
        if (hasFetch) {
          const res = await fetch(u, { redirect: 'follow' as any });
          if (!res.ok) throw new Error(`Failed to download generated image (${res.status})`);
          const ct = res.headers.get('content-type') || '';
          const buf = Buffer.from(await res.arrayBuffer());
          return { ct, buf };
        }

        const downloadOnce = async (urlStr: string, redirectsLeft: number): Promise<{ ct: string; buf: Buffer }> => {
          const { request } = await import(urlStr.startsWith('https://') ? 'https' : 'http');
          return new Promise((resolve, reject) => {
            const req = request(urlStr, (resp: any) => {
              const status = Number(resp.statusCode || 0);
              const loc = String(resp.headers?.location || '');
              if (status >= 300 && status < 400 && loc && redirectsLeft > 0) {
                resp.resume();
                const nextUrl = (() => {
                  try {
                    return new URL(loc, urlStr).toString();
                  } catch {
                    return loc;
                  }
                })();
                downloadOnce(nextUrl, redirectsLeft - 1).then(resolve).catch(reject);
                return;
              }
              if (status && status >= 400) {
                resp.resume();
                reject(new Error(`Failed to download generated image (${status})`));
                return;
              }
              const ct = String(resp.headers?.['content-type'] || '');
              const chunks: Buffer[] = [];
              resp.on('data', (c: Buffer) => chunks.push(c));
              resp.on('end', () => resolve({ ct, buf: Buffer.concat(chunks) }));
            });
            req.on('error', reject);
            req.end();
          });
        };

        return downloadOnce(u, 3);
      };

      const { ct, buf } = await download(resolved);

      let ext = '';
      try {
        const parsed = new URL(resolved);
        ext = extname(parsed.pathname);
      } catch {}
      if (!ext) ext = extFromMime(ct);

      const shaped = await ensureTargetDimensions(buf);
      return saveBuffer(shaped.buf, shaped.ext || ext);
    }

    // gpt-image-1 returns b64_json — save to disk and return a /uploads/ URL
    if (item.b64_json) {
      const raw = Buffer.from(item.b64_json, 'base64');
      const shaped = await ensureTargetDimensions(raw);
      return saveBuffer(shaped.buf, shaped.ext || '.png');
    }

    throw new Error('Unrecognised image response format');
  }

  async generateVideoScript(
    influencerName: string,
    projectBrief: {
      productName: string;
      keyMessage: string;
      targetAudience: string;
      tone: string;
      inclusions: string[];
      additionalNotes?: string;
    },
  ): Promise<string> {
    const prompt = `You are ${influencerName}, an AI influencer creating a 60-second marketing video script.

Product: ${projectBrief.productName}
Key Message: ${projectBrief.keyMessage}
Target Audience: ${projectBrief.targetAudience}
Tone: ${projectBrief.tone}
Must Include: ${projectBrief.inclusions.join(', ')}
${projectBrief.additionalNotes ? `Additional Notes: ${projectBrief.additionalNotes}` : ''}

Write a compelling 60-second video script that feels natural and engaging. Include visual direction cues in brackets.`;
    return this.generateResponse('', [{ role: 'user', content: prompt }], 700);
  }
}
