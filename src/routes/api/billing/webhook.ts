/**
 * Stripe Webhook API
 * POST /api/billing/webhook - Handle Stripe webhook events
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { getStripe, getStripeWebhookSecret } from '@/lib/billing/stripe';
import {
  addCredits,
  saveStripeCustomerId,
  hasTransactionWithStripeSessionId,
} from '@/lib/billing/credit-service';

export const Route = createFileRoute('/api/billing/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const stripe = getStripe();
          const webhookSecret = getStripeWebhookSecret();

          const body = await request.text();
          const signature = request.headers.get('stripe-signature');

          if (!signature) {
            return json({ error: 'Missing signature' }, { status: 400 });
          }

          const event = stripe.webhooks.constructEvent(
            body,
            signature,
            webhookSecret
          );

          switch (event.type) {
            case 'checkout.session.completed': {
              const session = event.data.object;

              if (
                session.metadata?.type !== 'credit_top_up' ||
                session.payment_status !== 'paid'
              ) {
                break;
              }

              const teamId = session.metadata.teamId;
              const userId = session.metadata.userId;
              const amountUsd = parseFloat(session.metadata.amountUsd);

              if (!teamId || isNaN(amountUsd)) {
                console.error('[Webhook] Invalid metadata:', session.metadata);
                break;
              }

              // Idempotency: skip if this session was already processed
              const alreadyProcessed = await hasTransactionWithStripeSessionId(
                session.id
              );
              if (alreadyProcessed) {
                console.log(
                  `[Webhook] Duplicate event for session ${session.id}, skipping`
                );
                break;
              }

              // Save customer ID mapping if not already saved
              if (session.customer) {
                const customerId =
                  typeof session.customer === 'string'
                    ? session.customer
                    : session.customer.id;
                await saveStripeCustomerId(teamId, customerId);
              }

              // Add credits
              await addCredits(teamId, amountUsd, {
                userId,
                description: `Top-up: $${amountUsd.toFixed(2)}`,
                metadata: {
                  stripeSessionId: session.id,
                  stripePaymentIntentId: session.payment_intent,
                },
              });

              console.log(
                `[Webhook] Added $${amountUsd} credits to team ${teamId}`
              );
              break;
            }

            case 'payment_intent.succeeded': {
              // Handle auto-top-up payment confirmations
              const paymentIntent = event.data.object;
              if (paymentIntent.metadata?.type === 'auto_top_up') {
                console.log(
                  `[Webhook] Auto-top-up payment succeeded for team ${paymentIntent.metadata.teamId}`
                );
              }
              break;
            }

            default:
              // Ignore other events
              break;
          }

          return json({ received: true }, { status: 200 });
        } catch (error) {
          console.error('[POST /api/billing/webhook] Error:', error);
          return json({ error: 'Webhook handler failed' }, { status: 400 });
        }
      },
    },
  },
});
