import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BookSummary } from 'shared';
import { User } from '../common/decorators/user.decorator';
import { BooksService } from './books.service';

@Controller('books')
export class BooksController {
  constructor(private booksService: BooksService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@User() user: any, @UploadedFile() file: Express.Multer.File) {
    return this.booksService.uploadAndIngest(user.id, file.buffer);
  }

  @Get()
  async findAll(@User() user: any): Promise<BookSummary[]> {
    return this.booksService.findAll(user.id);
  }

  @Post(':id/activate')
  async activate(@User() user: any, @Param('id') id: string) {
    return this.booksService.activate(user.id, id);
  }

  @Delete(':id')
  async delete(@User() user: any, @Param('id') id: string) {
    return this.booksService.delete(user.id, id);
  }
}
