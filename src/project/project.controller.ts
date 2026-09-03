import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ProjectService } from './project.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { SubmitDeliverableDto } from './dto/submit-deliverable.dto.js';
import { ApproveCompletionDto } from './dto/approve-completion.dto.js';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @Roles(UserRole.CLIENT)
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateProjectDto) {
    return this.projectService.create(user, dto);
  }

  @Get('dashboard')
  @Roles(UserRole.CLIENT)
  async getDashboard(@CurrentUser() user: CurrentUserDto) {
    return this.projectService.getClientDashboard(user);
  }

  @Get('discover')
  @Roles(UserRole.FREELANCER)
  async discover(@CurrentUser() user: CurrentUserDto, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.projectService.discover(user, page ? +page : 1, limit ? +limit : 10);
  }

  @Get('mine')
  async listMine(@CurrentUser() user: CurrentUserDto, @Query('tab') tab?: string) {
    if (user.role === UserRole.CLIENT) {
      return this.projectService.listForClient(user, tab);
    }
    return this.projectService.listForFreelancer(user, tab);
  }

  @Get(':id')
  async getDetail(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.projectService.getDetail(user, id);
  }

  @Patch(':id/close')
  @Roles(UserRole.CLIENT)
  async close(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.projectService.close(user, id);
  }

  @Patch(':id/submit')
  @Roles(UserRole.FREELANCER)
  async submitDeliverable(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: SubmitDeliverableDto,
  ) {
    return this.projectService.submitDeliverable(user, id, dto);
  }

  @Patch(':id/approve')
  @Roles(UserRole.CLIENT)
  async approveCompletion(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Body() dto: ApproveCompletionDto,
  ) {
    return this.projectService.approveCompletion(user, id, dto);
  }
}
