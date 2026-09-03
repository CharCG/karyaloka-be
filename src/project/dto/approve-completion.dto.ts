import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ApproveCompletionDto {
  @ApiProperty({ description: 'Rating for the freelancer (0.00 - 5.00)' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating!: number;
}
