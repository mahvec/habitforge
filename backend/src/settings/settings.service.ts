import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { UserSettings } from 'shared';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async findOne(userId: string): Promise<UserSettings> {
    const settings = await this.prisma.settings.findUnique({
      where: { userId },
    });

    if (!settings) {
      throw new NotFoundException('Settings not found');
    }

    const isTimeLocked = await this.isTimeLocked(userId, settings);

    return {
      targetReadingTime: settings.targetReadingTime,
      timezone: settings.timezone,
      baseWPM: settings.baseWPM,
      selectedAlarmTone: settings.selectedAlarmTone,
      isTimeLocked,
    };
  }

  async update(userId: string, dto: UpdateSettingsDto): Promise<UserSettings> {
    const settings = await this.prisma.settings.findUnique({
      where: { userId },
    });

    if (!settings) {
      throw new NotFoundException('Settings not found');
    }

    // Only check lock if targetReadingTime is being changed
    if (dto.targetReadingTime && dto.targetReadingTime !== settings.targetReadingTime) {
      if (await this.isTimeLocked(userId, settings)) {
        throw new ForbiddenException('Discipline is non-negotiable. Change denied within 12 hours of alarm.');
      }
    }

    const updated = await this.prisma.settings.update({
      where: { userId },
      data: {
        ...dto,
        lastLockChange: dto.targetReadingTime ? new Date() : settings.lastLockChange,
      },
    });

    return this.findOne(userId);
  }

  private async isTimeLocked(userId: string, settings: any): Promise<boolean> {
    const now = DateTime.now().setZone(settings.timezone);
    const [hours, minutes] = settings.targetReadingTime.split(':').map(Number);
    
    let nextAlarm = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
    
    if (nextAlarm < now) {
      nextAlarm = nextAlarm.plus({ days: 1 });
    }

    // Skip weekends for alarm lock logic as well since no alarms trigger then
    while (nextAlarm.weekday > 5) {
      nextAlarm = nextAlarm.plus({ days: 1 });
    }

    const diffInHours = nextAlarm.diff(now, 'hours').hours;
    return diffInHours < 12;
  }
}
