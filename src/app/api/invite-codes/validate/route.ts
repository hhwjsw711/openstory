import { isValidAccessCode } from '@/lib/auth/access-codes';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body: { code: string } = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { isValid: false, message: 'Invite code is required' },
        { status: 400 }
      );
    }

    const isValid = isValidAccessCode(code);

    if (!isValid) {
      return NextResponse.json({
        isValid: false,
        message: 'Invalid invite code',
      });
    }

    return NextResponse.json({
      isValid: true,
      message: 'Valid invite code',
    });
  } catch (error) {
    console.error('Invite code validation error:', error);
    return NextResponse.json(
      { isValid: false, message: 'Validation failed' },
      { status: 500 }
    );
  }
}
