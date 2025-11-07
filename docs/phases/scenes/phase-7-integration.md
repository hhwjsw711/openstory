# Phase 7: Mobile UI & Final Integration

## Objective

Complete mobile-specific UI components and integrate all phases into the final working /sequences/[id]/scenes page with full responsive design and proper data flow.

## Dependencies

- All previous phases (0-6)

## Files to Create

### Components

- `src/components/scenes/mobile-header.tsx` - Mobile header with navigation menu
- `src/components/scenes/mobile-bottom-bar.tsx` - Fixed bottom bar with current scene
- `src/components/scenes/scene-editor-layout.tsx` - Responsive layout wrapper

### Page

- `src/app/sequences/[id]/scenes/page.tsx` - Complete integrated page (replace shell from Phase 0)

### Utilities

- `src/lib/scenes/scene-editor.reducer.ts` - Top-level UI state (nav sheets, mobile menus)

## Component Specifications

### 1. Scene Editor Reducer

**File:** `src/lib/scenes/scene-editor.reducer.ts`

Manage top-level UI state:

```typescript
export type SceneEditorState = {
  // Navigation
  mobileNavOpen: boolean;
  mobileScenesOpen: boolean;

  // Scene selection
  selectedFrameId: string | null;

  // Completion tracking (client-side for now)
  completedFrameIds: Set<string>;
};

export type SceneEditorAction =
  | { type: 'OPEN_MOBILE_NAV' }
  | { type: 'CLOSE_MOBILE_NAV' }
  | { type: 'TOGGLE_MOBILE_NAV' }
  | { type: 'OPEN_MOBILE_SCENES' }
  | { type: 'CLOSE_MOBILE_SCENES' }
  | { type: 'TOGGLE_MOBILE_SCENES' }
  | { type: 'SELECT_FRAME'; frameId: string }
  | { type: 'TOGGLE_FRAME_COMPLETE'; frameId: string };

export const initialSceneEditorState: SceneEditorState = {
  mobileNavOpen: false,
  mobileScenesOpen: false,
  selectedFrameId: null,
  completedFrameIds: new Set(),
};

export function sceneEditorReducer(
  state: SceneEditorState,
  action: SceneEditorAction
): SceneEditorState {
  switch (action.type) {
    case 'OPEN_MOBILE_NAV':
      return { ...state, mobileNavOpen: true };

    case 'CLOSE_MOBILE_NAV':
      return { ...state, mobileNavOpen: false };

    case 'TOGGLE_MOBILE_NAV':
      return { ...state, mobileNavOpen: !state.mobileNavOpen };

    case 'OPEN_MOBILE_SCENES':
      return { ...state, mobileScenesOpen: true };

    case 'CLOSE_MOBILE_SCENES':
      return { ...state, mobileScenesOpen: false };

    case 'TOGGLE_MOBILE_SCENES':
      return { ...state, mobileScenesOpen: !state.mobileScenesOpen };

    case 'SELECT_FRAME':
      return { ...state, selectedFrameId: action.frameId };

    case 'TOGGLE_FRAME_COMPLETE': {
      const newCompleted = new Set(state.completedFrameIds);
      if (newCompleted.has(action.frameId)) {
        newCompleted.delete(action.frameId);
      } else {
        newCompleted.add(action.frameId);
      }
      return { ...state, completedFrameIds: newCompleted };
    }

    default:
      return state;
  }
}
```

### 2. MobileHeader Component

**Purpose:** Mobile-only header with hamburger menu and navigation sheet

**Props:**

```typescript
type MobileHeaderProps = {
  isNavOpen: boolean;
  onNavOpenChange: (open: boolean) => void;
  sequenceTitle?: string;
};
```

**Features:**

- Fixed at top (mobile only)
- Hamburger menu button
- Logo
- Sequence title display
- Navigation sheet with menu items

**Layout:**

```tsx
<header className="block md:hidden fixed top-0 left-0 right-0 z-50 border-b bg-card">
  <div className="flex h-14 items-center justify-between px-4">
    {/* Hamburger menu */}
    <Sheet open={isNavOpen} onOpenChange={onNavOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-64">
        <div className="flex flex-col gap-4 py-4">
          {/* Logo */}
          <div className="px-2">
            <img src="/velro-v-logo.svg" alt="Velro" className="h-8" />
          </div>

          {/* Navigation items */}
          <nav className="flex flex-col gap-1">
            <Button variant="ghost" className="justify-start" asChild>
              <Link href="/home">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <Link href="/videos">
                <Video className="mr-2 h-4 w-4" />
                Videos
              </Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <Link href="/community">
                <Users className="mr-2 h-4 w-4" />
                Community
              </Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
          </nav>

          {/* Theme toggle */}
          <div className="px-2">
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>

    {/* Logo and title */}
    <div className="flex items-center gap-2">
      <img src="/velro-v-logo.svg" alt="Velro" className="h-6" />
      {sequenceTitle && (
        <span className="text-sm font-medium truncate max-w-[200px]">
          {sequenceTitle}
        </span>
      )}
    </div>
  </div>
</header>
```

