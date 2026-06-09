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
  chatApiUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  chatApiKey?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  chatModel?: string;
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
