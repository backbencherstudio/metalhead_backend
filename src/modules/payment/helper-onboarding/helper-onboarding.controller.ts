import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HelperOnboardingService } from './helper-onboarding.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Helper Onboarding')
@UseGuards(JwtAuthGuard)
@Controller('payment/helper-onboarding')
export class HelperOnboardingController {
  constructor(
    private readonly helperOnboardingService: HelperOnboardingService,
  ) {}

  @ApiOperation({ summary: 'Get Stripe onboarding link for helper' })
  @Get('onboarding-link')
  async getOnboardingLink(@Req() req: Request) {
    const userId = req.user.userId;
    return await this.helperOnboardingService.getOnboardingLink(userId);
  }

  @ApiOperation({ summary: 'Check Stripe onboarding status' })
  @Get('onboarding-status')
  async checkOnboardingStatus(@Req() req: Request) {
    const userId = req.user.userId;
    return await this.helperOnboardingService.checkOnboardingStatus(userId);
  }

  @ApiOperation({ summary: 'Get helper payment status' })
  @Get('payment-status')
  async getHelperPaymentStatus(@Req() req: Request) {
    const userId = req.user.userId;
    return await this.helperOnboardingService.getHelperPaymentStatus(userId);
  }
}