/**
 * BetterAuth API route handler
 * Handles all authentication requests at /api/auth/*
 */

import { auth } from '@/lib/auth/config';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth.handler);
