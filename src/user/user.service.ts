import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UserRole } from '../generated/prisma/enums.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(currentUser: CurrentUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      include: {
        freelancerProfile: {
          include: {
            portfolioItems: { orderBy: { createdAt: 'desc' } },
            wallet: true,
          },
        },
        clientProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash: _passwordHash, ...result } = user;
    return result;
  }

  async updateProfile(currentUser: CurrentUserDto, dto: UpdateProfileDto) {
    const userUpdate: Record<string, any> = {};
    if (dto.name !== undefined) userUpdate.name = dto.name;
    if (dto.phone !== undefined) userUpdate.phone = dto.phone;
    if (dto.avatarUrl !== undefined) userUpdate.avatarUrl = dto.avatarUrl;

    if (Object.keys(userUpdate).length > 0) {
      await this.prisma.user.update({
        where: { id: currentUser.id },
        data: userUpdate,
      });
    }

    if (currentUser.role === UserRole.FREELANCER) {
      const profileUpdate: Record<string, any> = {};
      if (dto.description !== undefined) profileUpdate.description = dto.description;
      if (dto.skills !== undefined) profileUpdate.skills = dto.skills;

      if (Object.keys(profileUpdate).length > 0) {
        await this.prisma.freelancerProfile.update({
          where: { userId: currentUser.id },
          data: profileUpdate,
        });
      }
    } else if (currentUser.role === UserRole.CLIENT) {
      if (dto.description !== undefined) {
        await this.prisma.clientProfile.update({
          where: { userId: currentUser.id },
          data: { description: dto.description },
        });
      }
    }

    return this.getMe(currentUser);
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        freelancerProfile: {
          include: {
            portfolioItems: { orderBy: { createdAt: 'desc' } },
            _count: { select: { assignedProjects: { where: { status: 'IN_PROGRESS' } } } },
          },
        },
        clientProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash: _passwordHash, ...result } = user;
    return result;
  }
}
