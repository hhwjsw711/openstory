# ULID Migration Example

This document shows what your schema would look like using ULIDs instead of UUIDs.

## Installation

```bash
bun add ulid
```

## 1. Create Shared ID Generator Utility

**`src/lib/db/id.ts`** (new file):

```typescript
/**
 * ID Generation Utilities
 * Centralized ID generation for all database entities
 */

import { ulid } from 'ulid';

/**
 * Generate a ULID (Universally Unique Lexicographically Sortable Identifier)
 *
 * Format: 01ARZ3NDEKTSV4RRFFQ69G5FAV (26 characters)
 *
 * Benefits over UUID v4:
 * - Lexicographically sortable (better index performance)
 * - Timestamp prefix (can extract creation time)
 * - Shorter (26 vs 36 characters)
 * - Still globally unique
 *
 * @returns ULID string
 *
 * @example
 * ```ts
 * const id = generateId();
 * // "01HF5Z8XKQYC5N8Z3KQXR6TBQM"
 * ```
 */
export function generateId(): string {
  return ulid();
}

/**
 * Generate a ULID with a specific timestamp
 * Useful for testing or backfilling data
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns ULID string with specified timestamp
 *
 * @example
 * ```ts
 * const id = generateIdAt(Date.now());
 * ```
 */
export function generateIdAt(timestamp: number): string {
  return ulid(timestamp);
}

/**
 * Extract timestamp from a ULID
 *
 * @param id - ULID string
 * @returns Unix timestamp in milliseconds
 *
 * @example
 * ```ts
 * const id = generateId();
 * const timestamp = getTimestampFromId(id);
 * console.log(new Date(timestamp)); // Creation time
 * ```
 */
export function getTimestampFromId(id: string): number {
  // ULID spec: first 10 characters encode timestamp
  const timeComponent = id.substring(0, 10);

  // Decode Crockford's Base32
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let value = 0;

  for (let i = 0; i < timeComponent.length; i++) {
    value = value * 32 + chars.indexOf(timeComponent[i]);
  }

  return value;
}

/**
 * Validate if a string is a valid ULID
 *
 * @param id - String to validate
 * @returns true if valid ULID
 *
 * @example
 * ```ts
 * isValidId('01ARZ3NDEKTSV4RRFFQ69G5FAV'); // true
 * isValidId('invalid'); // false
 * ```
 */
export function isValidId(id: string): boolean {
  // ULID is exactly 26 characters, Crockford's Base32 alphabet
  const ulidRegex = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
  return ulidRegex.test(id);
}
```

## 2. Updated Schema Example: `sequences.ts`

**Before (UUID version):**
```typescript
import { uuid } from 'drizzle-orm/pg-core';

export const sequences = pgTable('sequences', {
  id: uuid()
    .default(sql`uuid_generate_v4()`)
    .primaryKey()
    .notNull(),
  teamId: uuid('team_id').notNull(),
  styleId: uuid('style_id').notNull(),
  // ...
});
```

