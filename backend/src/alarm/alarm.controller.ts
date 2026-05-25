import { Controller, Get, Post } from '@nestjs/common';
import { AlarmStatus } from 'shared';
import { User } from '../common/decorators/user.decorator';
import { AlarmService } from './alarm.service';

@Controller('alarm')
export class AlarmController {
  constructor(private alarmService: AlarmService) {}

  @Get('status')
  async getStatus(@User() user: any): Promise<AlarmStatus> {
    return this.alarmService.getStatus(user.id);
  }

  @Post('override-no-quiz')
  async override(@User() user: any): Promise<void> {
    return this.alarmService.overrideNoQuiz(user.id);
  }
}
