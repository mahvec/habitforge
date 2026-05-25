import { Module } from '@nestjs/common';
import { PassagesService } from './passages.service';
import { PassagesController } from './passages.controller';

@Module({
  providers: [PassagesService],
  controllers: [PassagesController]
})
export class PassagesModule {}
