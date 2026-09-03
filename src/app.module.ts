import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UserModule } from './user/user.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { ProjectModule } from './project/project.module.js';
import { ApplicationModule } from './application/application.module.js';
import { PaymentModule } from './payment/payment.module.js';
import { WalletModule } from './wallet/wallet.module.js';
import { MessagingModule } from './conversation/conversation.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get('SMTP_HOST'),
          port: Number(config.get('SMTP_PORT')),
          secure: false,
          auth: {
            user: config.get('SMTP_USER'),
            pass: config.get('SMTP_PASS'),
          },
        },
        defaults: {
          from: config.get('MAIL_FROM'),
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    StorageModule,
    UserModule,
    PortfolioModule,
    ProjectModule,
    ApplicationModule,
    PaymentModule,
    WalletModule,
    MessagingModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
