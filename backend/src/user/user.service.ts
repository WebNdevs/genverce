import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../config/prisma.service';
import { OrderStatus, Role } from '@prisma/client';
import { ChatService } from '../chat/chat.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
    private notificationService: NotificationService,
  ) {}

  private mockOverrides: Record<string, Partial<any>> = {};

  private isMock() {
    return this.config.get<string>('MOCK_MODE') === 'true';
  }

  private mockUsers() {
    const now = new Date();
    return [
      { id: 'mock-admin', name: 'Genverce Admin', email: 'admin@genverce.ai', role: 'ADMIN', accountType: 'INDIVIDUAL', isActive: true, isOnboarded: true, createdAt: now, avatar: null, company: null },
      { id: 'mock-reviewer', name: 'Quality Reviewer', email: 'reviewer@genverce.ai', role: 'REVIEWER', accountType: 'INDIVIDUAL', isActive: true, isOnboarded: true, createdAt: now, avatar: null, company: null },
      { id: 'mock-customer', name: 'Demo Customer', email: 'demo@genverce.ai', role: 'CUSTOMER', accountType: 'INDIVIDUAL', isActive: true, isOnboarded: true, createdAt: now, avatar: null, company: null },
    ];
  }

  async findById(id: string) {
    if (this.isMock()) {
      const base = this.mockUsers().find((x) => x.id === id);
      const override = base ? this.mockOverrides[id] : undefined;
      const u = base && override ? { ...base, ...override } : base;
      if (!u) throw new NotFoundException('User not found');
      return u as any;
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string) {
    if (this.isMock()) {
      const base = this.mockUsers().find((x) => x.email === email) as any;
      if (!base) return base;
      const override = this.mockOverrides[base.id];
      return override ? { ...base, ...override } : base;
    }
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findAll(role?: Role) {
    if (this.isMock()) {
      const list = this.mockUsers().map((u) =>
        this.mockOverrides[u.id] ? { ...u, ...this.mockOverrides[u.id] } : u,
      );
      return role ? list.filter((u) => u.role === role) : list;
    }
    return this.prisma.user.findMany({
      where: { deletedAt: null, ...(role ? { role } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProfile(id: string, data: { name?: string; username?: string; avatar?: string; company?: string }) {
    if (this.isMock()) {
      const u = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), ...data };
      return { ...u, ...this.mockOverrides[id] };
    }
    // Check username uniqueness if provided
    if (data.username) {
      const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Username already taken');
      }
    }
    return this.prisma.user.update({ where: { id }, data });
  }

  async completeOnboarding(
    id: string,
    data: {
      brandName: string;
      productName?: string;
      website?: string;
      targetAudience?: string;
      tone?: string;
      industry?: string;
      goal?: string;
      platforms?: string[];
      contentTypes?: string[];
      requestedCustomInfluencer?: boolean;
    },
  ) {
    if (this.isMock()) {
      const u = await this.findById(id);
      this.mockOverrides[id] = {
        ...(this.mockOverrides[id] || {}),
        ...data,
        isOnboarded: true,
      };
      return { ...u, ...this.mockOverrides[id] };
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        isOnboarded: true,
      },
    });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { password: hashed } });
    return true;
  }

  async adminUpdateUser(id: string, data: { name?: string; email?: string; role?: Role; company?: string }) {
    if (this.isMock()) {
      const u = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), ...data };
      return { ...u, ...this.mockOverrides[id] };
    }
    return this.prisma.user.update({ where: { id }, data });
  }

  async deactivate(id: string) {
    if (this.isMock()) {
      const u = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), isActive: false };
      return { ...u, ...this.mockOverrides[id] };
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(id: string) {
    if (this.isMock()) {
      const u = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), isActive: true };
      return { ...u, ...this.mockOverrides[id] };
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async softDelete(id: string) {
    if (this.isMock()) {
      const u = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), deletedAt: new Date() };
      return { ...u, ...this.mockOverrides[id] };
    }
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    if (this.isMock()) {
      const u = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), deletedAt: null };
      return { ...u, ...this.mockOverrides[id] };
    }
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async findTrashed() {
    if (this.isMock()) {
      return this.mockUsers()
        .map((u) => (this.mockOverrides[u.id] ? { ...u, ...this.mockOverrides[u.id] } : u))
        .filter((u: any) => u.deletedAt != null);
    }
    return this.prisma.user.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async getUserStats(userId: string) {
    if (this.isMock()) {
      return {
        totalOrders: 3,
        totalVideosGenerated: 12,
        totalInfluencersHired: 2,
      };
    }
    const orders = await this.prisma.order.findMany({
      where: { customerId: userId },
      select: { influencerId: true, status: true, videosDelivered: true },
    });

    const totalOrders = orders.length;
    const totalVideosGenerated = orders.reduce(
      (sum, o) => sum + (o.status === 'DELIVERED' ? (o.videosDelivered ?? 0) : 0),
      0,
    );
    const totalInfluencersHired = new Set(orders.map((o) => o.influencerId)).size;

    return { totalOrders, totalVideosGenerated, totalInfluencersHired };
  }

  async adminHireAgentForUser(userId: string, influencerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true, name: true, avatar: true, serviceType: true, isActive: true },
    });
    if (!influencer) throw new NotFoundException('Influencer not found');

    const emailPrefix = user.email.split('@')[0].toLowerCase();
    const relatedUsers = await this.prisma.user.findMany({
      where: {
        OR: [
          { id: userId },
          { email: user.email },
          { email: { startsWith: `${emailPrefix}@genver` } },
        ],
      },
      select: { id: true, name: true, email: true },
    });

    let primaryOrderId: string | undefined;
    let wasAlreadyHired = false;

    for (const targetUser of relatedUsers) {
      const activeOrder = await this.prisma.order.findFirst({
        where: {
          customerId: targetUser.id,
          influencerId,
          status: {
            in: [
              OrderStatus.PAID,
              OrderStatus.GENERATING,
              OrderStatus.PENDING_REVIEW,
              OrderStatus.APPROVED,
              OrderStatus.DELIVERED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (activeOrder) {
        if (targetUser.id === userId) {
          primaryOrderId = activeOrder.id;
          wasAlreadyHired = true;
        }
        try {
          await this.chatService.findOrCreateChat(targetUser.id, influencerId);
        } catch {}
        continue;
      }

      const pendingOrder = await this.prisma.order.findFirst({
        where: {
          customerId: targetUser.id,
          influencerId,
          status: OrderStatus.PENDING_PAYMENT,
        },
        orderBy: { createdAt: 'desc' },
      });

      let currentOrderId: string;
      if (pendingOrder) {
        const updated = await this.prisma.order.update({
          where: { id: pendingOrder.id },
          data: {
            status: OrderStatus.PAID,
            price: 0,
            aiDisclosure: true,
            projectBrief:
              typeof pendingOrder.projectBrief === 'string' && pendingOrder.projectBrief.length > 5
                ? pendingOrder.projectBrief
                : JSON.stringify({
                    productName: `${influencer.name} Collaboration`,
                    notes: 'Assigned directly by Super Admin. Full hiring access granted without payment.',
                  }),
          },
        });
        currentOrderId = updated.id;
      } else {
        const created = await this.prisma.order.create({
          data: {
            customerId: targetUser.id,
            influencerId,
            package: 'SINGLE' as any,
            deliveryType: 'INSTANT' as any,
            status: OrderStatus.PAID,
            price: 0,
            videosOrdered: 10,
            videosDelivered: 0,
            aiDisclosure: true,
            projectBrief: JSON.stringify({
              productName: `${influencer.name} Collaboration`,
              notes: 'Assigned directly by Super Admin. Full hiring access granted without payment.',
            }),
          },
        });
        currentOrderId = created.id;
      }

      if (targetUser.id === userId || !primaryOrderId) {
        primaryOrderId = currentOrderId;
      }

      // Initialize Chat and add welcome message
      try {
        const chat = await this.chatService.findOrCreateChat(targetUser.id, influencerId);
        await this.chatService.addMessage(
          chat.id,
          'ASSISTANT',
          `Hi ${targetUser.name || 'there'}! I’m ${influencer.name}. Your account has been granted direct collaboration access by the Super Admin. What would you like to create together?`,
        );
      } catch (chatErr) {
        console.error('[UserService] Could not initialize chat for hired influencer:', chatErr);
      }

      // Dispatch real-time notification
      try {
        await this.notificationService.create(targetUser.id, {
          title: `${influencer.name} is now hired & active!`,
          description: `Super Admin has assigned ${influencer.name} to your account. You can start collaborating immediately.`,
          href: `/chat/${influencer.id}`,
        });
      } catch (notifErr) {
        console.error('[UserService] Could not send hire notification:', notifErr);
      }
    }

    return {
      success: true,
      message: wasAlreadyHired
        ? `${influencer.name} is already hired and active for ${user.name || user.email}.`
        : `${influencer.name} was successfully hired and activated for ${user.name || user.email}!`,
      orderId: primaryOrderId,
      userId: user.id,
      influencerId: influencer.id,
      influencerName: influencer.name,
      userName: user.name || user.email,
      alreadyHired: wasAlreadyHired,
    };
  }

  async getUserHiredAgents(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        customerId: userId,
        status: {
          in: [
            OrderStatus.PAID,
            OrderStatus.GENERATING,
            OrderStatus.PENDING_REVIEW,
            OrderStatus.APPROVED,
            OrderStatus.DELIVERED,
          ],
        },
      },
      include: {
        influencer: {
          select: { id: true, name: true, avatar: true, serviceType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const seen = new Set<string>();
    const results: Array<{
      influencerId: string;
      influencerName: string;
      avatar?: string;
      serviceType?: string;
      orderId: string;
      status: string;
      createdAt: Date;
    }> = [];

    for (const o of orders) {
      if (!o.influencer || seen.has(o.influencerId)) continue;
      seen.add(o.influencerId);
      results.push({
        influencerId: o.influencer.id,
        influencerName: o.influencer.name,
        avatar: o.influencer.avatar || undefined,
        serviceType: o.influencer.serviceType,
        orderId: o.id,
        status: o.status,
        createdAt: o.createdAt,
      });
    }

    return results;
  }

  async getMyHiredAgentsOverview(userId: string) {
    // 1. Resolve user and any alias accounts
    let customerIds = [userId];
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });
      if (user?.email) {
        const prefix = user.email.split('@')[0].toLowerCase();
        const related = await this.prisma.user.findMany({
          where: {
            OR: [
              { id: userId },
              { email: user.email },
              { email: { startsWith: `${prefix}@genver` } },
            ],
          },
          select: { id: true },
        });
        customerIds = related.map((r) => r.id);
      }
    } catch {}

    // 2. Fetch all valid orders for this user
    const orders = await this.prisma.order.findMany({
      where: {
        customerId: { in: customerIds },
        status: {
          notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.REJECTED],
        },
      },
      include: {
        influencer: {
          select: { id: true, name: true, avatar: true, serviceType: true, bio: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Group by influencerId
    const agentMap = new Map<string, typeof orders>();
    for (const order of orders) {
      if (!order.influencer) continue;
      const list = agentMap.get(order.influencerId) || [];
      list.push(order);
      agentMap.set(order.influencerId, list);
    }

    // 4. Also fetch chats to provide direct chat deep-links
    const chats = await this.prisma.chat.findMany({
      where: {
        customerId: { in: customerIds },
      },
      select: { id: true, influencerId: true },
    });
    const chatByInfluencer = new Map<string, string>();
    for (const chat of chats) {
      if (chat.influencerId && !chatByInfluencer.has(chat.influencerId)) {
        chatByInfluencer.set(chat.influencerId, chat.id);
      }
    }

    const agentsOverview: Array<{
      influencerId: string;
      influencerName: string;
      avatar?: string;
      serviceType?: string;
      bio?: string;
      orderId: string;
      status: string;
      totalOrders: number;
      completedOrders: number;
      pendingOrders: number;
      remainingOrders: number;
      totalOrderedUnits: number;
      totalDeliveredUnits: number;
      remainingUnits: number;
      chatId?: string;
      latestOrderDate?: Date;
    }> = [];

    let overallRemainingOrders = 0;
    let overallCompletedOrders = 0;
    let overallPendingOrders = 0;

    for (const [infId, agentOrders] of agentMap.entries()) {
      const firstOrder = agentOrders[0];
      const influencer = firstOrder.influencer;

      let completedOrdersCount = 0;
      let pendingOrdersCount = 0;
      let totalOrderedUnits = 0;
      let totalDeliveredUnits = 0;

      for (const o of agentOrders) {
        let postsDelivered = 0;
        if (o.projectBrief) {
          try {
            const brief = typeof o.projectBrief === 'string' ? JSON.parse(o.projectBrief) : o.projectBrief;
            if (Array.isArray(brief?.generatedPosts)) {
              postsDelivered = brief.generatedPosts.length;
            } else if (Array.isArray(brief?.generatedImages)) {
              postsDelivered = brief.generatedImages.length;
            }
          } catch {}
        }
        const effectiveDelivered = Math.max(o.videosDelivered || 0, postsDelivered);
        const ordered = o.videosOrdered > 0 ? o.videosOrdered : 1;
        const deliveredForOrder = Math.min(ordered, effectiveDelivered);

        totalOrderedUnits += ordered;
        totalDeliveredUnits += deliveredForOrder;

        if (o.status === OrderStatus.DELIVERED || deliveredForOrder >= ordered) {
          completedOrdersCount++;
        } else if (
          [OrderStatus.PAID, OrderStatus.GENERATING, OrderStatus.PENDING_REVIEW, OrderStatus.APPROVED].includes(o.status as any)
        ) {
          pendingOrdersCount++;
        }
      }

      const remainingUnits = Math.max(0, totalOrderedUnits - totalDeliveredUnits);
      const remainingOrdersCount = Math.max(0, agentOrders.length - completedOrdersCount);

      overallRemainingOrders += remainingUnits;
      overallCompletedOrders += completedOrdersCount;
      overallPendingOrders += pendingOrdersCount;

      const isAgentActive = remainingUnits > 0 || pendingOrdersCount > 0 || firstOrder.status !== OrderStatus.DELIVERED;

      agentsOverview.push({
        influencerId: influencer.id,
        influencerName: influencer.name,
        avatar: influencer.avatar || undefined,
        serviceType: influencer.serviceType,
        bio: influencer.bio || undefined,
        orderId: firstOrder.id,
        status: isAgentActive ? 'ACTIVE' : 'COMPLETED',
        totalOrders: agentOrders.length,
        completedOrders: completedOrdersCount,
        pendingOrders: pendingOrdersCount,
        remainingOrders: remainingUnits > 0 ? remainingUnits : remainingOrdersCount,
        totalOrderedUnits,
        totalDeliveredUnits,
        remainingUnits,
        chatId: chatByInfluencer.get(influencer.id) || undefined,
        latestOrderDate: firstOrder.createdAt,
      });
    }

    agentsOverview.sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
      return +new Date(b.latestOrderDate || 0) - +new Date(a.latestOrderDate || 0);
    });

    const activeAgentsCount = agentsOverview.filter((a) => a.status === 'ACTIVE').length;

    return {
      totalAgents: agentsOverview.length,
      activeAgents: activeAgentsCount,
      totalRemainingOrders: overallRemainingOrders,
      totalCompletedOrders: overallCompletedOrders,
      totalPendingOrders: overallPendingOrders,
      agents: agentsOverview,
    };
  }
}
