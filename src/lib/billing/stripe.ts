/**
 * Stripe Client
 * Lazy-initialized Stripe instance for billing operations
 */

import { getEnv } from '#env';
import { ConfigurationError } from '@/lib/errors';
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;

  const env = getEnv();
  const key = env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new ConfigurationError(
      'STRIPE_SECRET_KEY environment variable is required'
    );
  }

  stripeInstance = new Stripe(key, {
    typescript: true,
  });

  return stripeInstance;
}

export function getStripeWebhookSecret(): string {
  const env = getEnv();
  const secret = env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new ConfigurationError(
      'STRIPE_WEBHOOK_SECRET environment variable is required'
    );
  }

  return secret;
}
