import { InputType, Field, ObjectType } from '@nestjs/graphql';
import { IsOptional, IsString, IsArray, IsBoolean } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class GeneratePostInput {
  @Field()
  @IsString()
  topic: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  platforms?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  postType?: string; // e.g. "social_media", "blog", "linkedin", "announcement", "promo", "carousel"

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  tone?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  keywords?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  inclusions?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  callToAction?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  brandName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  productName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  website?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  visualStyle?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  generateVisual?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  referenceImageUrl?: string;
}

@ObjectType()
export class GeneratedPostModel {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field()
  caption: string;

  @Field()
  content: string;

  @Field(() => [String])
  hashtags: string[];

  @Field({ nullable: true })
  imageUrl?: string;

  @Field({ nullable: true })
  imagePrompt?: string;

  @Field(() => [String])
  platforms: string[];

  @Field()
  topic: string;

  @Field({ nullable: true })
  tone?: string;

  @Field({ nullable: true })
  callToAction?: string;

  @Field()
  createdAt: string;

  @Field({ nullable: true })
  delivered?: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

export interface GeneratePostParams {
  influencer?: {
    id?: string;
    name?: string;
    systemPrompt?: string;
    industries?: any;
    contentStyle?: string;
    tone?: string;
  };
  aiConfig?: {
    postApiUrl?: string | null;
    postApiKey?: string | null;
    postModel?: string | null;
    imageApiUrl?: string | null;
    imageApiKey?: string | null;
    imageModel?: string | null;
    chatApiUrl?: string | null;
    chatApiKey?: string | null;
    chatModel?: string | null;
    chatProvider?: string | null;
  } | null;
  input: GeneratePostInput;
}

export interface GeneratedPostResult {
  id: string;
  title: string;
  caption: string;
  content: string;
  hashtags: string[];
  imageUrl?: string | null;
  imagePrompt?: string | null;
  platforms: string[];
  topic: string;
  tone?: string;
  callToAction?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}
