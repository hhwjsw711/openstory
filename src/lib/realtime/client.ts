'use client';

import { createRealtime } from '@upstash/realtime/client';
import type { realtimeSchema } from './index';

/**
 * Type-safe Realtime hook factory for the client.
 * Uses the same schema as the server to ensure type safety.
 */
export const { useRealtime } = createRealtime<typeof realtimeSchema>();
