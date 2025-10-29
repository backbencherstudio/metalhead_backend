// stripe-marketplace.service.ts

import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class StripeMarketplaceService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-03-31.basil',
  });

  constructor(private readonly prisma: PrismaService) {}

  async createMarketplacePaymentIntent({
    jobId,
    finalPrice,
    buyerBillingId,
    helperStripeAccountId,
    jobTitle,
    platformFeePercent = 0.10, // default 10%
  }: {
    jobId: string;
    finalPrice: number | Decimal;
    buyerBillingId: string;
    helperStripeAccountId: string;
    jobTitle: string;
    platformFeePercent?: number;
  }) {
    const amountCents = Math.round(Number(finalPrice) * 100);
    const platformFeeCents = Math.round(amountCents * platformFeePercent);

    if (!buyerBillingId) throw new Error('Buyer has no Stripe customer ID');
    if (!helperStripeAccountId) throw new Error('Helper has no Stripe Connect account');

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'usd',
        customer: buyerBillingId,
        capture_method: 'manual',
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: helperStripeAccountId,
        },
        payment_method_types: ['card'],
        metadata: {
          job_id: jobId,
          job_title: jobTitle,
        },
      },
      { idempotencyKey: `pi_create_${jobId}` },
    );

    // Save reference to DB (optional but recommended)
    await this.prisma.paymentTransaction.create({
      data: {
        reference_number: paymentIntent.id,
        status: paymentIntent.status,
        amount: finalPrice,
        currency: 'usd',
        paid_amount: finalPrice,
        paid_currency: 'usd',
        provider: 'stripe',
        user_id: buyerBillingId,
        order_id: jobId,
      },
    });

    return {
      success: true,
      message: 'Payment intent created successfully',
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    };
  }
}
