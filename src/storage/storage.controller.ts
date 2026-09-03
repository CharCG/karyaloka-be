import { Controller, Body, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { StorageService } from './storage.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';
import { GetSignedUploadUrlDto } from './dto/get-signed-upload-url.dto.js';
import { GetSignedReadUrlDto } from './dto/get-signed-read-url.dto.js';
import { GetPublicReadUrlDto } from './dto/get-public-read-url.dto.js';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('signed-upload-url')
  async getSignedUploadUrl(@Body() dto: GetSignedUploadUrlDto, @CurrentUser() user: CurrentUserDto) {
    return this.storageService.getSignedUploadUrl({
      userId: user.id,
      fileName: dto.fileName,
      folder: dto.folder,
      projectId: dto.projectId,
    });
  }

  @Get('signed-read-url')
  async getSignedReadUrl(@Query() query: GetSignedReadUrlDto) {
    const signedUrl = await this.storageService.getSignedReadUrl(query.folder, query.path);
    return { signedUrl };
  }

  @Get('public-read-url')
  async getPublicUrl(@Query() query: GetPublicReadUrlDto) {
    const publicUrl = this.storageService.getPublicUrl(query.folder, query.path);
    return { publicUrl };
  }
}
