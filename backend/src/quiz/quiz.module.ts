import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { GeminiService } from './gemini/gemini.service';

@Module({
  providers: [QuizService, GeminiService],
  controllers: [QuizController],
  exports: [GeminiService],
})
export class QuizModule {}
