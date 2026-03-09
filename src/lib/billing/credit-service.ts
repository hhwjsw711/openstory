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
import { eq, sql, desc, and } from 'drizzle-orm';
import {
  applyMarkup,
  MIN_TOPUP_AMOUNT_USD,
  AUTO_TOPUP_COOLDOWN_MS,
} from './constants';
import { getStripeOrThrow } from './stripe';
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
    type?: TransactionType;
    description?: string;
    metadata?: Record<string, unknown>;
    stripeSessionId?: string;
  } = {}
): Promise<{ newBalance: number; transactionId: string } | null> {
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

  // Insert transaction with unique stripeSessionId — DB rejects duplicates
  const rows = await db
    .insert(transactions)
    .values({
      teamId,
      userId: opts.userId ?? null,
      type: opts.type ?? ('credit_purchase' as TransactionType),
      amount: amountUsd,
      balanceAfter: updated.balance,
      description: opts.description ?? `Added $${amountUsd.toFixed(2)} credits`,
      metadata: opts.metadata ?? {},
      stripeSessionId: opts.stripeSessionId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: transactions.id });

  if (rows.length === 0) {
    // Duplicate — roll back the balance update
    await db
      .update(credits)
      .set({
        balance: sql`${credits.balance} - ${amountUsd}`,
        updatedAt: new Date(),
      })
      .where(eq(credits.teamId, teamId));
    return null;
  }

  return { newBalance: updated.balance, transactionId: rows[0].id };
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
    metadata: unknown;
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
        metadata: transactions.metadata,
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

  if (
    settings.enabled &&
    settings.thresholdUsd !== undefined &&
    settings.amountUsd !== undefined &&
    settings.amountUsd <= settings.thresholdUsd
  ) {
    throw new ValidationError(
      'Auto top-up amount must be greater than the threshold'
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

  // Cooldown: skip if last auto-top-up was within the cooldown period
  const db = getDb();
  const [recentAutoTopUp] = await db
    .select({ createdAt: transactions.createdAt })
    .from(transactions)
    .where(
      and(
        eq(transactions.teamId, teamId),
        sql`json_extract(${transactions.metadata}, '$.autoTopUp') = true`
      )
    )
    .orderBy(desc(transactions.createdAt))
    .limit(1);

  if (recentAutoTopUp) {
    const elapsed = Date.now() - recentAutoTopUp.createdAt.getTime();
    if (elapsed < AUTO_TOPUP_COOLDOWN_MS) {
      console.log(
        `[AutoTopUp] Cooldown active for team ${teamId}, skipping (${Math.round(elapsed / 1000)}s ago)`
      );
      return;
    }
  }

  const stripe = getStripeOrThrow();
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
    expand: ['latest_charge'],
    metadata: {
      teamId,
      type: 'auto_top_up',
    },
  });

  if (paymentIntent.status === 'succeeded') {
    const charge = paymentIntent.latest_charge;
    const receiptUrl =
      charge && typeof charge === 'object' ? charge.receipt_url : undefined;

    await addCredits(teamId, settings.autoTopUpAmountUsd, {
      description: `Auto top-up: $${settings.autoTopUpAmountUsd.toFixed(2)}`,
      metadata: {
        stripePaymentIntentId: paymentIntent.id,
        autoTopUp: true,
        ...(receiptUrl && { receiptUrl }),
      },
    });
  }
}

/** Public entry point for triggering auto-top-up from outside this module. */
export async function checkAutoTopUp(teamId: string): Promise<void> {
  const balance = await getTeamBalance(teamId);
  await maybeAutoTopUp(teamId, balance);
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
