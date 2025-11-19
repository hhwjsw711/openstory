/**
 * BetterAuth API route handler
 * Handles all authentication requests at /api/auth/*
 */

import { auth } from '@/lib/auth/config';
import { toNextJsHandler } from 'better-auth/next-js';
import { NextRequest, NextResponse } from 'next/server';

const { GET: getHandler, POST: postHandler } = toNextJsHandler(auth.handler);

export async function GET(request: NextRequest) {
  console.log('[Auth Debug] GET request:', request.url);
  console.log(
    '[Auth Debug] Headers:',
    JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2)
  );

  try {
    return await getHandler(request);
  } catch (error) {
    console.error('[Auth Debug] GET error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[Auth Debug] POST request:', request.url);
  console.log(
    '[Auth Debug] Headers:',
    JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2)
  );

  try {
    return await postHandler(request);
  } catch (error) {
    console.error('[Auth Debug] POST error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(error) },
      { status: 500 }
    );
  }
}
