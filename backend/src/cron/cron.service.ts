import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../quiz/gemini/gemini.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
  ) {}

  // Daily at 02:00 AM: Pre-generate quizzes
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleQuizGeneration() {
    this.logger.log('Running daily quiz generation cron...');
    
    // Find all active books
    const activeBooks = await this.prisma.book.findMany({
      where: { isActive: true },
      include: {
        user: {
          include: { settings: true },
        },
      },
    });

    for (const book of activeBooks) {
      try {
        const timezone = book.user.settings?.timezone ?? 'Africa/Lagos';
        const tomorrow = DateTime.now().setZone(timezone).plus({ days: 1 }).startOf('day');
        
        // Find the passage scheduled for tomorrow
        const passage = await this.prisma.passage.findFirst({
          where: {
            bookId: book.id,
            scheduledFor: tomorrow.toJSDate(),
            quiz: null,
          },
        });

        if (passage) {
          this.logger.log(`Generating quiz for book "${book.title}" (user: ${book.user.email})`);
          const questionsData = await this.geminiService.generateQuiz(passage.content);
          await this.prisma.quiz.create({
            data: {
              passageId: passage.id,
              questionsData: questionsData as any,
            },
          });
        }
      } catch (error) {
        this.logger.error(`Failed to generate quiz for book ${book.id}: ${error.message}`);
      }
    }
  }

  // Every minute: Check for alarm triggers
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAlarmTriggers() {
    // Note: In a production environment with many users, this query should be optimized.
    // For MVP, we query all users whose targetReadingTime matches current time.
    
    const users = await this.prisma.user.findMany({
      include: {
        settings: true,
        progress: true,
      },
    });

    for (const user of users) {
      if (!user.settings || !user.progress || user.progress.isAlarmActive) continue;

      const timezone = user.settings.timezone;
      const now = DateTime.now().setZone(timezone);
      
      // Skip weekends
      if (now.weekday > 5) continue;

      const [targetHours, targetMinutes] = user.settings.targetReadingTime.split(':').map(Number);
      
      if (now.hour === targetHours && now.minute === targetMinutes) {
        // Check if there's an active book and a passage scheduled for today
        const todayStart = now.startOf('day').toJSDate();
        const activePassage = await this.prisma.passage.findFirst({
          where: {
            book: { userId: user.id, isActive: true },
            scheduledFor: todayStart,
            isRead: false,
          },
        });

        if (activePassage) {
          this.logger.log(`Triggering alarm for user ${user.email}`);
          await this.prisma.userProgress.update({
            where: { userId: user.id },
            data: {
              isAlarmActive: true,
              activatedAt: now.toJSDate(),
            },
          });
        }
      }
    }
  }
}
