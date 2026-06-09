import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../config/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

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
      website: string;
      targetAudience: string;
      tone: string;
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
}
