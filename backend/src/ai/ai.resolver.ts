import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { GeneratePostInput, GeneratedPostModel } from './dto/generate-post.dto';
import {
  StandaloneVideoModel,
  AdminGenerateStandaloneVideoInput,
} from './dto/standalone-video.dto';
import { PrismaService } from '../config/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

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

  @Mutation(() => StandaloneVideoModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminGenerateStandaloneVideo(
    @Args('prompt') prompt: string,
    @Args('title', { nullable: true }) title?: string,
    @Args('duration', { nullable: true }) duration?: string,
    @Args('aspectRatio', { nullable: true }) aspectRatio?: string,
    @Args('videoProvider', { nullable: true }) videoProvider?: string,
    @Args('videoModel', { nullable: true }) videoModel?: string,
  ): Promise<StandaloneVideoModel> {
    const cleanPrompt = prompt?.trim();
    if (!cleanPrompt) {
      throw new BadRequestException('Video prompt is required');
    }

    const resolvedDuration = duration?.trim() || '15s';
    const resolvedAspect = aspectRatio?.trim() || '16:9';

    // Validate duration based on selected video provider/model API limits
    const match = resolvedDuration.match(/^(\d+)/);
    const prov = (videoProvider || '').toLowerCase().trim();
    if (match) {
      const secs = parseInt(match[1], 10);
      if (prov === 'runway' && (secs < 5 || secs > 16)) {
        throw new BadRequestException('RunwayML (Gen-3) video duration must be between 5s and 16s.');
      } else if (prov === 'luma' && (secs < 5 || secs > 20)) {
        throw new BadRequestException('Luma Dream Machine video duration must be between 5s and 20s.');
      } else if (prov === 'sora' && (secs < 5 || secs > 60)) {
        throw new BadRequestException('OpenAI Sora video duration must be between 5s and 60s.');
      } else if (prov === 'kling' && (secs < 5 || secs > 30)) {
        throw new BadRequestException('Kling AI video duration must be between 5s and 30s.');
      } else if (prov === 'pika' && (secs < 3 || secs > 15)) {
        throw new BadRequestException('Pika video duration must be between 3s and 15s.');
      } else if (prov && !['runway', 'luma', 'sora', 'kling', 'pika'].includes(prov)) {
        if (secs < 1 || secs > 120) {
          throw new BadRequestException(`Video duration for ${videoProvider || 'custom engine'} must be between 1s and 120s.`);
        }
      }
    }

    // Validate aspect ratio based on selected video provider/model API limits
    const standardAspects = ['16:9', '9:16', '1:1'];
    if (['runway', 'luma', 'kling', 'pika'].includes(prov)) {
      if (!standardAspects.includes(resolvedAspect)) {
        throw new BadRequestException(
          `${videoProvider || 'The selected provider'} only supports fixed standard aspect ratios (16:9, 9:16, 1:1). Custom aspect ratios are not supported.`
        );
      }
    } else if (prov === 'haiper') {
      if (!['16:9', '9:16'].includes(resolvedAspect)) {
        throw new BadRequestException(
          'Haiper AI only supports 16:9 Landscape and 9:16 Portrait aspect ratios.'
        );
      }
    } else {
      // Sora, Custom engine, or dynamic custom engine: validate ratio limits
      const ratioParts = resolvedAspect.split(':');
      if (ratioParts.length === 2) {
        const w = parseFloat(ratioParts[0]);
        const h = parseFloat(ratioParts[1]);
        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
          throw new BadRequestException('Invalid custom aspect ratio. Width and height must be positive numbers.');
        }
        const ratio = w / h;
        if (prov === 'sora') {
          if (ratio < 0.33 || ratio > 3.0) {
            throw new BadRequestException(
              `OpenAI Sora custom aspect ratio must be between 1:3 (0.33) and 3:1 (3.00). Provided ratio: ${resolvedAspect} (${ratio.toFixed(2)}).`
            );
          }
        } else {
          // Custom video engines
          if (ratio < 0.25 || ratio > 4.0) {
            throw new BadRequestException(
              `Custom engine aspect ratio must be between 1:4 (0.25) and 4:1 (4.00). Provided ratio: ${resolvedAspect} (${ratio.toFixed(2)}).`
            );
          }
        }
      }
    }

    // 1. Generate video via AiService
    const genResult = await this.aiService.generateVideo({
      prompt: cleanPrompt,
      duration: resolvedDuration,
      aspectRatio: resolvedAspect,
      customVideo: {
        videoProvider,
        videoModel,
      },
    });

    // 2. Derive title if not provided
    const words = cleanPrompt.replace(/[#*`_~]/g, '').trim().split(/\s+/);
    const derivedTitle =
      title?.trim() ||
      (words.length > 6 ? words.slice(0, 6).join(' ') + '…' : cleanPrompt);

    // 3. Persist in MySQL standalone_videos table
    const id = `sv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date();
    const metadata = {
      generatedDirectly: true,
      provider: genResult.provider,
      model: genResult.model,
      duration: resolvedDuration,
      aspectRatio: resolvedAspect,
    };

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO standalone_videos (id, title, prompt, videoUrl, thumbnailUrl, provider, model, duration, aspectRatio, status, metadata, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      derivedTitle,
      prompt,
      genResult.url,
      null,
      genResult.provider,
      genResult.model,
      resolvedDuration,
      resolvedAspect,
      'COMPLETED',
      JSON.stringify(metadata),
      now,
      now,
    );

    return {
      id,
      title: derivedTitle,
      prompt,
      videoUrl: genResult.url,
      thumbnailUrl: undefined,
      provider: genResult.provider,
      model: genResult.model,
      duration: resolvedDuration,
      aspectRatio: resolvedAspect,
      status: 'COMPLETED',
      metadata,
      createdAt: now,
      updatedAt: now,
    };
  }

  @Query(() => [StandaloneVideoModel])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminGetStandaloneVideos(
    @Args('search', { nullable: true }) search?: string,
    @Args('status', { nullable: true }) status?: string,
  ): Promise<StandaloneVideoModel[]> {
    let sql = 'SELECT * FROM standalone_videos WHERE 1=1';
    const params: any[] = [];
    if (search && search.trim()) {
      sql += ' AND (title LIKE ? OR prompt LIKE ? OR provider LIKE ? OR model LIKE ?)';
      const q = `%${search.trim()}%`;
      params.push(q, q, q, q);
    }
    if (status && status.trim() && status !== 'ALL') {
      sql += ' AND status = ?';
      params.push(status.trim());
    }
    sql += ' ORDER BY createdAt DESC';

    const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
    return rows.map((r) => {
      let meta: any = null;
      if (r.metadata) {
        try {
          meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
        } catch {
          meta = null;
        }
      }
      return {
        id: r.id,
        title: r.title,
        prompt: r.prompt,
        videoUrl: r.videoUrl,
        thumbnailUrl: r.thumbnailUrl || undefined,
        provider: r.provider || undefined,
        model: r.model || undefined,
        duration: r.duration || undefined,
        aspectRatio: r.aspectRatio || undefined,
        status: r.status || 'COMPLETED',
        metadata: meta,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      };
    });
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminDeleteStandaloneVideo(
    @Args('id') id: string,
  ): Promise<boolean> {
    await this.prisma.$executeRawUnsafe('DELETE FROM standalone_videos WHERE id = ?', id);
    return true;
  }
}

