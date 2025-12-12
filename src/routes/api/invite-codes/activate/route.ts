import { isValidAccessCode } from '@/lib/auth/access-codes';
import { requireAuth } from '@/lib/auth/server';
import { getDb } from '#db-client';
import { user } from '@/lib/db/schema';
import { ensureUserAndTeam } from '@/lib/db/helpers';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. Require authentication
    const { user: authUser } = await requireAuth();

    // 2. Get request body
    const body: { code: string } = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Invite code is required' },
        { status: 400 }
      );
    }

    // 3. Check user status is 'pending'
    const userRecord = await getDb().query.user.findFirst({
      where: eq(user.id, authUser.id),
    });

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const status = (userRecord as typeof userRecord & { status?: string })
      .status;

    if (status === 'active') {
      return NextResponse.json(
        { success: false, error: 'Account already activated' },
        { status: 400 }
      );
    }

    if (status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: 'Account cannot be activated at this time',
        },
        { status: 400 }
      );
    }

    // 4. Validate invite code
    if (!isValidAccessCode(code)) {
      return NextResponse.json(
        { success: false, error: 'Invalid invite code' },
        { status: 400 }
      );
    }

    // 5. Update user status to 'active' and store invite code
    const normalizedCode = code.toUpperCase().trim();
    await getDb()
      .update(user)
      .set({
        status: 'active',
        accessCode: normalizedCode,
      })
      .where(eq(user.id, authUser.id));

    // 6. Ensure user has team
    const teamResult = await ensureUserAndTeam({
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
    });

    if (!teamResult.success) {
      console.error('[Activate] Failed to create team:', teamResult.error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create team. Please contact support.',
        },
        { status: 500 }
      );
    }

    console.log('[Activate] User activated successfully:', authUser.id);

    return NextResponse.json({
      success: true,
      message: 'Account activated successfully',
    });
  } catch (error) {
    console.error('[Activate] Error:', error);

    if (error instanceof Error) {
      if (error.message === 'Authentication required') {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to activate account' },
      { status: 500 }
    );
  }
}
