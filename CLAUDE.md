# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
bun dev              # Start development server with Turbopack
bun build            # Build production app with Turbopack
bun start            # Start production server
```

### Code Quality

```bash
bun lint              # Run linter (oxlint with type-aware checks)
bun lint:fix          # Fix linting issues automatically
bun format            # Format code with Prettier
bun format:check      # Check formatting without making changes
```

### Database (Turso/SQLite)

```bash
bun db:generate         # Generate migrations from schema
bun db:migrate          # Apply migrations to database
bun db:seed             # Seed database with initial data (system team + style templates)
bun db:setup            # Run migrate + seed together (recommended for first-time setup)
bun db:push             # Push schema changes to database
bun db:studio           # Open Drizzle Studio (database GUI)
bun db:check            # Check for schema issues
```

**Note**: Local development uses a local SQLite file (`local.db`) via Turso's libSQL client. Production uses Turso cloud database. Both use the same libSQL driver for dev/prod parity.

### QStash Development

```bash
bun qstash:dev         # Start QStash tunnel for local webhooks
```

**Note**: Local development uses hardcoded QStash credentials (user: `defaultUser`) configured in `setup-env.sh`. The workflow URL is set to `http://host.docker.internal:3000` so QStash (running in Docker) can reach your local Next.js app.

### Environment Setup

```bash
bun setup:env          # Create .env.development.local with database and QStash credentials
```

**Note**: Database types are managed by Drizzle ORM:

- Schema defined in `src/lib/db/schema/`
- Types automatically inferred by Drizzle
- Use `bun db:generate` to create migrations from schema changes
- Use `bun db:migrate` to apply migrations to your local database

### Cloudflare R2 Storage

```bash
bun scripts/setup-r2-buckets.sh    # Create R2 buckets (interactive)
```

**R2 Setup Steps**:

1. Run `bunx wrangler login` to authenticate with Cloudflare
2. Run `bun scripts/setup-r2-buckets.sh` to create buckets
3. Create an R2 API token in Cloudflare Dashboard
4. Add R2 credentials to `.env.development.local`:

```bash
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=velro-storage-dev  # or velro-storage for production
```

### TypeScript

```bash
bun tsc --noEmit      # Type check without building
```

### Storybook (Component Development)

```bash
bun storybook         # Start Storybook dev server
bun build-storybook   # Build Storybook for production
```

### Deployment (Cloudflare Pages)

```bash
bun deploy:cloudflare              # Deploy to Cloudflare Pages (preview)
bun deploy:cloudflare:production   # Deploy to Cloudflare Pages (production)
bun setup:cloudflare-secrets       # Sync environment variables to Cloudflare
```

**Note**: Cloudflare Pages is one of three supported hosting platforms (Cloudflare, Vercel, Railway). All platforms use the same codebase with automatic platform detection.

## Development Workflow

### First Time Setup

1. **Install dependencies**: `bun install`
2. **Setup environment**: `bun setup:env` (automatically configures database + QStash with local dev credentials)
3. **Initialize database**: `bun db:setup` (creates local.db with schema + seeds initial data)
4. **Setup R2 Storage**:
   - `bunx wrangler login` (authenticate with Cloudflare)
   - `bun scripts/setup-r2-buckets.sh` (create R2 buckets)
   - Add R2 credentials to `.env.development.local`

### Daily Development (2 Terminal Setup)

1. **Terminal 1 - QStash**: `bun qstash:dev` (for async job testing)
2. **Terminal 2 - Next.js**: `bun dev`

**Note**: No database server needed - local SQLite file (`local.db`) is used automatically.

### Before Committing

```bash
bun tsc --noEmit      # Check TypeScript
bun lint              # Run linter with type-aware checks
bun format:check      # Check code formatting
bun test              # Run test suite
```

**Automatic Issue Tagging**: When working on branches that start with an issue number (e.g., `54-feature-name`), commit messages are automatically tagged with the issue number. For example, a commit message "Fix bug in auth" on branch `54-pre-commit-issue` becomes "Fix bug in auth (#54)".

This feature:

- Only applies to branches starting with digits followed by a dash
- Skips merge commits
- Won't duplicate existing issue numbers in commit messages
- Uses the lefthook commit-msg hook via `scripts/add-issue-number.sh`

## Deployment

Velro supports three hosting platforms with automatic platform detection:

### Cloudflare Pages (Recommended for Global Performance)

**Initial Setup**:

1. **Authenticate with Cloudflare**:

   ```bash
   bunx wrangler login
   ```

2. **Create Cloudflare Pages project** (via dashboard or CLI):

   ```bash
   bunx wrangler pages project create velro
   ```

3. **Set up GitHub secrets** (for CI/CD):
   - `CLOUDFLARE_API_TOKEN` - Create at https://dash.cloudflare.com/profile/api-tokens
   - `CLOUDFLARE_ACCOUNT_ID` - Find in Cloudflare dashboard URL

