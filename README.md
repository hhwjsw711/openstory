This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/create-next-app).

## Getting Started

### Prerequisites

- Node.js 18+
- bun (`npm install -g bun`)

### Development Setup

1. **Install dependencies:**

```bash
bun install
```

2. **Get Secrets**

```bash
# login to doppler
doppler login

# get dev secrets
bun run secrets:dev
```

**Terminal 2 - QStash Tunnel (Job Queue)**

```bash
bun qstash:dev
```

This creates a tunnel for QStash to reach your local API endpoints.

**Terminal 3 - Next.js App**

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Stopping Services

- Stop Next.js and QStash: Press `Ctrl+C` in their terminals

You can start editing the page by modifying `app/route.ts`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
