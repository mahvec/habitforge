import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { QuizResponse, QuizSubmissionResult } from 'shared';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from './gemini/gemini.service';

@Injectable()
export class QuizService {
  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
  ) {}

  async getTodayQuiz(userId: string): Promise<QuizResponse> {
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
      },
      include: {
        quiz: true,
      },
    });

    if (!passage) {
      throw new NotFoundException('No passage scheduled for today');
    }

    let quiz = passage.quiz;

    if (!quiz) {
      // Lazy generation if cron missed it
      const questionsData = await this.geminiService.generateQuiz(passage.content);
      quiz = await this.prisma.quiz.create({
        data: {
          passageId: passage.id,
          questionsData: questionsData as any,
        },
      });
    }

    const questions = (quiz.questionsData as any[]).map((q) => ({
      question: q.q,
      options: q.options,
    }));

    return {
      id: quiz.id,
      passageId: passage.id,
      questions,
    };
  }

  async submitQuiz(userId: string, answers: number[]): Promise<QuizSubmissionResult> {
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
      },
      include: {
        quiz: true,
      },
    });

    if (!passage || !passage.quiz) {
      throw new NotFoundException('Quiz not found for today');
    }

    const questionsData = passage.quiz.questionsData as any[];
    let score = 0;

    questionsData.forEach((q, index) => {
      if (q.correct === answers[index]) {
        score++;
      }
    });

    const success = score === questionsData.length;
    let streak = 0;

    if (success) {
      // Mark as read
      await this.prisma.passage.update({
        where: { id: passage.id },
        data: { isRead: true },
      });

      // Update alarm state and streak
      const progress = await this.prisma.userProgress.findUnique({
        where: { userId },
      });

      streak = (progress?.currentStreak ?? 0) + 1;

      await this.prisma.userProgress.update({
        where: { userId },
        data: {
          isAlarmActive: false,
          activatedAt: null,
          currentStreak: streak,
        },
      });
    }

    return {
      success,
      score,
      streak,
    };
  }
}
