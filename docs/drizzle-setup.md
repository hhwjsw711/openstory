# Drizzle ORM Setup Guide

## Overview

Drizzle ORM is now configured for the Velro application, providing type-safe database operations with PostgreSQL/Supabase.

## Architecture

### Files Created

```
/drizzle.config.ts                      # Drizzle Kit configuration
/drizzle/migrations/                    # Generated SQL migrations
/drizzle/README.md                      # Drizzle directory documentation
/src/lib/db/client.ts                   # Database client instance
/src/lib/db/client.test.ts              # Client tests
/src/lib/db/examples/basic-queries.ts   # Usage examples
/src/test/setup.ts                      # Test setup file
```

### Existing Files (Already Created)

```
/src/lib/db/pool.ts                     # PostgreSQL connection pool
/src/lib/db/schema/                     # Drizzle schema definitions
  ├── index.ts                          # Schema exports
  ├── auth.ts                           # Better Auth tables
  ├── users.ts                          # User table
  ├── teams.ts                          # Teams and members
  ├── sequences.ts                      # Sequences and frames
  ├── libraries.ts                      # Style/character/vfx/audio
  ├── tracking.ts                       # API request tracking
  └── credits.ts                        # Credits and transactions
```

## Configuration

### Database Client (`/src/lib/db/client.ts`)

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgPool } from './pool';
import { schema } from './schema';

export const db = drizzle(pgPool, {
  schema,
  logger: process.env.NODE_ENV === 'development',
});

export type Database = typeof db;
```

**Key Features:**

- Uses existing PostgreSQL pool (no new connections)
- Includes all schema definitions for relational queries
- Enables query logging in development mode
- Fully typed with TypeScript

### Drizzle Kit Config (`/drizzle.config.ts`)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

**Configuration Options:**

- `schema`: Path to Drizzle schema files
- `out`: Directory for generated migrations
- `dialect`: Database type (PostgreSQL)
- `dbCredentials`: Connection string from env
- `verbose`: Detailed migration output
- `strict`: Strict mode for safer migrations

## NPM Scripts

Added to `package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:check": "drizzle-kit check"
  }
}
```

### Script Descriptions

| Script        | Description                          | Use Case             |
| ------------- | ------------------------------------ | -------------------- |
| `db:generate` | Generate migration files from schema | After schema changes |
| `db:migrate`  | Apply migrations to database         | Deploy migrations    |
| `db:push`     | Push schema directly (no migrations) | Development only     |
| `db:studio`   | Open visual database browser         | Explore/edit data    |
| `db:check`    | Check for migration conflicts        | Before generating    |

## Usage Examples

### Basic Queries

```typescript
import { db } from '@/lib/db/client';
import { users, sequences } from '@/lib/db/schema';
import { eq, desc } from '@/lib/db/schema';

// SELECT
const user = await db.select().from(users).where(eq(users.id, userId));

// INSERT
const newUser = await db.insert(users).values({ id, email, name }).returning();

// UPDATE
await db.update(users).set({ name: 'New Name' }).where(eq(users.id, userId));

