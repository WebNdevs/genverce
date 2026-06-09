import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    const urlFromEnv = process.env.DATABASE_URL;

    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const pass = process.env.DB_PASSWORD ?? '';
    const name = process.env.DB_NAME;
    const port = process.env.DB_PORT || '3306';

    const scheme = process.env.DB_SCHEME || 'mysql';

    let url = urlFromEnv;
    if (!url && host && user && name) {
      const encodedUser = encodeURIComponent(user);
      const encodedPass = encodeURIComponent(pass);
      const passPart = encodedPass ? `:${encodedPass}` : '';
      url = `${scheme}://${encodedUser}${passPart}@${host}:${port}/${name}`;
    }

    super({
      datasources: url
        ? { db: { url } }
        : undefined,
    });
  }

  async onModuleInit() {
    const mockMode = this.configService.get<string>('MOCK_MODE') === 'true';
    if (mockMode) {
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
