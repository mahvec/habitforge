import { Body, Controller, Get, Post } from '@nestjs/common';
import { QuizResponse, QuizSubmissionResult } from 'shared';
import { User } from '../common/decorators/user.decorator';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { QuizService } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private quizService: QuizService) {}

  @Get('today')
  async getToday(@User() user: any): Promise<QuizResponse> {
    return this.quizService.getTodayQuiz(user.id);
  }

  @Post('submit')
  async submit(
    @User() user: any,
    @Body() dto: SubmitQuizDto,
  ): Promise<QuizSubmissionResult> {
    return this.quizService.submitQuiz(user.id, dto.answers);
  }
}
