import { IsIn, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetSignedUploadUrlDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsIn(['avatars', 'portfolios', 'portfolio', 'deliverables'])
  folder: string;

  @ApiPropertyOptional()
  @ValidateIf((dto) => dto.folder === 'deliverables')
  @IsNotEmpty()
  @IsString()
  projectId?: string;
}
