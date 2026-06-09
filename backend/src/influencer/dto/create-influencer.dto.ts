import { InputType, Field, Float } from '@nestjs/graphql';
import { IsString, IsArray, IsOptional, IsNumber, MinLength, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InfluencerServiceType } from '@prisma/client';
import { AIConfigInput } from './ai-config.dto';

@InputType()
export class CreateInfluencerInput {
  @Field()
  @IsString()
  @MinLength(2)
  name: string;

  @Field()
  @IsString()
  @MinLength(10)
  bio: string;

  @Field()
  @IsString()
  avatar: string;

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

  @Field(() => [String])
  @IsArray()
  industries: string[];

  @Field()
  @IsString()
  contentStyle: string;

  @Field(() => [String])
  @IsArray()
  languages: string[];

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @Field()
  @IsString()
  @MinLength(20)
  systemPrompt: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  voiceId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  topic?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  outOfTopicMessage?: string;

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
