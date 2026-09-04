import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePortfolioItemDto } from './dto/create-portfolio-item.dto.js';

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  private async getFreelancerProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.freelancerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Freelancer profile not found');
    }

    return profile.id;
  }

  async listOwn(userId: string) {
    const freelancerId = await this.getFreelancerProfileId(userId);

    return this.prisma.portfolioItem.findMany({
      where: { freelancerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreatePortfolioItemDto) {
    const freelancerId = await this.getFreelancerProfileId(userId);

    const imageUrl = dto.imageUrl || '';
    const description = dto.description || dto.title || '';
    const externalUrl = dto.externalUrl || dto.projectUrl || '';

    return this.prisma.portfolioItem.create({
      data: {
        freelancerId,
        imageUrl,
        description,
        externalUrl,
      },
    });
  }

  async remove(userId: string, itemId: string) {
    const freelancerId = await this.getFreelancerProfileId(userId);

    const item = await this.prisma.portfolioItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }

    if (item.freelancerId !== freelancerId) {
      throw new ForbiddenException('Not your portfolio item');
    }

    await this.prisma.portfolioItem.delete({ where: { id: itemId } });

    return { message: 'Portfolio item deleted' };
  }
}
