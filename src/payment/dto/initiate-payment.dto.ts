import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  projectId!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  freelancerId!: string;
}
