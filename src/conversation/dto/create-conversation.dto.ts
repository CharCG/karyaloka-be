import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  participantId!: string;
}
