import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUserDto } from '../common/dto/current-user.dto.js';
import { InitiatePaymentDto } from './dto/initiate-payment.dto.js';
import midtransClient from 'midtrans-client';
import crypto from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private snap: InstanceType<typeof midtransClient.Snap>;
  private serverKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY')!;

    this.snap = new midtransClient.Snap({
      isProduction: this.configService.get('MIDTRANS_IS_PRODUCTION') === 'true',
      serverKey: this.serverKey,
      clientKey: this.configService.get<string>('MIDTRANS_CLIENT_KEY')!,
    });
  }

  async initiatePayment(currentUser: CurrentUserDto, dto: InitiatePaymentDto) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId: currentUser.id },
      include: { user: true },
    });

    if (!clientProfile) {
      throw new NotFoundException('Client profile not found');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.clientId !== clientProfile.id) {
      throw new ForbiddenException('Not your project');
    }

    if (project.status !== 'OPEN') {
      throw new BadRequestException('Project must be OPEN to initiate payment');
    }

    const application = await this.prisma.projectApplication.findUnique({
      where: {
        projectId_freelancerId: {
          projectId: dto.projectId,
          freelancerId: dto.freelancerId,
        },
      },
    });

    if (!application || application.status !== 'APPLIED') {
      throw new BadRequestException('Freelancer has not applied or application is not in APPLIED status');
    }

    const budgetAmount = Number(project.budget);
    const serviceFee = Math.round(budgetAmount * 0.02 * 100) / 100; // 2% service fee
    const totalAmount = budgetAmount + serviceFee;

    const orderId = `KL-${dto.projectId}-${dto.freelancerId}-${Date.now()}`;

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: totalAmount,
      },
      item_details: [
        {
          id: dto.projectId,
          price: budgetAmount,
          quantity: 1,
          name: project.title.substring(0, 50),
        },
        {
          id: 'service-fee',
          price: serviceFee,
          quantity: 1,
          name: 'Service Fee (2%)',
        },
      ],
      customer_details: {
        first_name: clientProfile.user.name,
        email: clientProfile.user.email,
      },
    };

    try {
      const transaction = await this.snap.createTransaction(parameter);
      return {
        snapToken: transaction.token,
        redirectUrl: transaction.redirect_url,
        orderId,
        budgetAmount,
        serviceFee,
        totalAmount,
      };
    } catch (error) {
      this.logger.error('Midtrans createTransaction failed', error);
      throw new InternalServerErrorException('Failed to create payment transaction');
    }
  }

  async handleWebhook(notification: any) {
    // Verify signature
    const orderId = notification.order_id;
    const statusCode = notification.status_code;
    const grossAmount = notification.gross_amount;

    const signatureKey = crypto
      .createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${this.serverKey}`)
      .digest('hex');

    if (signatureKey !== notification.signature_key) {
      this.logger.warn('Invalid Midtrans signature');
      throw new BadRequestException('Invalid signature');
    }

    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    this.logger.log(`Webhook received: orderId=${orderId}, status=${transactionStatus}, fraud=${fraudStatus}`);

    if (
      transactionStatus === 'capture' && fraudStatus === 'accept' ||
      transactionStatus === 'settlement'
    ) {
      await this.processSuccessfulPayment(orderId, notification.transaction_id);
    }

    return { status: 'ok' };
  }

  private async processSuccessfulPayment(orderId: string, transactionId: string) {
    const parts = orderId.split('-');
    if (parts.length < 4 || parts[0] !== 'KL') {
      this.logger.error(`Invalid orderId format: ${orderId}`);
      return;
    }

    const projectId = parts[1];
    const freelancerId = parts[2];

    const existingPayment = await this.prisma.payment.findUnique({
      where: { projectId },
    });

    if (existingPayment) {
      this.logger.log(`Payment already processed for project ${projectId}`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      if (project.status !== 'OPEN' || project.assignedFreelancerId !== null) {
        this.logger.warn(`Race condition: project ${projectId} is no longer OPEN or already assigned`);
        return;
      }

      const application = await tx.projectApplication.findUnique({
        where: {
          projectId_freelancerId: {
            projectId,
            freelancerId,
          },
        },
      });

      if (!application || application.status !== 'APPLIED') {
        throw new Error(`Application not found or not in APPLIED status`);
      }

      const budgetAmount = Number(project.budget);
      const serviceFee = Math.round(budgetAmount * 0.02 * 100) / 100;
      const totalAmount = budgetAmount + serviceFee;

      const payment = await tx.payment.create({
        data: {
          projectId,
          budgetAmount: project.budget,
          serviceFee,
          totalAmount,
          status: 'PAID',
          gatewayRef: transactionId,
          paidAt: new Date(),
        },
      });

      await tx.escrow.create({
        data: {
          paymentId: payment.id,
          amount: project.budget,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: 'IN_PROGRESS',
          assignedFreelancerId: freelancerId,
        },
      });

      await tx.projectApplication.update({
        where: { id: application.id },
        data: { status: 'HIRED' },
      });

      await tx.projectApplication.updateMany({
        where: {
          projectId,
          freelancerId: { not: freelancerId },
          status: 'APPLIED',
        },
        data: { status: 'REJECTED' },
      });
    });

    this.logger.log(`Payment processed successfully for project ${projectId}`);
  }
}
