import { InputType, Field, Float } from '@nestjs/graphql';
import { IsString, IsEnum, IsBoolean, IsOptional, IsNumber, IsArray } from 'class-validator';
import { PackageType, DeliveryType, OrderStatus } from '@prisma/client';
import { GraphQLJSONObject } from 'graphql-type-json';
import { ProjectBriefInput } from './create-order.dto';

@InputType()
export class GeneratedImageInput {
  @Field()
  @IsString()
  url: string;

  @Field()
  @IsString()
  messageId: string;

  @Field()
  @IsString()
  createdAt: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  delivered?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  deliveredAt?: string;
}

@InputType()
export class AdminUpdateOrderInput {
  @Field()
  @IsString()
  id: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  projectBrief?: any;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEnum(PackageType)
  package?: PackageType;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  aiDisclosure?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  price?: number;

  @Field(() => [GeneratedImageInput], { nullable: true })
  @IsOptional()
  @IsArray()
  generatedImages?: GeneratedImageInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}
