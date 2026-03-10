/**
 * Stripe Webhook API
 * POST /api/billing/webhook - Handle Stripe webhook events
 */

import { createFileRoute } from '@tanstack/react-router';
import { json } from '@tanstack/react-start';
import { isBillingEnabled } from '@/lib/billing/constants';
import { getStripeOrThrow, getStripeWebhookSecret } from '@/lib/billing/stripe';
import { addCredits, saveStripeCustomerId } from '@/lib/billing/credit-service';
import { usdToMicros, microsToDisplayUsd } from '@/lib/billing/money';

export const Route = createFileRoute('/api/billing/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isBillingEnabled()) {
          return json({ received: true }, { status: 200 });
        }

        try {
          const stripe = getStripeOrThrow();
          const webhookSecret = getStripeWebhookSecret();

          if (!webhookSecret) {
            return json(
              { error: 'Webhook secret not configured' },
              { status: 500 }
            );
          }

          const body = await request.text();
          const signature = request.headers.get('stripe-signature');

          if (!signature) {
            return json({ error: 'Missing signature' }, { status: 400 });
          }

          const event = await stripe.webhooks.constructEventAsync(
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

              // Retrieve receipt URL + set default payment method (best-effort)
              const customerId = session.customer
                ? typeof session.customer === 'string'
                  ? session.customer
                  : session.customer.id
                : undefined;

              // Save customer ID mapping if not already saved
              if (customerId) {
                await saveStripeCustomerId(teamId, customerId);
              }
              let receiptUrl: string | undefined;
              try {
                if (session.payment_intent) {
                  const piId =
                    typeof session.payment_intent === 'string'
                      ? session.payment_intent
                      : session.payment_intent.id;
                  const pi = await stripe.paymentIntents.retrieve(piId, {
                    expand: ['latest_charge'],
                  });
                  const charge = pi.latest_charge;
                  if (charge && typeof charge === 'object') {
                    receiptUrl = charge.receipt_url ?? undefined;
                  }

                  // Set as default payment method so auto-top-up can charge off-session
                  if (pi.payment_method && customerId) {
                    const pmId =
                      typeof pi.payment_method === 'string'
                        ? pi.payment_method
                        : pi.payment_method.id;
                    await stripe.customers.update(customerId, {
                      invoice_settings: { default_payment_method: pmId },
                    });
                  }
                }
              } catch (err) {
                console.error('[Webhook] Failed to fetch receipt URL:', err);
              }

              // Add credits (unique stripeSessionId prevents duplicates)
              const amountMicros = usdToMicros(amountUsd);
              const result = await addCredits(teamId, amountMicros, {
                userId,
                stripeSessionId: session.id,
                description: `Top-up: ${microsToDisplayUsd(amountMicros)}`,
                metadata: {
                  stripePaymentIntentId: session.payment_intent,
                  ...(receiptUrl && { receiptUrl }),
                },
              });

              if (!result) {
                console.log(
                  `[Webhook] Duplicate session ${session.id}, skipping`
                );
                break;
              }

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
