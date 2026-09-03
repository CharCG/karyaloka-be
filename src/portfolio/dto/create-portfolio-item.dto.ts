import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePortfolioItemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  imageUrl!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  externalUrl!: string;
}
