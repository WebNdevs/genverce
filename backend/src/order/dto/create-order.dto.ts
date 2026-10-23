import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsEnum, IsBoolean, IsOptional, IsArray } from 'class-validator';
import { PackageType, DeliveryType } from '@prisma/client';

@InputType()
export class ProjectBriefInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  productName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  keyMessage?: string;

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
  inclusions?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  posterPlan?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  videoPrompt?: string;
}

@InputType()
export class CreateOrderInput {
  @Field()
  @IsString()
  influencerId: string;

  @Field(() => ProjectBriefInput)
  projectBrief: ProjectBriefInput;

  @Field(() => String)
  @IsEnum(PackageType)
  package: PackageType;

  @Field(() => String)
  @IsEnum(DeliveryType)
  deliveryType: DeliveryType;

  @Field()
  @IsBoolean()
  aiDisclosure: boolean;
}
