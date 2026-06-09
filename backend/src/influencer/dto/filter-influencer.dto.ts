import { InputType, Field, Float, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsNumber } from 'class-validator';

@InputType()
export class FilterInfluencerInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  industry?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  contentStyle?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  language?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  minRating?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @Field({ nullable: true })
  @IsOptional()
  includeInactive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  includeTrashed?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  onlyTrashed?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 12 })
  @IsOptional()
  limit?: number;
}
