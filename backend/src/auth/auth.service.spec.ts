import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: '1' });
      await expect(service.register({ email: 'test@test.com', password: 'password' }))
        .rejects.toThrow(ConflictException);
    });

    it('should create a new user and return auth response', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: '1', email: 'test@test.com' });
      mockJwtService.signAsync.mockResolvedValue('token');

      const result = await service.register({ email: 'test@test.com', password: 'password' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@test.com');
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'test@test.com', password: 'password' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should return auth response for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password', 12);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com', passwordHash });
      mockJwtService.signAsync.mockResolvedValue('token');

      const result = await service.login({ email: 'test@test.com', password: 'password' });

      expect(result).toHaveProperty('accessToken');
      expect(result.user.id).toBe('1');
    });
  });
});
