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

### Supabase

```bash
bunx supabase start     # Start local Supabase
bunx supabase stop      # Stop local Supabase
bunx supabase db reset  # Reset database
bunx supabase status    # Check local services status
bun supabase:types     # Generate TypeScript types from database
```

### QStash Development

```bash
bun qstash:dev         # Start QStash tunnel for local webhooks
```

**Note**: Local development uses hardcoded QStash credentials (user: `defaultUser`) configured in `setup-env.sh`. The workflow URL is set to `http://host.docker.internal:3000` so QStash (running in Docker) can reach your local Next.js app.

### Environment Setup

```bash
bun setup:env          # Create .env.development.local with Supabase credentials
```

**Note**: Database types (`src/lib/gen.types.ts`) are auto-generated:

- Generated automatically on `bun install` via postinstall hook
- Can be manually regenerated with `bun supabase:types`
- File is gitignored to ensure types always match local database schema
- Types are generated from your local Supabase instance (must be running)
- Use the convenience exports from `@/types/database` for cleaner imports

### TypeScript

```bash
bun tsc --noEmit      # Type check without building
```

### Storybook (Component Development)

```bash
bun storybook         # Start Storybook dev server
bun build-storybook   # Build Storybook for production
```

## Development Workflow

### First Time Setup

1. **Install dependencies**: `bun install`
2. **Start Supabase**: `bun supabase:start`
3. **Setup environment**: `bun setup:env` (automatically configures Supabase + QStash with local dev credentials)

### Daily Development (3 Terminal Setup)

1. **Terminal 1 - Supabase**: `bun supabase:start` (if not already running)
2. **Terminal 2 - QStash**: `bun qstash:dev` (for async job testing)
3. **Terminal 3 - Next.js**: `bun dev`

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

## Project Architecture

This is a Next.js 15 headless API application for AI-powered video sequence creation. The app transforms scripts into consistent, styled video productions using multiple AI models.

### Core Design Principles

- **Backend-only database access**: All Supabase DB operations go through API routes. Never use Supabase client directly in components to avoid RLS complexity.
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
- **Database**: Supabase (PostgreSQL + Better Auth + Storage + Realtime)
- **Workflows**: QStash Workflow (Upstash) for durable, serverless AI task orchestration
- **Styling**: Tailwind CSS v4 with shadcn/ui
- **Testing**: Bun test (migrated from Vitest)
- **Linting**: oxlint with type-aware checks
- **Formatting**: Prettier
- **AI Models**: Multiple providers (Fal.ai, Runway, Kling, etc.) via unified interface

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

Frames are the building blocks of sequences:

- Reference script sections
- Have thumbnail (image) and motion (video)
- Can include characters, audio, and VFX from team libraries
- AI adjusts frame boundaries when script changes

### Workflow Architecture

All async AI operations use QStash Workflow for durable execution:

**Available Workflows** (`/app/api/workflows/`):

- `image` - Image generation with FAL/LetzAI
- `video` - Video generation from text
- `motion` - Image-to-video generation
- `frame-generation` - Complex orchestration for script analysis and frame creation
- `script` - Script enhancement and analysis

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
  url: `${workflowConfig.baseUrl}/image`, // Use baseUrl for QStash webhooks
  body: workflowInput,
});

const workflowRunId = messageId;

