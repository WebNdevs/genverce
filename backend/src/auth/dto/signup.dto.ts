import { InputType, Field } from '@nestjs/graphql';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, MinLength, } from 'class-validator';
import { AccountType } from '@prisma/client';

@InputType()
export class SignupInput {
  @Field()
  @IsString()
  @MinLength(2)
  name: string;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(8)
  password: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  company?: string;

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