// DELETE
await db.delete(sequences).where(eq(sequences.id, sequenceId));
```

### Relational Queries

```typescript
// Query with relations
const sequence = await db.query.sequences.findFirst({
  where: eq(sequences.id, sequenceId),
  with: {
    frames: true,
    team: true,
  },
});
```

### Transactions

```typescript
await db.transaction(async (tx) => {
  const sequence = await tx.insert(sequences).values(data).returning();

  const frames = await tx.insert(frames).values(frameData).returning();

  return { sequence, frames };
});
```

## Development Workflow

### Making Schema Changes

1. **Edit Schema Files**

   ```typescript
   // /src/lib/db/schema/users.ts
   export const users = pgTable('users', {
     id: text('id').primaryKey(),
     email: text('email').notNull().unique(),
     name: text('name'), // Added new column
   });
   ```

2. **Generate Migration**

   ```bash
   bun db:generate
   ```

   This creates a new migration file in `/drizzle/migrations/`

3. **Review Migration SQL**
   Check the generated SQL file to ensure it matches expectations

4. **Apply Migration**
   ```bash
   bun db:migrate
   ```

### Development vs Production

**Development (Local):**

- Use `bun db:push` to quickly sync schema without migrations
- Run `bun db:studio` to browse data visually
- Enable query logging (automatic in dev mode)

**Production:**

- Always use migrations (`bun db:generate` → `bun db:migrate`)
- Test migrations in staging first
- Keep migrations in version control

## Integration with Existing Code

### Supabase Compatibility

Drizzle works alongside Supabase:

- **Database operations**: Use Drizzle (`db.select()`, etc.)
- **Storage/Auth**: Continue using Supabase SDK
- **Realtime**: Continue using Supabase realtime

### Migration Path

Existing code using Supabase client for DB operations can gradually migrate:

**Before (Supabase):**

```typescript
const { data } = await supabase.from('users').select('*').eq('id', userId);
```

**After (Drizzle):**

```typescript
const data = await db.select().from(users).where(eq(users.id, userId));
```

## Testing

### Test Setup

Tests automatically use the mock client via `/src/test/setup.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { db } from '@/lib/db/client';

describe('My Service', () => {
  it('should query database', async () => {
    const result = await db.select().from(users);
    expect(result).toBeDefined();
  });
});
```

### Running Tests

```bash
bun test                    # Run all tests
bun test --watch            # Watch mode
bun test specific.test.ts   # Single test file
```

## Best Practices

### 1. Type Safety

```typescript
// ✅ Good: Fully typed
import { User, NewUser } from '@/lib/db/schema';

const user: NewUser = {
  id: '123',
  email: 'user@example.com',
  name: 'John',
};

// ❌ Bad: Using 'any'
const user: any = {
  /* ... */
};
```

### 2. Transactions

```typescript
// ✅ Good: Use transactions for related operations
await db.transaction(async (tx) => {
  await tx.insert(sequences).values(sequenceData);
  await tx.insert(frames).values(framesData);
});

// ❌ Bad: Separate operations (not atomic)
await db.insert(sequences).values(sequenceData);
await db.insert(frames).values(framesData);
```

### 3. Error Handling

```typescript
// ✅ Good: Handle database errors
try {
  const user = await db.select().from(users).where(eq(users.id, userId));
  return user[0];
} catch (error) {
  console.error('Database error:', error);
  throw new DatabaseError('Failed to fetch user');
}
```

### 4. Query Optimization

```typescript
// ✅ Good: Select specific columns
await db
  .select({
    id: users.id,
    email: users.email,
  })
  .from(users);

// ⚠️ Less optimal: Select all columns
await db.select().from(users);
```

## Troubleshooting

### Common Issues

**Issue: "DATABASE_URL is not defined"**

- Solution: Ensure `.env.development.local` has `DATABASE_URL` set
- Run: `bun setup:env` to generate environment file

**Issue: "Table does not exist"**

- Solution: Run migrations: `bun db:migrate`
- Or push schema: `bun db:push`

**Issue: Type errors in queries**

- Solution: Ensure schemas are imported from `@/lib/db/schema`
- Check that schema types match database column types

**Issue: Migration conflicts**

- Solution: Run `bun db:check` to identify conflicts
- Review and resolve conflicts manually

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle Kit Documentation](https://orm.drizzle.team/kit-docs/overview)
- [Usage Examples](/src/lib/db/examples/basic-queries.ts)
- [Schema Definitions](/src/lib/db/schema/)

## Next Steps

1. ✅ Drizzle client configured and tested
2. ✅ Scripts added to package.json
3. ✅ Examples created for reference
4. 🔄 Migrate existing Supabase queries to Drizzle
5. 🔄 Add comprehensive tests for database operations
6. 🔄 Set up CI/CD pipeline for migrations
