import { getDb } from '#db-client';
import { generateId } from '@/lib/db/id';
import { giftTokens } from '@/lib/db/schema/gift-tokens';
import type { GiftToken } from '@/lib/db/schema/gift-tokens';
import { ValidationError } from '@/lib/errors';
import { desc, eq } from 'drizzle-orm';
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

export type GiftTokenStatus = 'available' | 'redeemed' | 'expired';

export function getGiftTokenStatus(token: GiftToken): GiftTokenStatus {
  if (token.redeemedAt) return 'redeemed';
  if (token.expiresAt && token.expiresAt < new Date()) return 'expired';
  return 'available';
}

export async function createGiftToken(opts: {
  createdByUserId: string;
  amountUsd: number;
  note?: string;
  expiresAt?: Date;
}): Promise<GiftToken> {
  if (opts.amountUsd <= 0) {
    throw new ValidationError('Gift token amount must be positive');
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

  const [token] = await db
    .select()
    .from(giftTokens)
    .where(eq(giftTokens.code, normalizedCode))
    .limit(1);

  if (!token) {
    throw new ValidationError('Invalid gift code');
  }

  if (token.redeemedAt) {
    throw new ValidationError('This gift code has already been redeemed');
  }

  if (token.expiresAt && token.expiresAt < new Date()) {
    throw new ValidationError('This gift code has expired');
  }

  // Mark as redeemed
  await db
    .update(giftTokens)
    .set({
      redeemedByTeamId: opts.teamId,
      redeemedByUserId: opts.userId,
      redeemedAt: new Date(),
    })
    .where(eq(giftTokens.id, token.id));

  const amountMicros = micros(token.amountMicros);

  // Add credits to team
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
};

export async function listGiftTokens(): Promise<GiftTokenWithStatus[]> {
  const db = getDb();
  const tokens = await db
    .select()
    .from(giftTokens)
    .orderBy(desc(giftTokens.createdAt));

  return tokens.map((token) => ({
    ...token,
    status: getGiftTokenStatus(token),
    amountUsd: microsToUsd(micros(token.amountMicros)),
  }));
}