4. **Configure environment variables**:

   ```bash
   # Copy your local environment
   cp .env.development.local .env.production

   # Sync secrets to Cloudflare
   bun setup:cloudflare-secrets --production
   ```

**Deployment Options**:

```bash
# Option 1: Automated via GitHub Actions (recommended)
# Push to main branch or create a PR
git push origin main

# Option 2: Manual deployment
bun deploy:cloudflare              # Preview deployment
bun deploy:cloudflare:production   # Production deployment
```

**PR Preview Deployments**:

- Automatic preview for every PR
- URL format: `https://<branch>.velro.pages.dev`
- Preview comment posted automatically on PR

**Platform-Specific Features**:

- **Edge Runtime**: Middleware runs on Cloudflare's edge network
- **R2 Storage**: Native integration with Cloudflare R2 (already configured)
- **Global CDN**: Automatic distribution to 275+ cities worldwide
- **Zero Cold Starts**: Edge workers stay warm

**Cloudflare-Specific Configuration**:

- `wrangler.jsonc` - Cloudflare Workers configuration
- `.dev.vars` - Local development secrets (gitignored)
- `nodejs_compat` flag enabled for Node.js API compatibility

### Vercel (Alternative Platform)

**Deployment**:

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy
vercel          # Preview deployment
vercel --prod   # Production deployment
```

**Configuration**:

- `vercel.json` - Platform configuration
- Environment variables set via Vercel dashboard
- Automatic PR previews included

### Railway (Alternative Platform)

**Deployment**:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway up
```

**Configuration**:

- Environment variables set via Railway dashboard
- Automatic PR previews supported

### Multi-Platform Compatibility

The codebase automatically adapts to each platform:

**Platform Detection** (`src/lib/utils/environment.ts`):

```typescript
// Automatically detects: cloudflare | vercel | railway | local
const platform = getDeploymentPlatform();
const isCloudflare = isCloudflare();
```

**APP_URL Resolution** (automatic):

- Cloudflare: `CF_PAGES_URL`
- Vercel: `VERCEL_URL`
- Railway: `RAILWAY_PUBLIC_DOMAIN`
- Local: `localhost:3000`

**Edge Runtime Compatibility**:

- Middleware uses `runtime: 'edge'` (works on all platforms)
- Auth uses cookie-based session validation
- Storage uses S3 SDK (compatible with Cloudflare Workers via `nodejs_compat`)

### Required Environment Variables (All Platforms)

```bash
# Database (Turso)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# Authentication
BETTER_AUTH_SECRET=your-secret
APP_URL=https://your-domain.com

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET_NAME=velro-storage

# Workflows (QStash)
QSTASH_TOKEN=your-token
QSTASH_URL=https://qstash.upstash.io
QSTASH_CURRENT_SIGNING_KEY=your-key
QSTASH_NEXT_SIGNING_KEY=your-key

# Optional: AI Service Keys
FAL_KEY=your-fal-key
OPENROUTER_API_KEY=your-key
CEREBRAS_API_KEY=your-key
GOOGLE_CLIENT_ID=your-id
GOOGLE_CLIENT_SECRET=your-secret
RESEND_API_KEY=your-key
```

### GitHub Actions CI/CD

**Cloudflare Deployment** (`.github/workflows/cloudflare-deploy.yml`):

- Triggers on push to `main` and PR events
- Runs tests, linting, type checking
- Builds with `@cloudflare/next-on-pages`
- Deploys to Cloudflare Pages
- Posts preview URL as PR comment

**Database Preview Environments** (`.github/workflows/database-ci.yml`):

- Creates Turso database for each PR
- Destroys database when PR closes
- Unique database URL per PR

**Test Suite** (`.github/workflows/test.yml`):

- Runs on all PRs
- Bun test + linting + type checking

## Project Architecture

This is a Next.js 15 headless API application for AI-powered video sequence creation. The app transforms scripts into consistent, styled video productions using multiple AI models.

### Core Design Principles

- **Backend-only database access**: All database operations go through API routes. Database client is only used server-side for security and consistency.
- **Anonymous-first**: Users can start creating without signup, then upgrade to save work via email login.
- **Team-based**: All resources (sequences, styles, characters, vfx, audio) belong to teams for collaboration.
- **Script-driven**: Everything generates from the script to maintain consistency.

### Data Model Hierarchy

```
teams
  ├── users (team members)
  ├── sequences (videos)
  │   └── frames (storyboard elements)
  └── libraries
      ├── styles (Style Stacks for consistency)
      ├── characters (LoRA models)
      ├── vfx (effects presets)
      └── audio (sound/music)
```

### Key Technical Decisions

