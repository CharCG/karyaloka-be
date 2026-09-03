import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetPublicReadUrlDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsIn(['avatars', 'portfolios'])
  folder: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  path: string;
}
