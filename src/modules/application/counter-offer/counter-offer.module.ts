import { Module } from '@nestjs/common';
import { CounterOfferService } from './counter-offer.service';
import { CounterOfferController } from './counter-offer.controller';
import { CounterOfferNotificationService } from './counter-offer-notification.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { JobModule } from '../job/job.module';
import { StripeModule } from 'src/modules/payment/stripe/stripe.module';
import { StripeMarketplaceService } from 'src/modules/payment/stripe/stripe-marketplace.service';

@Module({
  imports: [PrismaModule, JobModule, StripeModule],
  controllers: [CounterOfferController],
  providers: [CounterOfferService, CounterOfferNotificationService, StripeMarketplaceService],
  exports: [CounterOfferService],
})
export class CounterOfferModule {}
