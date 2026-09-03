import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { SubmitDeliverableDto } from './dto/submit-deliverable.dto.js';
import { ApproveCompletionDto } from './dto/approve-completion.dto.js';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(currentUser: CurrentUserDto, dto: CreateProjectDto) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId: currentUser.id },
    });

    if (!clientProfile) {
      throw new NotFoundException('Client profile not found');
    }

    return this.prisma.project.create({
      data: {
        clientId: clientProfile.id,
        title: dto.title,
        description: dto.description,
        skills: dto.skills,
        budget: dto.budget,
        deadline: new Date(dto.deadline),
      },
    });
  }

  async listForClient(currentUser: CurrentUserDto, tab?: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!clientProfile) {
      throw new NotFoundException('Client profile not found');
    }

    const where: any = { clientId: clientProfile.id };

    if (tab === 'active') {
      where.status = { in: ['IN_PROGRESS', 'NEED_REVIEW'] };
    } else if (tab === 'completed') {
      where.status = 'COMPLETED';
    }

    return this.prisma.project.findMany({
      where,
      include: {
        assignedFreelancer: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { applications: { where: { status: 'APPLIED' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForFreelancer(currentUser: CurrentUserDto, tab?: string) {
    const freelancerProfile = await this.prisma.freelancerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!freelancerProfile) {
      throw new NotFoundException('Freelancer profile not found');
    }

    const applicationWhere: any = { freelancerId: freelancerProfile.id };

    if (tab === 'active') {
      applicationWhere.project = { status: { in: ['IN_PROGRESS', 'NEED_REVIEW'] } };
      applicationWhere.status = 'HIRED';
    } else if (tab === 'completed') {
      applicationWhere.project = { status: 'COMPLETED' };
      applicationWhere.status = 'HIRED';
    }

    const applications = await this.prisma.projectApplication.findMany({
      where: applicationWhere,
      include: {
        project: {
          include: {
            client: {
              include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });

    return applications.map((app) => ({
      ...app.project,
      applicationStatus: app.status,
      appliedAt: app.appliedAt,
    }));
  }

  async discover(currentUser: CurrentUserDto, page = 1, limit = 10) {
    const freelancerProfile = await this.prisma.freelancerProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!freelancerProfile) {
      throw new NotFoundException('Freelancer profile not found');
    }

    const appliedProjectIds = await this.prisma.projectApplication.findMany({
      where: { freelancerId: freelancerProfile.id },
      select: { projectId: true },
    });

    const excludedIds = appliedProjectIds.map((a) => a.projectId);

    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          status: 'OPEN',
          id: { notIn: excludedIds },
        },
        include: {
          client: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({
        where: {
          status: 'OPEN',
          id: { notIn: excludedIds },
        },
      }),
    ]);

    return { projects, total, page, limit };
  }

  async getDetail(currentUser: CurrentUserDto, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        assignedFreelancer: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        applications: {
          where: { status: 'APPLIED' },
          include: {
            freelancer: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        },
        payment: {
          include: { escrow: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (currentUser.role === 'FREELANCER') {
      const freelancerProfile = await this.prisma.freelancerProfile.findUnique({
        where: { userId: currentUser.id },
        select: { id: true },
      });

      if (freelancerProfile) {
        const myApplication = await this.prisma.projectApplication.findUnique({
          where: {
            projectId_freelancerId: {
              projectId,
              freelancerId: freelancerProfile.id,
            },
          },
        });

        return { ...project, myApplication };
      }
    }

    return project;
  }

  async close(currentUser: CurrentUserDto, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId: currentUser.id },
    });

    if (!clientProfile || project.clientId !== clientProfile.id) {
      throw new ForbiddenException('Not your project');
    }

    if (project.status !== 'OPEN') {
      throw new BadRequestException('Project can only be closed when OPEN');
    }

    if (project.assignedFreelancerId) {
      throw new BadRequestException('Cannot close project after a freelancer has been hired');
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'CLOSED' },
    });
  }

  async submitDeliverable(currentUser: CurrentUserDto, projectId: string, dto: SubmitDeliverableDto) {
    const freelancerProfile = await this.prisma.freelancerProfile.findUnique({
      where: { userId: currentUser.id },
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

    if (project.assignedFreelancerId !== freelancerProfile.id) {
      throw new ForbiddenException('You are not assigned to this project');
    }

    if (project.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Project must be IN_PROGRESS to submit deliverable');
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'NEED_REVIEW',
        deliverableUrl: dto.deliverableUrl,
        submittedAt: new Date(),
      },
    });
  }

  async approveCompletion(currentUser: CurrentUserDto, projectId: string, dto: ApproveCompletionDto) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId: currentUser.id },
    });

    if (!clientProfile) {
      throw new NotFoundException('Client profile not found');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        payment: { include: { escrow: true } },
        assignedFreelancer: {
          include: { wallet: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.clientId !== clientProfile.id) {
      throw new ForbiddenException('Not your project');
    }

    if (project.status !== 'NEED_REVIEW') {
      throw new BadRequestException('Project must be in NEED_REVIEW status to approve');
    }

    if (!project.payment?.escrow) {
      throw new BadRequestException('No escrow found for this project');
    }

    if (!project.assignedFreelancer?.wallet) {
      throw new BadRequestException('Freelancer wallet not found');
    }

    const escrow = project.payment.escrow;
    const wallet = project.assignedFreelancer.wallet;
    const freelancer = project.assignedFreelancer;
    const budgetAmount = project.budget;

    const oldRating = Number(freelancer.rating);
    const oldCount = freelancer.completedCount;
    const newRating = (oldRating * oldCount + dto.rating) / (oldCount + 1);
    const roundedRating = Math.round(newRating * 100) / 100;

    await this.prisma.$transaction([
      this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'COMPLETED',
          approvedAt: new Date(),
        },
      }),
      this.prisma.escrow.update({
        where: { id: escrow.id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      }),
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: escrow.amount },
        },
      }),
      this.prisma.freelancerProfile.update({
        where: { id: freelancer.id },
        data: {
          completedCount: { increment: 1 },
          totalEarning: { increment: budgetAmount },
          rating: roundedRating,
        },
      }),
      this.prisma.clientProfile.update({
        where: { id: clientProfile.id },
        data: {
          completedCount: { increment: 1 },
          totalSpent: { increment: budgetAmount },
        },
      }),
    ]);

    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        payment: { include: { escrow: true } },
      },
    });
  }

  async getClientDashboard(currentUser: CurrentUserDto) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true },
    });

    if (!clientProfile) {
      throw new NotFoundException('Client profile not found');
    }

    const [openCount, activeCount, completedCount, needReviewProjects, recentProjects] = await Promise.all([
      this.prisma.project.count({
        where: { clientId: clientProfile.id, status: 'OPEN' },
      }),
      this.prisma.project.count({
        where: {
          clientId: clientProfile.id,
          status: { in: ['IN_PROGRESS', 'NEED_REVIEW'] },
        },
      }),
      this.prisma.project.count({
        where: { clientId: clientProfile.id, status: 'COMPLETED' },
      }),
      this.prisma.project.findMany({
        where: { clientId: clientProfile.id, status: 'NEED_REVIEW' },
        include: {
          assignedFreelancer: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.project.findMany({
        where: {
          clientId: clientProfile.id,
          status: { not: 'COMPLETED' },
        },
        include: {
          assignedFreelancer: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      overview: { openCount, activeCount, completedCount },
      needReviewProjects,
      recentProjects,
    };
  }
}
