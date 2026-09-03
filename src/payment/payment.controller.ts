import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';
import { InitiatePaymentDto } from './dto/initiate-payment.dto.js';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post('initiate')
  async initiatePayment(@CurrentUser() user: CurrentUserDto, @Body() dto: InitiatePaymentDto) {
    return this.paymentService.initiatePayment(user, dto);
  }

  @Post('webhook')
  async handleWebhook(@Body() notification: any) {
    return this.paymentService.handleWebhook(notification);
  }
}
