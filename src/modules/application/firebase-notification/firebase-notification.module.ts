import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../prisma/prisma.module';
import { FirebaseNotificationService } from './firebase-notification.service';
import { FirebaseNotificationController } from './firebase-notification.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [FirebaseNotificationController],
  providers: [FirebaseNotificationService],
  exports: [FirebaseNotificationService],
})
export class FirebaseNotificationModule {}
