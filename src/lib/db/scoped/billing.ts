/**
 * Scoped Billing Sub-module
 * Team-scoped credit operations: balance, deductions, transactions, settings.
 * All monetary values are in Microdollars (1 USD = 1,000,000).
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import {
  creditBatches,
  credits,
  teamBillingSettings,
  transactions,
} from '@/lib/db/schema/credits';
import type {
  CreditBatchSource,
  TeamBillingSetting,
  TransactionType,
} from '@/lib/db/schema/credits';
import { ValidationError } from '@/lib/errors';
import {
  applyMarkup,
  AUTO_TOPUP_COOLDOWN_MS,
  calculateExpiryDate,
  isStripeEnabled,
  MIN_TOPUP_AMOUNT_MICROS,
} from '@/lib/billing/constants';
import {
  type Microdollars,
  micros,
  microsToDisplayUsd,
  microsToUsdCents,
  microsToUsd,
  negateMicros,
  ZERO_MICROS,
} from '@/lib/billing/money';
import { getStripeOrThrow } from '@/lib/billing/stripe';

function mapBatchSource(
  type: TransactionType,
  metadata?: Record<string, unknown>
): CreditBatchSource {
  if (metadata?.giftTokenId) return 'gift_code';
  if (metadata?.autoTopUp) return 'auto_topup';
  if (type === 'credit_adjustment') return 'adjustment';
  return 'stripe_checkout';
}

export function createBillingMethods(db: Database, teamId: string) {
  /** Creates a credits row if one doesn't exist yet. */
  async function getBalance(): Promise<Microdollars> {
    const [row] = await db
      .select({ balance: credits.balance })
      .from(credits)
      .where(eq(credits.teamId, teamId))
      .limit(1);

    if (!row) {
      await db.insert(credits).values({ teamId, balance: 0 });
      return ZERO_MICROS;
    }

    return micros(row.balance);
  }

  async function hasEnoughCredits(
    estimatedCostMicros: Microdollars
  ): Promise<boolean> {
    const balance = await getBalance();
    return balance >= applyMarkup(estimatedCostMicros);
  }

  async function addCredits(
    amountMicros: Microdollars,
    opts: {
      userId?: string | null;
      type?: TransactionType;
      description?: string;
      metadata?: Record<string, unknown>;
      stripeSessionId?: string;
    } = {}
  ): Promise<{ newBalance: Microdollars; transactionId: string } | null> {
    if (amountMicros <= 0) {
      throw new ValidationError('Credit amount must be positive');
    }

    // Ensure credits row exists
    await db
      .insert(credits)
      .values({ teamId, balance: 0 })
      .onConflictDoNothing();

    // Atomic update + record transaction
    const [updated] = await db
      .update(credits)
      .set({
        balance: sql`${credits.balance} + ${amountMicros}`,
        updatedAt: new Date(),
      })
      .where(eq(credits.teamId, teamId))
      .returning({ balance: credits.balance });

    const txType = opts.type ?? ('credit_purchase' as TransactionType);

    // Insert transaction with unique stripeSessionId -- DB rejects duplicates
    const rows = await db
      .insert(transactions)
      .values({
        teamId,
        userId: opts.userId ?? null,
        type: txType,
        amount: amountMicros,
        balanceAfter: updated.balance,
        description:
          opts.description ??
          `Added ${microsToDisplayUsd(amountMicros)} credits`,
        metadata: opts.metadata ?? {},
        stripeSessionId: opts.stripeSessionId ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: transactions.id });

    if (rows.length === 0) {
      // Duplicate -- roll back the balance update
      await db
        .update(credits)
        .set({
          balance: sql`${credits.balance} - ${amountMicros}`,
          updatedAt: new Date(),
        })
        .where(eq(credits.teamId, teamId));
      return null;
    }

    const transactionId = rows[0].id;

    // Create a credit batch for future expiration tracking
    await db.insert(creditBatches).values({
      teamId,
      originalAmount: amountMicros,
      remainingAmount: amountMicros,
      source: mapBatchSource(txType, opts.metadata),
      transactionId,
      expiresAt: calculateExpiryDate(),
    });

    return { newBalance: micros(updated.balance), transactionId };
  }

  /** Applies markup automatically. Triggers auto-top-up if balance drops below threshold. */
  async function deductCredits(
    rawCostMicros: Microdollars,
    opts: {
      userId?: string | null;
      description?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<{
    newBalance: Microdollars;
    chargedAmount: Microdollars;
    transactionId: string;
  }> {
    if (rawCostMicros <= 0)
      return {
        newBalance: await getBalance(),
        chargedAmount: ZERO_MICROS,
        transactionId: '',
      };

    const chargedAmount = applyMarkup(rawCostMicros);

    // Ensure credits row exists
    await db
      .insert(credits)
      .values({ teamId, balance: 0 })
      .onConflictDoNothing();

    // Atomic deduction
    const [updated] = await db
      .update(credits)
      .set({
        balance: sql`${credits.balance} - ${chargedAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(credits.teamId, teamId))
      .returning({ balance: credits.balance });

    const rawUsd = microsToUsd(rawCostMicros);
    const chargedUsd = microsToUsd(chargedAmount);

    const [tx] = await db
      .insert(transactions)
      .values({
        teamId,
        userId: opts.userId ?? null,
        type: 'credit_usage' as TransactionType,
        amount: negateMicros(chargedAmount),
        balanceAfter: updated.balance,
        description:
          opts.description ??
          `Usage: $${chargedUsd.toFixed(4)} (raw: $${rawUsd.toFixed(4)})`,
        metadata: {
          rawCostMicros,
          chargedAmountMicros: chargedAmount,
          ...opts.metadata,
        },
      })
      .returning({ id: transactions.id });

    // Check if auto-top-up should trigger (fire-and-forget)
    void maybeAutoTopUp(micros(updated.balance)).catch((err) => {
      console.error('[AutoTopUp] Failed:', err);
    });

    return {
      newBalance: micros(updated.balance),
      chargedAmount,
      transactionId: tx.id,
    };
  }

  async function getTransactionHistory(
    opts: { limit?: number; offset?: number; type?: TransactionType } = {}
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
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    const conditions = [eq(transactions.teamId, teamId)];
    if (opts.type) {
      conditions.push(eq(transactions.type, opts.type));
    }
    const whereClause =
      conditions.length === 1 ? conditions[0] : and(...conditions);

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
        .where(whereClause)
        .orderBy(desc(transactions.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(whereClause),
    ]);

    return { transactions: rows, total: countResult[0].count };
  }

  async function getBillingSettings(): Promise<TeamBillingSetting> {
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

  async function updateAutoTopUpSettings(settings: {
    enabled: boolean;
    thresholdMicros?: Microdollars;
    amountMicros?: Microdollars;
  }): Promise<void> {
    if (
      settings.amountMicros !== undefined &&
      settings.amountMicros < MIN_TOPUP_AMOUNT_MICROS
    ) {
      throw new ValidationError(
        `Auto top-up amount must be at least ${microsToDisplayUsd(MIN_TOPUP_AMOUNT_MICROS)}`
      );
    }

    if (
      settings.enabled &&
      settings.thresholdMicros !== undefined &&
      settings.amountMicros !== undefined &&
      settings.amountMicros <= settings.thresholdMicros
    ) {
      throw new ValidationError(
        'Auto top-up amount must be greater than the threshold'
      );
    }

    await db
      .insert(teamBillingSettings)
      .values({
        teamId,
        autoTopUpEnabled: settings.enabled,
        autoTopUpThresholdMicros: settings.thresholdMicros,
        autoTopUpAmountMicros: settings.amountMicros,
      })
      .onConflictDoUpdate({
        target: teamBillingSettings.teamId,
        set: {
          autoTopUpEnabled: settings.enabled,
          ...(settings.thresholdMicros !== undefined && {
            autoTopUpThresholdMicros: settings.thresholdMicros,
          }),
          ...(settings.amountMicros !== undefined && {
            autoTopUpAmountMicros: settings.amountMicros,
          }),
          updatedAt: new Date(),
        },
      });
  }

  async function maybeAutoTopUp(currentBalance: Microdollars): Promise<void> {
    if (!isStripeEnabled()) return;

    const settings = await getBillingSettings();

    if (
      !settings.autoTopUpEnabled ||
      !settings.stripeCustomerId ||
      !settings.autoTopUpThresholdMicros ||
      !settings.autoTopUpAmountMicros
    ) {
      return;
    }

    if (currentBalance > settings.autoTopUpThresholdMicros) {
      return;
    }

    // Cooldown: skip if last auto-top-up was within the cooldown period
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
    // Convert micros to cents for Stripe
    const amountCents = microsToUsdCents(
      micros(settings.autoTopUpAmountMicros)
    );

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

      const topUpMicros = micros(settings.autoTopUpAmountMicros);
      await addCredits(topUpMicros, {
        description: `Auto top-up: ${microsToDisplayUsd(topUpMicros)}`,
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
          autoTopUp: true,
          ...(receiptUrl && { receiptUrl }),
        },
      });
    }
  }

  /** Public entry point for triggering auto-top-up from outside this module. */
  async function checkAutoTopUp(): Promise<void> {
    const balance = await getBalance();
    await maybeAutoTopUp(balance);
  }

  async function saveStripeCustomerId(stripeCustomerId: string): Promise<void> {
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

  /** Sum active (non-expired) batch remainingAmounts and compare to credits.balance */
  async function reconcileBatchBalance(): Promise<{
    runningBalance: Microdollars;
    batchTotal: Microdollars;
    drift: number;
  }> {
    const [balanceRow] = await db
      .select({ balance: credits.balance })
      .from(credits)
      .where(eq(credits.teamId, teamId))
      .limit(1);

    const runningBalance = micros(balanceRow?.balance ?? 0);

    const [batchRow] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${creditBatches.remainingAmount}), 0)`,
      })
      .from(creditBatches)
      .where(eq(creditBatches.teamId, teamId));

    const batchTotal = micros(batchRow?.total ?? 0);

    return {
      runningBalance,
      batchTotal,
      drift: runningBalance - batchTotal,
    };
  }

  return {
    getBalance,
    hasEnoughCredits,
    addCredits,
    deductCredits,
    getTransactionHistory,
    getBillingSettings,
    updateAutoTopUpSettings,
    checkAutoTopUp,
    saveStripeCustomerId,
    reconcileBatchBalance,
  };
}
