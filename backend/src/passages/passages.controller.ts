import { Controller, Get } from '@nestjs/common';
import { TodayPassage } from 'shared';
import { User } from '../common/decorators/user.decorator';
import { PassagesService } from './passages.service';

@Controller('passages')
export class PassagesController {
  constructor(private passagesService: PassagesService) {}

  @Get('today')
  async getToday(@User() user: any): Promise<TodayPassage> {
    return this.passagesService.findTodayPassage(user.id);
  }
}