**After (ULID version with SQLite):**
```typescript
/**
 * Sequences and Frames Schema
 * Core content creation entities for video sequences
 */

import {
  AspectRatio,
  DEFAULT_ASPECT_RATIO,
} from '@/lib/constants/aspect-ratios';
import type { Scene } from '@/lib/script';
import {
  InferInsertModel,
  InferSelectModel,
  relations,
} from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  index,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';
import { user } from './auth';
import { styles } from './libraries';
import { teams } from './teams';

/**
 * Sequence status values
 * SQLite doesn't have native enums, so we use text with runtime validation
 */
export const SEQUENCE_STATUS = [
  'draft',
  'processing',
  'completed',
  'failed',
  'archived',
] as const;

export type SequenceStatus = (typeof SEQUENCE_STATUS)[number];

export const FRAME_GENERATION_STATUS = [
  'pending',
  'generating',
  'completed',
  'failed',
] as const;

export type FrameGenerationStatus = (typeof FRAME_GENERATION_STATUS)[number];

/**
 * Type for sequence metadata JSON field
 */
export type SequenceMetadata = {
  frameGeneration?: {
    startedAt?: string;
    expectedFrameCount?: number | null;
    completedFrameCount?: number;
    options?: Record<string, unknown>;
    error?: string | null;
    failedAt?: string | null;
    thumbnailsGenerating?: boolean;
    completedAt?: string;
  };
  [key: string]: unknown;
};

/**
 * Sequences table
 * Main video sequence/project entity
 */
export const sequences = sqliteTable(
  'sequences',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    title: text({ length: 500 }).notNull(),
    script: text(),
    status: text()
      .$type<SequenceStatus>()
      .default('draft')
      .notNull(),
    metadata: text({ mode: 'json' })
      .$type<SequenceMetadata>()
      .default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    // Note: No $onUpdate in SQLite - handle in application code
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    updatedBy: text('updated_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    styleId: text('style_id')
      .notNull()
      .references(() => styles.id, { onDelete: 'set null' }),
    aspectRatio: text('aspect_ratio', { length: 10 })
      .$type<AspectRatio>()
      .default(DEFAULT_ASPECT_RATIO)
      .notNull(),
    analysisModel: text('analysis_model', { length: 100 })
      .default('anthropic/claude-haiku-4.5')
      .notNull(),
    analysisDurationMs: integer('analysis_duration_ms').default(0).notNull(),
  },
  (table) => ({
    // Simplified indexes for SQLite
    createdAtIdx: index('idx_sequences_created_at').on(table.createdAt.desc()),
    statusIdx: index('idx_sequences_status').on(table.status),
    styleIdIdx: index('idx_sequences_style_id').on(table.styleId),
    teamIdIdx: index('idx_sequences_team_id').on(table.teamId),
  })
);

/**
 * Frames table
 * Individual frames/shots within a sequence
 */
export const frames = sqliteTable(
  'frames',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    sequenceId: text('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    description: text(),
    durationMs: integer('duration_ms').default(3000),
    thumbnailUrl: text('thumbnail_url'),
    videoUrl: text('video_url'),
    // Thumbnail generation status tracking
    thumbnailStatus: text('thumbnail_status')
      .$type<FrameGenerationStatus>()
      .default('pending'),
    thumbnailWorkflowRunId: text('thumbnail_workflow_run_id'),
    thumbnailGeneratedAt: integer('thumbnail_generated_at', {
      mode: 'timestamp',
    }),
    thumbnailError: text('thumbnail_error'),
    // Video/motion generation status tracking
    videoStatus: text('video_status')
      .$type<FrameGenerationStatus>()
      .default('pending'),
    videoWorkflowRunId: text('video_workflow_run_id'),
    videoGeneratedAt: integer('video_generated_at', {
      mode: 'timestamp',
    }),
    videoError: text('video_error'),
    metadata: text({ mode: 'json' }).$type<Scene>(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    // Compound index for efficient ordering queries
    orderIdx: index('idx_frames_order').on(table.sequenceId, table.orderIndex),
    sequenceIdIdx: index('idx_frames_sequence_id').on(table.sequenceId),
    // Unique constraint
    uniqueOrder: index('frames_sequence_id_order_index_key')
      .on(table.sequenceId, table.orderIndex)
      .unique(),
  })
);

// Relations (unchanged)
export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  team: one(teams, {
    fields: [sequences.teamId],
    references: [teams.id],
  }),
  user_createdBy: one(user, {
    fields: [sequences.createdBy],
    references: [user.id],
    relationName: 'sequences_createdBy_users_id',
  }),
  user_updatedBy: one(user, {
    fields: [sequences.updatedBy],
    references: [user.id],
    relationName: 'sequences_updatedBy_users_id',
  }),
  style: one(styles, {
    fields: [sequences.styleId],
    references: [styles.id],
  }),
  frames: many(frames),
}));

export const framesRelations = relations(frames, ({ one }) => ({
  sequence: one(sequences, {
    fields: [frames.sequenceId],
    references: [sequences.id],
  }),
}));

// Type exports (unchanged)
export type Sequence = InferSelectModel<typeof sequences>;
export type NewSequence = InferInsertModel<typeof sequences>;
export type UpdateSequence = Partial<Sequence>;

export type Frame = Omit<InferSelectModel<typeof frames>, 'metadata'> & {
  metadata: Scene | null;
};

export type NewFrame = Omit<InferInsertModel<typeof frames>, 'metadata'> & {
  metadata?: Scene | null;
};
```

## 3. Updated Schema Example: `auth.ts`

