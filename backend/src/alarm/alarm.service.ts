import { Injectable } from '@nestjs/common';
import { AlarmStatus } from 'shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlarmService {
  constructor(private prisma: PrismaService) {}

  async getStatus(userId: string): Promise<AlarmStatus> {
    const progress = await this.prisma.userProgress.findUnique({
      where: { userId },
    });

    return {
      isAlarmActive: progress?.isAlarmActive ?? false,
      activatedAt: progress?.activatedAt ?? null,
      currentStreak: progress?.currentStreak ?? 0,
    };
  }

  async overrideNoQuiz(userId: string): Promise<void> {
    await this.prisma.userProgress.update({
      where: { userId },
      data: {
        isAlarmActive: false,
        activatedAt: null,
      },
    });
  }
}
