import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';
import { CreatePortfolioItemDto } from './dto/create-portfolio-item.dto.js';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FREELANCER)
@Controller('portfolios')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  async list(@CurrentUser() user: CurrentUserDto) {
    return this.portfolioService.listOwn(user.id);
  }

  @Post()
  async create(@CurrentUser() user: CurrentUserDto, @Body() dto: CreatePortfolioItemDto) {
    return this.portfolioService.create(user.id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.portfolioService.remove(user.id, id);
  }
}
