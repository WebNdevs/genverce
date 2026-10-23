import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';

const SETTINGS_ID = 'global';

export interface UpdateSettingsData {
  chatProvider?: string;
  chatApiUrl?: string;
  chatApiKey?: string;
  chatModel?: string;

  audioProvider?: string;
  audioApiUrl?: string;
  audioApiKey?: string;
  audioModel?: string;

  videoProvider?: string;
  videoApiUrl?: string;
  videoApiKey?: string;
  videoModel?: string;
  customVideoEngines?: string;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    try {
      return await (this.prisma as any).siteSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID },
        update: {},
      });
    } catch {
      return {
        id: SETTINGS_ID,
        chatProvider: null,
        chatApiUrl: null,
        chatApiKey: null,
        chatModel: null,
        audioProvider: null,
        audioApiUrl: null,
        audioApiKey: null,
        audioModel: null,
        videoProvider: null,
        videoApiUrl: null,
        videoApiKey: null,
        videoModel: null,
        customVideoEngines: null,
      } as any;
    }
  }

  async update(data: UpdateSettingsData) {
    try {
      return await (this.prisma as any).siteSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, ...data },
        update: data,
      });
    } catch {
      return {
        id: SETTINGS_ID,
        chatProvider: data.chatProvider ?? null,
        chatApiUrl: data.chatApiUrl ?? null,
        chatApiKey: data.chatApiKey ?? null,
        chatModel: data.chatModel ?? null,
        audioProvider: data.audioProvider ?? null,
        audioApiUrl: data.audioApiUrl ?? null,
        audioApiKey: data.audioApiKey ?? null,
        audioModel: data.audioModel ?? null,
        videoProvider: data.videoProvider ?? null,
        videoApiUrl: data.videoApiUrl ?? null,
        videoApiKey: data.videoApiKey ?? null,
        videoModel: data.videoModel ?? null,
        customVideoEngines: data.customVideoEngines ?? null,
      } as any;
    }
  }
}
