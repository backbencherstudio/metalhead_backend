import { Module } from '@nestjs/common';
import { StripeModule } from './stripe/stripe.module';
import { HelperOnboardingModule } from './helper-onboarding/helper-onboarding.module';
import { CardModule } from './card/card.module';

@Module({
  imports: [StripeModule, HelperOnboardingModule, CardModule],
})
export class PaymentModule {}
