import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ConversationService } from './conversation.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  async listConversations(@CurrentUser() user: CurrentUserDto, @Query('filter') filter?: string) {
    return this.conversationService.listConversations(user.id, filter);
  }

  @Post()
  async getOrCreate(@CurrentUser() user: CurrentUserDto, @Body() dto: CreateConversationDto) {
    return this.conversationService.getOrCreateConversation(user.id, dto.participantId);
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationService.getMessages(user.id, id, page ? +page : 1, limit ? +limit : 50);
  }

  @Post(':id/messages')
  async sendMessage(@CurrentUser() user: CurrentUserDto, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.conversationService.sendMessage(user.id, id, dto);
  }

  @Patch(':id/read')
  async markAsRead(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
    return this.conversationService.markAsRead(user.id, id);
  }
}
