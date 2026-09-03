import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto.js';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FREELANCER)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getBalance(@CurrentUser() user: CurrentUserDto) {
    return this.walletService.getBalance(user.id);
  }

  @Post('withdraw')
  async withdraw(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateWithdrawalDto) {
    return this.walletService.withdraw(user.id, dto);
  }

  @Get('withdrawals')
  async listWithdrawals(@CurrentUser() user: CurrentUserDto) {
    return this.walletService.listWithdrawals(user.id);
  }
}
