import { ObjectType, Field, ID, Float, Int, registerEnumType } from '@nestjs/graphql';
import { InfluencerServiceType, PackageType } from '@prisma/client';
import { AIConfigModel } from './dto/ai-config.dto';

registerEnumType(InfluencerServiceType, { name: 'InfluencerServiceType' });
registerEnumType(PackageType, { name: 'PackageType' });

@ObjectType()
export class PortfolioModel {
  @Field(() => ID)
  id: string;

  @Field()
  videoUrl: string;

  @Field()
  thumbnailUrl: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class InfluencerPackageModel {
  @Field(() => ID)
  id: string;

  @Field()
  influencerId: string;

  @Field(() => PackageType)
  type: PackageType;

  @Field()
  name: string;

  @Field(() => Float)
  price: number;

  @Field(() => Int)
  videoCount: number;

  @Field({ nullable: true })
  description?: string;

  @Field()
  isMonthly: boolean;

  @Field()
  isActive: boolean;

  @Field(() => Int)
  sortOrder: number;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class InfluencerModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  bio: string;

  @Field()
  avatar: string;

  @Field({ nullable: true })
  coverImage?: string;

  @Field({ nullable: true })
  locationCity?: string;

  @Field({ nullable: true })
  locationState?: string;

  @Field({ nullable: true })
  locationCountry?: string;

  @Field({ nullable: true })
  locationAddress?: string;

  @Field({ nullable: true })
  locationPincode?: string;

  @Field(() => [String])
  industries: string[];

  @Field()
  contentStyle: string;

  @Field(() => [String])
  languages: string[];

  @Field(() => Float)
  rating: number;

  @Field(() => Int)
  totalProjects: number;

  @Field(() => Int)
  totalReviews: number;

  @Field()
  isActive: boolean;

  @Field(() => Float, { nullable: true })
  hourlyRate?: number;

  @Field({ nullable: true })
  systemPrompt?: string;

  @Field({ nullable: true })
  topic?: string;

  @Field({ nullable: true })
  outOfTopicMessage?: string;

  @Field({ nullable: true })
  voiceId?: string;

  @Field(() => InfluencerServiceType)
  serviceType: InfluencerServiceType;

  @Field(() => AIConfigModel, { nullable: true })
  aiConfig?: AIConfigModel;

  @Field(() => [PortfolioModel])
  portfolio: PortfolioModel[];

  @Field(() => [InfluencerPackageModel])
  packages: InfluencerPackageModel[];

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  deletedAt?: Date;
}
