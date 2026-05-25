import { Module } from '@nestjs/common';
import { QuizModule } from '../quiz/quiz.module';
import { CronService } from './cron.service';

@Module({
  imports: [QuizModule],
  providers: [CronService],
})
export class CronModule {}
