import { getDb } from '#db-client';
import { generateId } from '@/lib/db/id';
import { giftTokenRedemptions, giftTokens } from '@/lib/db/schema/gift-tokens';
import type { GiftToken } from '@/lib/db/schema/gift-tokens';
import { ValidationError } from '@/lib/errors';
import { count, desc, eq, sql } from 'drizzle-orm';
import { addCredits } from './credit-service';
import { micros, microsToDisplayUsd, microsToUsd, usdToMicros } from './money';

// Ambiguity-free alphabet (no 0/O/1/I) — 32 chars → 32^6 ≈ 1B combinations
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateGiftCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes)
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join('');
}

export type GiftTokenStatus = 'available' | 'fully_redeemed' | 'expired';

export function getGiftTokenStatus(
  token: GiftToken,
  redemptionCount: number
): GiftTokenStatus {
  if (redemptionCount >= token.maxRedemptions) return 'fully_redeemed';
  if (token.expiresAt && token.expiresAt < new Date()) return 'expired';
  return 'available';
}

export async function createGiftToken(opts: {
  createdByUserId: string;
  amountUsd: number;
  maxRedemptions?: number;
  note?: string;
  expiresAt?: Date;
}): Promise<GiftToken> {
  if (opts.amountUsd <= 0) {
    throw new ValidationError('Gift token amount must be positive');
  }

  const maxRedemptions = opts.maxRedemptions ?? 1;
  if (maxRedemptions < 1) {
    throw new ValidationError('Max redemptions must be at least 1');
  }

  const db = getDb();
  const code = generateGiftCode();
  const amountMicros = usdToMicros(opts.amountUsd);

  const [token] = await db
    .insert(giftTokens)
    .values({
      id: generateId(),
      code,
      amountMicros,
      maxRedemptions,
      createdByUserId: opts.createdByUserId,
      note: opts.note ?? null,
      expiresAt: opts.expiresAt ?? null,
    })
    .returning();

  return token;
}

export async function redeemGiftToken(opts: {
  code: string;
  teamId: string;
  userId: string;
}): Promise<{ newBalance: number; amountUsd: number }> {
  const db = getDb();
  const normalizedCode = opts.code.trim().toUpperCase();

  // Find the token
  const [token] = await db
    .select()
    .from(giftTokens)
    .where(eq(giftTokens.code, normalizedCode))
    .limit(1);

  if (!token) {
    throw new ValidationError('Invalid gift code');
  }

  if (token.expiresAt && token.expiresAt < new Date()) {
    throw new ValidationError('This gift code has expired');
  }

  // Count existing redemptions
  const [{ value: redemptionCount }] = await db
    .select({ value: count() })
    .from(giftTokenRedemptions)
    .where(eq(giftTokenRedemptions.giftTokenId, token.id));

  if (redemptionCount >= token.maxRedemptions) {
    throw new ValidationError('This gift code has been fully redeemed');
  }

  // Record redemption — unique index on (giftTokenId, teamId) prevents duplicates
  const [inserted] = await db
    .insert(giftTokenRedemptions)
    .values({
      id: generateId(),
      giftTokenId: token.id,
      teamId: opts.teamId,
      userId: opts.userId,
    })
    .onConflictDoNothing()
    .returning();

  if (!inserted) {
    throw new ValidationError('Your team has already redeemed this gift code');
  }

  const amountMicros = micros(token.amountMicros);

  // Add credits to team (outside transaction)
  const result = await addCredits(opts.teamId, amountMicros, {
    userId: opts.userId,
    type: 'credit_adjustment',
    description: `Gift code redeemed: ${normalizedCode} (${microsToDisplayUsd(amountMicros)})`,
    metadata: { giftTokenId: token.id, giftCode: normalizedCode },
  });

  return {
    newBalance: result ? microsToUsd(result.newBalance) : 0,
    amountUsd: microsToUsd(amountMicros),
  };
}

export type GiftTokenWithStatus = GiftToken & {
  status: GiftTokenStatus;
  amountUsd: number;
  redemptionCount: number;
};

export async function listGiftTokens(): Promise<GiftTokenWithStatus[]> {
  const db = getDb();

  const redemptionCountSq = db
    .select({
      giftTokenId: giftTokenRedemptions.giftTokenId,
      count: count().as('count'),
    })
    .from(giftTokenRedemptions)
    .groupBy(giftTokenRedemptions.giftTokenId)
    .as('redemption_counts');

  const tokens = await db
    .select({
      token: giftTokens,
      redemptionCount: sql<number>`coalesce(${redemptionCountSq.count}, 0)`,
    })
    .from(giftTokens)
    .leftJoin(
      redemptionCountSq,
      eq(giftTokens.id, redemptionCountSq.giftTokenId)
    )
    .orderBy(desc(giftTokens.createdAt));

  return tokens.map(({ token, redemptionCount }) => ({
    ...token,
    redemptionCount,
    status: getGiftTokenStatus(token, redemptionCount),
    amountUsd: microsToUsd(micros(token.amountMicros)),
  }));
}
