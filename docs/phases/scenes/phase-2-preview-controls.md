# Phase 2: Image Preview & Video Controls

## Objective

Build the main content area showing the selected scene's image/video with an always-visible playback controls overlay, timeline scrubber, and auto-play functionality.

## Dependencies

- Phase 0 (foundation - formatTime utility)
- Phase 1 (scene selection state) - Can be built in parallel and integrated later

## Files to Create

### Components

- `src/components/scenes/scene-preview.tsx` - Main image/video display container
- `src/components/scenes/video-controls-overlay.tsx` - Playback controls overlay
- `src/components/scenes/timeline-scrubber.tsx` - Timeline with scene markers

### Utilities

- `src/lib/scenes/playback.reducer.ts` - Playback state management

### Stories

- `src/components/scenes/scene-preview.stories.tsx`
- `src/components/scenes/video-controls-overlay.stories.tsx`
- `src/components/scenes/timeline-scrubber.stories.tsx`

## Existing APIs to Use

### Types

```typescript
import type { Frame } from '@/types/database';
// Frame includes: thumbnailUrl, videoUrl, videoStatus
```

### Utilities

```typescript
import { formatTime } from '@/lib/scenes/format-time';
// Converts seconds to MM:SS format
```

## Component Specifications

### 1. ScenePreview Component

**Purpose:** Display scene image or video with proper aspect ratio and loading states

**Props:**

```typescript
type ScenePreviewProps = {
  frame: Frame | null;
  className?: string;
};
```

**Features:**

- Display video if `videoUrl` exists and `videoStatus === 'complete'`
- Display thumbnail if only `thumbnailUrl` exists
- Show loading skeleton if frame is null or generating
- Aspect ratio: 16:9 (aspect-video)
- Centered with max-width: 3xl
- Object-fit: cover

**Video Considerations:**

- Use native `<video>` element (not auto-play)
- Muted by default
- Loop enabled
- Playback controlled by parent via ref

**Loading States:**

```tsx
{
  frame ? (
    frame.videoUrl ? (
      <video src={frame.videoUrl} className="aspect-video rounded-lg" />
    ) : (
      <img
        src={frame.thumbnailUrl || ''}
        alt="Scene"
        className="aspect-video rounded-lg"
      />
    )
  ) : (
    <Skeleton className="aspect-video rounded-lg" />
  );
}
```

### 2. TimelineScrubber Component

**Purpose:** Visual progress bar with scene markers

**Props:**

```typescript
type TimelineScrubberProps = {
  currentSceneIndex: number;
  totalScenes: number;
  className?: string;
};
```

**Features:**

- Thin horizontal bar (1px height)
- Background: white/20
- Progress bar shows current position
- Vertical dividers at scene boundaries
- Responsive to container width

**Layout:**

```
[====|====|====|====]
     ^current scene
```

**Calculation:**

```typescript
const progress = ((currentSceneIndex + 1) / totalScenes) * 100;
```

**Scene Markers:**

- Place dividers at equal intervals: `left: ${(i / totalScenes) * 100}%`
- Markers: `border-white/30`

### 3. VideoControlsOverlay Component

**Purpose:** Always-visible playback controls (not hover-based)

**Props:**

```typescript
type VideoControlsOverlayProps = {
  isPlaying: boolean;
  currentSceneIndex: number;
  totalScenes: number;
  currentTime: number;
  totalTime: number;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
};
```

**Layout:**

```
┌─────────────────────────────────────┐
│                                     │
│  [Scene Image/Video]                │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Timeline Scrubber           │   │
│  └─────────────────────────────┘   │
│  ◄◄  ⏸  ►► │ 00:06 / 00:24  Scene 3 of 8
└─────────────────────────────────────┘
```

**Gradient Background:**

- `bg-gradient-to-t from-black/60 via-transparent to-transparent`
- Ensures controls are visible over any image

**Control Buttons:**

- Previous: SkipBack icon, 28px button
- Play/Pause: 32px button, shows Pause when playing, Play when paused
- Next: SkipForward icon, 28px button
- All: `text-white hover:bg-white/20 rounded-full`

**Timecode Display:**

- Format: `{formatTime(currentTime)} / {formatTime(totalTime)}`
- Font: `text-xs font-medium text-white tabular-nums`

**Scene Indicator:**

- Format: `Scene {currentSceneIndex + 1} of {totalScenes}`
- Font: `text-xs font-medium text-white/80`

