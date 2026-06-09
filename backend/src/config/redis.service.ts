import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(private configService: ConfigService) {
    const url = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const mockMode = configService.get<string>('MOCK_MODE') === 'true';
    super(url, {
      lazyConnect: mockMode ? true : false,
      autoResubscribe: !mockMode,
      autoResendUnfulfilledCommands: !mockMode,
      enableOfflineQueue: !mockMode,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null, // Don't retry — Redis is optional
    } as any);

    // Suppress unhandled error events so they don't flood logs or crash the process
    this.on('error', () => {});
  }

  async onModuleDestroy() {
    await this.quit();
  }
}
