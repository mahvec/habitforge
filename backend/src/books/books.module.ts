import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { IngestionService } from './ingestion/ingestion.service';

@Module({
  providers: [BooksService, IngestionService],
  controllers: [BooksController]
})
export class BooksModule {}
