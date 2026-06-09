import { InputType, Field, Float } from '@nestjs/graphql';
import { IsString, IsArray, IsOptional, IsNumber, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InfluencerServiceType } from '@prisma/client';
import { AIConfigInput } from './ai-config.dto';

@InputType()
export class UpdateInfluencerInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  bio?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  avatar?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  locationCity?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  locationState?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  locationCountry?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  locationAddress?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  locationPincode?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  industries?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  contentStyle?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  languages?: string[];

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  topic?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  outOfTopicMessage?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  voiceId?: string;

  @Field(() => InfluencerServiceType, { nullable: true })
  @IsOptional()
  @IsEnum(InfluencerServiceType)
  serviceType?: InfluencerServiceType;

  @Field(() => AIConfigInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AIConfigInput)
  aiConfig?: AIConfigInput;
}
