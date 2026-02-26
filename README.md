# OpenStory

AI-powered video sequence platform.

## Tech Stack

- **Runtime**: Bun
- **Framework**: TanStack Start + TanStack Router + Vite
- **Database**: Turso (libSQL) + Drizzle ORM
- **Workflows**: QStash (durable execution)
- **Storage**: Cloudflare R2
- **Auth**: Better Auth
- **Styling**: Tailwind v4 + shadcn/ui

## Setup

```bash
bun install
bun setup              # Configure local environment
bun db:setup           # Migrate + seed database
```

## Development

Run in two terminals:

```bash
# Terminal 1: Async job processing
bun qstash:dev

# Terminal 2: Dev server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Scripts

| Command           | Description          |
| ----------------- | -------------------- |
| `bun dev`         | Start dev server     |
| `bun build`       | Build for production |
| `bun test`        | Run tests            |
| `bun lint`        | Lint with oxlint     |
| `bun format`      | Format with oxfmt    |
| `bun typecheck`   | Type check           |
| `bun db:generate` | Generate migrations  |
| `bun db:migrate`  | Apply migrations     |
| `bun db:studio`   | Open Drizzle Studio  |
| `bun storybook`   | Start Storybook      |

## Deployment

Supports Cloudflare Pages, Vercel, and Railway.

```bash
# Cloudflare
bun cf:deploy:stg   # Deploy to staging
bun cf:deploy:prd   # Deploy to production
```
