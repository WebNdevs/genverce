import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { GeneratePostInput, GeneratedPostModel } from './dto/generate-post.dto';
import { PrismaService } from '../config/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Resolver()
export class AiResolver {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  @Mutation(() => GeneratedPostModel)
  @UseGuards(JwtAuthGuard)
  async generatePost(
    @CurrentUser() user: any,
    @Args('influencerId') influencerId: string,
    @Args('input') input: GeneratePostInput,
  ) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      include: { aiConfig: true },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    if (user.role !== 'ADMIN' && user.role !== 'REVIEWER') {
      const orders = await this.prisma.order.findMany({
        where: {
          customerId: user.id,
          influencerId,
          status: {
            in: [
              'PAID',
              'GENERATING',
              'PENDING_REVIEW',
              'APPROVED',
              'DELIVERED',
            ],
          },
        },
        select: {
          videosOrdered: true,
          videosDelivered: true,
          projectBrief: true,
        },
      });

      if (!orders || orders.length === 0) {
        throw new BadRequestException(
          `You have not hired ${influencer.name} for this project yet. Please hire first before doing any work.`,
        );
      }

      let totalOrderedUnits = 0;
      let totalDeliveredUnits = 0;
      for (const o of orders) {
        let postsDelivered = 0;
        let imagesDelivered = 0;
        if (o.projectBrief) {
          try {
            const brief = typeof o.projectBrief === 'string' ? JSON.parse(o.projectBrief) : o.projectBrief;
            if (Array.isArray(brief?.generatedPosts)) postsDelivered = brief.generatedPosts.length;
            if (Array.isArray(brief?.generatedImages)) imagesDelivered = brief.generatedImages.length;
          } catch {}
        }
        const effectiveDelivered = Math.max(o.videosDelivered || 0, postsDelivered, imagesDelivered);
        const ordered = o.videosOrdered > 0 ? o.videosOrdered : 1;
        const deliveredForOrder = Math.min(ordered, effectiveDelivered);

        totalOrderedUnits += ordered;
        totalDeliveredUnits += deliveredForOrder;
      }

      const remainingUnits = Math.max(0, totalOrderedUnits - totalDeliveredUnits);
      if (remainingUnits <= 0) {
        throw new BadRequestException(
          `The available quantity/credits for this project have been fully used (${totalDeliveredUnits}/${totalOrderedUnits} completed). Please purchase or hire additional quantity for your next work before creating anything further.`,
        );
      }
    }

    // Default brand / product details from user if not explicitly passed
    const brandName = input.brandName || user.brandName || user.company || undefined;
    const productName = input.productName || user.productName || undefined;
    const website = input.website || user.website || undefined;
    const targetAudience = input.targetAudience || user.targetAudience || undefined;
    const tone = input.tone || user.tone || undefined;

    const result = await this.aiService.generatePost({
      influencer: {
        id: influencer.id,
        name: influencer.name,
        systemPrompt: influencer.systemPrompt,
        industries: influencer.industries,
        contentStyle: influencer.contentStyle,
      },
      aiConfig: influencer.aiConfig,
      input: {
        ...input,
        brandName,
        productName,
        website,
        targetAudience,
        tone,
      },
    });

    // Automatically add generated post to the client's order for this influencer
    try {
      const order = await this.prisma.order.findFirst({
        where: {
          customerId: user.id,
          influencerId,
          status: { notIn: ['CANCELLED', 'REFUNDED', 'REJECTED'] as any },
        },
        orderBy: { createdAt: 'desc' },
      });

      const postEntry = {
        id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: result.title || 'Social Post',
        caption: result.caption || result.content || '',
        content: result.content || result.caption || '',
        hashtags: result.hashtags || [],
        imageUrl: result.imageUrl || null,
        imagePrompt: result.imagePrompt || null,
        platforms: input.platforms || [],
        topic: input.topic || '',
        tone: tone || null,
        createdAt: new Date().toISOString(),
        delivered: true,
      };

      if (order) {
        let brief: any = {};
        if (order.projectBrief) {
          if (typeof order.projectBrief === 'string') {
            try {
              brief = JSON.parse(order.projectBrief);
            } catch {
              brief = { raw: order.projectBrief };
            }
          } else if (typeof order.projectBrief === 'object') {
            brief = { ...(order.projectBrief as any) };
          }
        }
        const existingPosts = Array.isArray(brief.generatedPosts) ? [...brief.generatedPosts] : [];
        existingPosts.push(postEntry);
        brief.generatedPosts = existingPosts;
        const newDelivered = existingPosts.length;
        const isComplete = order.videosOrdered > 0 && newDelivered >= order.videosOrdered;

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            projectBrief: JSON.stringify(brief),
            videosDelivered: newDelivered,
            ...(isComplete && order.status !== 'DELIVERED'
              ? { status: 'DELIVERED', deliveredAt: new Date() }
              : {}),
          },
        });
      }
    } catch (err) {
      console.error('[AiResolver] Error saving post to order:', err);
    }

    return result;
  }
}