// 2. Workflow executes with durable steps
export const { POST } = serve<ImageWorkflowInput>(async (context) => {
  const input = context.requestPayload;
  validateWorkflowAuth(input); // Check userId/teamId

  const result = await context.run('step-name', async () => {
    // Step logic - automatically retried on failure
  });
});
```

**Important**:

- Always use `qstash.publishJSON()` to trigger workflows, not direct `fetch()` calls
- QStash requires proper signatures which are only added through the publish API
- Use `workflowConfig.baseUrl` for QStash webhook URLs (external URL that QStash can reach)

**Key Principles**:

- Workflows handle their own state - no database job tracking needed
- Pass auth (userId/teamId) through workflow context
- Use `context.run()` for each logical step
- Workflows update database records directly (e.g., frame.thumbnail_url)
- Steps are durable - execution continues even if server restarts

## Frontend Development Guidelines

### 1. Use as little React as possible

- Keep components small - less than 100 lines
- Views reference components
- Remove as much logic as possible from components and views
- Externalize functions rather and keep external functions _vanilla typescript_
- Vanilla typescript is easier to test, and package for other uses

### 1.5. Prefer SSR components

- Prefer SSR components for most pages that don't have significant interactivity

### 2. Avoid using useEffect

- Avoid using useEffect to fetch data or initialise state
- Use hooks, tanstack query, or the new `use` feature in react 19
- use useEffect to update state when something else changes

### 3. Use useState sparingly

- Using a local variable is often more optimal - even if something has to be calculated
- useState uses reducers under the hood
- If you have more than 3 useStates you might as well use reducers

### 4. Use React.FC and expand props

- Expand props so that each parameter is named
- It's easier to know which props are not used

### 5. Avoid globals and global state

- Globals including auth globals, often lead to race conditions
- Global state is only useful in rare cases. SPAs with signifant complexity
- Start with reducers which are passed through props
- If that's too complicated, use React context
- As a last resort for very complicated SPAs - use zustand

### 6. Use reducers

- Reducers are great - read up on them and understand them
- They keep all state update logic in one place
- They are vanilla typescript - keep them that way
- Use them to update state based on other state.
- Note that updating any part of the state returned from a reducer will cause a re-render if the whole state is a parameter - you can pass just parts of it

### 7. Avoid adding styles on top of components

- Avoid passing styles to components, or styling your components in views
- Create components that are pre-styled
- Create variants - e.g. small, medium, large - rather than size={18}
- Avoid using styles in views as much as possible

### 8. Use the theme

- Create constants for your theme or use a consistent structure
- Use the theme fonts and colors
- Avoid naming fonts and inluding color values directly in views and components

### 9. Use flexbox

- Use flexbox for every component

### 10. Avoid margin

- Don't pre-add padding or margin to the outside of components, unless there is a specific reason to
- Use flexbox gap instead

### 11. Use kebab-case for file names

- Use PascalCase for component names, but kebab case for file-names
- PascalCase can often give you issues in git as case sensitive file names is not supported on all platforms

### 12. Create a component library

- If using a 3rd party component library, wrap those components then include your wrapped components. It makes it easier to change libraries
- Shadcn makes this easy - it includes the source in your repo, and imports only primitives from that source.
- You don't need to wrap Shadcn generated components - just edit the component source with your changes
- Don't create duplicates of components for minor variations. Create a variation
- Customise the component if there's a new variation - don't style from the outside
- Put your components into a high level components folder
- Use an aliases or subpath imports "~" to import components from views.

### 13. Avoid hard coding width or height

- Use flexbox and create rules for screen sizes

### 14. Use a show prop if you need to hide something

- Avoid code that conditionally shows a complex component - this creates janky ui
- Instead use the display css property to hide or show - this will precalculate everything in the component but not render it

### 15. Use a linter

- We use oxlint with type-aware checks for fast, TypeScript-aware linting
- Ensure the rules of hooks linting rule is on

### 16. Views are routes

- All views should be routable - meaning you can get to them via a route
- No view should rely on variables or parameters from another
- A view can be accessed in any order
- Pass params on the url. You can use url segments for ids, search params should be optional
- Name views with the same name as the route - or place in a folder with that name

### 17. Avoid default exports

- It's more efficient to export the component directly than to import a default
- Avoid barrelled imports as much as possible _unless_ you are planning to package that library for others

### 18. use useActionState for forms

### 19. Don't add React. prefix. Import useEffect, useReducer, useCallback etc.

### Testing

```bash
bun test              # Run all tests
bun test --watch      # Run tests in watch mode (also test:watch, test:ui)
bun test --coverage   # Run tests with coverage
bun test path/to/specific.test.ts  # Run single test file
bun test --bail       # Stop after first failure
```

## Testing

### Test Framework & Patterns

- Use **bun:test** framework (not vitest) - migrated from Vitest to Bun test
- Place API route tests in `__tests__` directories alongside routes
- Place service/util tests in same directory as the module (e.g., `service.test.ts` next to `service.ts`)
- Test business logic thoroughly, but avoid testing React components directly

### Mock Management (Important for Bun)

When mocking modules in Bun tests, avoid shared mock state between tests:

```typescript
// CORRECT - Fresh mock for each test
const mockCreateClient = mock(() => ({
  /* mock implementation */
}));
mock.module('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

beforeEach(async () => {
  mockCreateClient.mockClear(); // Clear call history
  // Import modules after clearing mocks
  const module = await import('./module-under-test');
});
```

### Database Integration

- Tests use mocked Supabase clients, not real database connections
- Include database types from `@/types/database` (not `src/lib/supabase/gen.types.ts`)
- Always use the Supabase CLI to create migrations
- Use `z.uuid()` for UUID validation in schemas

### Workflow Integration Testing

- Workflow tests mock the workflow context and database operations
- Test workflow steps: step execution → state management → error handling
- Mock external AI service calls to avoid real API usage during testing
- Workflows use durable execution - steps are retried automatically on failure
- Pass authentication (userId/teamId) through workflow context, not database lookups
