/**
 * Stripe Checkout Service
 * Creates checkout sessions for credit top-ups
 */

import { ValidationError } from '@/lib/errors';
import { MIN_TOPUP_AMOUNT_USD } from './constants';
import { createScopedDb } from '@/lib/db/scoped';
import { getStripeOrThrow } from './stripe';

type CreateCheckoutParams = {
  teamId: string;
  amountUsd: number;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<{ url: string }> {
  const { teamId, amountUsd, userId, userEmail, successUrl, cancelUrl } =
    params;

  if (amountUsd < MIN_TOPUP_AMOUNT_USD) {
    throw new ValidationError(
      `Minimum top-up amount is $${MIN_TOPUP_AMOUNT_USD}`
    );
  }

  const stripe = getStripeOrThrow();
  const scopedDb = createScopedDb(teamId);
  const settings = await scopedDb.billing.getBillingSettings();

  // Reuse existing Stripe customer or create new one
  let customerId = settings.stripeCustomerId;
  if (customerId) {
    // Verify the customer still exists in Stripe (may differ between environments)
    try {
      const existing = await stripe.customers.retrieve(customerId);
      if (existing.deleted) {
        customerId = null;
      }
    } catch {
      customerId = null;
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { teamId, userId },
    });
    customerId = customer.id;
    await scopedDb.billing.saveStripeCustomerId(customerId);
  }

  const amountCents = Math.round(amountUsd * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    payment_method_types: ['card'],
    // Save the payment method for auto-top-up
    payment_intent_data: {
      setup_future_usage: 'off_session',
    },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: `Credits — $${amountUsd.toFixed(2)}`,
            description: `Add $${amountUsd.toFixed(2)} to your team wallet`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      teamId,
      userId,
      amountUsd: String(amountUsd),
      type: 'credit_top_up',
    },
    customer_update: {
      address: 'auto',
      name: 'auto',
    },
    tax_id_collection: {
      enabled: true,
    },
    automatic_tax: {
      enabled: true,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return { url: session.url };
}
