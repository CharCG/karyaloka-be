import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';

@Injectable()
export class ApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(currentUser: CurrentUserDto, projectId: string) {
    const freelancerProfile = await this.prisma.freelancerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!freelancerProfile) {
      throw new NotFoundException('Freelancer profile not found');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status !== 'OPEN') {
      throw new BadRequestException('Project is not open for applications');
    }

    const existing = await this.prisma.projectApplication.findUnique({
      where: {
        projectId_freelancerId: {
          projectId,
          freelancerId: freelancerProfile.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException('You have already applied to this project');
    }

    return this.prisma.projectApplication.create({
      data: {
        projectId,
        freelancerId: freelancerProfile.id,
      },
    });
  }

  async withdraw(currentUser: CurrentUserDto, projectId: string) {
    const freelancerProfile = await this.prisma.freelancerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!freelancerProfile) {
      throw new NotFoundException('Freelancer profile not found');
    }

    const application = await this.prisma.projectApplication.findUnique({
      where: {
        projectId_freelancerId: {
          projectId,
          freelancerId: freelancerProfile.id,
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'APPLIED') {
      throw new BadRequestException('Can only withdraw applications with APPLIED status');
    }

    return this.prisma.projectApplication.update({
      where: { id: application.id },
      data: { status: 'WITHDRAWN' },
    });
  }

  async listCandidates(currentUser: CurrentUserDto, projectId: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!clientProfile) {
      throw new NotFoundException('Client profile not found');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.clientId !== clientProfile.id) {
      throw new ForbiddenException('Not your project');
    }

    return this.prisma.projectApplication.findMany({
      where: {
        projectId,
        status: 'APPLIED',
      },
      include: {
        freelancer: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            portfolioItems: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }
}
