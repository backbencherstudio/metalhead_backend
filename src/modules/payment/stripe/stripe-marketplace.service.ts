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
    buyerUserId,
    helperStripeAccountId,
    jobTitle,
    platformFeePercent = 0.1, // default 10%
  }: {
    jobId: string;
    finalPrice: number | Decimal;
    buyerBillingId: string;
    buyerUserId?: string; // internal user id
    helperStripeAccountId?: string;
    jobTitle: string;
    platformFeePercent?: number;
  }) {
    const amountCents = Math.round(Number(finalPrice) * 100);
    const platformFeeCents = Math.round(amountCents * platformFeePercent);

    if (!buyerBillingId) throw new Error('Buyer has no Stripe customer ID');

    // Fetch and require a default payment method on the customer
    const customer = (await this.stripe.customers.retrieve(buyerBillingId)) as Stripe.Customer;
    let defaultPm = (customer.invoice_settings?.default_payment_method as any)?.id;
    if (!defaultPm) {
      // Attempt to use the first attached card and set it as default
      const list = await this.stripe.paymentMethods.list({ customer: buyerBillingId, type: 'card' });
      const firstPm = list.data[0]?.id;
      if (!firstPm) {
        throw new Error('Customer has no attached card');
      }
      await this.stripe.customers.update(buyerBillingId, {
        invoice_settings: { default_payment_method: firstPm },
      });
      defaultPm = firstPm;
    }

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'usd',
        customer: buyerBillingId,
        payment_method: defaultPm,
        capture_method:"manual",
        off_session: true,
        automatic_payment_methods: { enabled: true },
        metadata: { job_id: jobId, job_title: jobTitle },
        confirm: true, // confirm in the same call
      },
      { idempotencyKey: `pi_create_${jobId}` },
    );
    // Do NOT confirm twice

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
        user_id: buyerUserId ?? null,
        customer_id: buyerBillingId,
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

  async capturePaymentIntent(paymentIntentId: string) {
    return this.stripe.paymentIntents.capture(paymentIntentId);
  }
  
  async transferToHelper(opts: {
    jobId: string;
    finalPrice: number | Decimal;
    helperStripeAccountId: string;
    platformFeePercent?: number; // default 0.10
  }) {
    const amountCents = Math.round(Number(opts.finalPrice) * 100);
    const helperAmountCents = Math.round(amountCents * (1 - (opts.platformFeePercent ?? 0.10)));
  
    return this.stripe.transfers.create({
      amount: helperAmountCents,
      currency: 'usd',
      destination: opts.helperStripeAccountId,
      metadata: { job_id: opts.jobId },
    });
  }
}
