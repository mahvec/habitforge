import { Body, Controller, Get, Put } from '@nestjs/common';
import { UserSettings } from 'shared';
import { User } from '../common/decorators/user.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  async findOne(@User() user: any): Promise<UserSettings> {
    return this.settingsService.findOne(user.id);
  }

  @Put()
  async update(
    @User() user: any,
    @Body() dto: UpdateSettingsDto,
  ): Promise<UserSettings> {
    return this.settingsService.update(user.id, dto);
  }
}
