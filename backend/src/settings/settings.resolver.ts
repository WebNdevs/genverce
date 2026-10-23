import { Resolver, Query, Mutation, Args, InputType, Field } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { SiteSettings } from './settings.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@InputType()
class UpdateSiteSettingsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  chatProvider?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  chatApiUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  chatApiKey?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  chatModel?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  audioProvider?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  audioApiUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  audioApiKey?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  audioModel?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  videoProvider?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  videoApiUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  videoApiKey?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  videoModel?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  customVideoEngines?: string;
}

@Resolver()
export class SettingsResolver {
  constructor(private settingsService: SettingsService) {}

  @Query(() => SiteSettings)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  siteSettings() {
    return this.settingsService.get();
  }

  @Mutation(() => SiteSettings)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateSiteSettings(@Args('input') input: UpdateSiteSettingsInput) {
    return this.settingsService.update(input);
  }
}
