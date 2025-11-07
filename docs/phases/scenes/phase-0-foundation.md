# Phase 0: Foundation & Setup

## Objective

Set up the foundational infrastructure, routing, and shared utilities needed for all subsequent phases of the /scenes route implementation.

## Dependencies

None (foundational phase)

## Files to Create

### 1. Route Shell

- `src/app/sequences/[id]/scenes/page.tsx` - Route page component (minimal shell)

### 2. Directory Structure

- `src/components/scenes/` - Directory for all scene-related components
- `src/lib/scenes/` - Directory for scene-specific utilities and helpers

### 3. Utilities

- `src/lib/scenes/format-time.ts` - Time formatting utility (seconds to MM:SS)

## Implementation Details

### Route Shell (`src/app/sequences/[id]/scenes/page.tsx`)

Create a minimal Next.js page that:

- Accepts `sequenceId` from URL params
- Renders a placeholder component
- Sets up proper TypeScript typing
- Includes basic layout structure

```tsx
export default async function ScenesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sequenceId } = await params;

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1">
        <h1>Scenes Editor - Sequence {sequenceId}</h1>
        <p>Scene components will be implemented in subsequent phases</p>
      </div>
    </div>
  );
}
```

### Time Formatting Utility (`src/lib/scenes/format-time.ts`)

Pure TypeScript function to convert seconds to MM:SS format:

```typescript
/**
 * Formats seconds into MM:SS format
 * @param seconds - Number of seconds to format
 * @returns Formatted time string (e.g., "02:45")
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
```

### Directory Structure

Create empty directories for future components:

- `src/components/scenes/` - Will house all presentational components
- `src/lib/scenes/` - Will house reducers, utilities, and types

## Acceptance Criteria

- [ ] Route is accessible at `/sequences/[id]/scenes`
- [ ] Page renders with proper TypeScript types
- [ ] `formatTime` utility correctly converts seconds to MM:SS
- [ ] Directory structure is in place
- [ ] No console errors or TypeScript errors
- [ ] Page builds successfully with `bun run build`

## Testing

### Manual Testing

1. Navigate to `/sequences/any-id/scenes` in browser
2. Verify page renders without errors
3. Check that sequence ID is displayed correctly

### Unit Test for formatTime

Create `src/lib/scenes/format-time.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test';
import { formatTime } from './format-time';

describe('formatTime', () => {
  test('formats zero seconds', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  test('formats single digit seconds', () => {
    expect(formatTime(5)).toBe('00:05');
  });

  test('formats double digit seconds', () => {
    expect(formatTime(45)).toBe('00:45');
  });

  test('formats minutes and seconds', () => {
    expect(formatTime(125)).toBe('02:05');
  });

  test('formats large durations', () => {
    expect(formatTime(3665)).toBe('61:05');
  });
});
```

## Storybook

No Storybook stories needed for this phase.

## Commit Message

```
feat: add scenes route foundation and directory structure

- Create /sequences/[id]/scenes route shell
- Add formatTime utility for time display
- Set up component and utility directories
- Add unit tests for formatTime
```

## Next Phase

After committing this phase, proceed to **Phase 1: Scene List Components**.
