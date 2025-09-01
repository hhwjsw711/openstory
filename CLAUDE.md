# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
pnpm dev              # Start development server with Turbopack
pnpm build            # Build production app with Turbopack
pnpm start            # Start production server
```

### Code Quality
```bash
pnpm biome check .          # Run linter
pnpm biome format .         # Format code
pnpm biome check --write .  # Fix linting and formatting
```

### Supabase
```bash
pnpx supabase start     # Start local Supabase
pnpx supabase stop      # Stop local Supabase
pnpx supabase db reset  # Reset database
pnpx supabase status    # Check local services status
pnpm supabase:types     # Generate TypeScript types from database
```

**Note**: Database types (`src/lib/gen.types.ts`) are auto-generated:
- Generated automatically on `pnpm install` via postinstall hook
- Can be manually regenerated with `pnpm supabase:types`
- File is gitignored to ensure types always match local database schema
- Types are generated from your local Supabase instance (must be running)
- Use the convenience exports from `@/types/database` for cleaner imports

### TypeScript
```bash
pnpm tsc --noEmit      # Type check without building
```

## Project Architecture

This is a Next.js 15 headless API application for AI-powered video sequence creation. The app transforms scripts into consistent, styled video productions using multiple AI models.

### Core Design Principles
- **Backend-only database access**: All Supabase DB operations go through API routes. Never use Supabase client directly in components to avoid RLS complexity.
- **Anonymous-first**: Users can start creating without signup, then upgrade to save work via magic link or passkeys.
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
3. **Job Queue**: QStash handles all AI generation tasks asynchronously.
4. **Authentication**: Supabase Auth with only magic links and passkeys (no passwords).
5. **File Structure**: API routes handle all business logic and DB access. Components remain presentational.

### API Pattern
All API routes follow this structure:
1. Validate input (Zod schemas)
2. Check auth/team permissions
3. Execute business logic (DB operations only here)
4. Queue async work via QStash if needed
5. Return standardized response

### Generation Pipeline
1. User uploads/edits script
2. AI analyzes and creates frame boundaries
3. Frames generated with Style Stack + character LoRAs
4. Motion added via video models
5. Export as video or other formats

### Technology Stack
- **Framework**: Next.js 15 with App Router and Turbopack
- **Database**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Queue**: QStash (Upstash) for AI job management
- **Styling**: Tailwind CSS v4 with shadcn/ui
- **Formatting**: Biome for linting and formatting
- **AI Models**: Multiple providers (Fal.ai, Runway, Kling, etc.) via unified interface

### Import Alias
Use `@/*` to import from src directory:
```typescript
import { something } from '@/app/api/utils'
```

## Development Guidelines

### When creating new features:
1. Start with API route in `/app/api/v1/[feature]`
2. All DB operations in API routes only
3. Use QStash for any AI generation or long-running tasks
4. Create TanStack Query hooks for data fetching
5. Build components with shadcn/ui only
6. Apply theme variables for styling, avoid inline Tailwind

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


### React Guidelines
1. Use as little React as possible - keep components small and externalise logic
2. Avoid using useEffect - use tanstack query if possible
3. Use useState sparingly
4. Use React.FC and expand props
5. Avoid globals and global state
6. Use reducers
7. Avoid adding style ontop of components - adjust the component style
8. Use a common theme for styling
9. Use flexbox
10. Avoid margin
11. Use kebab-case for file names
12. Create a component library and use storybook
13. Avoid hard coding width or height
14. Use a show/hide prop if you need to hide something
15. Use biome after editing
16. Views are routes
17. Avoid default exports

### Testing
- Use vitest to create tests and include tests for all logic on frontend and backend.
- Include database types in the codebase from types/database instead of supabase/gen.types