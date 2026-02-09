/**
 * Credit Service
 * Core billing logic: balance queries, credit additions, deductions, and auto-top-up
 */

import { getDb } from '#db-client';
import {
  credits,
  transactions,
  teamBillingSettings,
} from '@/lib/db/schema/credits';
import type {
  TeamBillingSetting,
  TransactionType,
} from '@/lib/db/schema/credits';
import { eq, sql, desc } from 'drizzle-orm';
import { applyMarkup, MIN_TOPUP_AMOUNT_USD } from './constants';
import { getStripe } from './stripe';
import { ValidationError } from '@/lib/errors';

/** Creates a credits row if one doesn't exist yet. */
export async function getTeamBalance(teamId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ balance: credits.balance })
    .from(credits)
    .where(eq(credits.teamId, teamId))
    .limit(1);

  if (!row) {
    // Initialize with 0 balance
    await db.insert(credits).values({ teamId, balance: 0 });
    return 0;
  }

  return row.balance;
}

export async function hasEnoughCredits(
  teamId: string,
  estimatedCostUsd: number
): Promise<boolean> {
  const balance = await getTeamBalance(teamId);
  return balance >= applyMarkup(estimatedCostUsd);
}

export async function addCredits(
  teamId: string,
  amountUsd: number,
  opts: {
    userId?: string | null;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ newBalance: number; transactionId: string }> {
  if (amountUsd <= 0) {
    throw new ValidationError('Credit amount must be positive');
  }

  const db = getDb();

  // Ensure credits row exists
  await db.insert(credits).values({ teamId, balance: 0 }).onConflictDoNothing();

  // Atomic update + record transaction
  const [updated] = await db
    .update(credits)
    .set({
      balance: sql`${credits.balance} + ${amountUsd}`,
      updatedAt: new Date(),
    })
    .where(eq(credits.teamId, teamId))
    .returning({ balance: credits.balance });

  const [tx] = await db
    .insert(transactions)
    .values({
      teamId,
      userId: opts.userId ?? null,
      type: 'credit_purchase' as TransactionType,
      amount: amountUsd,
      balanceAfter: updated.balance,
      description: opts.description ?? `Added $${amountUsd.toFixed(2)} credits`,
      metadata: opts.metadata ?? {},
    })
    .returning({ id: transactions.id });

  return { newBalance: updated.balance, transactionId: tx.id };
}

/** Applies markup automatically. Triggers auto-top-up if balance drops below threshold. */
export async function deductCredits(
  teamId: string,
  rawCostUsd: number,
  opts: {
    userId?: string | null;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{
  newBalance: number;
  chargedAmount: number;
  transactionId: string;
}> {
  if (rawCostUsd <= 0)
    return {
      newBalance: await getTeamBalance(teamId),
      chargedAmount: 0,
      transactionId: '',
    };

  const chargedAmount = applyMarkup(rawCostUsd);
  const db = getDb();

  // Ensure credits row exists
  await db.insert(credits).values({ teamId, balance: 0 }).onConflictDoNothing();

  // Atomic deduction — check constraint prevents going below 0
  const [updated] = await db
    .update(credits)
    .set({
      balance: sql`${credits.balance} - ${chargedAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(credits.teamId, teamId))
    .returning({ balance: credits.balance });

  const [tx] = await db
    .insert(transactions)
    .values({
      teamId,
      userId: opts.userId ?? null,
      type: 'credit_usage' as TransactionType,
      amount: -chargedAmount,
      balanceAfter: updated.balance,
      description:
        opts.description ??
        `Usage: $${chargedAmount.toFixed(4)} (raw: $${rawCostUsd.toFixed(4)})`,
      metadata: {
        rawCostUsd,
        chargedAmount,
        ...opts.metadata,
      },
    })
    .returning({ id: transactions.id });

  // Check if auto-top-up should trigger (fire-and-forget)
  void maybeAutoTopUp(teamId, updated.balance).catch((err) => {
    console.error('[AutoTopUp] Failed:', err);
  });

  return { newBalance: updated.balance, chargedAmount, transactionId: tx.id };
}

export async function getTransactionHistory(
  teamId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const db = getDb();
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        balanceAfter: transactions.balanceAfter,
        description: transactions.description,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(eq(transactions.teamId, teamId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.teamId, teamId)),
  ]);

  return { transactions: rows, total: countResult[0].count };
}

export async function getBillingSettings(
  teamId: string
): Promise<TeamBillingSetting> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(teamBillingSettings)
    .where(eq(teamBillingSettings.teamId, teamId))
    .limit(1);

  if (!row) {
    const [created] = await db
      .insert(teamBillingSettings)
      .values({ teamId })
      .returning();
    return created;
  }

  return row;
}

export async function updateAutoTopUpSettings(
  teamId: string,
  settings: {
    enabled: boolean;
    thresholdUsd?: number;
    amountUsd?: number;
  }
): Promise<void> {
  if (
    settings.amountUsd !== undefined &&
    settings.amountUsd < MIN_TOPUP_AMOUNT_USD
  ) {
    throw new ValidationError(
      `Auto top-up amount must be at least $${MIN_TOPUP_AMOUNT_USD}`
    );
  }

  const db = getDb();

  await db
    .insert(teamBillingSettings)
    .values({
      teamId,
      autoTopUpEnabled: settings.enabled,
      autoTopUpThresholdUsd: settings.thresholdUsd,
      autoTopUpAmountUsd: settings.amountUsd,
    })
    .onConflictDoUpdate({
      target: teamBillingSettings.teamId,
      set: {
        autoTopUpEnabled: settings.enabled,
        ...(settings.thresholdUsd !== undefined && {
          autoTopUpThresholdUsd: settings.thresholdUsd,
        }),
        ...(settings.amountUsd !== undefined && {
          autoTopUpAmountUsd: settings.amountUsd,
        }),
        updatedAt: new Date(),
      },
    });
}

async function maybeAutoTopUp(
  teamId: string,
  currentBalance: number
): Promise<void> {
  const settings = await getBillingSettings(teamId);

  if (
    !settings.autoTopUpEnabled ||
    !settings.stripeCustomerId ||
    !settings.autoTopUpThresholdUsd ||
    !settings.autoTopUpAmountUsd
  ) {
    return;
  }

  if (currentBalance > settings.autoTopUpThresholdUsd) {
    return;
  }

  const stripe = getStripe();
  const amountCents = Math.round(settings.autoTopUpAmountUsd * 100);

  // Get the customer's default payment method
  const customer = await stripe.customers.retrieve(settings.stripeCustomerId);
  if (customer.deleted) return;

  const defaultPaymentMethod =
    customer.invoice_settings?.default_payment_method;
  if (!defaultPaymentMethod) return;

  const paymentMethodId =
    typeof defaultPaymentMethod === 'string'
      ? defaultPaymentMethod
      : defaultPaymentMethod.id;

  // Create and confirm a PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: settings.stripeCustomerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    metadata: {
      teamId,
      type: 'auto_top_up',
    },
  });

  if (paymentIntent.status === 'succeeded') {
    await addCredits(teamId, settings.autoTopUpAmountUsd, {
      description: `Auto top-up: $${settings.autoTopUpAmountUsd.toFixed(2)}`,
      metadata: {
        stripePaymentIntentId: paymentIntent.id,
        autoTopUp: true,
      },
    });
  }
}

export async function saveStripeCustomerId(
  teamId: string,
  stripeCustomerId: string
): Promise<void> {
  const db = getDb();
  await db
    .insert(teamBillingSettings)
    .values({ teamId, stripeCustomerId })
    .onConflictDoUpdate({
      target: teamBillingSettings.teamId,
      set: {
        stripeCustomerId,
        updatedAt: new Date(),
      },
    });
}