1. **State Management**: Use TanStack Query for server state and reducers for complex UI state. Keep components pure.
2. **UI Components**: Use shadcn/ui components exclusively. Apply styling through theme variables, not inline Tailwind.
3. **Async Processing**: QStash Workflow handles all AI generation tasks with durable execution and automatic retries.
4. **Authentication**: Better Auth with email/password login.
5. **File Structure**: API routes handle all business logic and DB access. Components remain presentational.

### API Pattern

All API routes follow this structure:

1. Validate input (Zod schemas)
2. Check auth/team permissions
3. Execute business logic (DB operations only here)
4. Trigger workflows for async AI generation tasks
5. Return standardized response with workflow run ID

### Generation Pipeline

1. User uploads/edits script
2. AI analyzes and creates frame boundaries
3. Frames generated with Style Stack + character LoRAs
4. Motion added via video models
5. Export as video or other formats

### Technology Stack

- **Runtime**: Bun (migrated from Node.js/pnpm)
- **Framework**: Next.js 15 with App Router and Turbopack
- **Database**: Turso (libSQL/SQLite) with Drizzle ORM
- **Authentication**: Better Auth with Drizzle adapter
- **Storage**: Cloudflare R2 (S3-compatible)
- **Workflows**: QStash Workflow (Upstash) for durable, serverless AI task orchestration
- **Styling**: Tailwind CSS v4 with shadcn/ui
- **Testing**: Bun test (migrated from Vitest)
- **Linting**: oxlint with type-aware checks
- **Formatting**: Prettier
- **AI Models**: Multiple providers (Fal.ai, Runway, Kling, etc.) via unified interface

### Fal.ai API Documentation

When working with fal.ai models, always verify API specifications using the `/llms.txt` endpoint:

```bash
# Get exact API specifications for any model
https://fal.ai/models/{model-path}/llms.txt

# Examples:
https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/llms.txt
https://fal.ai/models/fal-ai/fast-svd-lcm/llms.txt
https://fal.ai/models/fal-ai/wan-25-preview/image-to-video/llms.txt
```

**Why `/llms.txt`?**

- Provides machine-readable, authoritative parameter specifications
- Includes all required/optional parameters with types, defaults, and constraints
- More reliable than HTML documentation which may be outdated
- Essential for accurate model capability definitions in `src/lib/ai/models.ts`

**Always verify before updating model configurations** to ensure capabilities match the actual API.

### Motion Generation Status Checking

The motion service uses fal.ai's queue-based `subscribe()` API for asynchronous video generation. When you generate motion with `generateMotionForFrame()`, you receive status URLs that can be used to check progress, get results, or cancel requests.

**Status URLs returned from `generateMotionForFrame()`:**

```typescript
const result = await generateMotionForFrame({
  imageUrl: 'https://example.com/image.jpg',
  prompt: 'Camera pan left',
  model: 'wan_i2v',
});

// result.requestId - Unique request identifier
// result.statusUrl - Check current status
// result.responseUrl - Get final result
// result.cancelUrl - Cancel the request
```

**Programmatic status checking:**

```typescript
import {
  checkMotionStatus,
  getMotionResult,
  cancelMotionGeneration,
} from '@/lib/services/motion.service';

// Check status
const status = await checkMotionStatus(result.statusUrl);
// status.status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED"
// status.queue_position (when IN_QUEUE)
// status.logs[] (when IN_PROGRESS or COMPLETED)
// status.metrics.inference_time (when COMPLETED)

// Get result once completed
const video = await getMotionResult(result.responseUrl);
// video.video.url - Final video URL

// Cancel if needed
await cancelMotionGeneration(result.cancelUrl);
```

**CLI status checking:**

```bash
# Check status
bun scripts/check-motion-status.ts <status-url>

# Get result
bun scripts/check-motion-status.ts --result <response-url>

# Cancel request
bun scripts/check-motion-status.ts --cancel <cancel-url>

# Example
bun scripts/check-motion-status.ts https://queue.fal.run/fal-ai/fast-svd-lcm/requests/abc123/status
```

**Using curl directly:**

```bash
# Check status
curl -H "Authorization: Key $FAL_KEY" https://queue.fal.run/fal-ai/fast-svd-lcm/requests/abc123/status

# Get result
curl -H "Authorization: Key $FAL_KEY" https://queue.fal.run/fal-ai/fast-svd-lcm/requests/abc123

# Cancel
curl -X PUT -H "Authorization: Key $FAL_KEY" https://queue.fal.run/fal-ai/fast-svd-lcm/requests/abc123/cancel
```

### Import Alias

Use `@/*` to import from src directory:

```typescript
import { something } from '@/app/api/utils';
```

## Backend Development Guidelines

### When creating new features:

1. Start with API route in `/app/api/[feature]`
2. All DB operations in API routes only
3. Create workflows in `/app/api/workflows/[workflow-name]` for AI generation or long-running tasks
4. API routes trigger workflows and return workflow run IDs
5. Create TanStack Query hooks for data fetching
6. Build components with shadcn/ui only
7. Apply theme variables for styling, avoid inline Tailwind

