import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../config/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { TicketStatus } from '@prisma/client';

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

@Injectable()
export class TicketService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notificationService: NotificationService,
  ) {}

  private isMock() {
    return this.config.get<string>('MOCK_MODE') === 'true';
  }

  async create(customerId: string, orderId: string | undefined, issue: string) {
    if (this.isMock()) {
      return {
        id: `mock-ticket-${Date.now()}`,
        customerId,
        orderId,
        issue,
        status: 'OPEN',
        resolution: null,
        createdAt: new Date(),
        order: orderId
          ? { id: orderId, influencer: { name: 'Mock Influencer' } }
          : null,
      };
    }
    const ticket = await this.prisma.ticket.create({
      data: { customerId, orderId, issue },
      include: { order: { include: { influencer: { include: { portfolio: true } } } } },
    });

    // Notify all admins about the new ticket
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' } });
    const preview = issue.length > 100 ? issue.slice(0, 100) + '…' : issue;
    await Promise.all(
      admins.map((admin) =>
        this.notificationService.create(admin.id, {
          title: 'New support ticket raised',
          description: preview,
          href: '/admin/tickets',
        }),
      ),
    );

    return ticket;
  }

  async findByCustomer(customerId: string) {
    if (this.isMock()) {
      return [
        {
          id: 'mock-ticket-1',
          customerId,
          orderId: undefined,
          issue: 'Sample issue in mock mode',
          status: 'OPEN',
          resolution: null,
          createdAt: new Date(),
          order: null,
        },
      ];
    }
    return this.prisma.ticket.findMany({
      where: { customerId },
      include: { order: { include: { influencer: { include: { portfolio: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(status?: TicketStatus) {
    if (this.isMock()) {
      return [
        {
          id: 'mock-ticket-1',
          customerId: 'mock-customer',
          orderId: 'mock-order',
          issue: 'Custom AI Influencer Request — Mock',
          status: 'OPEN',
          resolution: null,
          createdAt: new Date(),
          order: { id: 'mock-order', influencer: { name: 'Mock Influencer' } },
        },
      ];
    }
    return this.prisma.ticket.findMany({
      where: status ? { status } : undefined,
      include: {
        customer: true,
        order: { include: { influencer: { include: { portfolio: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(id: string, resolution: string) {
    if (this.isMock()) {
      return {
        id,
        customerId: 'mock-customer',
        orderId: 'mock-order',
        issue: 'Mock ticket',
        status: 'RESOLVED',
        resolution,
        createdAt: new Date(),
        order: { id: 'mock-order', influencer: { name: 'Mock Influencer' } },
      };
    }
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'RESOLVED', resolution },
      include: { order: { include: { influencer: { include: { portfolio: true } } } } },
    });

    // Notify the customer that their ticket was resolved
    const preview = resolution.length > 100 ? resolution.slice(0, 100) + '…' : resolution;
    await this.notificationService.create(ticket.customerId, {
      title: 'Your support ticket has been resolved',
      description: preview,
      href: '/dashboard/tickets',
    });

    return updated;
  }

  async updateStatus(id: string, status: TicketStatus) {
    if (this.isMock()) {
      return {
        id,
        customerId: 'mock-customer',
        orderId: 'mock-order',
        issue: 'Mock ticket',
        status,
        resolution: null,
        reopenNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: { id: 'mock-order', influencer: { name: 'Mock Influencer' } },
      };
    }
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status },
      include: {
        customer: true,
        order: { include: { influencer: { include: { portfolio: true } } } },
      },
    });

    // Notify the customer about the status change
    await this.notificationService.create(updated.customerId, {
      title: `Your support ticket status changed to ${STATUS_LABEL[status] ?? status}`,
      href: '/dashboard/tickets',
    });

    return updated;
  }

  async reopen(id: string, customerId: string, note: string) {
    if (this.isMock()) {
      return {
        id,
        customerId,
        orderId: null,
        issue: 'Mock ticket',
        status: 'OPEN',
        resolution: null,
        reopenNote: note,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: null,
      };
    }
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.customerId !== customerId)
      throw new BadRequestException('You can only reopen your own tickets');
    if (ticket.status !== 'RESOLVED')
      throw new BadRequestException('Only resolved tickets can be reopened');

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'OPEN', resolution: null, reopenNote: note },
      include: { order: { include: { influencer: { include: { portfolio: true } } } } },
    });

    // Notify all admins that a ticket was reopened
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' } });
    const preview = note.length > 100 ? note.slice(0, 100) + '…' : note;
    await Promise.all(
      admins.map((admin) =>
        this.notificationService.create(admin.id, {
          title: 'A support ticket has been reopened',
          description: preview,
          href: '/admin/tickets',
        }),
      ),
    );

    return updated;
  }
}
