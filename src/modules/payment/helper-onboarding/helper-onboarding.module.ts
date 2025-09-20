import { Module } from '@nestjs/common';
import { HelperOnboardingController } from './helper-onboarding.controller';
import { HelperOnboardingService } from './helper-onboarding.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HelperOnboardingController],
  providers: [HelperOnboardingService],
  exports: [HelperOnboardingService],
})
export class HelperOnboardingModule {}