**Positioning:**

- `fixed top-0` to stay at top
- `z-50` to be above other content
- Only visible on mobile: `block md:hidden`

### 3. MobileBottomBar Component

**Purpose:** Fixed bottom bar showing current scene (triggers scene sheet)

**Props:**

```typescript
type MobileBottomBarProps = {
  currentFrame: Frame | null;
  sceneNumber: number;
  totalScenes: number;
  onOpen: () => void;
};
```

**Features:**

- Fixed at bottom (mobile only)
- Shows current scene thumbnail
- Scene number and heading
- Tappable to open scene sheet
- ChevronUp icon

**Layout:**

```tsx
<button
  onClick={onOpen}
  className="block md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card p-4 active:bg-muted/50 transition-colors"
>
  <div className="flex items-center gap-3">
    {/* Thumbnail */}
    <div className="h-[27px] w-12 flex-shrink-0 rounded overflow-hidden bg-muted">
      {currentFrame?.thumbnailUrl ? (
        <img
          src={currentFrame.thumbnailUrl}
          alt="Current scene"
          className="h-full w-full object-cover"
        />
      ) : (
        <Skeleton className="h-full w-full" />
      )}
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0 text-left">
      <p className="text-xs font-medium">
        Scene {sceneNumber} of {totalScenes}
      </p>
      <p className="text-[10px] text-muted-foreground truncate">
        {currentFrame ? getSceneTitle(currentFrame) : 'Loading...'}
      </p>
    </div>

    {/* Icon */}
    <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
  </div>
</button>
```

**Positioning:**

- `fixed bottom-0` to stay at bottom
- `z-40` (below header)
- Only visible on mobile: `block md:hidden`

### 4. SceneEditorLayout Component

**Purpose:** Responsive layout wrapper handling desktop/mobile layouts

**Props:**

```typescript
type SceneEditorLayoutProps = {
  sequenceId: string;
  children: React.ReactNode;
};
```

**Features:**

- Two-column layout on desktop
- Single column on mobile
- Proper spacing and overflow handling
- Integration with all child components

**Layout:**

```tsx
<div className="flex h-screen flex-col">
  {/* Mobile header */}
  <MobileHeader {...headerProps} />

  {/* Main content area */}
  <div className="flex flex-1 overflow-hidden pt-14 md:pt-0">
    {/* Desktop scene list (left sidebar) */}
    <div className="hidden md:block md:w-80 border-r">
      <SceneList {...sceneListProps} />
    </div>

    {/* Main content (right side) */}
    <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
  </div>

  {/* Mobile bottom bar */}
  <MobileBottomBar {...bottomBarProps} />

  {/* Mobile scene sheet */}
  <MobileSceneSheet {...sceneSheetProps} />
</div>
```

**Responsive Considerations:**

- Desktop: `md:pt-0` (no top padding)
- Mobile: `pt-14` (space for fixed header)
- Mobile: `pb-20` on content for fixed bottom bar

### 5. Final Page Integration

**File:** `src/app/sequences/[id]/scenes/page.tsx`

Bring together all components:

```tsx
'use client';

import { Suspense, useReducer } from 'react';
import { useFramesBySequence } from '@/lib/api/frames';
import { SceneEditorLayout } from '@/components/scenes/scene-editor-layout';
import { ScenePreview } from '@/components/scenes/scene-preview';
import { VideoControlsOverlay } from '@/components/scenes/video-controls-overlay';
import { SceneDetailsTabs } from '@/components/scenes/scene-details-tabs';
import { VersionTimeline } from '@/components/scenes/version-timeline';
import { RegenerationPanel } from '@/components/scenes/regeneration-panel';
import {
  sceneEditorReducer,
  initialSceneEditorState,
} from '@/lib/scenes/scene-editor.reducer';
import {
  playbackReducer,
  initialPlaybackState,
} from '@/lib/scenes/playback.reducer';
import {
  regenerationReducer,
  initialRegenerationState,
} from '@/lib/scenes/regeneration.reducer';
import { Skeleton } from '@/components/ui/skeleton';

type ScenesPageProps = {
  params: Promise<{ id: string }>;
};

function ScenesPageContent({ sequenceId }: { sequenceId: string }) {
  // Fetch frames
  const { data: frames = [] } = useFramesBySequence(sequenceId, {
    suspense: true,
  });

  // State management
  const [editorState, editorDispatch] = useReducer(
    sceneEditorReducer,
    initialSceneEditorState
  );
  const [playbackState, playbackDispatch] = useReducer(
    playbackReducer,
    initialPlaybackState
  );
  const [regenerationState, regenerationDispatch] = useReducer(
    regenerationReducer,
    initialRegenerationState
  );

  // Get current frame
  const currentFrame =
    frames.find((f) => f.id === editorState.selectedFrameId) ||
    frames[0] ||
    null;

  // Auto-play logic
  useEffect(() => {
    if (!playbackState.isPlaying || frames.length === 0) return;

    const timer = setInterval(() => {
      playbackDispatch({
        type: 'AUTO_ADVANCE',
        totalScenes: frames.length,
      });

      // Update selected frame
      const nextIndex = (playbackState.currentSceneIndex + 1) % frames.length;
      editorDispatch({
        type: 'SELECT_FRAME',
        frameId: frames[nextIndex].id,
      });
    }, playbackState.playbackSpeed);

    return () => clearInterval(timer);
  }, [playbackState.isPlaying, playbackState.currentSceneIndex, frames]);

  return (
    <SceneEditorLayout sequenceId={sequenceId}>
      {/* Top: Scene preview with controls */}
      <div className="relative flex items-center justify-center bg-muted/10 p-4">
        <div className="relative w-full max-w-3xl">
          <ScenePreview frame={currentFrame} />
          <VideoControlsOverlay
            isPlaying={playbackState.isPlaying}
            currentSceneIndex={playbackState.currentSceneIndex}
            totalScenes={frames.length}
            currentTime={
              playbackState.currentSceneIndex *
              (playbackState.playbackSpeed / 1000)
            }
            totalTime={frames.length * (playbackState.playbackSpeed / 1000)}
            onPlayPause={() => playbackDispatch({ type: 'TOGGLE_PLAY_PAUSE' })}
            onPrevious={() =>
              playbackDispatch({
                type: 'PREVIOUS_SCENE',
                totalScenes: frames.length,
              })
            }
            onNext={() =>
              playbackDispatch({
                type: 'NEXT_SCENE',
                totalScenes: frames.length,
              })
            }
          />
        </div>
      </div>

      {/* Middle: Scene details tabs */}
      <div className="flex-1 overflow-y-auto p-4">
        <SceneDetailsTabs
          frame={currentFrame}
          onUpdate={(updates) => {
            // Handle frame updates
          }}
        />
      </div>

      {/* Bottom: Version timeline or regeneration panel */}
      <div className="border-t p-4">
        {regenerationState.isOpen ? (
          <RegenerationPanel
            state={regenerationState}
            onSelect={(versionId) => {
              // Add selected version to timeline
              // Close panel
              regenerationDispatch({ type: 'CLOSE_PANEL' });
            }}
            onCancel={() => regenerationDispatch({ type: 'CLOSE_PANEL' })}
          />
        ) : (
          <VersionTimeline
            frameId={currentFrame?.id || ''}
            versions={[]} // Manage versions state
            currentVersionIndex={0}
            onVersionSelect={() => {}}
            onAddVersion={() => {
              // Open regeneration panel
            }}
            sceneNumber={playbackState.currentSceneIndex + 1}
          />
        )}
      </div>
    </SceneEditorLayout>
  );
}

export default async function ScenesPage({ params }: ScenesPageProps) {
  const { id: sequenceId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      }
    >
      <ScenesPageContent sequenceId={sequenceId} />
    </Suspense>
  );
}
```

## Implementation Guidelines

### Suspense Boundaries

Wrap data-dependent components with Suspense:

```tsx
<Suspense fallback={<LoadingSkeleton />}>
  <DataComponent />
</Suspense>
```

### State Management Flow

```
editorState
├── selectedFrameId (which frame is active)
├── completedFrameIds (completion tracking)
└── mobileNavOpen/mobileScenesOpen (UI state)

playbackState
├── isPlaying (auto-play toggle)
├── currentSceneIndex (for timecode)
└── playbackSpeed (3000ms default)

regenerationState
├── isOpen (show panel or timeline)
├── versions (loading/complete states)
└── selectedVersionId (user selection)
```