### Style Stacks

The core innovation - JSON presets that maintain consistent style across different AI models:

- Stored per team in the styles library
- Auto-adapt to different model requirements
- Include persistent elements (characters, settings)
- Tradeable in marketplace (future feature)

### Frame System

Frames are the building blocks of sequences, with each frame representing one scene from script analysis.

**Frame Structure:**

- **Visual Content**: `thumbnailUrl` (image) and `videoUrl` (motion video)
- **Metadata**: Complete `Scene` object from script analysis (typed as JSONB in database)
- **Database**: Frame.metadata is typed as `Scene` in Drizzle schema for full type safety

**Frame Metadata = Scene Object** (`src/lib/ai/frame.schema.ts`):

Frame metadata IS the Scene object directly - no wrapper, just the complete scene data:

```typescript
frame.metadata = {
  sceneId: string,
  sceneNumber: number,
  originalScript: { extract, lineNumber, dialogue },
  metadata: { title, durationSeconds, location, timeOfDay, storyBeat },
  variants: { cameraAngles, movementStyles, moodTreatments }, // A/B/C options
  selectedVariant: { cameraAngle, movementStyle, moodTreatment, rationale },
  prompts: {
    visual: { fullPrompt, negativePrompt, components, parameters },
    motion: { fullPrompt, components, parameters },
  },
  continuity: { characterTags, environmentTag, colorPalette, lightingSetup },
  audioDesign: { music, soundEffects, dialogue, ambient },
};
```

**Key Benefits:**

- Simple, clean structure - metadata IS the scene
- Complete scene data enables regeneration without re-analyzing script
- Variants preserved for trying different creative options
- Prompts stored for consistent regeneration
- Continuity maintained across frames
- Type-safe with Drizzle's typed JSONB

**Working with Frames:**

```typescript
import { frameService } from '@/lib/services/frame.service';

// Get scene data from frame (metadata IS the scene)
const scene = frameService.getSceneData(frame);

// Get prompts for regeneration
const visualPrompt = frameService.getVisualPrompt(frame);
const motionPrompt = frameService.getMotionPrompt(frame);

// Check if frame has valid Scene metadata
const hasScene = frameService.hasSceneMetadata(frame);

// Access scene data directly (typed!)
const sceneTitle = frame.metadata.metadata.title;
const visualPrompt = frame.metadata.prompts.visual.fullPrompt;
```

### Workflow Architecture

All async AI operations use QStash Workflow for durable execution:

**Available Workflows** (`/app/api/workflows/[...any]/`):

- `image-workflow` - Image generation with FAL/LetzAI
- `motion-workflow` - Image-to-video generation (motion for frames)
- `storyboard-workflow` - Complex orchestration for script analysis and frame creation

**Workflow Status Endpoint**: `/app/api/workflows/status/[runId]/` - Check workflow execution status

**Workflow Pattern**:

```typescript
// 1. API route triggers workflow via QStash publish
const workflowInput: ImageWorkflowInput = {
  userId: user.id,
  teamId: team.id,
  prompt: '...',
  // ...
};

// Publish to QStash to trigger the workflow
const qstash = getQStashClient();
const { messageId } = await qstash.publishJSON({
  url: `${getQStashWebhookUrl()}/workflows/image`, // Use webhook URL for QStash
  body: workflowInput,
});

const workflowRunId = messageId;

// 2. Workflow registered with serveMany in /api/workflows/[...any]/route.ts
export const { POST } = serveMany(
  {
    storyboard: generateStoryboardWorkflow,
    image: generateImageWorkflow,
    motion: generateMotionWorkflow,
  },
  {
    baseUrl: getQStashWebhookUrl(),
  }
);

// 3. Individual workflow implementation
export const generateImageWorkflow = async (
  context: WorkflowContext<ImageWorkflowInput>
) => {
  const input = context.requestPayload;
  validateWorkflowAuth(input); // Check userId/teamId

  const result = await context.run('step-name', async () => {
    // Step logic - automatically retried on failure
  });
};
```

**Important**:

- Always use `qstash.publishJSON()` to trigger workflows, not direct `fetch()` calls
- QStash requires proper signatures which are only added through the publish API
- Use `getQStashWebhookUrl()` for QStash webhook URLs (external URL that QStash can reach)
- Workflows are registered using `serveMany()` from `@upstash/workflow/dist/nextjs`

**Key Principles**:

- Workflows handle their own state - no database job tracking needed
- Pass auth (userId/teamId) through workflow context
- Use `context.run()` for each logical step
- Workflows update database records directly (e.g., frame.thumbnail_url)
- Steps are durable - execution continues even if server restarts

## React Development Guidelines

### Component Structure & Logic

