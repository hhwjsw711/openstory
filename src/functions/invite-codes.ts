/**
 * Invite Code Server Functions
 * End-to-end type-safe functions for invite code validation and activation
 */

import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';
import { getDb } from '#db-client';
import { authMiddleware } from './middleware';
import { isValidAccessCode } from '@/lib/auth/access-codes';
import { ensureUserAndTeam } from '@/lib/db/helpers/ensure-user-team';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// Activate Invite Code
// ============================================================================

const activateCodeInputSchema = z.object({
  code: z.string().min(1, 'Invite code is required'),
});

/**
 * Activate an invite code for the current user
 * Updates user status to 'active' and creates a team if needed
 */
export const activateInviteCodeFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(activateCodeInputSchema))
  .handler(async ({ data, context }) => {
    // Check user status
    const userRecord = await getDb().query.user.findFirst({
      where: eq(user.id, context.user.id),
    });

    if (!userRecord) {
      throw new Error('User not found');
    }

    const status = (userRecord as typeof userRecord & { status?: string })
      .status;

    if (status === 'active') {
      throw new Error('Account already activated');
    }

    if (status !== 'pending') {
      throw new Error('Account cannot be activated at this time');
    }

    // Validate invite code
    if (!isValidAccessCode(data.code)) {
      throw new Error('Invalid invite code');
    }

    // Update user status to 'active' and store invite code
    const normalizedCode = data.code.toUpperCase().trim();
    await getDb()
      .update(user)
      .set({
        status: 'active',
        accessCode: normalizedCode,
      })
      .where(eq(user.id, context.user.id));

    // Ensure user has team
    const teamResult = await ensureUserAndTeam({
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
    });

    if (!teamResult.success) {
      throw new Error('Failed to create team. Please contact support.');
    }

    return {
      success: true,
      message: 'Account activated successfully',
    };
  });
