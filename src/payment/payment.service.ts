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

    const budgetAmount = Math.round(Number(project.budget));
    const serviceFee = Math.round(budgetAmount * 0.02);
    const totalAmount = budgetAmount + serviceFee;

    const shortProjectId = dto.projectId.replace(/-/g, '').slice(0, 12);
    const shortFreelancerId = dto.freelancerId.replace(/-/g, '').slice(0, 12);
    const timestamp = Date.now().toString().slice(-8);
    const orderId = `KL_${shortProjectId}_${shortFreelancerId}_${timestamp}`;

    await this.prisma.payment.upsert({
      where: { projectId: dto.projectId },
      create: {
        projectId: dto.projectId,
        budgetAmount,
        serviceFee,
        totalAmount,
        status: 'PENDING',
        gatewayRef: `${orderId}:${dto.projectId}:${dto.freelancerId}`,
      },
      update: {
        budgetAmount,
        serviceFee,
        totalAmount,
        status: 'PENDING',
        gatewayRef: `${orderId}:${dto.projectId}:${dto.freelancerId}`,
      },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL')!;

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: totalAmount,
      },
      item_details: [
        {
          id: dto.projectId.slice(0, 30),
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
      callbacks: {
        finish: `${frontendUrl}/client/projects/${dto.projectId}/payment/success`,
        error: `${frontendUrl}/client/projects/${dto.projectId}/checkout/${dto.freelancerId}`,
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

  async verifyPayment(projectId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { projectId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'PAID') {
      return { status: 'PAID', paid: true };
    }

    if (!payment.gatewayRef) {
      throw new BadRequestException('No payment order associated with this project');
    }

    const orderId = payment.gatewayRef.split(':')[0];

    try {
      const statusResponse = await (this.snap as any).transaction.status(orderId);
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;

      if (
        (transactionStatus === 'capture' && fraudStatus === 'accept') ||
        transactionStatus === 'settlement'
      ) {
        await this.processSuccessfulPayment(orderId, statusResponse.transaction_id);
        return { status: 'PAID', paid: true, message: 'Payment confirmed successfully' };
      }

      return { status: payment.status, transactionStatus, paid: false };
    } catch (error: any) {
      this.logger.warn(`Failed to verify Midtrans status for order ${orderId}: ${error.message}`);
      return { status: payment.status, paid: false };
    }
  }

  async handleWebhook(notification: any) {
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

    if ((transactionStatus === 'capture' && fraudStatus === 'accept') || transactionStatus === 'settlement') {
      await this.processSuccessfulPayment(orderId, notification.transaction_id);
    }

    return { status: 'ok' };
  }

  private async processSuccessfulPayment(orderId: string, transactionId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        gatewayRef: { startsWith: `${orderId}:` },
      },
    });

    let projectId: string;
    let freelancerId: string;

    if (payment && payment.gatewayRef) {
      const parts = payment.gatewayRef.split(':');
      projectId = parts[1];
      freelancerId = parts[2];
    } else {
      this.logger.error(`Cannot resolve payment for orderId: ${orderId}`);
      return;
    }

    if (payment.status === 'PAID') {
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

      const budgetAmount = Math.round(Number(project.budget));
      const serviceFee = Math.round(budgetAmount * 0.02);
      const totalAmount = budgetAmount + serviceFee;

      const updatedPayment = await tx.payment.upsert({
        where: { projectId },
        create: {
          projectId,
          budgetAmount,
          serviceFee,
          totalAmount,
          status: 'PAID',
          gatewayRef: transactionId || orderId,
          paidAt: new Date(),
        },
        update: {
          status: 'PAID',
          gatewayRef: transactionId || orderId,
          paidAt: new Date(),
        },
      });

      await tx.escrow.upsert({
        where: { paymentId: updatedPayment.id },
        create: {
          paymentId: updatedPayment.id,
          amount: project.budget,
        },
        update: {},
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
