import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { BookSummary } from 'shared';
import { PrismaService } from '../prisma/prisma.service';
import { IngestionService } from './ingestion/ingestion.service';

@Injectable()
export class BooksService {
  constructor(
    private prisma: PrismaService,
    private ingestionService: IngestionService,
  ) {}

  async uploadAndIngest(userId: string, buffer: Buffer): Promise<any> {
    const { title, author, content } = await this.ingestionService.parseEpub(buffer);
    
    const settings = await this.prisma.settings.findUnique({
      where: { userId },
    });
    
    const baseWPM = settings?.baseWPM ?? 250;
    const chunks = this.ingestionService.chunkText(content, baseWPM);

    const book = await this.prisma.book.create({
      data: {
        userId,
        title,
        author,
        passages: {
          create: chunks.map((chunk, index) => ({
            chunkIndex: index,
            content: chunk.content,
            estimatedMinutes: chunk.estimatedMinutes,
          })),
        },
      },
    });

    return book;
  }

  async findAll(userId: string): Promise<BookSummary[]> {
    const books = await this.prisma.book.findMany({
      where: { userId },
      include: {
        _count: {
          select: { passages: true },
        },
        passages: {
          where: { isRead: true },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return books.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      passageCount: book._count.passages,
      readCount: book.passages.length,
      isActive: book.isActive,
      createdAt: book.createdAt,
    }));
  }

  async activate(userId: string, bookId: string): Promise<void> {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    const settings = await this.prisma.settings.findUnique({
      where: { userId },
    });

    const timezone = settings?.timezone ?? 'Africa/Lagos';

    // Deactivate other books
    await this.prisma.book.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Activate this book
    await this.prisma.book.update({
      where: { id: bookId },
      data: { isActive: true },
    });

    // Schedule passages
    const passages = await this.prisma.passage.findMany({
      where: { bookId, isRead: false },
      orderBy: { chunkIndex: 'asc' },
    });

    let currentDay = DateTime.now().setZone(timezone).startOf('day');
    
    for (const passage of passages) {
      // Find next weekday
      while (currentDay.weekday > 5) {
        currentDay = currentDay.plus({ days: 1 });
      }
      
      await this.prisma.passage.update({
        where: { id: passage.id },
        data: { scheduledFor: currentDay.toJSDate() },
      });
      
      currentDay = currentDay.plus({ days: 1 });
    }
  }

  async delete(userId: string, bookId: string): Promise<void> {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    await this.prisma.book.delete({
      where: { id: bookId },
    });
  }
}