**Keep reusable components small (<100 lines) for clarity. Views can be larger - don't split unnecessarily. Extract logic to vanilla TypeScript.**

Note: Views live in `app/` routes (Next.js pages), components live in `components/` (reusable pieces). Don't over-split components if it adds complexity - a cohesive 200-line view is better than 5 fragmented files.

```tsx
// ❌ BAD - Logic mixed with UI, useEffect for data fetching, inline styles
'use client';
import { useEffect, useState } from 'react';

export default function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
        setIsLoading(false);
      });
  }, [userId]);

  if (isLoading) return <div>Loading...</div>;

  return <div style={{ fontSize: 16, color: '#333' }}>{user.name}</div>;
}

// ✅ GOOD - TanStack Query, Suspense, logic extracted, theme variables
('use client');
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { formatUserName } from '@/lib/users/format'; // vanilla TS function

const UserProfileContent: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId), // vanilla TS function
    suspense: true,
  });

  return <div className="text-base">{formatUserName(user)}</div>;
};

export const UserProfile: React.FC<{ userId: string }> = ({ userId }) => {
  return (
    <Suspense fallback={<Skeleton className="h-6 w-32" />}>
      <UserProfileContent userId={userId} />
    </Suspense>
  );
};
```

### State Management

**Avoid useState/useEffect for data fetching. Use Suspense instead of isLoading checks. Use reducers only when state updates depend on other state (complex state logic).**

```tsx
// ❌ BAD - Multiple useState, useEffect for data fetching, isLoading checks
'use client';
import { useEffect, useState } from 'react';

function FrameEditor({ frameId }: { frameId: string }) {
  const [frame, setFrame] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('default');

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/frames/${frameId}`)
      .then((r) => r.json())
      .then((data) => {
        setFrame(data);
        setIsLoading(false);
      });
  }, [frameId]);

  if (isLoading) return <div>Loading...</div>; // Manual loading state

  // ... complex update logic scattered across handlers
}

// ✅ GOOD - Suspense for loading, TanStack Query, reducer for UI state
('use client');
import { Suspense, useReducer } from 'react';
import { useQuery } from '@tanstack/react-query';
import { frameReducer, initialState } from './frame-editor.reducer'; // vanilla TS
import { Skeleton } from '@/components/ui/skeleton';

type FrameEditorProps = {
  frameId: string;
  onUpdate?: (state: EditorState) => void;
};

const FrameEditorContent: React.FC<FrameEditorProps> = ({
  frameId,
  onUpdate,
}) => {
  const { data: frame } = useQuery({
    queryKey: ['frame', frameId],
    queryFn: () => fetchFrame(frameId), // vanilla TS function
    suspense: true, // Enable Suspense
  });

  const [state, dispatch] = useReducer(frameReducer, initialState);

  // No isLoading check needed - Suspense handles it
  return (
    <div className="flex flex-col gap-4">
      <h2>{frame.title}</h2>
      {/* ... */}
    </div>
  );
};

// Wrap with Suspense boundary
export const FrameEditor: React.FC<FrameEditorProps> = (props) => {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <FrameEditorContent {...props} />
    </Suspense>
  );
};
```

**Reducer pattern (vanilla TypeScript)**

```typescript
// frame-editor.reducer.ts - Pure vanilla TypeScript
export type EditorState = {
  isEditing: boolean;
  prompt: string;
  style: string;
  isDirty: boolean;
};

export type EditorAction =
  | { type: 'START_EDIT' }
  | { type: 'UPDATE_PROMPT'; payload: string }
  | { type: 'CHANGE_STYLE'; payload: string }
  | { type: 'RESET' };

export const initialState: EditorState = {
  isEditing: false,
  prompt: '',
  style: 'default',
  isDirty: false,
};

export function frameReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case 'START_EDIT':
      return { ...state, isEditing: true };
    case 'UPDATE_PROMPT':
      return { ...state, prompt: action.payload, isDirty: true };
    case 'CHANGE_STYLE':
      return { ...state, style: action.payload, isDirty: true };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}