### Desktop Layout

```
┌─────────────────────────────────────────┐
│ [Scene List]  │  [Preview + Controls]   │
│   (320px)     │                          │
│               │  [Scene Tabs]            │
│               │                          │
│               │  [Version Timeline]      │
└─────────────────────────────────────────┘
```

### Mobile Layout

```
┌─────────────────────┐
│ [Header]            │ ← Fixed top
├─────────────────────┤
│                     │
│ [Preview+Controls]  │
│                     │
│ [Scene Tabs]        │
│                     │
│ [Version Timeline]  │
│                     │
├─────────────────────┤
│ [Bottom Bar]        │ ← Fixed bottom
└─────────────────────┘
```

### Theme Integration

Use theme toggle from existing components:

```tsx
import { useTheme } from 'next-themes';

const { theme, setTheme } = useTheme();

<Button
  variant="ghost"
  size="sm"
  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
>
  {theme === 'dark' ? <Sun /> : <Moon />}
</Button>;
```

## Acceptance Criteria

- [ ] Page loads at /sequences/[id]/scenes
- [ ] Desktop shows two-column layout (scene list + main content)
- [ ] Mobile shows single column with header and bottom bar
- [ ] Scene list works on desktop with drag-and-drop
- [ ] Mobile bottom bar opens scene sheet
- [ ] Mobile header opens navigation menu
- [ ] Scene selection updates preview
- [ ] Playback controls work (play/pause/prev/next)
- [ ] Auto-play advances scenes every 3 seconds
- [ ] Scene tabs switch correctly
- [ ] Model selection grids work
- [ ] Multi-Generate opens regeneration panel
- [ ] Version timeline displays correctly
- [ ] Regeneration panel shows loading then results
- [ ] Selecting version adds to timeline
- [ ] Mobile breakpoint at 768px works correctly
- [ ] All state is properly managed with reducers
- [ ] No console errors or warnings
- [ ] Page is fully responsive
- [ ] Suspense loading states show correctly

## Testing

### Manual Testing Checklist

**Desktop:**

1. Navigate to /sequences/[id]/scenes
2. Verify two-column layout
3. Drag scenes to reorder
4. Click scene to select
5. Toggle completion checkboxes
6. Play video controls
7. Edit script/prompts
8. Select models
9. Click Multi-Generate
10. Select version from panel
11. Switch between versions in timeline

**Mobile:**

1. Resize browser to <768px
2. Verify mobile header appears
3. Open hamburger menu
4. Navigate with bottom bar
5. Open scene sheet
6. Select different scene
7. Test playback controls
8. Edit prompts (tabs)
9. Test model selection
10. Verify regeneration panel

**Responsive:**

1. Start desktop, resize to mobile
2. Start mobile, resize to desktop
3. Verify layout adapts smoothly
4. Check no layout shift or jank

### Integration Tests

Focus on state coordination:

```typescript
// Test that selecting a frame updates playback state
// Test that playback advances selection
// Test that regeneration panel closes after selection
// Test that version selection updates timeline
```

## Commit Message

```
feat: complete scenes route with mobile UI

- Add MobileHeader with navigation menu
- Create MobileBottomBar for current scene display
- Implement SceneEditorLayout for responsive layout
- Complete final page integration at /sequences/[id]/scenes
- Add scene-editor reducer for top-level state
- Integrate all phases into working page
- Add Suspense boundaries for loading states
- Implement two-column desktop layout
- Implement single-column mobile layout with overlays
- Wire up all state management (playback, regeneration, editor)
- Test responsive behavior at 768px breakpoint
```

## Next Steps

After this phase, the scenes route is complete! Future enhancements could include:

1. **Backend Integration:**
   - Connect to real API endpoints for frame updates
   - Persist version history to database
   - Implement actual AI generation (not simulated)

2. **Performance:**
   - Add React Query optimistic updates
   - Virtualize long scene lists
   - Lazy load images/videos

3. **Features:**
   - Export sequence as video
   - Keyboard shortcuts
   - Bulk operations (generate all motion)
   - Undo/redo

4. **Polish:**
   - Add animations/transitions
   - Improve error handling
   - Add onboarding tour
   - Accessibility improvements

## Notes

- All state management uses reducers for predictable updates
- Suspense boundaries provide clean loading states
- CSS-only responsive design (no JavaScript breakpoint detection)
- Mobile sheets auto-close on selection for better UX
- Theme toggle integrates with existing theme system
- Page is fully client-side but could be optimized with RSC later
