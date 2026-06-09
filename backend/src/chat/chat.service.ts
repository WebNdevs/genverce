import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  private chatMetaCache = new Map<string, { customerId: string; influencerId: string }>();
  private workflowCache = new Map<string, any>();

  private async getChatMetaCached(chatId: string) {
    const cached = this.chatMetaCache.get(chatId);
    if (cached) return cached;
    try {
      const meta = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: { customerId: true, influencerId: true },
      });
      if (!meta) return null;
      this.chatMetaCache.set(chatId, meta);
      return meta;
    } catch {
      return null;
    }
  }

  private cleanValue(v: string) {
    return v.replace(/\s+/g, ' ').trim();
  }

  private extractKeyDetails(text: string) {
    const t = (text ?? '').trim();
    if (!t) return {};

    const out: Record<string, string> = {};

    const emailMatch = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) out.clientEmail = emailMatch[0];

    const urlMatch = t.match(/https?:\/\/[^\s)]+/i) || t.match(/\bwww\.[^\s)]+/i);
    if (urlMatch) out.website = urlMatch[0];

    const nameMatch =
      t.match(/\b(?:my name is|call me|this is)\s+([A-Za-z][A-Za-z\s.'-]{1,60})\b/i) ||
      t.match(/^\s*i(?:'| a)?m\s+([A-Za-z][A-Za-z\s.'-]{1,60})\b/i);
    if (nameMatch?.[1]) {
      const name = this.cleanValue(nameMatch[1]);
      if (name.length >= 2 && name.length <= 60) out.clientName = name;
    }

    const brandMatch =
      t.match(/\b(?:our|my)\s+(?:brand|company|business)\s+(?:name\s+)?is\s+["']?([^"'\n]{2,80})/i) ||
      t.match(/\b(?:we are|we're)\s+(?:called|named)\s+["']?([^"'\n]{2,80})/i) ||
      t.match(/\bbrand\s+name\s+is\s+["']?([^"'\n]{2,80})/i) ||
      t.match(/\bbrand\s+(?:named|called)\s+["']?([^"'\n]{2,80})/i) ||
      t.match(/\bfor\s+(?:a\s+)?brand\s+named\s+["']?([^"'\n]{2,80})/i);
    if (brandMatch?.[1]) {
      const brandName = this.cleanValue(brandMatch[1]);
      if (brandName.length >= 2 && brandName.length <= 80) out.brandName = brandName;
    }

    const productMatch =
      t.match(/\b(?:our|my)\s+(?:product|app|website)\s+(?:name\s+)?is\s+["']?([^"'\n]{2,80})/i) ||
      t.match(/\bproduct\s+name\s+is\s+["']?([^"'\n]{2,80})/i);
    if (productMatch?.[1]) {
      const productName = this.cleanValue(productMatch[1]);
      if (productName.length >= 2 && productName.length <= 80) out.productName = productName;
    }

    const audienceMatch = t.match(/\b(?:target audience|audience|customers)\s*(?:is|are|:)\s*([^.\n]{4,120})/i);
    if (audienceMatch?.[1]) {
      const targetAudience = this.cleanValue(audienceMatch[1]);
      if (targetAudience.length >= 4 && targetAudience.length <= 120) out.targetAudience = targetAudience;
    }

    const toneMatch = t.match(/\b(?:tone|style|voice)\s*(?:is|:)\s*([^.\n]{3,80})/i);
    if (toneMatch?.[1]) {
      const tone = this.cleanValue(toneMatch[1]);
      if (tone.length >= 3 && tone.length <= 80) out.tone = tone;
    }

    return out;
  }

  private isImportantMessage(role: 'USER' | 'ASSISTANT', content: string, imageUrl?: string) {
    if (imageUrl) return true;
    const text = (content ?? '').trim();
    if (!text) return false;
    if (/https?:\/\//i.test(text)) return true;
    if (text.length >= 200) return true;

    const lower = text.toLowerCase();
    const trivial = new Set([
      'ok',
      'okay',
      'k',
      'kk',
      'yes',
      'no',
      'sure',
      'thanks',
      'thank you',
      'thx',
      'cool',
      'great',
      'nice',
      'got it',
      'sounds good',
      'hi',
      'hello',
      'bye',
    ]);
    if (text.length <= 12 && trivial.has(lower)) return false;

    const importantSignals = [
      /\b(my|our)\s+(brand|company|product|website|app|startup|business)\b/i,
      /\b(email|phone|address|contact)\b/i,
      /\b(budget|deadline|launch|due|timeline|milestone)\b/i,
      /\b(requirements?|must|need|goal|objective|kpi|target)\b/i,
      /\b(price|pricing|plan|subscription|cost)\b/i,
      /\b(confirm|confirmed|approved|final|decision)\b/i,
    ];
    if (importantSignals.some((re) => re.test(text))) return true;

    if (role === 'USER' && text.includes('?') && text.length >= 40) return true;
    if (role === 'ASSISTANT' && text.length >= 140) return true;

    return false;
  }

  private async updateChatMemoryFromMessage(
    message: { id: string; chatId: string; role: string; content: string; imageUrl?: string; createdAt: Date },
    meta: { customerId: string; influencerId: string } | null,
  ) {
    if (!meta) return;
    const role = message.role === 'USER' ? 'USER' : 'ASSISTANT';
    const extracted = this.extractKeyDetails(message.content);
    const isImportant = this.isImportantMessage(role, message.content, message.imageUrl);
    if (!isImportant && Object.keys(extracted).length === 0) return;

    const createdAtIso =
      message.createdAt instanceof Date ? message.createdAt.toISOString() : new Date(message.createdAt).toISOString();
    let existing: any = null;
    try {
      existing = await this.prisma.chatMemory.findUnique({
        where: { chatId: message.chatId },
        select: { details: true, facts: true, snippets: true },
      });
    } catch {
      return;
    }

    const details: Record<string, any> =
      existing?.details && typeof existing.details === 'object' ? { ...(existing.details as any) } : {};
    const facts: any[] = Array.isArray(existing?.facts) ? [...existing.facts] : [];
    const snippets: any[] = Array.isArray(existing?.snippets) ? [...existing.snippets] : [];

    const wfCached = this.workflowCache.get(message.chatId);
    if (wfCached && !details._workflow) {
      details._workflow = wfCached;
    } else if (!wfCached && details._workflow) {
      this.workflowCache.set(message.chatId, details._workflow);
    }

    for (const [key, value] of Object.entries(extracted)) {
      const v = this.cleanValue(String(value));
      if (!v) continue;
      details[key] = v;
      const signature = `${key}::${v}`;
      if (!facts.some((f: any) => `${f.key}::${f.value}` === signature)) {
        facts.push({
          key,
          value: v,
          messageId: message.id,
          chatId: message.chatId,
          customerId: meta.customerId,
          createdAt: createdAtIso,
        });
      }
    }

    if (isImportant) {
      const snippetContent = this.cleanValue(message.content).slice(0, 600);
      if (!snippets.some((s: any) => s.messageId === message.id)) {
        snippets.push({
          messageId: message.id,
          chatId: message.chatId,
          customerId: meta.customerId,
          role,
          content: snippetContent,
          ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
          createdAt: createdAtIso,
        });
      }
      if (snippets.length > 50) snippets.splice(0, snippets.length - 50);
    }

    if (facts.length > 200) facts.splice(0, facts.length - 200);

    try {
      await this.prisma.chatMemory.upsert({
        where: { chatId: message.chatId },
        create: {
          chatId: message.chatId,
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
          facts,
          snippets,
        },
        update: {
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
          facts,
          snippets,
        },
      });
    } catch {}
  }

  async getChatMemoryForPrompt(chatId: string) {
    let row: any = null;
    try {
      row = await this.prisma.chatMemory.findUnique({
        where: { chatId },
        select: { details: true, snippets: true },
      });
    } catch {
      return '';
    }
    if (!row) return '';
    const details = row.details ?? {};
    const lines: string[] = [];

    const add = (label: string, value?: string) => {
      const v = (value ?? '').trim();
      if (!v) return;
      lines.push(`${label}: ${v}`);
    };

    add('Client name', details.clientName);
    add('Client email', details.clientEmail);
    add('Brand name', details.brandName);
    add('Product name', details.productName);
    add('Website', details.website);
    add('Target audience', details.targetAudience);
    add('Tone', details.tone);

    const snippets = Array.isArray(row.snippets) ? row.snippets.slice(-6) : [];
    if (snippets.length) {
      lines.push('Recent important notes:');
      for (const s of snippets) {
        const content = typeof s?.content === 'string' ? s.content : '';
        const role = s?.role === 'USER' ? 'User' : 'Assistant';
        if (content) lines.push(`- (${role}) ${content}`);
      }
    }

    return lines.join('\n');
  }

  async getChatMemoryDetails(chatId: string) {
    let row: any = null;
    try {
      row = await this.prisma.chatMemory.findUnique({
        where: { chatId },
        select: { details: true },
      });
    } catch {
      return {};
    }
    const details = row?.details ?? {};
    return details && typeof details === 'object' ? details : {};
  }

  async getWorkflowState(chatId: string) {
    if (this.workflowCache.has(chatId)) {
      return this.workflowCache.get(chatId);
    }
    const details: any = await this.getChatMemoryDetails(chatId);
    const wf = details?._workflow;
    const normalized = wf && typeof wf === 'object' ? wf : null;
    if (normalized) {
      this.workflowCache.set(chatId, normalized);
    }
    return normalized;
  }

  async setWorkflowState(chatId: string, state: any | null) {
    if (state) {
      this.workflowCache.set(chatId, state);
    } else {
      this.workflowCache.delete(chatId);
    }
    let meta: { customerId: string; influencerId: string } | null = null;
    try {
      meta = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: { customerId: true, influencerId: true },
      });
    } catch {}
    if (!meta) return;

    let existing: any = null;
    try {
      existing = await this.prisma.chatMemory.findUnique({
        where: { chatId },
        select: { details: true, facts: true, snippets: true },
      });
    } catch {}

    const details: Record<string, any> =
      existing?.details && typeof existing.details === 'object' ? { ...(existing.details as any) } : {};
    if (state) {
      details._workflow = state;
    } else {
      delete (details as any)._workflow;
    }

    const facts = Array.isArray(existing?.facts) ? existing.facts : [];
    const snippets = Array.isArray(existing?.snippets) ? existing.snippets : [];

    try {
      await this.prisma.chatMemory.upsert({
        where: { chatId },
        create: {
          chatId,
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
          facts,
          snippets,
        },
        update: {
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
        },
      });
    } catch {}
  }

  async updateChatMemoryDetails(chatId: string, patch: Record<string, any>) {
    let meta: { customerId: string; influencerId: string } | null = null;
    try {
      meta = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: { customerId: true, influencerId: true },
      });
    } catch {}
    if (!meta) return;

    let existing: any = null;
    try {
      existing = await this.prisma.chatMemory.findUnique({
        where: { chatId },
        select: { details: true, facts: true, snippets: true },
      });
    } catch {}

    const details: Record<string, any> =
      existing?.details && typeof existing.details === 'object' ? { ...(existing.details as any) } : {};
    for (const [k, v] of Object.entries(patch ?? {})) {
      if (typeof v === 'undefined') continue;
      (details as any)[k] = v;
    }

    const facts = Array.isArray(existing?.facts) ? existing.facts : [];
    const snippets = Array.isArray(existing?.snippets) ? existing.snippets : [];

    try {
      await this.prisma.chatMemory.upsert({
        where: { chatId },
        create: {
          chatId,
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
          facts,
          snippets,
        },
        update: {
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
        },
      });
    } catch {}
  }

  async savePosterPlanToLatestProject(chatId: string, plan: Record<string, any>) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { customerId: true, influencerId: true },
    });
    if (!chat) return;

    const order = await this.prisma.order.findFirst({
      where: {
        customerId: chat.customerId,
        influencerId: chat.influencerId,
        status: { notIn: ['CANCELLED', 'REFUNDED', 'REJECTED'] as any },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, projectBrief: true },
    });

    if (!order) {
      await this.prisma.order.create({
        data: {
          customerId: chat.customerId,
          influencerId: chat.influencerId,
          projectBrief: {
            productName: 'AI Influencer Project',
            keyMessage: '',
            targetAudience: '',
            tone: '',
            inclusions: [],
            additionalNotes: '',
            generatedImages: [],
            posterPlan: plan,
          } as any,
          package: 'SINGLE' as any,
          deliveryType: 'INSTANT' as any,
          status: 'PAID' as any,
          price: 0,
          aiDisclosure: true,
          videosOrdered: 0,
          videosDelivered: 0,
        },
      });
      return;
    }

    const brief = order.projectBrief && typeof order.projectBrief === 'object' ? { ...(order.projectBrief as any) } : {};
    const existingPlan = brief.posterPlan && typeof brief.posterPlan === 'object' ? { ...(brief.posterPlan as any) } : {};
    const nextPlan = { ...existingPlan, ...(plan as any) };
    const existingList = Array.isArray(existingPlan.posters) ? existingPlan.posters : [];
    const nextList = Array.isArray((plan as any)?.posters) ? (plan as any).posters : [];
    if (nextList.length > 0) {
      const seen = new Set(existingList.map((p: any) => String(p?.id || p?.createdAt || '')));
      for (const p of nextList) {
        const key = String(p?.id || p?.createdAt || '');
        if (!key || seen.has(key)) continue;
        existingList.push(p);
        seen.add(key);
      }
      nextPlan.posters = existingList;
    }

    brief.posterPlan = nextPlan;
    await this.prisma.order.update({
      where: { id: order.id },
      data: { projectBrief: brief as any },
    });
  }

  async savePostPlanToLatestProject(chatId: string, plan: Record<string, any>) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { customerId: true, influencerId: true },
    });
    if (!chat) return;

    const order = await this.prisma.order.findFirst({
      where: {
        customerId: chat.customerId,
        influencerId: chat.influencerId,
        status: { notIn: ['CANCELLED', 'REFUNDED', 'REJECTED'] as any },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, projectBrief: true },
    });

    if (!order) {
      await this.prisma.order.create({
        data: {
          customerId: chat.customerId,
          influencerId: chat.influencerId,
          projectBrief: {
            productName: 'AI Influencer Project',
            keyMessage: '',
            targetAudience: '',
            tone: '',
            inclusions: [],
            additionalNotes: '',
            postPlan: plan,
          } as any,
          package: 'SINGLE' as any,
          deliveryType: 'INSTANT' as any,
          status: 'PAID' as any,
          price: 0,
          aiDisclosure: true,
          videosOrdered: 0,
          videosDelivered: 0,
        },
      });
      return;
    }

    const brief = order.projectBrief && typeof order.projectBrief === 'object' ? { ...(order.projectBrief as any) } : {};
    const existingPlan = brief.postPlan && typeof brief.postPlan === 'object' ? { ...(brief.postPlan as any) } : {};
    const nextPlan = { ...existingPlan, ...(plan as any) };
    const existingList = Array.isArray(existingPlan.posts) ? existingPlan.posts : [];
    const nextList = Array.isArray((plan as any)?.posts) ? (plan as any).posts : [];
    if (nextList.length > 0) {
      const seen = new Set(existingList.map((p: any) => String(p?.id || p?.createdAt || '')));
      for (const p of nextList) {
        const key = String(p?.id || p?.createdAt || '');
        if (!key || seen.has(key)) continue;
        existingList.push(p);
        seen.add(key);
      }
      nextPlan.posts = existingList;
    }

    brief.postPlan = nextPlan;
    await this.prisma.order.update({
      where: { id: order.id },
      data: { projectBrief: brief as any },
    });
  }

  async findOrCreateChat(customerId: string, influencerId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });

    if (!influencer || !influencer.isActive) {
      throw new NotFoundException('Influencer not found');
    }

    const include = {
      messages: { orderBy: { createdAt: 'asc' as const } },
      influencer: { include: { portfolio: true } },
    };

    let chat: any;
    try {
      chat = await this.prisma.chat.create({
        data: { customerId, influencerId },
        include,
      });
    } catch (err: any) {
      // P2002 = unique constraint violation — chat already exists
      if (err?.code === 'P2002') {
        chat = await this.prisma.chat.findUnique({
          where: { customerId_influencerId: { customerId, influencerId } },
          include,
        });
      } else {
        throw err;
      }
    }

    // Save welcome message on first open
    if (chat.messages.length === 0) {
      const welcome = await this.prisma.message.create({
        data: {
          chatId: chat.id,
          role: 'ASSISTANT',
          content: `Hi! I'm ${influencer.name}. Tell me about your brand and what kind of content you're looking to create — I'm here to help! 🎯`,
        },
      });
      chat.messages.push(welcome);

      // Seed ChatMemory using user onboarding details
      try {
        const customer = await this.prisma.user.findUnique({
          where: { id: customerId },
        });

        if (customer && customer.isOnboarded) {
          const details = {
            brandName: customer.brandName || '',
            productName: customer.productName || '',
            website: customer.website || '',
            targetAudience: customer.targetAudience || '',
            tone: customer.tone || '',
          };
          const facts = [
            { key: 'brandName', value: customer.brandName || '' },
            { key: 'productName', value: customer.productName || '' },
            { key: 'website', value: customer.website || '' },
            { key: 'targetAudience', value: customer.targetAudience || '' },
            { key: 'tone', value: customer.tone || '' },
          ]
            .filter((f) => f.value !== '')
            .map((f) => ({
              key: f.key,
              value: f.value,
              messageId: 'onboarding-seeded',
              chatId: chat.id,
              customerId: customer.id,
              createdAt: new Date().toISOString(),
            }));

          await this.prisma.chatMemory.create({
            data: {
              chatId: chat.id,
              customerId: customer.id,
              influencerId: influencer.id,
              details,
              facts,
              snippets: [],
            },
          });
        }
      } catch (err) {
        console.error('[ChatService] Failed to seed ChatMemory during findOrCreateChat:', err);
      }
    }

    return chat;
  }

  async addMessage(chatId: string, role: 'USER' | 'ASSISTANT', content: string, imageUrl?: string) {
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { chatId, role, content, ...(imageUrl ? { imageUrl } : {}) } }),
      this.prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } }),
    ]);
    if (role === 'ASSISTANT' && imageUrl) {
      try {
        await this.attachGeneratedImageToLatestProject(chatId, message.id, imageUrl, message.createdAt);
      } catch (e) {
        console.error('[ChatService] Failed to attach generated image to project:', e);
      }
    }
    try {
      const meta = await this.getChatMetaCached(chatId);
      await this.updateChatMemoryFromMessage(message as any, meta);
    } catch {}
    return message;
  }

  private async attachGeneratedImageToLatestProject(
    chatId: string,
    messageId: string,
    imageUrl: string,
    createdAt: Date,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { customerId: true, influencerId: true },
    });
    if (!chat) return;

    const order = await this.prisma.order.findFirst({
      where: {
        customerId: chat.customerId,
        influencerId: chat.influencerId,
        createdAt: { lte: createdAt },
        status: { notIn: ['CANCELLED', 'REFUNDED', 'REJECTED'] as any },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, projectBrief: true, videosDelivered: true },
    });
    if (!order) {
      const fallback = await this.prisma.order.findFirst({
        where: {
          customerId: chat.customerId,
          influencerId: chat.influencerId,
          status: { notIn: ['CANCELLED', 'REFUNDED', 'REJECTED'] as any },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, projectBrief: true, videosDelivered: true },
      });
      if (fallback) {
        return this.attachGeneratedImageToOrder(fallback.id, fallback.projectBrief as any, messageId, imageUrl, createdAt);
      }

      const created = await this.prisma.order.create({
        data: {
          customerId: chat.customerId,
          influencerId: chat.influencerId,
          projectBrief: {
            productName: 'AI Influencer Project',
            keyMessage: '',
            targetAudience: '',
            tone: '',
            inclusions: [],
            additionalNotes: '',
            generatedImages: [],
          } as any,
          package: 'SINGLE' as any,
          deliveryType: 'INSTANT' as any,
          status: 'PAID' as any,
          price: 0,
          aiDisclosure: true,
          videosOrdered: 1,
          videosDelivered: 0,
        },
        select: { id: true, projectBrief: true },
      });
      return this.attachGeneratedImageToOrder(created.id, created.projectBrief as any, messageId, imageUrl, createdAt);
    }

    await this.attachGeneratedImageToOrder(order.id, order.projectBrief as any, messageId, imageUrl, createdAt);
  }

  private async attachGeneratedImageToOrder(
    orderId: string,
    projectBrief: any,
    messageId: string,
    imageUrl: string,
    createdAt: Date,
  ) {
    const brief = projectBrief && typeof projectBrief === 'object' ? { ...(projectBrief as Record<string, any>) } : {};
    const list = Array.isArray(brief.generatedImages) ? [...brief.generatedImages] : [];
    if (!list.some((x: any) => x?.messageId === messageId || x?.url === imageUrl)) {
      list.push({
        url: imageUrl,
        messageId,
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString(),
        delivered: false,
      });
    }
    brief.generatedImages = list;

    const deliveredCount = list.filter((x: any) => x && x.delivered === true).length;
    const total = list.length;

    const current = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, deliveredAt: true },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        projectBrief: brief as any,
        videosOrdered: total,
        videosDelivered: deliveredCount,
        ...(total > 0 && deliveredCount === total
          ? { status: 'DELIVERED' as any, deliveredAt: current?.deliveredAt || new Date() }
          : {
              ...(current?.status === 'DELIVERED' ? { status: 'PAID' as any } : {}),
              deliveredAt: null,
            }),
      },
    });
  }

  async getChatHistory(chatId: string) {
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getLastAssistantImage(chatId: string) {
    return this.prisma.message.findFirst({
      where: { chatId, role: 'ASSISTANT', imageUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true, imageUrl: true, createdAt: true },
    });
  }

  async getUserChats(customerId: string) {
    return this.prisma.chat.findMany({
      where: { customerId },
      include: {
        influencer: { include: { portfolio: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getInfluencerChats(influencerId: string) {
    return this.prisma.chat.findMany({
      where: { influencerId },
      include: {
        customer: true,
        influencer: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getAllChats() {
    return this.prisma.chat.findMany({
      include: {
        customer: true,
        influencer: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getChatById(chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        customer: true,
        influencer: { include: { portfolio: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }

  async getChatMeta(chatId: string) {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { customerId: true, influencerId: true, influencer: { select: { name: true } } },
    });
  }

  async getInfluencerSystemPrompt(influencerId: string): Promise<string> {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { systemPrompt: true, name: true },
    });

    if (!influencer) throw new NotFoundException('Influencer not found');
    return influencer.systemPrompt;
  }

  async getInfluencerAIContext(influencerId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: {
        name: true,
        industries: true,
        contentStyle: true,
        locationCity: true,
        locationState: true,
        locationCountry: true,
        locationAddress: true,
        locationPincode: true,
        systemPrompt: true,
        topic: true,
        outOfTopicMessage: true,
        serviceType: true,
        aiConfig: { select: { imageApiUrl: true, imageApiKey: true, imageModel: true, chatApiUrl: true, chatApiKey: true, chatModel: true } },
      },
    });
    if (!influencer) throw new NotFoundException('Influencer not found');
    return influencer;
  }

  async getInfluencerActivePackages(influencerId: string) {
    return this.prisma.influencerPackage.findMany({
      where: { influencerId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        type: true,
        name: true,
        price: true,
        videoCount: true,
        description: true,
        isMonthly: true,
        sortOrder: true,
      },
    });
  }

  async getRecentMessages(chatId: string, limit = 20) {
    const messages = await this.prisma.message.findMany({
      where: { chatId, role: { not: 'SYSTEM' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }
}