```

### Styling & Layout

**Use theme variables, flexbox with gap (not margin), pre-styled variants (not props). Avoid excessive inline Tailwind - create base components with built-in theming instead.**

Key principle: If you find yourself adding lots of Tailwind classes to components/views, you should instead create or extend a base component with that styling built-in. Keep Tailwind usage minimal - mainly for layout (flex, gap, grid) and spacing. Color, typography, and component-specific styling should come from the theme.

```tsx
// ❌ BAD - Excessive inline Tailwind, inline styles, hard-coded colors
export default function FrameCard({ frame, onSelect }) {
  return (
    <div
      className="w-[300px] h-[200px] m-4 p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-slate-200 dark:border-slate-700"
      onClick={onSelect}
    >
      <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
        {frame.title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {frame.description}
      </p>
    </div>
  );
}

// ✅ GOOD - Base component with theme, minimal Tailwind for layout only
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

type FrameCardProps = {
  frame: Frame;
  onSelect?: () => void;
};

export const FrameCard: React.FC<FrameCardProps> = ({ frame, onSelect }) => {
  return (
    <Card onClick={onSelect} className="cursor-pointer">
      <CardHeader>
        <CardTitle>{frame.title}</CardTitle>
        <CardDescription>{frame.description}</CardDescription>
      </CardHeader>
    </Card>
  );
};

// Usage in view - layout only with Tailwind
export const FrameGrid: React.FC<{ frames: Frame[] }> = ({ frames }) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      {' '}
      {/* Tailwind for layout/spacing only */}
      {frames.map((frame) => (
        <FrameCard key={frame.id} frame={frame} />
      ))}
    </div>
  );
};
```

**Why this is better:**

- Base `Card` component handles theming, colors, shadows, borders automatically
- Views only use Tailwind for layout (`grid`, `gap`) and structure
- Dark mode, hover states, colors all come from theme
- Easy to maintain - change theme, not every component

### Loading States & Conditional Rendering

**Inline skeletons matching layout structure. Use CSS display (not conditional rendering) for show/hide.**

```tsx
// ❌ BAD - Separate skeleton component, conditional rendering causes janky UI
function FrameCardSkeleton() {
  return (
    <div className="p-4 border rounded">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mt-2" />
    </div>
  );
}

function FrameCard({ frame, showDetails }: Props) {
  if (!frame) return <FrameCardSkeleton />;

  return (
    <div className="p-4 border rounded">
      <h3>{frame.title}</h3>
      {showDetails && ( // conditional render causes layout shift
        <DetailPanel frame={frame} />
      )}
    </div>
  );
}

// ✅ GOOD - Inline skeleton, CSS display for visibility
import { Skeleton } from '@/components/ui/skeleton';

type FrameCardProps = {
  frame?: Frame;
  showDetails?: boolean;
};

export const FrameCard: React.FC<FrameCardProps> = ({
  frame,
  showDetails = false,
}) => {
  return (
    <div className="flex flex-col gap-3 p-4 border rounded">
      {frame ? (
        <h3 className="text-lg font-semibold">{frame.title}</h3>
      ) : (
        <Skeleton className="h-6 w-3/4" />
      )}

      {/* Pre-renders but hidden - no layout shift */}
      <div className={showDetails ? 'block' : 'hidden'}>
        {frame ? (
          <DetailPanel frame={frame} />
        ) : (
          <Skeleton className="h-20 w-full" />
        )}
      </div>
    </div>
  );
};
```

### File Organization & Naming

**kebab-case files, named exports, routable views with URL state**

```tsx
// ❌ BAD
// File: UserProfile.tsx (PascalCase causes git issues)
export default function Component({ id }) {
  // default export, unclear name
  const user = useGlobalUser(); // global state
  // No URL state - can't deep link
}

// ✅ GOOD
// File: user-profile.tsx
import { formatUserName } from '@/lib/users/format-user-name'; // vanilla TS

type UserProfileProps = {
  userId: string; // from URL params
};

export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1>{user ? formatUserName(user) : <Skeleton className="h-8 w-48" />}</h1>
    </div>
  );
};

// File: page.tsx (route)
export default function UserProfilePage({
  params,
}: {
  params: { userId: string };
}) {
  return <UserProfile userId={params.userId} />;
}
```

### Forms

**Use useActionState, uncontrolled inputs when possible, validate after submission**

```tsx
// ❌ BAD - Controlled inputs everywhere, no progressive enhancement
'use client';
import { useState } from 'react';

function ScriptForm() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Manual validation, blocking, no progressive enhancement
    if (!title) {
      setErrors({ title: 'Required' });
      return;
    }
    await fetch('/api/scripts', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      {errors.title && <span>{errors.title}</span>}
    </form>
  );
}

