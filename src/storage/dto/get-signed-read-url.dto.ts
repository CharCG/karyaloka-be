import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetSignedReadUrlDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsIn(['deliverables'])
  folder: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  path: string;
}
