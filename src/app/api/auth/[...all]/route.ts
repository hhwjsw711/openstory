/**
 * BetterAuth API route handler
 * Handles all authentication requests at /api/auth/*
 */

import { getAuth } from '@/lib/auth/config';

export async function GET(request: Request) {
  const auth = getAuth();
  return auth.handler(request);
}

export async function POST(request: Request) {
  const auth = getAuth();
  return auth.handler(request);
}