### 4. Playback Reducer

**Purpose:** Manage playback state in pure TypeScript

**File:** `src/lib/scenes/playback.reducer.ts`

```typescript
export type PlaybackState = {
  isPlaying: boolean;
  currentSceneIndex: number;
  playbackSpeed: number; // milliseconds per scene
};

export type PlaybackAction =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_PLAY_PAUSE' }
  | { type: 'NEXT_SCENE'; totalScenes: number }
  | { type: 'PREVIOUS_SCENE'; totalScenes: number }
  | { type: 'GO_TO_SCENE'; sceneIndex: number }
  | { type: 'AUTO_ADVANCE'; totalScenes: number };

export const initialPlaybackState: PlaybackState = {
  isPlaying: false,
  currentSceneIndex: 0,
  playbackSpeed: 3000, // 3 seconds per scene
};

export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction
): PlaybackState {
  switch (action.type) {
    case 'PLAY':
      return { ...state, isPlaying: true };

    case 'PAUSE':
      return { ...state, isPlaying: false };

    case 'TOGGLE_PLAY_PAUSE':
      return { ...state, isPlaying: !state.isPlaying };

    case 'NEXT_SCENE':
      return {
        ...state,
        currentSceneIndex: (state.currentSceneIndex + 1) % action.totalScenes,
      };

    case 'PREVIOUS_SCENE':
      return {
        ...state,
        currentSceneIndex:
          state.currentSceneIndex === 0
            ? action.totalScenes - 1
            : state.currentSceneIndex - 1,
      };

    case 'GO_TO_SCENE':
      return { ...state, currentSceneIndex: action.sceneIndex };

    case 'AUTO_ADVANCE':
      // Used by auto-play timer
      return {
        ...state,
        currentSceneIndex: (state.currentSceneIndex + 1) % action.totalScenes,
      };

    default:
      return state;
  }
}
```

## Implementation Guidelines

### Auto-Play with useEffect

```typescript
const [state, dispatch] = useReducer(playbackReducer, initialPlaybackState);

useEffect(() => {
  if (!state.isPlaying || frames.length === 0) return;

  const timer = setInterval(() => {
    dispatch({ type: 'AUTO_ADVANCE', totalScenes: frames.length });
  }, state.playbackSpeed);

  return () => clearInterval(timer);
}, [state.isPlaying, state.playbackSpeed, frames.length]);
```

### Calculate Timecode

```typescript
const currentTime = state.currentSceneIndex * (state.playbackSpeed / 1000);
const totalTime = frames.length * (state.playbackSpeed / 1000);
```

### Responsive Design

Controls should adapt to mobile:

```tsx
<div className="flex items-center gap-2 md:gap-3">
  {/* Buttons scale on mobile */}
  <Button size="sm" className="h-7 w-7 md:h-8 md:w-8">
    <SkipBack className="h-3 w-3 md:h-4 md:w-4" />
  </Button>
</div>
```

### Timeline with Scene Markers

```tsx
<div className="relative h-px w-full bg-white/20 rounded-full">
  {/* Progress bar */}
  <div
    className="absolute left-0 top-0 h-full bg-primary rounded-full"
    style={{ width: `${progress}%` }}
  />

  {/* Scene markers */}
  {Array.from({ length: totalScenes - 1 }).map((_, i) => (
    <div
      key={i}
      className="absolute top-0 h-2 w-px bg-white/30 -translate-y-1/2"
      style={{ left: `${((i + 1) / totalScenes) * 100}%` }}
    />
  ))}
</div>
```

## Acceptance Criteria

- [ ] Image displays with proper aspect ratio (16:9)
- [ ] Video displays when available
- [ ] Controls overlay is always visible (not hover-based)
- [ ] Play/Pause button toggles correctly
- [ ] Play icon changes to Pause when playing
- [ ] Previous button navigates to previous scene (wraps)
- [ ] Next button navigates to next scene (wraps)
- [ ] Timeline scrubber shows correct progress
- [ ] Scene markers divide timeline equally
- [ ] Timecode displays correctly (MM:SS format)
- [ ] Auto-play advances scenes every 3 seconds
- [ ] Auto-play stops when pause is clicked
- [ ] Scene indicator shows correct numbers
- [ ] All Storybook stories render without errors
- [ ] Responsive design works on mobile

## Storybook Stories

### ScenePreview Stories

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ScenePreview } from './scene-preview';

