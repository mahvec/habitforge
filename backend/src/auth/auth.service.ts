import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthResponse } from 'shared';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        settings: {
          create: {
            targetReadingTime: '05:40',
            timezone: 'Africa/Lagos',
          },
        },
        progress: {
          create: {},
        },
      },
      include: {
        settings: true,
        progress: true,
      },
    });

    return this.generateAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateAuthResponse(user);
  }

  async refresh(refreshToken: string): Promise<Partial<AuthResponse>> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException();
      }

      const tokens = await this.generateTokens(user.id);
      return tokens;
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateAuthResponse(user: any): Promise<AuthResponse> {
    const tokens = await this.generateTokens(user.id);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  private async generateTokens(userId: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId },
        {
          secret: process.env.JWT_SECRET || 'dev-secret',
          expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId },
        {
          secret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret',
          expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || '30d') as any,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }
}
