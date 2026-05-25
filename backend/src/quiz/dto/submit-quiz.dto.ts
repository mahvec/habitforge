import { IsArray, IsNumber } from 'class-validator';

export class SubmitQuizDto {
  @IsArray()
  @IsNumber({}, { each: true })
  answers: number[];
}
