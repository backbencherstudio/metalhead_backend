import { Module } from '@nestjs/common';
import { StripeModule } from './stripe/stripe.module';
import { HelperOnboardingModule } from './helper-onboarding/helper-onboarding.module';

@Module({
  imports: [StripeModule,HelperOnboardingModule],
})
export class PaymentModule {}
