import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../config/prisma.service';
import { RedisService } from '../config/redis.service';
import { SignupInput } from './dto/signup.dto';
import { LoginInput } from './dto/login.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redis: RedisService,
  ) {}

  private async loginWithPresets(input: LoginInput) {
    const presets: Record<
      string,
      { name: string; role: 'ADMIN' | 'REVIEWER' | 'CUSTOMER' }
    > = {
      'admin@genverce.ai': { name: 'Genverce Admin', role: 'ADMIN' },
      'admin@inflexa.local': { name: 'Genverce Admin', role: 'ADMIN' },
      'reviewer@genverce.ai': { name: 'Quality Reviewer', role: 'REVIEWER' },
      'demo@genverce.ai': { name: 'Demo Customer', role: 'CUSTOMER' },
    };
    const passwordByEmail: Record<string, string> = {
      'admin@genverce.ai': 'admin123456',
      'admin@inflexa.local': 'admin123456',
      'reviewer@genverce.ai': 'reviewer123456',
      'demo@genverce.ai': 'customer123456',
    };
    const preset = presets[input.email];
    if (!preset || passwordByEmail[input.email] !== input.password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const user = {
      id: `mock-${preset.role.toLowerCase()}`,
      name: preset.name,
      email: input.email,
      role: preset.role,
      accountType: 'INDIVIDUAL',
      avatar: null,
      company: null,
      isActive: true,
      password: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as User;
    const tokens = await this.generateTokens(user);
    return { ...tokens, user };
  }

  async signup(input: SignupInput) {
    const mockMode = this.configService.get<string>('MOCK_MODE') === 'true';
    if (mockMode) {
      throw new ConflictException('Signup is disabled in mock mode');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
        accountType: input.accountType || 'INDIVIDUAL',
        company: input.company,
      },
    });

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken).catch(() => {});

    return { ...tokens, user };
  }

  async login(input: LoginInput) {
    const mockMode = this.configService.get<string>('MOCK_MODE') === 'true';
    const env = (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development').toLowerCase();
    const allowPresetLogin = env !== 'production';
    if (mockMode) {
      return this.loginWithPresets(input);
    }
    let user: User | null = null;
    try {
      user = await this.prisma.user.findUnique({
        where: { email: input.email },
      });
    } catch {
      if (allowPresetLogin) {
        return this.loginWithPresets(input);
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user) {
      if (allowPresetLogin) {
        return this.loginWithPresets(input);
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(input.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken).catch(() => {});

    return { ...tokens, user };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const mockMode = this.configService.get<string>('MOCK_MODE') === 'true';
    if (mockMode) {
      // In mock mode, simply issue new tokens for a dummy user with the same role inferred from id
      const role =
        userId.includes('admin') ? 'ADMIN' : userId.includes('reviewer') ? 'REVIEWER' : 'CUSTOMER';
      const user = {
        id: userId,
        name:
          role === 'ADMIN'
            ? 'Genverce Admin'
            : role === 'REVIEWER'
            ? 'Quality Reviewer'
            : 'Demo Customer',
        email:
          role === 'ADMIN'
            ? 'admin@genverce.ai'
            : role === 'REVIEWER'
            ? 'reviewer@genverce.ai'
            : 'demo@genverce.ai',
        role,
        accountType: 'INDIVIDUAL',
        avatar: null,
        company: null,
        isActive: true,
        password: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as User;
      const tokens = await this.generateTokens(user);
      return { ...tokens, user };
    }
    let storedToken: string | null = null;
    try {
      storedToken = await this.redis.get(`refresh_token:${userId}`);
    } catch (_) {}

    if (storedToken && storedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { ...tokens, user };
  }

  async logout(userId: string) {
    const mockMode = this.configService.get<string>('MOCK_MODE') === 'true';
    if (mockMode) {
      return true;
    }
    await this.redis.del(`refresh_token:${userId}`).catch(() => {});
    return true;
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRATION') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION') || '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string) {
    await this.redis.set(
      `refresh_token:${userId}`,
      token,
      'EX',
      7 * 24 * 60 * 60, // 7 days
    );
  }
}
