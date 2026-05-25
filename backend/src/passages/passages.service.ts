import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { TodayPassage } from 'shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PassagesService {
  constructor(private prisma: PrismaService) {}

  async findTodayPassage(userId: string): Promise<TodayPassage> {
    const settings = await this.prisma.settings.findUnique({
      where: { userId },
    });

    const timezone = settings?.timezone ?? 'Africa/Lagos';
    const localTodayStart = DateTime.now().setZone(timezone).startOf('day');
    const utcMatchDate = localTodayStart.toJSDate();

    const passage = await this.prisma.passage.findFirst({
      where: {
        book: { userId, isActive: true },
        scheduledFor: utcMatchDate,
        isRead: false,
      },
      include: {
        book: true,
      },
      orderBy: { chunkIndex: 'asc' },
    });

    if (!passage) {
      throw new NotFoundException('No passage scheduled for today');
    }

    return {
      id: passage.id,
      content: passage.content,
      estimatedMinutes: passage.estimatedMinutes,
      bookTitle: passage.book.title,
      chunkIndex: passage.chunkIndex,
    };
  }
}
