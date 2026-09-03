import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto.js';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private async getWallet(userId: string) {
    const profile = await this.prisma.freelancerProfile.findUnique({
      where: { userId },
      include: { wallet: true },
    });

    if (!profile) {
      throw new NotFoundException('Freelancer profile not found');
    }

    if (!profile.wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return profile.wallet;
  }

  async getBalance(userId: string) {
    const wallet = await this.getWallet(userId);
    return { balance: wallet.balance };
  }

  async withdraw(userId: string, dto: CreateWithdrawalDto) {
    const wallet = await this.getWallet(userId);
    const currentBalance = Number(wallet.balance);

    if (dto.amount > currentBalance) {
      throw new BadRequestException('Insufficient balance');
    }

    const [withdrawal] = await this.prisma.$transaction([
      this.prisma.withdrawal.create({
        data: {
          walletId: wallet.id,
          amount: dto.amount,
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      }),
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: dto.amount },
        },
      }),
    ]);

    return withdrawal;
  }

  async listWithdrawals(userId: string) {
    const wallet = await this.getWallet(userId);

    return this.prisma.withdrawal.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
