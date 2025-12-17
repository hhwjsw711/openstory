/**
 * Better Auth CLI configuration
 * This file exports the auth instance for the better-auth CLI to generate migrations
 *
 * Usage: bun auth:generate
 */

import { getAuth } from './config';

export default getAuth();
