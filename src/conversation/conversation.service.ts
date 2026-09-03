import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeParticipants(userId1: string, userId2: string) {
    return userId1 < userId2
      ? { participantAId: userId1, participantBId: userId2 }
      : { participantAId: userId2, participantBId: userId1 };
  }

  async getOrCreateConversation(currentUserId: string, otherUserId: string) {
    if (currentUserId === otherUserId) {
      throw new BadRequestException('Cannot create conversation with yourself');
    }

    const otherUser = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    });

    if (!otherUser) {
      throw new NotFoundException('User not found');
    }

    const { participantAId, participantBId } = this.normalizeParticipants(currentUserId, otherUserId);

    let conversation = await this.prisma.conversation.findUnique({
      where: {
        participantAId_participantBId: { participantAId, participantBId },
      },
      include: {
        participantA: { select: { id: true, name: true, avatarUrl: true } },
        participantB: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { participantAId, participantBId },
        include: {
          participantA: { select: { id: true, name: true, avatarUrl: true } },
          participantB: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
    }

    return conversation;
  }

  async listConversations(currentUserId: string, filter?: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ participantAId: currentUserId }, { participantBId: currentUserId }],
      },
      include: {
        participantA: { select: { id: true, name: true, avatarUrl: true } },
        participantB: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const result = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: currentUserId },
            readStatus: 'UNREAD',
          },
        });

        const lastMessage = conv.messages[0] ?? null;

        return {
          id: conv.id,
          participantA: conv.participantA,
          participantB: conv.participantB,
          lastMessage,
          unreadCount,
          updatedAt: conv.updatedAt,
        };
      }),
    );

    if (filter === 'unread') {
      return result.filter((c) => c.unreadCount > 0);
    }

    return result;
  }

  async getMessages(currentUserId: string, conversationId: string, page = 1, limit = 50) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participantAId !== currentUserId && conversation.participantBId !== currentUserId) {
      throw new ForbiddenException('Not your conversation');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return { messages, total, page, limit };
  }

  async sendMessage(currentUserId: string, conversationId: string, dto: SendMessageDto) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participantAId !== currentUserId && conversation.participantBId !== currentUserId) {
      throw new ForbiddenException('Not your conversation');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: currentUserId,
        content: dto.content,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async markAsRead(currentUserId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participantAId !== currentUserId && conversation.participantBId !== currentUserId) {
      throw new ForbiddenException('Not your conversation');
    }

    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: currentUserId },
        readStatus: 'UNREAD',
      },
      data: { readStatus: 'READ' },
    });

    return { markedAsRead: result.count };
  }
}
