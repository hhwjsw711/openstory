/**
 * Preview Branch OAuth Transfer
 *
 * Handles secure user transfer from production to preview branches
 * when Google OAuth callback completes on production.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { eq } from 'drizzle-orm';

import { getDb } from '#db-client';
import { getEnv } from '#env';
import { generateId } from '@/lib/db/id';
import { account, session, user } from '@/lib/db/schema';

// JWT payload for preview transfer
export type PreviewTransferPayload = JWTPayload & {
  sub: string; // User ID from production
  email: string;
  name: string;
  image?: string;
  previewUrl: string; // Target preview URL origin
  callbackUrl: string; // Original callbackURL the user wanted
};

// Production hosts that should NOT be treated as preview
const PRODUCTION_HOSTS = [
  'app.velro.ai',
  'cf.velro.ai',
  'r.velro.ai',
  'v.velro.ai',
  'velro.up.railway.app',
];

// Allowed preview URL patterns
const ALLOWED_PREVIEW_PATTERNS = [
  /^https:\/\/velro-.*\.vercel\.app$/, // Vercel preview deployments
  /^https:\/\/.*\.velro\.ai$/, // Velro subdomains (excluding production)
  /^https:\/\/.*\.velro\.workers\.dev$/, // Cloudflare Workers preview
  /^http:\/\/localhost:\d+$/, // Local development
];

/**
 * Check if a URL is a valid preview deployment URL
 */
export function isPreviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Reject production hosts
    if (PRODUCTION_HOSTS.includes(parsed.hostname)) {
      return false;
    }

    // Check against allowed patterns
    return ALLOWED_PREVIEW_PATTERNS.some((pattern) =>
      pattern.test(parsed.origin)
    );
  } catch {
    return false;
  }
}

/**
 * Get the secret key for JWT signing (as Uint8Array for jose)
 */
function getJwtSecret(): Uint8Array {
  const secret = getEnv().BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET not configured');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Generate a signed JWT for preview transfer
 *
 * @param params - User and preview info to encode
 * @returns Signed JWT string (5 minute expiry)
 */
export async function generatePreviewTransferToken(params: {
  userId: string;
  email: string;
  name: string;
  image?: string;
  previewUrl: string;
  callbackUrl: string;
}): Promise<string> {
  if (!isPreviewUrl(params.previewUrl)) {
    throw new Error(`Invalid preview URL: ${params.previewUrl}`);
  }

  const token = await new SignJWT({
    sub: params.userId,
    email: params.email,
    name: params.name,
    image: params.image,
    previewUrl: params.previewUrl,
    callbackUrl: params.callbackUrl,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m') // 5 minute expiry
    .setIssuer('velro-production')
    .setAudience('velro-preview')
    .sign(getJwtSecret());

  return token;
}

/**
 * Verify and decode a preview transfer token
 *
 * @param token - JWT token to verify
 * @returns Decoded payload
 * @throws If token is invalid, expired, or malformed
 */
export async function verifyPreviewTransferToken(
  token: string
): Promise<PreviewTransferPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: 'velro-production',
    audience: 'velro-preview',
  });

  // Validate required fields
  if (
    !payload.sub ||
    !payload.email ||
    !payload.previewUrl ||
    !payload.callbackUrl
  ) {
    throw new Error('Invalid token payload: missing required fields');
  }

  return payload as PreviewTransferPayload;
}

/**
 * Create or find user on preview database and create session
 *
 * @param payload - Decoded JWT payload with user info
 * @returns Session token and callback URL
 */
export async function createPreviewSession(
  payload: PreviewTransferPayload
): Promise<{
  sessionToken: string;
  userId: string;
  callbackUrl: string;
}> {
  const db = getDb();

  // Check if user exists on preview DB (by ID or email)
  let existingUser = await db.query.user.findFirst({
    where: eq(user.id, payload.sub),
  });

  // Also check by email in case user exists with different ID
  if (!existingUser) {
    existingUser = await db.query.user.findFirst({
      where: eq(user.email, payload.email),
    });
  }

  if (!existingUser) {
    // Create user on preview database
    const [newUser] = await db
      .insert(user)
      .values({
        id: payload.sub,
        name: payload.name || payload.email.split('@')[0], // Fallback if name is empty
        email: payload.email,
        emailVerified: true, // Already verified via Google on production
        image: payload.image ?? null,
        status: 'active', // Skip invite code on preview - user is already approved on prod
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    existingUser = newUser;

    // Create Google account link
    await db.insert(account).values({
      id: generateId(),
      userId: newUser.id,
      providerId: 'google',
      accountId: payload.email, // Use email as account identifier
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('[Preview Transfer] Created user on preview DB:', {
      userId: newUser.id,
      email: payload.email,
    });
  } else {
    console.log('[Preview Transfer] User already exists on preview DB:', {
      userId: existingUser.id,
      email: existingUser.email,
    });
  }

  // Create session using the actual user ID (may differ from payload.sub if found by email)
  const sessionId = generateId();
  const sessionToken = generateId(); // Secure random token
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  await db.insert(session).values({
    id: sessionId,
    userId: existingUser.id,
    token: sessionToken,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('[Preview Transfer] Created session on preview DB:', {
    userId: existingUser.id,
    sessionId,
  });

  return {
    sessionToken,
    userId: existingUser.id,
    callbackUrl: payload.callbackUrl,
  };
}
