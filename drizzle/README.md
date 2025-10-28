# Drizzle ORM Setup

This directory contains Drizzle ORM migrations for the Velro application.

## Overview

Drizzle ORM is configured to work with our PostgreSQL database (Supabase) using the existing connection pool.

## Directory Structure

```
drizzle/
├── migrations/          # Generated SQL migrations
│   └── .gitkeep
└── README.md           # This file
```

## Available Commands

### Development Workflow

```bash
# Generate migrations from schema changes
bun db:generate

# Apply migrations to database
bun db:migrate

# Push schema directly (development only, skips migrations)
bun db:push

# Open Drizzle Studio (visual database browser)
bun db:studio

# Check for migration conflicts
bun db:check
```

## Configuration

- **Config File**: `/drizzle.config.ts`
- **Schema Location**: `/src/lib/db/schema/`
- **Database Client**: `/src/lib/db/client.ts`
- **Connection Pool**: `/src/lib/db/pool.ts`

## Usage

### Creating Migrations

1. Make changes to schema files in `/src/lib/db/schema/`
2. Run `bun db:generate` to create migration files
3. Review generated SQL in `drizzle/migrations/`
4. Run `bun db:migrate` to apply migrations

### Using the Database Client

```typescript
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

// Query example
const allUsers = await db.select().from(users);

// Insert example
await db.insert(users).values({
  id: '123',
  email: 'user@example.com',
});
```

## Environment Variables

Ensure `DATABASE_URL` is set in your environment:

```bash
# .env.development.local or .env.local
DATABASE_URL=postgresql://user:password@localhost:54322/postgres
```

## Notes

- Migrations are tracked in git to maintain consistency across environments
- The database client uses the existing PostgreSQL pool (no new connections)
- Logger is enabled in development mode for debugging queries
- Drizzle Studio provides a visual interface for browsing/editing data
