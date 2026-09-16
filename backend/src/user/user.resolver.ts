import { Resolver, Query, Mutation, Args, InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UserModel } from './user.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { UserStatsModel } from './user-stats.model';
import { AdminHireAgentResult, HiredAgentInfo, UserHiredAgentsSummary } from './dto/admin-hire-agent.dto';

@InputType()
class AdminUpdateUserInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field(() => Role, { nullable: true })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  company?: string;
}

@InputType()
class CompleteOnboardingInput {
  @Field()
  @IsString()
  brandName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  productName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requestedCustomInfluencer?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  website?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  tone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  industry?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  goal?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentTypes?: string[];
}

@Resolver(() => UserModel)
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query(() => UserModel)
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    return this.userService.findById(user.id);
  }

  @Query(() => [UserModel])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async users(@Args('role', { nullable: true }) role?: Role) {
    return this.userService.findAll(role);
  }

  @Query(() => [UserModel])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async allUsers() {
    return this.userService.findAll();
  }

  @Query(() => UserStatsModel)
  @UseGuards(JwtAuthGuard)
  async myStats(@CurrentUser() user: any) {
    return this.userService.getUserStats(user.id);
  }

  @Mutation(() => UserModel)
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: any,
    @Args('name', { nullable: true }) name?: string,
    @Args('username', { nullable: true }) username?: string,
    @Args('avatar', { nullable: true }) avatar?: string,
    @Args('company', { nullable: true }) company?: string,
  ) {
    return this.userService.updateProfile(user.id, { name, username, avatar, company });
  }

  @Mutation(() => UserModel)
  @UseGuards(JwtAuthGuard)
  async completeOnboarding(
    @CurrentUser() user: any,
    @Args('input') input: CompleteOnboardingInput,
  ) {
    return this.userService.completeOnboarding(user.id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: any,
    @Args('currentPassword') currentPassword: string,
    @Args('newPassword') newPassword: string,
  ) {
    return this.userService.changePassword(user.id, currentPassword, newPassword);
  }

  @Mutation(() => UserModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminUpdateUser(
    @Args('userId') userId: string,
    @Args('input') input: AdminUpdateUserInput,
  ) {
    return this.userService.adminUpdateUser(userId, input);
  }

  @Mutation(() => UserModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deactivateUser(@Args('userId') userId: string) {
    return this.userService.deactivate(userId);
  }

  @Mutation(() => UserModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async activateUser(@Args('userId') userId: string) {
    return this.userService.activate(userId);
  }

  @Query(() => [UserModel])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async trashedUsers() {
    return this.userService.findTrashed();
  }

  @Mutation(() => UserModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async softDeleteUser(@Args('userId') userId: string) {
    return this.userService.softDelete(userId);
  }

  @Mutation(() => UserModel)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async restoreUser(@Args('userId') userId: string) {
    return this.userService.restore(userId);
  }

  @Mutation(() => AdminHireAgentResult)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminHireAgentForUser(
    @Args('userId') userId: string,
    @Args('influencerId') influencerId: string,
  ) {
    return this.userService.adminHireAgentForUser(userId, influencerId);
  }

  @Query(() => [HiredAgentInfo])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async adminUserHiredAgents(@Args('userId') userId: string) {
    return this.userService.getUserHiredAgents(userId);
  }

  @Query(() => UserHiredAgentsSummary)
  @UseGuards(JwtAuthGuard)
  async myHiredAgentsOverview(@CurrentUser() user: any) {
    return this.userService.getMyHiredAgentsOverview(user.id);
  }
}
