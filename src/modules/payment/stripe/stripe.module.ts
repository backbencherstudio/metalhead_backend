import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { StripeMarketplaceService } from './stripe-marketplace.service';

@Module({
  controllers: [StripeController],
  providers: [StripeService, StripeMarketplaceService],
  exports: [StripeMarketplaceService],
})
export class StripeModule {}
