import { InputType, Field, ObjectType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class AIConfigInput {
  @Field({ nullable: true }) @IsOptional() @IsString() chatApiUrl?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() chatApiKey?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() chatModel?: string;

  @Field({ nullable: true }) @IsOptional() @IsString() scriptApiUrl?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() scriptApiKey?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() scriptModel?: string;

  @Field({ nullable: true }) @IsOptional() @IsString() voiceApiUrl?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() voiceApiKey?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() voiceModel?: string;

  @Field({ nullable: true }) @IsOptional() @IsString() videoApiUrl?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() videoApiKey?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() videoModel?: string;

  @Field({ nullable: true }) @IsOptional() @IsString() imageApiUrl?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() imageApiKey?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() imageModel?: string;

  @Field({ nullable: true }) @IsOptional() @IsString() postApiUrl?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() postApiKey?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() postModel?: string;
}

@ObjectType()
export class AIConfigModel {
  @Field({ nullable: true }) chatApiUrl?: string;
  @Field({ nullable: true }) chatApiKey?: string;
  @Field({ nullable: true }) chatModel?: string;

  @Field({ nullable: true }) scriptApiUrl?: string;
  @Field({ nullable: true }) scriptApiKey?: string;
  @Field({ nullable: true }) scriptModel?: string;

  @Field({ nullable: true }) voiceApiUrl?: string;
  @Field({ nullable: true }) voiceApiKey?: string;
  @Field({ nullable: true }) voiceModel?: string;

  @Field({ nullable: true }) videoApiUrl?: string;
  @Field({ nullable: true }) videoApiKey?: string;
  @Field({ nullable: true }) videoModel?: string;

  @Field({ nullable: true }) imageApiUrl?: string;
  @Field({ nullable: true }) imageApiKey?: string;
  @Field({ nullable: true }) imageModel?: string;

  @Field({ nullable: true }) postApiUrl?: string;
  @Field({ nullable: true }) postApiKey?: string;
  @Field({ nullable: true }) postModel?: string;
}
