import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';

const SETTINGS_ID = 'global';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    try {
      return await this.prisma.siteSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID },
        update: {},
      });
    } catch {
      return {
        id: SETTINGS_ID,
        chatApiUrl: null,
        chatApiKey: null,
        chatModel: null,
      } as any;
    }
  }

  async update(data: { chatApiUrl?: string; chatApiKey?: string; chatModel?: string }) {
    try {
      return await this.prisma.siteSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, ...data },
        update: data,
      });
    } catch {
      return {
        id: SETTINGS_ID,
        chatApiUrl: data.chatApiUrl ?? null,
        chatApiKey: data.chatApiKey ?? null,
        chatModel: data.chatModel ?? null,
      } as any;
    }
  }
}
