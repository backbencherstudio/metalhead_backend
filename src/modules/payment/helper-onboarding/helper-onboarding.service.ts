import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripePayment } from '../../../common/lib/Payment/stripe/StripePayment';
import appConfig from '../../../config/app.config';

@Injectable()
export class HelperOnboardingService {
  constructor(private prisma: PrismaService) {}

  // 1. Get onboarding link for helper
  async getOnboardingLink(userId: string): Promise<{ success: boolean; url?: string; message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { 
          stripe_connect_account_id: true, 
          stripe_onboarding_completed: true,
          email: true 
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.stripe_connect_account_id) {
        return {
          success: false,
          message: 'Stripe Connect account not found. Please convert to helper role first.',
        };
      }

      if (user.stripe_onboarding_completed) {
        return {
          success: false,
          message: 'Onboarding already completed',
        };
      }

      // Generate onboarding link using existing StripePayment method
      console.log('Creating onboarding link for account:', user.stripe_connect_account_id);
      console.log('APP_URL:', appConfig().app.url);
      
      const accountLink = await StripePayment.createOnboardingAccountLink(user.stripe_connect_account_id);
      
      console.log('Generated account link:', accountLink);

      return {
        success: true,
        url: accountLink.url,
        message: 'Onboarding link generated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to generate onboarding link',
      };
    }
  }

  // 2. Check onboarding status
  async checkOnboardingStatus(userId: string): Promise<{
    success: boolean;
    isOnboarded?: boolean;
    accountId?: string;
    message: string;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { 
          stripe_connect_account_id: true, 
          stripe_onboarding_completed: true 
        },
      });

      if (!user?.stripe_connect_account_id) {
        return {
          success: false,
          message: 'Stripe account not found',
        };
      }

      // Check account status with Stripe
      const account = await StripePayment.checkAccountStatus(user.stripe_connect_account_id);
      
      const isOnboardCompleted = account.details_submitted && account.charges_enabled;

      // Update user onboarding status if completed
      if (isOnboardCompleted && !user.stripe_onboarding_completed) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { 
            stripe_onboarding_completed: true,
            stripe_account_status: 'active',
          },
        });
      }

      return {
        success: true,
        isOnboarded: isOnboardCompleted,
        accountId: user.stripe_connect_account_id,
        message: 'Onboarding status checked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to check onboarding status',
      };
    }
  }

  // 3. Get helper payment status
  async getHelperPaymentStatus(userId: string): Promise<{
    success: boolean;
    data?: {
      hasStripeAccount: boolean;
      isOnboarded: boolean;
      accountStatus: string;
      canReceivePayments: boolean;
    };
    message: string;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          stripe_connect_account_id: true,
          stripe_onboarding_completed: true,
          stripe_account_status: true,
          stripe_payouts_enabled: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const hasStripeAccount = !!user.stripe_connect_account_id;
      const isOnboarded = user.stripe_onboarding_completed || false;
      const accountStatus = user.stripe_account_status || 'none';
      const canReceivePayments = isOnboarded && user.stripe_payouts_enabled;

      return {
        success: true,
        data: {
          hasStripeAccount,
          isOnboarded,
          accountStatus,
          canReceivePayments,
        },
        message: 'Payment status retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get payment status',
      };
    }
  }

}