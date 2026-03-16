import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import {
  authMiddleware,
  authWithTeamMiddleware,
  systemAdminMiddleware,
} from './middleware';
import { isSystemAdmin } from '@/lib/auth/system-admin';
import { createScopedDb } from '@/lib/db/scoped';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const createGiftTokenFn = createServerFn({ method: 'POST' })
  .middleware([systemAdminMiddleware])
  .inputValidator(
    zodValidator(
      z.object({
        amountUsd: z.number().positive(),
        maxRedemptions: z.number().int().min(1).default(1),
        note: z.string().optional(),
        expiresInDays: z.number().positive().optional(),
      })
    )
  )
  .handler(async ({ context, data }) => {
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * MS_PER_DAY)
      : undefined;

    // Admin ops use a dummy teamId since they're not team-scoped
    const scopedDb = createScopedDb('admin');
    return scopedDb.admin.createGiftToken({
      createdByUserId: context.user.id,
      amountUsd: data.amountUsd,
      maxRedemptions: data.maxRedemptions,
      note: data.note,
      expiresAt,
    });
  });

export const redeemGiftTokenFn = createServerFn({ method: 'POST' })
  .middleware([authWithTeamMiddleware])
  .inputValidator(zodValidator(z.object({ code: z.string().min(1) })))
  .handler(async ({ context, data }) => {
    const scopedDb = createScopedDb(context.teamId);
    return scopedDb.admin.redeemGiftToken({
      code: data.code,
      teamId: context.teamId,
      userId: context.user.id,
      addCredits: scopedDb.billing.addCredits,
    });
  });

export const listGiftTokensFn = createServerFn({ method: 'GET' })
  .middleware([systemAdminMiddleware])
  .handler(async () => {
    const scopedDb = createScopedDb('admin');
    return scopedDb.admin.listGiftTokens();
  });

export const isSystemAdminFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return { isAdmin: isSystemAdmin(context.user.email) };
  });