// ✅ GOOD - useActionState, server validation, progressive enhancement
('use client');
import { useActionState } from 'react';
import { createScriptAction } from './actions'; // server action
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const ScriptForm: React.FC = () => {
  const [state, formAction, isPending] = useActionState(
    createScriptAction,
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Input
          name="title"
          placeholder="Script title…"
          autoComplete="off"
          required
          aria-invalid={!!state?.errors?.title}
        />
        {state?.errors?.title && (
          <p className="text-sm text-destructive">{state.errors.title}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          name="content"
          placeholder="Write your script…"
          className="min-h-[200px] resize-y"
          required
          aria-invalid={!!state?.errors?.content}
        />
        {state?.errors?.content && (
          <p className="text-sm text-destructive">{state.errors.content}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create Script'}
      </Button>
    </form>
  );
};
```

### Import Organization

**Direct imports (no React. prefix), named exports, @ alias for src**

```tsx
// ❌ BAD
import React from 'react';
import Button from '../../../components/ui/button'; // relative paths

export default function MyComponent() {
  const [state, setState] = React.useState(0); // React. prefix
  return <Button onClick={() => setState(state + 1)} />;
}

// ✅ GOOD
import { useState } from 'react'; // direct import
import { Button } from '@/components/ui/button'; // @ alias
import { calculateTotal } from '@/lib/utils/calculations'; // vanilla TS

export const OrderSummary: React.FC<{ items: Item[] }> = ({ items }) => {
  const [quantity, setQuantity] = useState(1);
  const total = calculateTotal(items, quantity); // vanilla TS function

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={() => setQuantity(quantity + 1)}>Add More</Button>
      <p>Total: ${total}</p>
    </div>
  );
};
```

### Quick Reference

- **State**: TanStack Query for server data, reducers only for complex state logic
- **Loading**: Suspense instead of isLoading checks, inline <Skeleton /> fallbacks
- **Styling**: Minimal Tailwind (layout only), use base components with built-in theming
- **Layout**: Flexbox + gap (never margin on components)
- **Files**: kebab-case.tsx, named exports, vanilla TS for logic
- **Forms**: useActionState, server validation, progressive enhancement
- **Visibility**: CSS display for show/hide (not conditional rendering)
- **Imports**: Direct (useState not React.useState), @ alias, no default exports

### Rules for Building Accessible, Fast, Delightful UIs

Use MUST/SHOULD/NEVER to guide decisions

## Interactions

- Keyboard
  - MUST: Full keyboard support per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
  - MUST: Visible focus rings (`:focus-visible`; group with `:focus-within`)
  - MUST: Manage focus (trap, move, and return) per APG patterns
- Targets & input
  - MUST: Hit target ≥24px (mobile ≥44px) If visual <24px, expand hit area
  - MUST: Mobile `<input>` font-size ≥16px or set:
    ```html
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
    />
    ```
  - NEVER: Disable browser zoom
  - MUST: `touch-action: manipulation` to prevent double-tap zoom; set `-webkit-tap-highlight-color` to match design
- Inputs & forms (behavior)
  - MUST: Hydration-safe inputs (no lost focus/value)
  - NEVER: Block paste in `<input>/<textarea>`
  - MUST: Loading buttons show spinner and keep original label
  - MUST: Enter submits focused text input In `<textarea>`, ⌘/Ctrl+Enter submits; Enter adds newline
  - MUST: Keep submit enabled until request starts; then disable, show spinner, use idempotency key
  - MUST: Don’t block typing; accept free text and validate after
  - MUST: Allow submitting incomplete forms to surface validation
  - MUST: Errors inline next to fields; on submit, focus first error
  - MUST: `autocomplete` + meaningful `name`; correct `type` and `inputmode`
  - SHOULD: Disable spellcheck for emails/codes/usernames
  - SHOULD: Placeholders end with ellipsis and show example pattern (eg, `+1 (123) 456-7890`, `sk-012345…`)
  - MUST: Warn on unsaved changes before navigation
  - MUST: Compatible with password managers & 2FA; allow pasting one-time codes
  - MUST: Trim values to handle text expansion trailing spaces
  - MUST: No dead zones on checkboxes/radios; label+control share one generous hit target
- State & navigation
  - MUST: URL reflects state (deep-link filters/tabs/pagination/expanded panels) Prefer libs like [nuqs](https://nuqs.dev)
  - MUST: Back/Forward restores scroll
  - MUST: Links are links—use `<a>/<Link>` for navigation (support Cmd/Ctrl/middle-click)
- Feedback
  - SHOULD: Optimistic UI; reconcile on response; on failure show error and rollback or offer Undo
  - MUST: Confirm destructive actions or provide Undo window
  - MUST: Use polite `aria-live` for toasts/inline validation
  - SHOULD: Ellipsis (`…`) for options that open follow-ups (eg, "Rename…") and loading states (eg, "Loading…", "Saving…", "Generating…")
- Touch/drag/scroll
  - MUST: Design forgiving interactions (generous targets, clear affordances; avoid finickiness)
  - MUST: Delay first tooltip in a group; subsequent peers no delay
  - MUST: Intentional `overscroll-behavior: contain` in modals/drawers
  - MUST: During drag, disable text selection and set `inert` on dragged element/containers
  - MUST: No “dead-looking” interactive zones—if it looks clickable, it is
- Autofocus
  - SHOULD: Autofocus on desktop when there’s a single primary input; rarely on mobile (to avoid layout shift)

## Animation

- MUST: Honor `prefers-reduced-motion` (provide reduced variant)
- SHOULD: Prefer CSS > Web Animations API > JS libraries
- MUST: Animate compositor-friendly props (`transform`, `opacity`); avoid layout/repaint props (`top/left/width/height`)
- SHOULD: Animate only to clarify cause/effect or add deliberate delight
- SHOULD: Choose easing to match the change (size/distance/trigger)
- MUST: Animations are interruptible and input-driven (avoid autoplay)
- MUST: Correct `transform-origin` (motion starts where it “physically” should)

## Layout

- SHOULD: Optical alignment; adjust by ±1px when perception beats geometry
- MUST: Deliberate alignment to grid/baseline/edges/optical centers—no accidental placement
- SHOULD: Balance icon/text lockups (stroke/weight/size/spacing/color)
- MUST: Verify mobile, laptop, ultra-wide (simulate ultra-wide at 50% zoom)
- MUST: Respect safe areas (use env(safe-area-inset-\*))
- MUST: Avoid unwanted scrollbars; fix overflows

## Content & Accessibility

- SHOULD: Inline help first; tooltips last resort
- MUST: Skeletons mirror final content to avoid layout shift
- MUST: `<title>` matches current context
- MUST: No dead ends; always offer next step/recovery
- MUST: Design empty/sparse/dense/error states
- SHOULD: Curly quotes (“ ”); avoid widows/orphans
- MUST: Tabular numbers for comparisons (`font-variant-numeric: tabular-nums` or a mono like Geist Mono)
- MUST: Redundant status cues (not color-only); icons have text labels
- MUST: Don’t ship the schema—visuals may omit labels but accessible names still exist
- MUST: Use the ellipsis character `…` (not ``)
- MUST: `scroll-margin-top` on headings for anchored links; include a “Skip to content” link; hierarchical `<h1–h6>`
- MUST: Resilient to user-generated content (short/avg/very long)
- MUST: Locale-aware dates/times/numbers/currency
- MUST: Accurate names (`aria-label`), decorative elements `aria-hidden`, verify in the Accessibility Tree
- MUST: Icon-only buttons have descriptive `aria-label`
- MUST: Prefer native semantics (`button`, `a`, `label`, `table`) before ARIA
- SHOULD: Right-clicking the nav logo surfaces brand assets
- MUST: Use non-breaking spaces to glue terms: `10&nbsp;MB`, `⌘&nbsp;+&nbsp;K`, `Vercel&nbsp;SDK`

## Performance

- SHOULD: Test iOS Low Power Mode and macOS Safari
- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid unnecessary reflows/repaints
- MUST: Mutations (`POST/PATCH/DELETE`) target <500 ms
- SHOULD: Prefer uncontrolled inputs; make controlled loops cheap (keystroke cost)
- MUST: Virtualize large lists (eg, `virtua`)
- MUST: Preload only above-the-fold images; lazy-load the rest
- MUST: Prevent CLS from images (explicit dimensions or reserved space)

## Design

- SHOULD: Layered shadows (ambient + direct)
- SHOULD: Crisp edges via semi-transparent borders + shadows
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: tint borders/shadows/text toward bg hue
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrast.com/) over WCAG 2
- MUST: Increase contrast on `:hover/:active/:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid gradient banding (use masks when needed)

## Testing

### Testing

```bash
bun test              # Run all tests
bun test --watch      # Run tests in watch mode (also test:watch, test:ui)
bun test --coverage   # Run tests with coverage
bun test path/to/specific.test.ts  # Run single test file
bun test --bail       # Stop after first failure
```

### Test Framework & Patterns

- Use **bun:test** framework (not vitest) - migrated from Vitest to Bun test
- Place API route tests in `__tests__` directories alongside routes
- Place service/util tests in same directory as the module (e.g., `service.test.ts` next to `service.ts`)
- Test business logic thoroughly, but avoid testing React components directly

### Mock Management (Important for Bun)

When mocking modules in Bun tests, avoid shared mock state between tests:

```typescript
// CORRECT - Fresh mock for each test
const mockDb = mock(() => ({
  /* mock implementation */
}));
mock.module('@/lib/db/client', () => ({
  db: mockDb,
}));

beforeEach(async () => {
  mockDb.mockClear(); // Clear call history
  // Import modules after clearing mocks
  const module = await import('./module-under-test');
});
```

### Database Integration

- Tests use mocked database clients (Drizzle/Turso), not real database connections
- Database types are automatically inferred by Drizzle from schema definitions in `src/lib/db/schema/`
- Always use Drizzle Kit to generate migrations (`bun db:generate`)
- Schema uses `ulid()` for primary keys (not UUIDs)

### Workflow Integration Testing

- Workflow tests mock the workflow context and database operations
- Test workflow steps: step execution → state management → error handling
- Mock external AI service calls to avoid real API usage during testing
- Workflows use durable execution - steps are retried automatically on failure
- Pass authentication (userId/teamId) through workflow context, not database lookups
- Never manually alter files in components/ui
- **Database migrations**: Use Drizzle Kit to generate migrations (`bun db:generate`), never manually write migration SQL files
- Use type instead of interface to define typescript types
- Throw errors instead of returning success true / false
