import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Time must be in HH:mm format' })
  targetReadingTime?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  baseWPM?: number;

  @IsOptional()
  @IsString()
  selectedAlarmTone?: string;
}
