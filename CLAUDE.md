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

### 15. Use inline skeletons with the Skeleton component

- Always show loading skeletons inline within the component itself
- Never create separate skeleton components that duplicate the component structure
- Use the shadcn/ui `<Skeleton />` component for consistent theming
- Match the exact layout structure of the loaded content
- Example:
  ```tsx
  return (
    <div className="grid gap-4">
      {loading
        ? Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))
        : items.map((item) => <ItemCard key={item.id} {...item} />)}
    </div>
  );
  ```

### 16. Use a linter

- We use oxlint with type-aware checks for fast, TypeScript-aware linting
- Ensure the rules of hooks linting rule is on

### 17. Views are routes

- All views should be routable - meaning you can get to them via a route
- No view should rely on variables or parameters from another
- A view can be accessed in any order
- Pass params on the url. You can use url segments for ids, search params should be optional
- Name views with the same name as the route - or place in a folder with that name

### 18. Avoid default exports

- It's more efficient to export the component directly than to import a default
- Avoid barrelled imports as much as possible _unless_ you are planning to package that library for others

### 19. use useActionState for forms

### 20. Don't add React. prefix. Import useEffect, useReducer, useCallback etc.

Concise rules for building accessible, fast, delightful UIs Use MUST/SHOULD/NEVER to guide decisions

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
- Please create a rule that prevents claude from ever alterting files in components/ui
- never manually create migrations
- Use type instead of interface to define typescript types
