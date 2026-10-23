import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../config/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AiService } from '../ai/ai.service';
import { ChatGateway } from '../chat/chat.gateway';
import { CreateOrderInput } from './dto/create-order.dto';
import { AdminCreateOrderInput } from './dto/admin-create-order.dto';
import { AdminUpdateOrderInput } from './dto/admin-update-order.dto';
import { OrderStatus, PackageType } from '@prisma/client';

const PACKAGE_PRICES: Record<PackageType, { price: number; videos: number }> = {
  SINGLE: { price: 9.99, videos: 1 },
  PACK_5: { price: 39.99, videos: 5 },
  PACK_10: { price: 70.0, videos: 10 },
  MONTHLY_STARTER: { price: 199.0, videos: 30 },
  MONTHLY_GROWTH: { price: 499.0, videos: 100 },
  CUSTOM: { price: 0, videos: 0 },
};

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notificationService: NotificationService,
    private aiService: AiService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway?: ChatGateway,
  ) {}

  private isMock() {
    return this.config.get<string>('MOCK_MODE') === 'true';
  }

  private mockOrders(): any[] {
    const now = new Date();
    return [
      {
        id: 'mock-order-1',
        customerId: 'mock-customer',
        influencerId: '1',
        projectBrief: { notes: 'Mock brief' },
        package: 'SINGLE',
        deliveryType: 'STANDARD',
        price: 9.99,
        videosOrdered: 1,
        aiDisclosure: true,
        status: 'PENDING_REVIEW',
        createdAt: now,
        influencer: { id: '1', name: 'Nova Sterling', portfolio: [] },
        customer: { id: 'mock-customer', name: 'Demo Customer' },
        payment: null,
        review: null,
        ticket: null,
        videoUrl: null,
        thumbnailUrl: null,
        videosDelivered: 0,
      },
      {
        id: 'mock-order-2',
        customerId: 'mock-customer',
        influencerId: '2',
        projectBrief: { notes: 'Another brief' },
        package: 'PACK_5',
        deliveryType: 'EXPRESS',
        price: 39.99,
        videosOrdered: 5,
        aiDisclosure: true,
        status: 'DELIVERED',
        createdAt: now,
        influencer: { id: '2', name: 'Aria Bloom', portfolio: [] },
        customer: { id: 'mock-customer', name: 'Demo Customer' },
        payment: null,
        review: null,
        ticket: null,
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        videosDelivered: 5,
      },
    ];
  }

  private async resolveInfluencerPackagePricing(influencerId: string, type: PackageType) {
    const pkg = await this.prisma.influencerPackage.findFirst({
      where: { influencerId, type, isActive: true },
      select: { price: true, videoCount: true },
    });
    if (!pkg) {
      throw new BadRequestException('Selected package is not available');
    }
    const price = Number(pkg.price);
    const videos = Number(pkg.videoCount);
    if (!Number.isFinite(price) || price < 0) throw new BadRequestException('Invalid package price');
    if (!Number.isFinite(videos) || videos < 0) throw new BadRequestException('Invalid package configuration');
    return { price, videos };
  }

  async create(customerId: string, input: CreateOrderInput) {
    if (this.isMock()) {
      const valid = ['SINGLE', 'PACK_5', 'PACK_10', 'MONTHLY_STARTER', 'MONTHLY_GROWTH'].includes(
        input.package as any,
      );
      if (!valid) throw new BadRequestException('Invalid package selection');
      const order = {
        id: `mock-order-${Date.now()}`,
        customerId,
        influencerId: input.influencerId,
        projectBrief: input.projectBrief as any,
        package: input.package,
        deliveryType: input.deliveryType,
        price: PACKAGE_PRICES[input.package].price,
        videosOrdered: PACKAGE_PRICES[input.package].videos,
        aiDisclosure: input.aiDisclosure,
        status: 'PENDING_PAYMENT',
        createdAt: new Date(),
        influencer: { id: input.influencerId, name: 'Mock Influencer', portfolio: [] },
        customer: { id: customerId, name: 'Demo Customer' },
        payment: null,
        review: null,
        ticket: null,
        videoUrl: null,
        thumbnailUrl: null,
        videosDelivered: 0,
      };
      return order;
    }
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: input.influencerId },
    });

    if (!influencer || !influencer.isActive) {
      throw new NotFoundException('Influencer not found or unavailable');
    }

    if (input.package === 'CUSTOM') {
      throw new BadRequestException('Invalid package selection');
    }

    const packageInfo = await this.resolveInfluencerPackagePricing(input.influencerId, input.package);

    let finalProjectBrief = '{}';
    const briefRaw: any = input.projectBrief;
    const briefHasContent =
      briefRaw != null &&
      (typeof briefRaw === 'string'
        ? briefRaw.trim().length > 2 && briefRaw.trim() !== '{}'
        : Object.keys(briefRaw).length > 0 &&
          (Boolean(briefRaw.productName) || Boolean(briefRaw.keyMessage) || Boolean(briefRaw.targetAudience)));

    if (briefHasContent) {
      finalProjectBrief =
        typeof briefRaw === 'string' ? briefRaw : JSON.stringify(briefRaw);
    } else {
      // Automatically reuse project brief from customer's previous order with this influencer if available
      const previousOrder = await this.prisma.order.findFirst({
        where: {
          customerId,
          influencerId: input.influencerId,
          status: { not: OrderStatus.CANCELLED },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (previousOrder && previousOrder.projectBrief && previousOrder.projectBrief.trim().length > 2) {
        finalProjectBrief = previousOrder.projectBrief;
      } else if (briefRaw != null) {
        finalProjectBrief =
          typeof briefRaw === 'string' ? briefRaw : JSON.stringify(briefRaw);
      }
    }

    // Ensure reused project brief does NOT carry over previous order deliverables
    try {
      const parsed = typeof finalProjectBrief === 'string' ? JSON.parse(finalProjectBrief) : finalProjectBrief;
      if (parsed && typeof parsed === 'object') {
        delete (parsed as any).generatedPosts;
        delete (parsed as any).generatedImages;
        delete (parsed as any).postPlan;
        finalProjectBrief = JSON.stringify(parsed);
      }
    } catch {}

    const order = await this.prisma.order.create({
      data: {
        customerId,
        influencerId: input.influencerId,
        projectBrief: finalProjectBrief,
        package: input.package,
        deliveryType: input.deliveryType,
        price: packageInfo.price,
        videosOrdered: packageInfo.videos,
        aiDisclosure: input.aiDisclosure,
        status: 'PENDING_PAYMENT',
      },
      include: {
        influencer: { include: { portfolio: true } },
        customer: true,
      },
    });

    return order;
  }

  async findById(id: string) {
    if (this.isMock()) {
      const list = this.mockOrders();
      const found = list.find((o) => o.id === id);
      if (!found) throw new NotFoundException('Order not found');
      return found;
    }
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        influencer: { include: { portfolio: true } },
        customer: true,
        payment: true,
        review: true,
        ticket: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findGeneratedImages(orderId: string) {
    if (this.isMock()) return [];

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, influencerId: true, createdAt: true, projectBrief: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    let brief: Record<string, any> = {};
    if (order.projectBrief) {
      if (typeof order.projectBrief === 'string') {
        try {
          brief = JSON.parse(order.projectBrief);
        } catch {
          brief = {};
        }
      } else if (typeof order.projectBrief === 'object') {
        brief = order.projectBrief as Record<string, any>;
      }
    }
    const direct = Array.isArray(brief.generatedImages) ? brief.generatedImages : [];
    if (direct.length > 0) {
      return direct
        .filter((x: any) => typeof x?.url === 'string' && x.url.trim())
        .map((x: any) => ({
          url: x.url as string,
          messageId: String(x.messageId || ''),
          createdAt: x.createdAt ? new Date(x.createdAt) : order.createdAt,
          delivered: typeof x.delivered === 'boolean' ? x.delivered : true,
          deliveredAt: x.deliveredAt ? new Date(x.deliveredAt) : undefined,
        }))
        .sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }

    const next = await this.prisma.order.findFirst({
      where: {
        customerId: order.customerId,
        influencerId: order.influencerId,
        createdAt: { gt: order.createdAt },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const chat = await this.prisma.chat.findUnique({
      where: { customerId_influencerId: { customerId: order.customerId, influencerId: order.influencerId } },
      select: { id: true },
    });
    if (!chat) return [];

    const images = await this.prisma.message.findMany({
      where: {
        chatId: chat.id,
        role: 'ASSISTANT',
        imageUrl: { not: null },
        createdAt: {
          gte: order.createdAt,
          ...(next?.createdAt ? { lt: next.createdAt } : {}),
        },
      },
      select: { id: true, imageUrl: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return images
      .filter((m) => typeof m.imageUrl === 'string' && m.imageUrl.trim())
      .map((m) => ({
        url: m.imageUrl as string,
        messageId: m.id,
        createdAt: m.createdAt,
        delivered: true,
      }));
  }

  async findGeneratedPosts(orderId: string) {
    if (this.isMock()) return [];

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, influencerId: true, createdAt: true, projectBrief: true, videosOrdered: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    let brief: Record<string, any> = {};
    if (order.projectBrief) {
      if (typeof order.projectBrief === 'string') {
        try {
          brief = JSON.parse(order.projectBrief);
        } catch {
          brief = {};
        }
      } else if (typeof order.projectBrief === 'object') {
        brief = order.projectBrief as Record<string, any>;
      }
    }

    const direct = Array.isArray(brief.generatedPosts) ? brief.generatedPosts : [];
    if (direct.length > 0) {
      return direct.map((p: any, idx: number) => ({
        id: p.id || `post-${idx + 1}`,
        title: p.title || 'Untitled Post',
        caption: p.caption || p.content || '',
        content: p.content || p.caption || '',
        hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
        imageUrl: p.imageUrl || null,
        imagePrompt: p.imagePrompt || null,
        platforms: Array.isArray(p.platforms) && p.platforms.length > 0 ? p.platforms : ['Blog', 'Social Media'],
        topic: p.topic || p.title || 'General',
        tone: p.tone || null,
        callToAction: p.callToAction || null,
        createdAt: p.createdAt || (order.createdAt instanceof Date ? order.createdAt.toISOString() : new Date().toISOString()),
        delivered: p.delivered !== false,
      }));
    }

    if (brief && brief.postPlan && Array.isArray(brief.postPlan.posts)) {
      return brief.postPlan.posts.map((p: any) => ({
        id: p.id || String(p.index || 'post'),
        title: p.requirements?.topic || p.title || 'Scheduled Post',
        caption: p.optimizedPrompt || p.caption || '',
        content: p.optimizedPrompt || p.content || '',
        hashtags: [],
        createdAt: p.createdAt || new Date().toISOString(),
        delivered: true,
      }));
    }

    // Auto-sync fallback: inspect chat messages between customer & influencer
    let customerIds = [order.customerId];
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: order.customerId },
        select: { email: true },
      });
      if (user?.email) {
        const prefix = user.email.split('@')[0].toLowerCase();
        const related = await this.prisma.user.findMany({
          where: {
            OR: [
              { id: order.customerId },
              { email: user.email },
              { email: { startsWith: `${prefix}@genver` } },
            ],
          },
          select: { id: true },
        });
        customerIds = related.map((r) => r.id);
      }
    } catch {}

    const chats = await this.prisma.chat.findMany({
      where: {
        customerId: { in: customerIds },
        influencerId: order.influencerId,
      },
      select: { id: true },
    });

    if (chats.length === 0) return [];

    const chatIds = chats.map((c) => c.id);
    const messages = await this.prisma.message.findMany({
      where: {
        chatId: { in: chatIds },
        role: 'ASSISTANT',
        createdAt: { gte: order.createdAt },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const extractedPosts: any[] = [];
    for (const msg of messages) {
      const post = this.parsePostText(msg.content, msg.imageUrl, msg.createdAt);
      if (post) {
        const isDup = extractedPosts.some(
          (p) => p.title.trim().toLowerCase() === post.title.trim().toLowerCase() && p.caption.trim().toLowerCase() === post.caption.trim().toLowerCase(),
        );
        if (!isDup) extractedPosts.push(post);
      }
    }

    if (extractedPosts.length > 0) {
      brief.generatedPosts = extractedPosts;
      const isVideoReq =
        brief.type === 'VIDEO_REQUEST' ||
        brief.type === 'VIDEO' ||
        Boolean(brief.videoPrompt) ||
        Boolean(brief.videoDetails) ||
        (Array.isArray(brief.videoRequests) && brief.videoRequests.length > 0) ||
        Boolean(brief.autoGeneratedPrompt) ||
        Boolean(brief.influencerScript) ||
        brief.source === 'INFLUENCER_CHAT';

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          projectBrief: JSON.stringify(brief),
          ...(isVideoReq
            ? {}
            : {
                videosDelivered: Math.max(extractedPosts.length, (order as any).videosDelivered || 0),
                status: 'DELIVERED',
                deliveredAt: new Date(),
              }),
        },
      });
    }

    return extractedPosts;
  }

  private parsePostText(content: string, imageUrl?: string | null, createdAt?: Date): any | null {
    if (!content || typeof content !== 'string') return null;
    const text = content.trim();

    // If the content is a video request confirmation, video script, or video prompt, it is NOT a social post deliverable
    if (
      /\b(video script|storyboard|video prompt|video request|production specifications)\b/i.test(text) ||
      text.includes('🎬') ||
      text.includes('Generated Video Script') ||
      text.includes('Suggested Video Script')
    ) {
      return null;
    }

    const cleanStr = (s?: string | null) => (s ? s.replace(/^[*_~`\s]+|[*_~`\s]+$/g, '').trim() : '');

    // 1. Strict POST format: POST / **POST** with Title: ... Description: ... Hashtags: ... Image: ...
    const titleMatch = text.match(/(?:^|\n)\s*(?:#{1,4}\s*)?(?:\*\*)?Title(?:\*\*)?:(?:\*\*)?\s*([^\n]+)/i);
    const descMatch = text.match(/(?:^|\n)\s*(?:\*\*)?(?:Description|Caption|Content|Body)(?:\*\*)?:(?:\*\*)?\s*([\s\S]+?)(?=(?:\n\s*(?:\*\*)?(?:Hashtags?|Tags?|Image|Prompt)(?:\*\*)?:|\n\s*---|(?:\n\s*(?:#{1,4}|\*\*)\s*POST)|$))/i);
    const hashMatch = text.match(/(?:^|\n)\s*(?:\*\*)?(?:Hashtags?|Tags?)(?:\*\*)?:(?:\*\*)?\s*([^\n]+)/i);
    const imgMatch = text.match(/(?:^|\n)\s*(?:\*\*)?(?:Image|Visual|Prompt)(?:\*\*)?:(?:\*\*)?\s*([^\n]+)/i);

    if (titleMatch && descMatch) {
      const title = cleanStr(titleMatch[1]);
      const description = cleanStr(descMatch[1]);
      const hashtagsRaw = hashMatch ? cleanStr(hashMatch[1]) : '';
      const hashtags = hashtagsRaw
        ? (hashtagsRaw.match(/#[a-zA-Z0-9_]+/g) || hashtagsRaw.split(/\s+/).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`)))
        : (description.match(/#[a-zA-Z0-9_]+/g) || []);

      const imgLine = imgMatch ? cleanStr(imgMatch[1]) : '';
      const extractedImg = imageUrl || (imgLine.startsWith('http') ? imgLine : (imgLine.match(/\((https?:\/\/[^\)]+)\)/)?.[1] || null));
      const imagePrompt = (!extractedImg && imgLine && !imgLine.toLowerCase().includes('generating image') && !imgLine.toLowerCase().includes('now generating')) ? imgLine : null;

      const ctaMatch = description.match(/(?:Visit(?:\s+us)?(?:\s+at)?\s+(?:https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-z]{2,})[^\n]*|Contact us[^\n]*|Call us[^\n]*|Sign up[^\n]*)/i);
      const callToAction = ctaMatch ? ctaMatch[0].trim() : null;

      return {
        id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        caption: description,
        content: description,
        hashtags,
        imageUrl: extractedImg || null,
        imagePrompt: imagePrompt || null,
        topic: title,
        callToAction,
        platforms: ['Blog', 'LinkedIn', 'Website'],
        createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
        delivered: true,
      };
    }

    // 2. Emoji format: 📝 **[Title]**\n\n[Caption]\n\n[Hashtags]
    const emojiMatch = text.match(/📝\s*\*\*([^*]+)\*\*\s*\n+([\s\S]+?)(?=(?:\n+#[a-zA-Z0-9_\s#]+|\n\s*---|$))/i);
    if (emojiMatch) {
      const title = cleanStr(emojiMatch[1]);
      const caption = cleanStr(emojiMatch[2]);
      const hashtags = text.match(/#[a-zA-Z0-9_]+/g) || [];
      return {
        id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        caption,
        content: caption,
        hashtags,
        imageUrl: imageUrl || null,
        imagePrompt: null,
        topic: title,
        callToAction: null,
        platforms: ['Blog', 'LinkedIn', 'Website'],
        createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
        delivered: true,
      };
    }

    // 4. Markdown section with heading
    const headerMatch = text.match(/(?:^|\n)(?:---\s*\n+)?(?:#{1,4}\s+|\*\*([^*]+)\*\*\s*\n+)([^\n*#]+)(?:\n+)([\s\S]+?)(?:\n+---|\n+(?:Feel free|Let me know|Hope this helps)|$)/i);
    if (headerMatch) {
      const rawTitle = (headerMatch[1] || headerMatch[2] || '').trim().replace(/^\*\*|\*\*$/g, '');
      let body = (headerMatch[3] || '').trim();
      body = body.replace(/\n*---[\s\S]*$/, '').replace(/\n*(?:Feel free|Let me know|Hope this helps)[\s\S]*$/i, '').trim();

      if (rawTitle.length >= 3 && body.length >= 40) {
        const hashtags = body.match(/#[a-zA-Z0-9_]+/g) || [];
        return {
          id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: rawTitle,
          caption: body,
          content: body,
          hashtags,
          imageUrl: imageUrl || null,
          createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
          delivered: true,
        };
      }
    }

    // 5. General Draft Post match
    const draftMatch = text.match(/(?:Here(?:’|')s\s+(?:a\s+)?(?:draft\s+for\s+your\s+)?(?:website\s+|social\s+)?post[^:]*:\s*\n+)([\s\S]+)/i);
    if (draftMatch) {
      const draftBody = draftMatch[1].trim();
      const subHeader = draftBody.match(/(?:---\s*\n+)?(?:#{1,4}\s+|\*\*([^*]+)\*\*\s*\n+)?([^\n]+)\n+([\s\S]+)/);
      if (subHeader) {
        const title = (subHeader[1] || subHeader[2] || '').replace(/^[#*\s-]+|[#*\s-]+$/g, '').trim();
        let body = (subHeader[3] || '').replace(/\n*---[\s\S]*$/, '').replace(/\n*(?:Feel free|Let me know|Hope this helps)[\s\S]*$/i, '').trim();
        if (title.length >= 3 && body.length >= 30) {
          const hashtags = body.match(/#[a-zA-Z0-9_]+/g) || [];
          return {
            id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            caption: body,
            content: body,
            hashtags,
            imageUrl: imageUrl || null,
            createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString(),
            delivered: true,
          };
        }
      }
    }

    return null;
  }

  async findByCustomer(customerId: string) {
    if (this.isMock()) {
      return this.mockOrders().filter((o) => o.customerId === customerId);
    }
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        influencer: true,
        payment: true,
        review: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(status?: OrderStatus, influencerId?: string) {
    if (this.isMock()) {
      let list = this.mockOrders();
      if (status) list = list.filter((o) => o.status === status);
      if (influencerId) list = list.filter((o) => o.influencerId === influencerId);
      return list;
    }
    return this.prisma.order.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(influencerId ? { influencerId } : {}),
      },
      include: {
        influencer: { include: { portfolio: true } },
        customer: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingReview() {
    if (this.isMock()) {
      return this.mockOrders().filter((o) => o.status === 'PENDING_REVIEW');
    }
    return this.prisma.order.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: {
        influencer: { include: { portfolio: true } },
        customer: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateStatus(id: string, status: OrderStatus, reviewNotes?: string, reviewedBy?: string) {
    if (this.isMock()) {
      const base = this.mockOrders()[0];
      return {
        ...base,
        id,
        status,
        reviewNotes: reviewNotes || base.reviewNotes,
        reviewedBy: reviewedBy || base.reviewedBy,
        reviewedAt: reviewedBy ? new Date() : base.reviewedAt,
        deliveredAt: status === 'DELIVERED' ? new Date() : base.deliveredAt,
      };
    }
    const prev = await this.prisma.order.findUnique({
      where: { id },
      select: { status: true, deliveredAt: true },
    });
    if (!prev) throw new NotFoundException('Order not found');
    const data: any = { status };

    if (reviewNotes) data.reviewNotes = reviewNotes;
    if (reviewedBy) {
      data.reviewedBy = reviewedBy;
      data.reviewedAt = new Date();
    }
    if (status === 'DELIVERED') {
      data.deliveredAt = new Date();
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data,
      include: {
        influencer: { include: { portfolio: true } },
        customer: true,
      },
    });
    if (status === 'DELIVERED' && prev.status !== 'DELIVERED') {
      const influencerName = (updated as any)?.influencer?.name || 'your influencer';
      await this.notificationService.create(updated.customerId, {
        title: `Your project is delivered`,
        description: `Your project with ${influencerName} has been marked as delivered.`,
        href: '/dashboard/orders',
      });
    }
    return updated;
  }

  async adminUpdate(input: AdminUpdateOrderInput) {
    if (this.isMock()) {
      const base = this.mockOrders()[0];
      return {
        ...base,
        id: input.id,
        status: (input.status as any) || base.status,
        price: typeof input.price === 'number' ? input.price : base.price,
      };
    }

    const existing = await this.prisma.order.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        projectBrief: true,
        status: true,
        deliveredAt: true,
      },
    });
    if (!existing) throw new NotFoundException('Order not found');

    const data: any = {};
    if (input.package) data.package = input.package;
    if (input.deliveryType) data.deliveryType = input.deliveryType;
    if (typeof input.aiDisclosure === 'boolean') data.aiDisclosure = input.aiDisclosure;
    if (input.status) {
      data.status = input.status;
      if (input.status === 'DELIVERED' && !existing.deliveredAt) {
        data.deliveredAt = new Date();
      }
    }
    if (typeof input.price === 'number') data.price = input.price;
    if (typeof input.videoUrl === 'string') {
      data.videoUrl = input.videoUrl.trim() || null;
      if (input.videoUrl.trim() && (input.status === 'DELIVERED' || existing.status === 'DELIVERED')) {
        data.videosDelivered = (existing as any).videosOrdered || 1;
      }
    }
    if (typeof input.thumbnailUrl === 'string') {
      data.thumbnailUrl = input.thumbnailUrl.trim() || null;
    }

    if (input.projectBrief !== undefined) {
      let prev: any = {};
      if (existing.projectBrief) {
        if (typeof existing.projectBrief === 'object') {
          prev = existing.projectBrief;
        } else if (typeof existing.projectBrief === 'string') {
          try {
            prev = JSON.parse(existing.projectBrief);
          } catch {
            prev = {};
          }
        }
      }

      const inputBrief =
        typeof input.projectBrief === 'string'
          ? (() => {
              try {
                return JSON.parse(input.projectBrief);
              } catch {
                return {};
              }
            })()
          : input.projectBrief && typeof input.projectBrief === 'object'
          ? input.projectBrief
          : {};

      // Ensure critical arrays and metadata are never lost when admin updates partial brief
      const keepGeneratedImages = Array.isArray(prev.generatedImages) ? prev.generatedImages : undefined;
      const keepVideoRequests = Array.isArray(prev.videoRequests) ? prev.videoRequests : undefined;
      const keepGeneratedVideos = Array.isArray(prev.generatedVideos) ? prev.generatedVideos : undefined;
      const keepGeneratedPosts = Array.isArray(prev.generatedPosts) ? prev.generatedPosts : undefined;
      const keepHistory = Array.isArray(prev.history) ? prev.history : undefined;

      const merged = {
        ...prev,
        ...inputBrief,
        ...(keepGeneratedImages && !inputBrief.generatedImages ? { generatedImages: keepGeneratedImages } : {}),
        ...(keepVideoRequests && !inputBrief.videoRequests ? { videoRequests: keepVideoRequests } : {}),
        ...(keepGeneratedVideos && !inputBrief.generatedVideos ? { generatedVideos: keepGeneratedVideos } : {}),
        ...(keepGeneratedPosts && !inputBrief.generatedPosts ? { generatedPosts: keepGeneratedPosts } : {}),
        ...(keepHistory && !inputBrief.history ? { history: keepHistory } : {}),
      };
      data.projectBrief = JSON.stringify(merged);
    }

    if (Array.isArray((input as any).generatedImages)) {
      let prev: any = {};
      if (data.projectBrief) {
        try {
          prev = typeof data.projectBrief === 'string' ? JSON.parse(data.projectBrief) : data.projectBrief;
        } catch {
          prev = {};
        }
      } else if (existing.projectBrief) {
        try {
          prev = typeof existing.projectBrief === 'string' ? JSON.parse(existing.projectBrief) : existing.projectBrief;
        } catch {
          prev = {};
        }
      }
      const list = (input as any).generatedImages as any[];
      prev.generatedImages = list;
      data.projectBrief = JSON.stringify(prev);
      const deliveredCount = list.filter((x) => x && x.delivered === true).length;
      data.videosOrdered = list.length;
      data.videosDelivered = deliveredCount;
      if (!input.status) {
        if (list.length > 0 && deliveredCount === list.length) {
          data.status = 'DELIVERED';
          if (!existing.deliveredAt) data.deliveredAt = new Date();
        } else {
          if (existing.status === 'DELIVERED') data.status = 'PAID';
          data.deliveredAt = null;
        }
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: input.id },
      data,
      include: { influencer: true, customer: true, review: true, payment: true },
    });
    if (updated.status === 'DELIVERED' && existing.status !== 'DELIVERED') {
      const influencerName = (updated as any)?.influencer?.name || 'your influencer';
      await this.notificationService.create(updated.customerId, {
        title: `Your project is delivered`,
        description: `Your project with ${influencerName} has been marked as delivered.`,
        href: '/dashboard/orders',
      });
    }
    return updated;
  }

  async findByInfluencer(influencerId: string) {
    if (this.isMock()) {
      return this.mockOrders().filter((o) => o.influencerId === influencerId);
    }
    return this.prisma.order.findMany({
      where: { influencerId },
      include: {
        customer: true,
        influencer: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminCreate(input: AdminCreateOrderInput) {
    let price = 0;
    let videosOrdered = 0;
    if (input.package === 'CUSTOM') {
      if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price < 0) {
        throw new BadRequestException('Custom price is required');
      }
      price = input.price;
      videosOrdered = 0;
    } else {
      const pkg = await this.resolveInfluencerPackagePricing(input.influencerId, input.package);
      price = pkg.price;
      videosOrdered = pkg.videos;
    }
    const status = input.status ?? 'PAID';

    const order = await this.prisma.order.create({
      data: {
        customerId: input.customerId,
        influencerId: input.influencerId,
        projectBrief: input.projectBrief as any,
        package: input.package,
        deliveryType: input.deliveryType,
        price,
        videosOrdered,
        aiDisclosure: input.aiDisclosure,
        status,
      },
      include: {
        influencer: { include: { portfolio: true } },
        customer: true,
      },
    });
    return order;
  }

  async setVideoUrl(id: string, videoUrl: string, thumbnailUrl?: string) {
    return this.prisma.order.update({
      where: { id },
      data: {
        videoUrl,
        thumbnailUrl,
        videosDelivered: { increment: 1 },
      },
    });
  }

  async getRevenueStats() {
    if (this.isMock()) {
      return {
        totalRevenue: 49.98,
        monthlyRevenue: 39.99,
        ordersByStatus: [
          { status: 'PENDING_REVIEW', _count: 1 },
          { status: 'DELIVERED', _count: 1 },
        ],
      } as any;
    }
    const [totalRevenue, monthlyRevenue, ordersByStatus] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'SUCCEEDED',
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    return {
      totalRevenue: totalRevenue._sum.amount || 0,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
      ordersByStatus,
    };
  }

  async generateOrderVideo(params: {
    orderId: string;
    prompt?: string;
    duration?: string;
    aspectRatio?: string;
    videoProvider?: string;
    videoModel?: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: params.orderId },
      include: {
        influencer: { include: { aiConfig: true } },
        customer: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    let brief: any = {};
    if (order.projectBrief) {
      try {
        brief =
          typeof order.projectBrief === 'string'
            ? JSON.parse(order.projectBrief)
            : { ...(order.projectBrief as Record<string, any>) };
      } catch {
        brief = { raw: order.projectBrief };
      }
    }

    const resolvedPrompt =
      params.prompt?.trim() ||
      brief.videoPrompt ||
      brief.videoDetails?.fullPrompt ||
      `Cinematic promotional video for ${brief.productName || order.influencer.name}`;

    const resolvedDuration = params.duration?.trim() || brief.videoDetails?.duration || '30 seconds';
    const resolvedAspect = params.aspectRatio?.trim() || brief.videoDetails?.aspectRatio || '9:16';

    // Generate the video using AiService
    const generationResult = await this.aiService.generateVideo({
      prompt: resolvedPrompt,
      duration: resolvedDuration,
      aspectRatio: resolvedAspect,
      influencerName: order.influencer.name,
      customVideo:
        params.videoProvider || params.videoModel
          ? {
              videoProvider: params.videoProvider,
              videoModel: params.videoModel,
            }
          : undefined,
    });

    const generatedVideoItem = {
      id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url: generationResult.url,
      prompt: resolvedPrompt,
      provider: generationResult.provider,
      model: generationResult.model,
      duration: resolvedDuration,
      aspectRatio: resolvedAspect,
      generatedAt: new Date().toISOString(),
      status: 'COMPLETED',
    };

    const existingVideos = Array.isArray(brief.generatedVideos) ? brief.generatedVideos : [];
    brief.generatedVideos = [generatedVideoItem, ...existingVideos];

    const historyItem = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: 'VIDEO_GENERATED',
      timestamp: new Date().toISOString(),
      videoUrl: generationResult.url,
      provider: generationResult.provider,
      model: generationResult.model,
      prompt: resolvedPrompt.length > 200 ? resolvedPrompt.slice(0, 200) + '…' : resolvedPrompt,
      actor: 'Admin',
    };
    brief.history = Array.isArray(brief.history) ? [historyItem, ...brief.history] : [historyItem];

    // Update order status to PENDING_REVIEW if in PAID or GENERATING
    const nextStatus =
      order.status === OrderStatus.PAID || order.status === OrderStatus.GENERATING
        ? OrderStatus.PENDING_REVIEW
        : order.status;

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        videoUrl: generationResult.url,
        status: nextStatus,
        projectBrief: JSON.stringify(brief),
      },
      include: {
        influencer: true,
        customer: true,
      },
    });

    return {
      ...updated,
      projectBrief: brief,
    };
  }

  async sendOrderVideoToClient(params: {
    orderId: string;
    videoUrl?: string;
    customMessage?: string;
    notes?: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: params.orderId },
      include: {
        influencer: true,
        customer: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    let brief: any = {};
    if (order.projectBrief) {
      try {
        brief =
          typeof order.projectBrief === 'string'
            ? JSON.parse(order.projectBrief)
            : { ...(order.projectBrief as Record<string, any>) };
      } catch {
        brief = { raw: order.projectBrief };
      }
    }

    const videoUrlToSend =
      params.videoUrl?.trim() ||
      order.videoUrl ||
      brief.generatedVideos?.[0]?.url;

    if (!videoUrlToSend) {
      throw new BadRequestException('No video deliverable found to send. Please generate or attach a video first.');
    }

    // 1. Find or create the 1-on-1 Chat between customer and influencer
    let chat = await this.prisma.chat.findUnique({
      where: {
        customerId_influencerId: {
          customerId: order.customerId,
          influencerId: order.influencerId,
        },
      },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: {
          customerId: order.customerId,
          influencerId: order.influencerId,
        },
      });
    }

    // 2. Draft message in the influencer's persona and identity
    const productName =
      brief.productName ||
      brief.videoDetails?.productName ||
      `${order.influencer.name} Video`;

    const defaultContent =
      `🎬 **Here is your completed video deliverable!**\n\n` +
      `Hey ${order.customer?.name || 'there'}! I've finished generating and refining your video for **${productName}** based on your project requirements.\n\n` +
      `**Deliverable Details:**\n` +
      `- Aspect Ratio: ${brief.videoDetails?.aspectRatio || '9:16 Vertical'}\n` +
      `- Duration: ${brief.videoDetails?.duration || '30s'}\n` +
      (brief.videoDetails?.keyMessage ? `- Key Message: ${brief.videoDetails.keyMessage}\n` : '') +
      `\nYou can watch, preview, and download your finished video directly above. Let me know what you think or if you'd like any adjustments! ✨`;

    const messageContent = params.customMessage?.trim() || defaultContent;

    // 3. Create message from ASSISTANT (the influencer)
    const message = await this.prisma.message.create({
      data: {
        chatId: chat.id,
        role: 'ASSISTANT',
        content: messageContent,
        imageUrl: videoUrlToSend,
      },
    });

    // 4. Update brief history
    const historyItem = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: 'DELIVERED_TO_CLIENT',
      timestamp: new Date().toISOString(),
      videoUrl: videoUrlToSend,
      chatId: chat.id,
      messageId: message.id,
      sentBy: 'ADMIN_AS_INFLUENCER',
      deliveredAs: order.influencer.name,
      clientName: order.customer.name,
      notes: params.notes || 'Sent directly to client chat by Admin using influencer account and persona',
    };
    brief.history = Array.isArray(brief.history) ? [historyItem, ...brief.history] : [historyItem];

    // 5. Update order status to DELIVERED
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(),
        videoUrl: videoUrlToSend,
        videosDelivered: Math.max(order.videosDelivered || 0, 1),
        projectBrief: JSON.stringify(brief),
      },
      include: {
        influencer: true,
        customer: true,
      },
    });

    // 6. Send in-app notification to the client
    try {
      await this.notificationService.create(order.customerId, {
        title: `🎬 ${order.influencer.name} delivered your video!`,
        description: `Your video deliverable for Order #${order.id.slice(0, 8).toUpperCase()} has arrived in your chat.`,
        href: `/dashboard/orders/influencer/${order.influencerId}`,
      });
    } catch (notifErr) {
      console.warn('[OrderService] Could not send customer notification:', notifErr);
    }

    // 7. Emit real-time socket events for chat message and order status
    try {
      if (this.chatGateway?.server) {
        this.chatGateway.server.to(chat.id).emit('newMessage', {
          id: message.id,
          chatId: chat.id,
          role: message.role,
          content: message.content,
          imageUrl: message.imageUrl,
          createdAt: message.createdAt.toISOString(),
          chat: {
            id: chat.id,
            customerId: order.customerId,
            influencerId: order.influencerId,
            influencer: {
              id: order.influencer.id,
              name: order.influencer.name,
              avatar: order.influencer.avatar,
            },
          },
        });

        this.chatGateway.server.emit('orderUpdated', {
          orderId: order.id,
          status: OrderStatus.DELIVERED,
          videoUrl: videoUrlToSend,
          customerId: order.customerId,
          influencerId: order.influencerId,
        });
      }
    } catch (socketErr) {
      console.warn('[OrderService] Could not emit socket events:', socketErr);
    }

    // 8. Update chat memory tasks: mark video production task completed
    try {
      const mem = await this.prisma.chatMemory.findUnique({
        where: { chatId: chat.id },
        select: { details: true },
      });
      if (mem?.details && typeof mem.details === 'object') {
        const details = { ...(mem.details as any) };
        if (Array.isArray(details.tasks)) {
          details.tasks = details.tasks.map((t: any) =>
            t?.task?.toLowerCase()?.includes('video') ? { ...t, status: 'completed', updatedAt: new Date().toISOString() } : t
          );
          await this.prisma.chatMemory.update({
            where: { chatId: chat.id },
            data: { details },
          });
        }
      }
    } catch {}

    return {
      ...updated,
      projectBrief: brief,
    };
  }
}