**After (ULID version with SQLite):**
```typescript
/**
 * Authentication Schema
 * Better Auth tables and user-related tables
 */

import {
  InferInsertModel,
  InferSelectModel,
  relations,
} from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  index,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '../id';

/**
 * Better Auth user table
 * Core authentication identity table using ULID
 */
export const user = sqliteTable(
  'user',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    email: text().notNull(),
    emailVerified: integer({ mode: 'boolean' }).default(false).notNull(),
    name: text(),
    image: text(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    isAnonymous: integer({ mode: 'boolean' }).default(false),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' })
      .default(false),
  },
  (table) => ({
    emailIdx: index('user_email_key').on(table.email).unique(),
  })
);

/**
 * Better Auth session table
 * Tracks active user sessions
 */
export const session = sqliteTable(
  'session',
  {
    id: text().primaryKey().notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    expiresAtIdx: index('idx_session_expires_at').on(table.expiresAt),
    tokenIdx: index('idx_session_token').on(table.token).unique(),
    userIdIdx: index('idx_session_user_id').on(table.userId),
  })
);

/**
 * Better Auth account table
 * OAuth/social provider accounts linked to users
 */
export const account = sqliteTable(
  'account',
  {
    id: text()
      .$defaultFn(() => generateId())
      .primaryKey()
      .notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp',
    }),
    scope: text(),
    password: text(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_account_user_id').on(table.userId),
    providerIdx: index('account_provider_id_account_id_key')
      .on(table.providerId, table.accountId)
      .unique(),
  })
);

/**
 * Better Auth verification table
 * Email verification and password reset tokens
 */
export const verification = sqliteTable('verification', {
  id: text()
    .$defaultFn(() => generateId())
    .primaryKey()
    .notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
});

// Relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Type exports
export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export type Session = InferSelectModel<typeof session>;
export type NewSession = InferInsertModel<typeof session>;

export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;

export type Verification = InferSelectModel<typeof verification>;
export type NewVerification = InferInsertModel<typeof verification>;
```

## 4. Validation Schema Updates

**Update Zod schemas to accept ULIDs:**

```typescript
import { z } from 'zod';
import { isValidId } from '@/lib/db/id';

// Before (UUID validation)
export const uuidSchema = z.string().uuid();

// After (ULID validation)
export const idSchema = z.string().refine(isValidId, {
  message: 'Invalid ID format',
});

// Usage in API routes
export const createSequenceSchema = z.object({
  teamId: idSchema,
  title: z.string().min(1).max(500),
  styleId: idSchema,
  // ...
});

export const getSequenceSchema = z.object({
  id: idSchema,
});
```

## 5. Better Auth Configuration

**Update `src/lib/auth/config.ts`:**

```typescript
import { generateId } from '@/lib/db/id';

export const auth = betterAuth({
  // ... other config

  // Advanced configuration
  advanced: {
    database: {
      // Use ULID instead of UUID
      generateId: () => generateId(),
    },
  },
});
```

## 6. Database Client Update

**`src/lib/db/client.ts`:**

```typescript
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { schema } from './schema';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development',
  casing: 'snake_case',
});

export type Database = typeof db;
```

## Key Differences: UUID vs ULID

| Feature | UUID v4 | ULID |
|---------|---------|------|
| **Format** | `550e8400-e29b-41d4-a716-446655440000` | `01HF5Z8XKQYC5N8Z3KQXR6TBQM` |
| **Length** | 36 characters | 26 characters |
| **Sortable** | ❌ No (random) | ✅ Yes (time-ordered) |
| **Index Performance** | 😐 Acceptable | ✅ Better (less fragmentation) |
| **Timestamp** | ❌ No | ✅ Yes (first 48 bits) |
| **Uniqueness** | ✅ Cryptographically random | ✅ Time + random |
| **URL-friendly** | ⚠️ Contains hyphens | ✅ Base32 (no special chars) |

## Migration Benefits

1. **Better Index Performance**
   - ULIDs are lexicographically sortable
   - Less B-tree fragmentation
   - Better cache locality

2. **Built-in Timestamps**
   ```typescript
   import { getTimestampFromId } from '@/lib/db/id';

   const sequence = await getSequence(id);
   const createdAt = getTimestampFromId(sequence.id);
   console.log(`Created at: ${new Date(createdAt)}`);
   ```

3. **Shorter IDs**
   - 26 vs 36 characters
   - Better for URLs, logs, UI display
   - 27% smaller in database

4. **Still Compatible**
   - Still strings (no breaking changes to TypeScript types)
   - Still unique across distributed systems
   - Better Auth supports custom ID generation

## When to Use ULID vs UUID

**Use ULID if:**
- ✅ Building new tables/systems
- ✅ Want better index performance
- ✅ Need sortable IDs
- ✅ Want built-in timestamps

**Use UUID if:**
- ✅ Already have UUIDs (migration cost)
- ✅ Need specific UUID versions (v5, v7, etc.)
- ✅ Ecosystem requires UUIDs
- ✅ "Good enough" performance is acceptable

## For Your Migration

**Recommendation:** Start with UUIDs for the Turso migration, then consider ULIDs for new tables.

This keeps the migration simple while giving you the option to adopt ULIDs incrementally as you build new features.
