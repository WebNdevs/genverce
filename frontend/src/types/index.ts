// ═══════════════════════════════════════════
// Genverce — Shared TypeScript Types
// ═══════════════════════════════════════════

export enum Role {
  CUSTOMER = 'CUSTOMER',
  AGENCY = 'AGENCY',
  ADMIN = 'ADMIN',
  REVIEWER = 'REVIEWER',
}

export enum AccountType {
  INDIVIDUAL = 'INDIVIDUAL',
  AGENCY = 'AGENCY',
}

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  GENERATING = 'GENERATING',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  DELIVERED = 'DELIVERED',
  REJECTED = 'REJECTED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum PackageType {
  SINGLE = 'SINGLE',
  PACK_5 = 'PACK_5',
  PACK_10 = 'PACK_10',
  MONTHLY_STARTER = 'MONTHLY_STARTER',
  MONTHLY_GROWTH = 'MONTHLY_GROWTH',
  CUSTOM = 'CUSTOM',
}

export enum DeliveryType {
  INSTANT = 'INSTANT',
  QUALITY_CHECKED = 'QUALITY_CHECKED',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  accountType: AccountType;
  avatar?: string;
  company?: string;
  isActive: boolean;
  isOnboarded: boolean;
  brandName?: string;
  productName?: string;
  website?: string;
  targetAudience?: string;
  tone?: string;
  createdAt: string;
}

export interface Influencer {
  id: string;
  name: string;
  bio: string;
  avatar: string;
  coverImage?: string;
  industries: string[];
  contentStyle: string;
  languages: string[];
  rating: number;
  totalProjects: number;
  totalReviews: number;
  isActive: boolean;
  hourlyRate?: number;
  portfolio: InfluencerPortfolio[];
}

export interface InfluencerPortfolio {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  description?: string;
}

export interface Chat {
  id: string;
  customerId: string;
  influencerId: string;
  messages: Message[];
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  imageUrl?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  influencerId: string;
  projectBrief: ProjectBrief;
  package: PackageType;
  deliveryType: DeliveryType;
  status: OrderStatus;
  price: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  deliveredAt?: string | null;
  generatedImages?: { url: string; messageId: string; createdAt: string; delivered?: boolean | null; deliveredAt?: string | null }[];
  aiDisclosure: boolean;
  videosOrdered: number;
  videosDelivered: number;
  createdAt: string;
  influencer?: Influencer;
  review?: { id: string } | null;
}

export interface ProjectBrief {
  productName: string;
  keyMessage: string;
  targetAudience: string;
  tone: string;
  inclusions: string[];
  additionalNotes?: string;
}

export interface Review {
  id: string;
  orderId: string;
  customerId: string;
  influencerId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  customerId: string;
  orderId?: string;
  issue: string;
  status: TicketStatus;
  resolution?: string;
  createdAt: string;
}

export interface PricingPackage {
  type: PackageType;
  name: string;
  price: number;
  videoCount: number;
  description: string;
  isMonthly: boolean;
}

export const PRICING_PACKAGES: PricingPackage[] = [
  {
    type: PackageType.SINGLE,
    name: 'Single Video',
    price: 9.99,
    videoCount: 1,
    description: '1 video, 60 seconds',
    isMonthly: false,
  },
  {
    type: PackageType.PACK_5,
    name: 'Pack of 5',
    price: 39.99,
    videoCount: 5,
    description: '5 videos, 60 sec each',
    isMonthly: false,
  },
  {
    type: PackageType.PACK_10,
    name: 'Pack of 10',
    price: 70.0,
    videoCount: 10,
    description: '10 videos, 60 sec each',
    isMonthly: false,
  },
  {
    type: PackageType.MONTHLY_STARTER,
    name: 'Monthly Starter',
    price: 199.0,
    videoCount: 30,
    description: '30 videos/month',
    isMonthly: true,
  },
  {
    type: PackageType.MONTHLY_GROWTH,
    name: 'Monthly Growth',
    price: 499.0,
    videoCount: 100,
    description: '100 videos/month',
    isMonthly: true,
  },
];