const meta: Meta<typeof ScenePreview> = {
  title: 'Scenes/ScenePreview',
  component: ScenePreview,
};

export default meta;
type Story = StoryObj<typeof ScenePreview>;

export const WithImage: Story = {
  args: {
    frame: {
      id: '1',
      thumbnailUrl: 'https://picsum.photos/1280/720',
      videoUrl: null,
      thumbnailStatus: 'complete',
    } as Frame,
  },
};

export const WithVideo: Story = {
  args: {
    frame: {
      id: '1',
      thumbnailUrl: 'https://picsum.photos/1280/720',
      videoUrl:
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      videoStatus: 'complete',
    } as Frame,
  },
};

export const Loading: Story = {
  args: {
    frame: null,
  },
};
```

### VideoControlsOverlay Stories

```typescript
export const Playing: Story = {
  args: {
    isPlaying: true,
    currentSceneIndex: 2,
    totalScenes: 8,
    currentTime: 6,
    totalTime: 24,
    onPlayPause: () => {},
    onPrevious: () => {},
    onNext: () => {},
  },
};

export const Paused: Story = {
  args: {
    isPlaying: false,
    currentSceneIndex: 0,
    totalScenes: 8,
    currentTime: 0,
    totalTime: 24,
    onPlayPause: () => {},
    onPrevious: () => {},
    onNext: () => {},
  },
};

export const LastScene: Story = {
  args: {
    isPlaying: false,
    currentSceneIndex: 7,
    totalScenes: 8,
    currentTime: 21,
    totalTime: 24,
    onPlayPause: () => {},
    onPrevious: () => {},
    onNext: () => {},
  },
};
```

### TimelineScrubber Stories

```typescript
export const Beginning: Story = {
  args: {
    currentSceneIndex: 0,
    totalScenes: 8,
  },
};

export const Middle: Story = {
  args: {
    currentSceneIndex: 3,
    totalScenes: 8,
  },
};

export const End: Story = {
  args: {
    currentSceneIndex: 7,
    totalScenes: 8,
  },
};
```

## Testing

### Manual Testing

1. Open Storybook and verify all stories
2. Test play/pause functionality
3. Verify auto-play advances scenes
4. Test previous/next navigation with wrapping
5. Check timecode accuracy
6. Verify timeline progress matches current scene
7. Test on mobile viewport

### Unit Tests

Test playback reducer:

```typescript
import { describe, expect, test } from 'bun:test';
import { playbackReducer, initialPlaybackState } from './playback.reducer';

describe('playbackReducer', () => {
  test('toggles play/pause', () => {
    const state = playbackReducer(initialPlaybackState, {
      type: 'TOGGLE_PLAY_PAUSE',
    });
    expect(state.isPlaying).toBe(true);
  });

  test('advances to next scene', () => {
    const state = playbackReducer(initialPlaybackState, {
      type: 'NEXT_SCENE',
      totalScenes: 8,
    });
    expect(state.currentSceneIndex).toBe(1);
  });

  test('wraps to first scene', () => {
    const state = playbackReducer(
      { ...initialPlaybackState, currentSceneIndex: 7 },
      { type: 'NEXT_SCENE', totalScenes: 8 }
    );
    expect(state.currentSceneIndex).toBe(0);
  });

  test('goes to previous scene', () => {
    const state = playbackReducer(
      { ...initialPlaybackState, currentSceneIndex: 3 },
      { type: 'PREVIOUS_SCENE', totalScenes: 8 }
    );
    expect(state.currentSceneIndex).toBe(2);
  });

  test('wraps to last scene when going back from first', () => {
    const state = playbackReducer(initialPlaybackState, {
      type: 'PREVIOUS_SCENE',
      totalScenes: 8,
    });
    expect(state.currentSceneIndex).toBe(7);
  });
});
```

## Commit Message

```
feat: add scene preview and video controls

- Create ScenePreview component with image/video display
- Add VideoControlsOverlay with always-visible controls
- Implement TimelineScrubber with scene markers
- Add playback reducer for state management
- Include auto-play functionality with 3-second intervals
- Add unit tests for playback reducer
- Include Storybook stories for all components
```

## Next Phase

After committing this phase, proceed to **Phase 3: Scene Details Tabs**.

## Notes

- Controls are always visible, not hover-based
- Video element is native HTML5 (consider react-player if more features needed later)
- Auto-play is opt-in via play button
- Timeline is visual only for now (no click-to-seek yet)
- Timecode is calculated, not from actual video duration
