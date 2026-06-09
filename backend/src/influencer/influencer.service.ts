import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../config/prisma.service';
import { CreateInfluencerInput } from './dto/create-influencer.dto';
import { FilterInfluencerInput } from './dto/filter-influencer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InfluencerService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  private mockOverrides: Record<string, Partial<any>> = {};

  private isMock() {
    return this.config.get<string>('MOCK_MODE') === 'true';
  }

  private mockInfluencers() {
    const now = new Date();
    const base = [
      {
        id: '1',
        name: 'Nova Sterling',
        bio:
          'AI-powered tech influencer specializing in SaaS, fintech, and developer tools. Known for sharp, data-driven content that converts.',
        avatar: '',
        coverImage: '',
        industries: ['Technology', 'SaaS', 'Fintech'],
        contentStyle: 'Professional & Data-Driven',
        languages: ['English', 'Spanish'],
        rating: 4.9,
        totalProjects: 347,
        totalReviews: 289,
        isActive: true,
        hourlyRate: 120,
        portfolio: [],
        packages: [],
        createdAt: now,
      },
      {
        id: '2',
        name: 'Aria Bloom',
        bio:
          'Lifestyle and beauty AI influencer with a warm, relatable personality for beauty brands and wellness products.',
        avatar: '',
        coverImage: '',
        industries: ['Beauty', 'Lifestyle', 'Wellness'],
        contentStyle: 'Warm & Relatable',
        languages: ['English', 'French'],
        rating: 4.8,
        totalProjects: 512,
        totalReviews: 445,
        isActive: true,
        hourlyRate: 90,
        portfolio: [],
        packages: [],
        createdAt: now,
      },
      {
        id: '3',
        name: 'Kai Vortex',
        bio: 'Gaming and esports AI persona delivering high-energy promos and streams.',
        avatar: '',
        coverImage: '',
        industries: ['Gaming', 'Entertainment'],
        contentStyle: 'Dynamic & High-Energy',
        languages: ['English', 'Japanese'],
        rating: 4.7,
        totalProjects: 210,
        totalReviews: 180,
        isActive: true,
        hourlyRate: 75,
        portfolio: [],
        packages: [],
        createdAt: now,
      },
      {
        id: '4',
        name: 'Luna Verde',
        bio: 'Sustainability and eco-tech AI influencer focused on green products and clean energy.',
        avatar: '',
        coverImage: '',
        industries: ['Sustainability', 'Technology'],
        contentStyle: 'Educational & Inspirational',
        languages: ['English', 'Spanish'],
        rating: 4.6,
        totalProjects: 160,
        totalReviews: 130,
        isActive: true,
        hourlyRate: 85,
        portfolio: [],
        packages: [],
        createdAt: now,
      },
      {
        id: '5',
        name: 'Milo Spark',
        bio: 'Consumer electronics explainer with crisp demos and comparisons.',
        avatar: '',
        coverImage: '',
        industries: ['Technology', 'Consumer Electronics'],
        contentStyle: 'Clear & Practical',
        languages: ['English'],
        rating: 4.5,
        totalProjects: 300,
        totalReviews: 260,
        isActive: true,
        hourlyRate: 95,
        portfolio: [],
        packages: [],
        createdAt: now,
      },
      {
        id: '6',
        name: 'Eve Harbor',
        bio: 'Fintech and personal finance storyteller, making complex topics simple.',
        avatar: '',
        coverImage: '',
        industries: ['Fintech', 'Education'],
        contentStyle: 'Story-driven & Trustworthy',
        languages: ['English'],
        rating: 4.6,
        totalProjects: 220,
        totalReviews: 175,
        isActive: true,
        hourlyRate: 110,
        portfolio: [],
        packages: [],
        createdAt: now,
      },
    ];
    return base;
  }

  async findAll(filter?: FilterInfluencerInput) {
    if (this.isMock()) {
      let list = this.mockInfluencers().map((i) =>
        this.mockOverrides[i.id] ? { ...i, ...this.mockOverrides[i.id] } : i,
      );
      if (!filter?.includeTrashed && !filter?.onlyTrashed) {
        list = list.filter((i) => !(i as any).deletedAt);
      } else if (filter?.onlyTrashed) {
        list = list.filter((i) => !!(i as any).deletedAt);
      }
      if (!filter?.includeInactive) {
        list = list.filter((i) => i.isActive);
      }
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        list = list.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.bio.toLowerCase().includes(q) ||
            i.contentStyle.toLowerCase().includes(q),
        );
      }
      if (filter?.industry) {
        list = list.filter((i) => i.industries.includes(filter.industry as any));
      }
      if (filter?.contentStyle) {
        const q = filter.contentStyle.toLowerCase();
        list = list.filter((i) => i.contentStyle.toLowerCase().includes(q));
      }
      if (filter?.language) {
        list = list.filter((i) => i.languages.includes(filter.language as any));
      }
      if (filter?.minRating) {
        list = list.filter((i) => i.rating >= (filter.minRating as number));
      }
      if (filter?.maxPrice) {
        list = list.filter((i) => (i.hourlyRate || 0) <= (filter.maxPrice as number));
      }
      const page = filter?.page || 1;
      const limit = filter?.limit || 12;
      const total = list.length;
      const start = (page - 1) * limit;
      const subset = list.slice(start, start + limit);
      return { influencers: subset, total, page, totalPages: Math.ceil(total / limit) };
    }
    const page = filter?.page || 1;
    const limit = filter?.limit || 12;
    const skip = (page - 1) * limit;

    const where: Prisma.InfluencerWhereInput = {};
    
    if (filter?.onlyTrashed) {
      where.deletedAt = { not: null };
    } else if (!filter?.includeTrashed) {
      where.deletedAt = null;
    }

    if (!filter?.includeInactive) {
      where.isActive = true;
    }

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search } },
        { bio: { contains: filter.search } },
        { contentStyle: { contains: filter.search } },
      ];
    }

    // industry filter handled after fetch due to MySQL JSON storage

    if (filter?.contentStyle) {
      where.contentStyle = { contains: filter.contentStyle };
    }

    // language filter handled after fetch due to MySQL JSON storage

    if (filter?.minRating) {
      where.rating = { gte: filter.minRating };
    }

    if (filter?.maxPrice) {
      where.hourlyRate = { lte: filter.maxPrice };
    }

    const all = await this.prisma.influencer.findMany({
      where,
      include: {
        portfolio: true,
        packages: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
      orderBy: { rating: 'desc' },
    });
    let filtered = all;
    if (filter?.industry) {
      filtered = filtered.filter((i: any) => Array.isArray(i.industries) && i.industries.includes(filter.industry));
    }
    if (filter?.language) {
      filtered = filtered.filter((i: any) => Array.isArray(i.languages) && i.languages.includes(filter.language));
    }
    const total = filtered.length;
    const subset = filtered.slice(skip, skip + limit);

    return { influencers: subset, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    if (this.isMock()) {
      const base = this.mockInfluencers().find((i) => i.id === id);
      if (!base) throw new NotFoundException('Influencer not found');
      const override = this.mockOverrides[id];
      return override ? { ...base, ...override } : base;
    }
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
      include: {
        portfolio: { orderBy: { createdAt: 'desc' } },
        packages: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        aiConfig: true,
        reviews: {
          include: { customer: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!influencer) throw new NotFoundException('Influencer not found');
    return influencer;
  }

  async create(input: CreateInfluencerInput) {
    if (this.isMock()) {
      const now = new Date();
      const created = {
        id: `mock-inf-${Date.now()}`,
        name: input.name,
        bio: input.bio,
        avatar: input.avatar || '',
        coverImage: input.coverImage,
        locationCity: input.locationCity,
        locationState: input.locationState,
        locationCountry: input.locationCountry,
        locationAddress: input.locationAddress,
        locationPincode: input.locationPincode,
        industries: input.industries,
        contentStyle: input.contentStyle,
        languages: input.languages,
        rating: 4.5,
        totalProjects: 0,
        totalReviews: 0,
        isActive: true,
        hourlyRate: input.hourlyRate,
        portfolio: [],
        packages: [],
        createdAt: now,
      };
      this.mockOverrides[created.id] = { ...created };
      return created as any;
    }
    return this.prisma.influencer.create({
      data: {
        name: input.name,
        bio: input.bio,
        avatar: input.avatar,
        coverImage: input.coverImage,
        locationCity: input.locationCity,
        locationState: input.locationState,
        locationCountry: input.locationCountry,
        locationAddress: input.locationAddress,
        locationPincode: input.locationPincode,
        industries: input.industries as any,
        contentStyle: input.contentStyle,
        languages: input.languages as any,
        hourlyRate: input.hourlyRate,
        systemPrompt: input.systemPrompt,
        voiceId: input.voiceId,
        topic: input.topic,
        outOfTopicMessage: input.outOfTopicMessage,
        serviceType: input.serviceType,
        ...(input.aiConfig ? { aiConfig: { create: input.aiConfig } } : {}),
      },
      include: {
        portfolio: true,
        aiConfig: true,
        packages: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  async update(id: string, data: Partial<CreateInfluencerInput>) {
    if (this.isMock()) {
      const existing = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), ...data };
      return { ...existing, ...this.mockOverrides[id] };
    }
    const { aiConfig, serviceType, ...rest } = data;
    const aiConfigData = aiConfig ? { ...aiConfig } : undefined;
    return this.prisma.influencer.update({
      where: { id },
      data: {
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.bio !== undefined && { bio: rest.bio }),
        ...(rest.avatar !== undefined && { avatar: rest.avatar }),
        ...(rest.coverImage !== undefined && { coverImage: rest.coverImage }),
        ...(rest.locationCity !== undefined && { locationCity: rest.locationCity }),
        ...(rest.locationState !== undefined && { locationState: rest.locationState }),
        ...(rest.locationCountry !== undefined && { locationCountry: rest.locationCountry }),
        ...(rest.locationAddress !== undefined && { locationAddress: rest.locationAddress }),
        ...(rest.locationPincode !== undefined && { locationPincode: rest.locationPincode }),
        ...(rest.industries !== undefined && { industries: rest.industries as any }),
        ...(rest.contentStyle !== undefined && { contentStyle: rest.contentStyle }),
        ...(rest.languages !== undefined && { languages: rest.languages as any }),
        ...(rest.hourlyRate !== undefined && { hourlyRate: rest.hourlyRate }),
        ...(rest.systemPrompt !== undefined && { systemPrompt: rest.systemPrompt }),
        ...(rest.topic !== undefined && { topic: rest.topic }),
        ...(rest.outOfTopicMessage !== undefined && { outOfTopicMessage: rest.outOfTopicMessage }),
        ...(rest.voiceId !== undefined && { voiceId: rest.voiceId }),
        ...(serviceType !== undefined && { serviceType }),
        ...(aiConfigData
          ? { aiConfig: { upsert: { create: aiConfigData, update: aiConfigData } } }
          : {}),
      },
      include: {
        portfolio: true,
        aiConfig: true,
        packages: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  async deactivate(id: string) {
    if (this.isMock()) {
      const existing = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), isActive: false };
      return { ...existing, ...this.mockOverrides[id] };
    }
    return this.prisma.influencer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(id: string) {
    if (this.isMock()) {
      const existing = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), isActive: true };
      return { ...existing, ...this.mockOverrides[id] };
    }
    return this.prisma.influencer.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async softDelete(id: string) {
    if (this.isMock()) {
      const existing = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), deletedAt: new Date() };
      return { ...existing, ...this.mockOverrides[id] };
    }
    return this.prisma.influencer.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async restore(id: string) {
    if (this.isMock()) {
      const existing = await this.findById(id);
      this.mockOverrides[id] = { ...(this.mockOverrides[id] || {}), deletedAt: null };
      return { ...existing, ...this.mockOverrides[id] };
    }
    return this.prisma.influencer.update({
      where: { id },
      data: { deletedAt: null, isActive: true },
    });
  }

  async addPortfolioItem(
    influencerId: string,
    data: { videoUrl: string; thumbnailUrl: string; title: string; description?: string },
  ) {
    if (this.isMock()) {
      return { id: `mock-port-${Date.now()}`, influencerId, ...data, createdAt: new Date() };
    }
    return this.prisma.influencerPortfolio.create({
      data: { ...data, influencerId },
    });
  }

  async getTopInfluencers(limit: number = 6) {
    if (this.isMock()) {
      const list = this.mockInfluencers().map((i) =>
        this.mockOverrides[i.id] ? { ...i, ...this.mockOverrides[i.id] } : i,
      );
      return list.filter((i) => i.isActive && !(i as any).deletedAt).slice(0, limit);
    }
    return this.prisma.influencer.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        portfolio: { take: 1 },
        packages: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
      orderBy: [{ rating: 'desc' }, { totalProjects: 'desc' }],
      take: limit,
    });
  }

  async getFilterOptions() {
    if (this.isMock()) {
      const list = this.mockInfluencers().filter(i => !(i as any).deletedAt);
      const industries = [...new Set(list.flatMap((i) => i.industries))].sort();
      const contentStyles = [...new Set(list.map((i) => i.contentStyle))].sort();
      const languages = [...new Set(list.flatMap((i) => i.languages))].sort();
      return { industries, contentStyles, languages };
    }
    const influencers = await this.prisma.influencer.findMany({
      where: { isActive: true, deletedAt: null },
      select: { industries: true, contentStyle: true, languages: true },
    });
    const industries = [...new Set(influencers.flatMap((i: any) => (Array.isArray(i.industries) ? i.industries : [])))].sort();
    const contentStyles = [...new Set(influencers.map((i) => i.contentStyle))].sort();
    const languages = [...new Set(influencers.flatMap((i: any) => (Array.isArray(i.languages) ? i.languages : [])))].sort();

    return { industries, contentStyles, languages };
  }

  async upsertPackage(
    influencerId: string,
    data: {
      type: any;
      name: string;
      price: number;
      videoCount: number;
      description?: string | null;
      isMonthly?: boolean | null;
      isActive?: boolean | null;
      sortOrder?: number | null;
    },
  ) {
    if (this.isMock()) {
      return {
        id: `mock-pkg-${Date.now()}`,
        influencerId,
        type: data.type,
        name: String(data.name ?? '').trim(),
        price: Number(data.price) || 0,
        videoCount: Number(data.videoCount) || 0,
        description: data.description ?? null,
        isMonthly: !!data.isMonthly,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
        createdAt: new Date(),
      } as any;
    }

    await this.findById(influencerId);

    const price = Number(data.price);
    const videoCount = Number(data.videoCount);
    if (!Number.isFinite(price) || price < 0) throw new BadRequestException('Price must be a non-negative number');
    if (!Number.isFinite(videoCount) || videoCount < 0) throw new BadRequestException('Video count must be a non-negative number');
    const name = String(data.name ?? '').trim();
    if (!name) throw new BadRequestException('Package name is required');

    const isCustom = String(data.type) === 'CUSTOM';
    if (isCustom) {
      return this.prisma.influencerPackage.create({
        data: {
          influencerId,
          type: data.type,
          name,
          price,
          videoCount,
          description: data.description ?? null,
          isMonthly: data.isMonthly ?? false,
          isActive: data.isActive ?? true,
          sortOrder: data.sortOrder ?? 0,
        },
      });
    }

    const existing = await this.prisma.influencerPackage.findFirst({
      where: { influencerId, type: data.type },
      select: { id: true },
    });

    if (!existing) {
      return this.prisma.influencerPackage.create({
        data: {
          influencerId,
          type: data.type,
          name,
          price,
          videoCount,
          description: data.description ?? null,
          isMonthly: data.isMonthly ?? false,
          isActive: data.isActive ?? true,
          sortOrder: data.sortOrder ?? 0,
        },
      });
    }

    return this.prisma.influencerPackage.update({
      where: { id: existing.id },
      data: {
        name,
        price,
        videoCount,
        description: data.description ?? null,
        ...(data.isMonthly !== undefined && data.isMonthly !== null ? { isMonthly: data.isMonthly } : {}),
        ...(data.isActive !== undefined && data.isActive !== null ? { isActive: data.isActive } : {}),
        ...(data.sortOrder !== undefined && data.sortOrder !== null ? { sortOrder: data.sortOrder } : {}),
      },
    });
  }

  async createPackage(
    influencerId: string,
    data: {
      type: any;
      name: string;
      price: number;
      videoCount: number;
      description?: string | null;
      isMonthly?: boolean | null;
      isActive?: boolean | null;
      sortOrder?: number | null;
    },
  ) {
    if (this.isMock()) {
      return {
        id: `mock-pkg-${Date.now()}`,
        influencerId,
        type: data.type,
        name: String(data.name ?? '').trim(),
        price: Number(data.price) || 0,
        videoCount: Number(data.videoCount) || 0,
        description: data.description ?? null,
        isMonthly: !!data.isMonthly,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
        createdAt: new Date(),
      } as any;
    }

    await this.findById(influencerId);

    const price = Number(data.price);
    const videoCount = Number(data.videoCount);
    if (!Number.isFinite(price) || price < 0) throw new BadRequestException('Price must be a non-negative number');
    if (!Number.isFinite(videoCount) || videoCount < 0) throw new BadRequestException('Video count must be a non-negative number');
    const name = String(data.name ?? '').trim();
    if (!name) throw new BadRequestException('Package name is required');

    const isCustom = String(data.type) === 'CUSTOM';
    if (!isCustom) {
      const alreadyExists = await this.prisma.influencerPackage.findFirst({
        where: { influencerId, type: data.type },
        select: { id: true },
      });
      if (alreadyExists) {
        throw new BadRequestException('A package with this type already exists. Edit it instead.');
      }
    }

    try {
      return await this.prisma.influencerPackage.create({
        data: {
          influencerId,
          type: data.type,
          name,
          price,
          videoCount,
          description: data.description ?? null,
          isMonthly: data.isMonthly ?? false,
          isActive: data.isActive ?? true,
          sortOrder: data.sortOrder ?? 0,
        },
      });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        if (String(data.type) === 'CUSTOM') {
          throw new BadRequestException('Database currently blocks multiple custom packages. Apply the package-type unique-index migration and try again.');
        }
        throw new BadRequestException('A package with this type already exists. Edit it instead.');
      }
      throw e;
    }
  }

  async updatePackage(
    id: string,
    data: {
      name?: string | null;
      price?: number | null;
      videoCount?: number | null;
      description?: string | null;
      isMonthly?: boolean | null;
      isActive?: boolean | null;
      sortOrder?: number | null;
    },
  ) {
    if (this.isMock()) throw new BadRequestException('Not available in mock mode');

    const existing = await this.prisma.influencerPackage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Package not found');

    const update: any = {};
    if (data.name !== undefined) {
      const name = String(data.name ?? '').trim();
      if (!name) throw new BadRequestException('Package name is required');
      update.name = name;
    }
    if (data.price !== undefined) {
      const price = Number(data.price);
      if (!Number.isFinite(price) || price < 0) throw new BadRequestException('Price must be a non-negative number');
      update.price = price;
    }
    if (data.videoCount !== undefined) {
      const videoCount = Number(data.videoCount);
      if (!Number.isFinite(videoCount) || videoCount < 0) throw new BadRequestException('Video count must be a non-negative number');
      update.videoCount = videoCount;
    }
    if (data.description !== undefined) update.description = data.description ?? null;
    if (data.isMonthly !== undefined) update.isMonthly = !!data.isMonthly;
    if (data.isActive !== undefined) update.isActive = !!data.isActive;
    if (data.sortOrder !== undefined) update.sortOrder = Number(data.sortOrder) || 0;

    return this.prisma.influencerPackage.update({ where: { id }, data: update });
  }

  async deletePackage(id: string) {
    if (this.isMock()) return true;
    const existing = await this.prisma.influencerPackage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Package not found');
    await this.prisma.influencerPackage.delete({ where: { id } });
    return true;
  }
}
