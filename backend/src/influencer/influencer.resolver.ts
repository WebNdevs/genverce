import { Resolver, Query, Mutation, Args, Int, ObjectType, Field, InputType, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InfluencerService } from './influencer.service';
import { InfluencerModel } from './influencer.model';
import { CreateInfluencerInput } from './dto/create-influencer.dto';
import { UpdateInfluencerInput } from './dto/update-influencer.dto';
import { FilterInfluencerInput } from './dto/filter-influencer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, PackageType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

@ObjectType()
class InfluencerListResponse {
  @Field(() => [InfluencerModel])
  influencers: InfluencerModel[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  totalPages: number;
}

@ObjectType()
class FilterOptionsResponse {
  @Field(() => [String])
  industries: string[];

  @Field(() => [String])
  contentStyles: string[];

  @Field(() => [String])
  languages: string[];
}

@InputType()
class UpsertInfluencerPackageInput {
  @Field(() => PackageType)
  @IsEnum(PackageType)
  type: PackageType;

  @Field()
  @IsString()
  name: string;

  @Field(() => Float)
  @IsNumber()
  price: number;

  @Field(() => Int)
  @IsInt()
  videoCount: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isMonthly?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@InputType()
class UpdateInfluencerPackageInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  price?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  videoCount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isMonthly?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@Resolver(() => InfluencerModel)
export class InfluencerResolver {
  constructor(private influencerService: InfluencerService) {}

  @Query(() => InfluencerListResponse)
  async influencers(
    @Args('filter', { nullable: true }) filter?: FilterInfluencerInput,
  ) {
    return this.influencerService.findAll(filter);
  }

  @Query(() => InfluencerModel)
  async influencer(@Args('id') id: string) {
    return this.influencerService.findById(id);
  }

  @Query(() => [InfluencerModel])
  async topInfluencers(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 6 }) limit: number,
  ) {
    return this.influencerService.getTopInfluencers(limit);
  }

  @Query(() => FilterOptionsResponse)
  async influencerFilterOptions() {
    return this.influencerService.getFilterOptions();
  }

  @Mutation(() => InfluencerModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createInfluencer(@Args('input') input: CreateInfluencerInput) {
    return this.influencerService.create(input);
  }

  @Mutation(() => InfluencerModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateInfluencer(
    @Args('id') id: string,
    @Args('input') input: UpdateInfluencerInput,
  ) {
    return this.influencerService.update(id, input);
  }

  @Mutation(() => InfluencerModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deactivateInfluencer(@Args('id') id: string) {
    return this.influencerService.deactivate(id);
  }

  @Mutation(() => InfluencerModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async activateInfluencer(@Args('id') id: string) {
    return this.influencerService.activate(id);
  }

  @Mutation(() => InfluencerModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async softDeleteInfluencer(@Args('id') id: string) {
    return this.influencerService.softDelete(id);
  }

  @Mutation(() => InfluencerModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async restoreInfluencer(@Args('id') id: string) {
    return this.influencerService.restore(id);
  }

  @Mutation(() => InfluencerModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async upsertInfluencerPackage(
    @Args('influencerId') influencerId: string,
    @Args('input') input: UpsertInfluencerPackageInput,
  ) {
    await this.influencerService.upsertPackage(influencerId, input as any);
    return this.influencerService.findById(influencerId);
  }

  @Mutation(() => InfluencerModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async createInfluencerPackage(
    @Args('influencerId') influencerId: string,
    @Args('input') input: UpsertInfluencerPackageInput,
  ) {
    await this.influencerService.createPackage(influencerId, input as any);
    return this.influencerService.findById(influencerId);
  }

  @Mutation(() => InfluencerModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async updateInfluencerPackage(
    @Args('id') id: string,
    @Args('input') input: UpdateInfluencerPackageInput,
  ) {
    const pkg = await this.influencerService.updatePackage(id, input as any);
    return this.influencerService.findById(pkg.influencerId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteInfluencerPackage(@Args('id') id: string) {
    return this.influencerService.deletePackage(id);
  }
}
