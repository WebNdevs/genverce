import { InputType, Field, Float } from '@nestjs/graphql';
import { IsString, IsEnum, IsBoolean, IsOptional, IsArray, IsNumber } from 'class-validator';
import { PackageType, DeliveryType, OrderStatus } from '@prisma/client';
import { ProjectBriefInput } from './create-order.dto';

@InputType()
export class AdminCreateOrderInput {
  @Field()
  @IsString()
  influencerId: string;

  @Field()
  @IsString()
  customerId: string;

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

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  price?: number;
}
