import { Module } from '@nestjs/common';
import { CounterOfferService } from './counter-offer.service';
import { CounterOfferController } from './counter-offer.controller';
import { CounterOfferNotificationService } from './counter-offer-notification.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { JobModule } from '../job/job.module';

@Module({
  imports: [PrismaModule, JobModule],
  controllers: [CounterOfferController],
  providers: [CounterOfferService, CounterOfferNotificationService],
  exports: [CounterOfferService],
})
export class CounterOfferModule {}
