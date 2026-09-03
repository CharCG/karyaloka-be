import { Controller, Post, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationService } from './application.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post('apply')
  @Roles(UserRole.FREELANCER)
  async apply(@CurrentUser() user: CurrentUserDto, @Param('projectId') projectId: string) {
    return this.applicationService.apply(user, projectId);
  }

  @Delete('apply')
  @Roles(UserRole.FREELANCER)
  async withdraw(@CurrentUser() user: CurrentUserDto, @Param('projectId') projectId: string) {
    return this.applicationService.withdraw(user, projectId);
  }

  @Get('applications')
  @Roles(UserRole.CLIENT)
  async listCandidates(@CurrentUser() user: CurrentUserDto, @Param('projectId') projectId: string) {
    return this.applicationService.listCandidates(user, projectId);
  }
}
