import { isValidAccessCode } from '@/lib/auth/access-codes';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body: { code: string } = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { isValid: false, message: 'Access code is required' },
        { status: 400 }
      );
    }

    const isValid = isValidAccessCode(code);

    if (!isValid) {
      return NextResponse.json({
        isValid: false,
        message: 'Invalid access code',
      });
    }

    return NextResponse.json({
      isValid: true,
      message: 'Valid access code',
    });
  } catch (error) {
    console.error('Access code validation error:', error);
    return NextResponse.json(
      { isValid: false, message: 'Validation failed' },
      { status: 500 }
    );
  }
}
