import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  async create(
    customerId: string,
    orderId: string,
    rating: number,
    comment?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId) {
      throw new BadRequestException('You can only review your own orders');
    }
    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('Order must be delivered before reviewing');
    }

    const existing = await this.prisma.review.findUnique({
      where: { orderId },
    });

    if (existing) {
      throw new BadRequestException('Order already reviewed');
    }

    const review = await this.prisma.review.create({
      data: {
        orderId,
        customerId,
        influencerId: order.influencerId,
        rating,
        comment,
      },
      include: { customer: true },
    });

    // Update influencer rating
    const stats = await this.prisma.review.aggregate({
      where: { influencerId: order.influencerId },
      _avg: { rating: true },
      _count: true,
    });

    await this.prisma.influencer.update({
      where: { id: order.influencerId },
      data: {
        rating: stats._avg.rating || 0,
        totalReviews: stats._count,
      },
    });

    return review;
  }

  async findByInfluencer(influencerId: string) {
    return this.prisma.review.findMany({
      where: { influencerId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
