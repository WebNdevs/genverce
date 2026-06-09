import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsBoolean, IsArray } from 'class-validator';
import { UseGuards } from '@nestjs/common';
import { FaqService } from './faq.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ObjectType()
export class FaqEntryType {
  @Field(() => ID) id: string;
  @Field() question: string;
  @Field(() => [String]) answers: string[];
  @Field({ nullable: true }) keywords?: string;
  @Field() isActive: boolean;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}

@InputType()
export class CreateFaqInput {
  @Field() @IsString() question: string;
  @Field(() => [String]) @IsArray() answers: string[];
  @Field({ nullable: true }) @IsOptional() @IsString() keywords?: string;
}

@InputType()
export class UpdateFaqInput {
  @Field({ nullable: true }) @IsOptional() @IsString() question?: string;
  @Field(() => [String], { nullable: true }) @IsOptional() @IsArray() answers?: string[];
  @Field({ nullable: true }) @IsOptional() @IsString() keywords?: string;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

@Resolver(() => FaqEntryType)
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaqResolver {
  constructor(private faqService: FaqService) {}

  @Query(() => [FaqEntryType])
  @Roles(Role.ADMIN)
  async faqEntries() {
    return this.faqService.findAll();
  }

  @Mutation(() => FaqEntryType)
  @Roles(Role.ADMIN)
  async createFaqEntry(@Args('input') input: CreateFaqInput) {
    return this.faqService.create(input);
  }

  @Mutation(() => FaqEntryType)
  @Roles(Role.ADMIN)
  async updateFaqEntry(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateFaqInput,
  ) {
    return this.faqService.update(id, input);
  }

  @Mutation(() => Boolean)
  @Roles(Role.ADMIN)
  async deleteFaqEntry(@Args('id', { type: () => ID }) id: string) {
    return this.faqService.delete(id);
  }
}
