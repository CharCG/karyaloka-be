import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SubmitDeliverableDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  deliverableUrl!: string;
}
