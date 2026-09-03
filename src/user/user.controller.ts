import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserDto) {
    return this.userService.getMe(user);
  }

  @Patch('me')
  async updateProfile(@CurrentUser() user: CurrentUserDto, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(user, dto);
  }

  @Get(':id/profile')
  async getPublicProfile(@Param('id') id: string) {
    return this.userService.getPublicProfile(id);
  }
}
