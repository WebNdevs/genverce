import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsEnum, IsBoolean, IsOptional, IsArray } from 'class-validator';
import { PackageType, DeliveryType } from '@prisma/client';

@InputType()
export class ProjectBriefInput {
  @Field()
  @IsString()
  productName: string;

  @Field()
  @IsString()
  keyMessage: string;

  @Field()
  @IsString()
  targetAudience: string;

  @Field()
  @IsString()
  tone: string;

  @Field(() => [String])
  @IsArray()
  inclusions: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  additionalNotes?: string;

  // ADD THIS
  @Field(() => String, { nullable: true })
  @IsOptional()
  posterPlan?: string;
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
