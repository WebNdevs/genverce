import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../config/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-06-20' as any,
    });
  }

  async createCheckoutSession(orderId: string, customerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { influencer: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId) {
      throw new BadRequestException('Unauthorized');
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Genverce Video - ${order.influencer.name}`,
              description: `${order.package} package - ${order.videosOrdered} video(s)`,
            },
            unit_amount: Math.round(order.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${this.configService.get('CORS_ORIGIN')}/dashboard/orders?success=true&orderId=${orderId}`,
      cancel_url: `${this.configService.get('CORS_ORIGIN')}/dashboard/orders?canceled=true`,
      metadata: { orderId, customerId },
    });

    // Create payment record
    await this.prisma.payment.create({
      data: {
        orderId,
        customerId,
        stripePaymentId: session.id,
        amount: order.price,
        status: 'PENDING',
      },
    });

    return { sessionId: session.id, url: session.url || '' };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret || '');
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await this.prisma.$transaction([
            this.prisma.payment.update({
              where: { orderId },
              data: { status: 'SUCCEEDED', stripePaymentId: session.payment_intent as string },
            }),
            this.prisma.order.update({
              where: { id: orderId },
              data: { status: 'PAID' },
            }),
          ]);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await this.prisma.payment.findFirst({
          where: { stripePaymentId: intent.id },
        });
        if (payment) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED' },
          });
        }
        break;
      }
    }

    return { received: true };
  }

  async processRefund(orderId: string, customerId: string) {
    // Enforce refund policy
    const totalOrders = await this.prisma.order.count({
      where: { customerId },
    });

    const totalRefunded = await this.prisma.payment.count({
      where: { customerId, status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] } },
    });

    // Max 10 videos worth of refunds ever
    if (totalRefunded >= 10) {
      throw new BadRequestException(
        'Maximum refund limit reached. You have exhausted your refund eligibility.',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order || !order.payment) throw new NotFoundException('Order not found');

    // 0-2 total orders: full refund, no questions
    // 3+ orders: only last 2 videos refundable
    if (totalOrders >= 3) {
      const recentOrders = await this.prisma.order.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { id: true },
      });
      const refundableIds = recentOrders.map((o) => o.id);
      if (!refundableIds.includes(orderId)) {
        throw new BadRequestException(
          'Only your last 2 orders are eligible for refund.',
        );
      }
    }

    if (order.payment.stripePaymentId) {
      await this.stripe.refunds.create({
        payment_intent: order.payment.stripePaymentId,
      });
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: order.payment.id },
        data: { status: 'REFUNDED', refundedAmount: order.payment.amount },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'REFUNDED' },
      }),
    ]);

    return order.payment;
  }
}
