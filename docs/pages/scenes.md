# Scene Editor Route Documentation

## 1. Overview

**Route:** `/scenes` (SceneEditor page)

**Purpose:** A comprehensive video scene editing interface that allows users to create, edit, and manage video scenes for commercial/brand film production. Users can edit scripts, generate images and motion using multiple AI models, manage versions, and preview the final timeline.

**Key Features:**

- Scene list navigation with drag-and-drop reordering
- Multi-model image and motion generation (select up to 4 image models and 5 motion models simultaneously)
- Version management system with timeline preview
- Video playback controls with scene scrubbing
- Script, image prompt, and motion prompt editing
- Regeneration panel for comparing multiple model outputs
- Mobile-responsive design with bottom sheet navigation
- Scene completion tracking

---

## 2. Data Models

### Scene Interface

```typescript
interface Scene {
  id: string; // Unique identifier (numeric string)
  sceneNumber: number; // Display number (1-based)
  heading: string; // Scene heading (e.g., "INT. BREWERY - DAY")
  script: string; // Scene description/action
  imagePrompt: string; // Detailed prompt for image generation
  motionPrompt: string; // Detailed prompt for motion/camera movement
  imageUrl: string | null; // Currently selected image URL
  status: 'pending' | 'generating' | 'complete';
  versions: ImageVersion[]; // All generated versions
  currentVersionIndex: number; // Index of currently selected version
}
```

### ImageVersion Interface

```typescript
interface ImageVersion {
  id: string; // Format: "{sceneId}-v{versionNumber}"
  url: string; // Image URL
  timestamp: Date; // Generation timestamp
  isSelected: boolean; // Whether this is the active version
}
```

---

## 3. Visual Layout

### Desktop Layout (≥768px)

**Two-column structure:**

1. **Left Column - Scene List (320px fixed width)**
   - Story title (editable text input at top)
   - "Scenes" label
   - Scrollable scene list with drag handles
   - Each scene shows: thumbnail, scene number badge, heading, script preview, completion checkbox
   - Two action buttons at bottom: "Generate ALL Motion" and "Add Scene"

2. **Right Column - Main Content Area (flex-1, fills remaining space)**
   - **Top Section:** Large image preview with video controls overlay
   - **Middle Section:** Scene heading + 3 tabs (Script, Image Prompt, Motion Prompt)
   - **Bottom Section:** Version timeline OR regeneration panel

_Note: The global VerticalNavSidebar (80px) is present on the left but is considered part of the application chrome, not the page layout._

### Mobile Layout (<768px)

**Single column with overlays:**

- Fixed header at top (hamburger menu, logo, story title)
- Main content area fills screen
- Fixed bottom bar showing current scene (tappable to open scene list sheet)
- Scene list appears as bottom sheet (70% viewport height)

---

## 4. Component Tree

```
SceneEditor
├── Mobile Header (isMobile only)
│   ├── Sheet (navigation menu)
│   │   ├── Logo
│   │   ├── Navigation Items (Home, Videos, Community, Settings)
│   │   └── Theme Toggle
│   └── Logo + Story Title Display
│
├── Scene List - Left Column (!isMobile only)
│   ├── Story Title Input
│   ├── ScrollArea
│   │   └── DndContext
│   │       └── SortableContext
│   │           └── SortableSceneItem[] (draggable scenes)
│   │               ├── Drag Handle (GripVertical icon)
│   │               ├── Scene Thumbnail
│   │               ├── Scene Number Badge
│   │               ├── Heading
│   │               ├── Script Preview
│   │               └── Completion Checkbox
│   └── Action Buttons
│       ├── Generate ALL Motion
│       └── Add Scene
│
└── Scene Details - Right Column
    ├── Image Preview Section
    │   ├── Scene Image (aspect-video)
    │   └── Video Controls Overlay (always visible)
    │       ├── Timeline Scrubber (with scene markers)
    │       ├── Play/Pause Button
    │       ├── Previous/Next Buttons
    │       └── Timecode Display
    │
    ├── Scene Details Section
    │   ├── Scene Heading (!isMobile only)
    │   └── Tabs (Script, Image Prompt, Motion Prompt)
    │       ├── Script Tab
    │       │   └── Textarea (editable script)
    │       ├── Image Prompt Tab
    │       │   ├── Textarea (editable image prompt)
    │       │   ├── Model Selector Grid (4 models)
    │       │   │   ├── Flux Krea (Sparkles icon)
    │       │   │   ├── Nano Banana (Zap icon)
    │       │   │   ├── Qwen (Target icon)
    │       │   │   └── Seedream (Sprout icon)
    │       │   └── Multi-Generate Button
    │       └── Motion Prompt Tab
    │           ├── Textarea (editable motion prompt)
    │           ├── Model Selector Grid (5 models)
    │           │   ├── Ray3 (Zap icon)
    │           │   ├── Seedance (Music icon)
    │           │   ├── Kling 2.5 (Clapperboard icon)
    │           │   ├── Veo 3.1 (Video icon)
    │           │   └── Wan 2.5 (Waves icon)
    │           └── Multi-Generate Button
    │
    └── Bottom Section (conditional)
        ├── Version Timeline (default state)
        │   ├── Version info text
        │   └── Horizontal scrollable thumbnails
        │       ├── Version Thumbnails (clickable)
        │       ├── Connector Lines
        │       └── Add New Variation Button
        └── RegenerationPanel (when regenerating)
            ├── Header (frame label + close button)
            ├── Grid of generating/generated versions
            │   └── Version Cards (clickable when loaded)
            └── Action Buttons (Cancel, Select)

└── Mobile Bottom Sheet (isMobile only)
    ├── Sheet Trigger (fixed bottom bar)
    │   ├── Current Scene Thumbnail
    │   ├── Scene Number + Heading
    │   └── ChevronUp Icon
    └── Sheet Content (scene list)
        └── Scene Items (similar to desktop but non-draggable)
```

---

## 5. State Management

All state uses `useState` hooks:

### Navigation & UI State

- `sideNavCollapsed: boolean` - Desktop side nav collapse state (default: true)
- `mobileNavOpen: boolean` - Mobile navigation sheet open state
- `mobileScenesOpen: boolean` - Mobile scene list sheet open state
- `isMobile: boolean` - From useIsMobile hook

### Story & Scene State

- `storyTitle: string` - Project title (default: "Greedy Bear Commercial")
- `scenes: Scene[]` - Array of all scenes (initialized with 8 default scenes)
- `selectedSceneId: string` - Currently active scene ID (default: "1")
- `completedScenes: Set<string>` - Scene IDs marked as complete

### Playback State

- `isPlaying: boolean` - Video playback state
- `playbackSpeed: number` - Milliseconds per scene (default: 3000)

### Generation State

- `selectedImageModels: string[]` - Selected image model IDs (default: ["flux-krea", "nano-banana", "qwen", "seedream"])
- `selectedMotionModels: string[]` - Selected motion model IDs (default: ["ray3", "seedance", "kling-2.5", "veo-3.1", "wan-2.5"])
- `showRegenerationPanel: boolean` - Whether regeneration panel is visible
- `regeneratingSceneId: string | null` - ID of scene being regenerated
- `regenerationType: "image" | "motion"` - Type of regeneration in progress

### Script Input State

- `scriptInput: string` - Unused input field for script (loaded from navigation state)

### Theme State (from next-themes)

- `theme: string` - Current theme ("dark" | "light")
- `setTheme: (theme: string) => void` - Theme setter function

---

## 6. UI Elements Inventory

### Scene List (Left Column)

**Header:**

- Story title input: text-base font-semibold, editable, hover:bg-muted/20
- "Scenes" label: text-xs font-medium text-muted-foreground

**Sortable Scene Items:**
Each scene card shows:

- Drag handle: GripVertical icon (16px), cursor-grab/grabbing, hover:bg-muted/50
- Thumbnail: 80x45px, rounded, object-cover
- Scene number badge: text-[10px], outline variant
- Heading: font-medium text-xs, line-clamp-1
- Script preview: text-[10px] text-muted-foreground, line-clamp-2
- Completion checkbox: circular button (24px)
  - Unchecked: bg-muted border-border/40
  - Checked: bg-green-500 text-white with Check icon

Active scene:

- bg-primary/10 border-primary

Inactive scene:

- bg-muted/50 border-border/50, hover:bg-muted/70

**Bottom Action Buttons:**

- "Generate ALL Motion": variant-default, Zap icon
- "Add Scene": variant-outline, Plus icon

### Image Preview Section (Top of Right Panel)

**Container:**

- Centered flex layout with padding
- bg-muted/10
- max-w-3xl

**Image:**

- aspect-video, rounded-lg border shadow-lg
- object-cover

**Video Controls Overlay (always visible, not on hover):**

Gradient overlay:

- bg-gradient-to-t from-black/60 via-transparent to-transparent

Timeline scrubber:

- 1px height, bg-white/20, rounded-full
- Progress bar: bg-primary, width based on current scene percentage
- Scene section markers: vertical dividers at scene boundaries (border-white/30)

Control buttons (bottom left):

- Previous: SkipBack icon, 28px button
- Play/Pause: 32px button, filled icon, shows Pause when playing
- Next: SkipForward icon, 28px button
- All buttons: text-white, hover:bg-white/20, rounded-full

Timecode display:

- text-xs font-medium text-white, tabular-nums
- Format: "00:00 / 00:12"

Scene indicator (bottom right):

- text-xs font-medium text-white/80
- "Scene X of Y"

### Scene Details Section (Tabs)

**Scene Heading (!isMobile):**

- text-lg font-medium, above tabs

**Tabs Component:**

- 3 equal columns: Script, Image Prompt, Motion Prompt
- Height: 40px
- text-xs on mobile, text-sm on desktop

**Tab Content Structure (all tabs):**

- Label: text-xs font-medium text-muted-foreground
- Textarea: min-h-[80px], resize-none, text-sm
- Specific placeholder text for each tab

**Image Prompt Tab - Model Selector:**
Grid layout: 4 columns, gap-1.5, max-w-xs

Each model card (4 total):

- aspect-square, rounded-md, border-2
- Icon (14px, Lucide icon)
- Name (7px font-medium)
- Selected state: border-primary bg-primary/10, shows checkmark badge (top-right, 16px circle)
- Unselected: border-border/40 bg-muted/20
- Hover: scale-105
- Tooltip on hover: shows model description

Models:

1. Flux Krea - Sparkles icon - "Best for creative and artistic generations with vibrant colors"
2. Nano Banana - Zap icon - "Ultra-fast generation, ideal for quick iterations"
3. Qwen - Target icon - "Excellent precision and detail for realistic imagery"
4. Seedream - Sprout icon - "Specialized in natural and organic compositions"

Multi-Generate button:

- width: full, height: 36px
- Zap icon + "Multi-Generate (X models)" text
- Disabled if no models selected

**Motion Prompt Tab - Model Selector:**
Grid layout: 5 columns, gap-1.5, max-w-xs

Each model card (5 total):

- Same styling as image models

Models:

1. Ray3 - Zap icon - "Lightning-fast rendering with smooth motion"
2. Seedance - Music icon - "Specialized in dynamic and fluid movements"
3. Kling 2.5 - Clapperboard icon - "Cinematic quality with advanced camera movements"
4. Veo 3.1 - Video icon - "Professional-grade video with realistic physics"
5. Wan 2.5 - Waves icon - "Best for organic and natural motion patterns"

Multi-Generate button: same as image tab

### Version Timeline Section (Bottom of Right Panel)

**Version Info Text:**

- text-[10px] text-muted-foreground
- "Scene X - Y version(s) generated"

**Timeline Container:**

- bg-muted/20, rounded-md, padding-1.5, border-border/50
- Horizontal scrollable flex layout with gap-1.5

**Version Thumbnails:**
Each version shows:

- 80x48px thumbnail, rounded, object-cover
- Version badge (top-left): "vX" text, 9px font
  - Selected: bg-primary text-primary-foreground
  - Unselected: bg-background/80 text-foreground
- Selected indicator: 6px primary circle (bottom-right)
- Border styling:
  - Selected: border-primary ring-1 ring-primary/20
  - Past (before current): border-border/50 opacity-60, hover:opacity-100
  - Future (after current): border-dashed border-muted-foreground/20, opacity-40, blur-sm grayscale

**Connector Lines:**
Between versions: 12x1px line

- Primary color for past versions
- border/50 color for future connections

**Add New Variation Button:**

- 56x48px, border-dashed border-muted-foreground/20
- Plus icon (16px)
- hover: border-primary/50 bg-muted/30

### Regeneration Panel (Alternative Bottom Section)

**Container:**

- max-w-2xl, mx-auto
- bg-background/98 backdrop-blur-sm
- rounded-lg border-border/70, padding-16px

**Header:**

- Frame label: text-xs font-medium text-foreground/90
- Subtitle: text-[10px] text-muted-foreground "Select a version"
- Close button (X icon): 28px ghost button

**Version Grid:**
Dynamic grid:

- 4 columns if ≤4 models
- 5 columns if 5 models
- 4 columns if >5 models
- gap-2

**Loading State (5 second duration):**
Each card shows:

- Black background (bg-black/95)
- Matrix-style falling green lines animation (8 vertical lines)
- RotateCcw icon spinning (12px, text-green-500)
- "LOADING..." text (8px, font-mono, text-green-500)
- Version badge at bottom-left: "VX" (8px, bg-background/80)

**Loaded State:**
Each card shows:

- aspect-video, rounded border
- Placeholder: bg-muted/30 with "VX" text (9px)
- Selection indicator (when selected): 16px circle (top-right) with Check icon (10px)
- Selected border: ring-1 ring-foreground/40 border-foreground/40 bg-muted/60
- Unselected: border-border/50 bg-muted/20
- Version badge (bottom-left): same as loading state

**Action Buttons (after loading):**

- Cancel: flex-1, height-32px, text-xs, variant-outline
- Select: flex-1, height-32px, text-xs, Check icon, disabled if no selection

**Loading Message (during generation):**

- Centered row with RotateCcw icon (10px, spinning) + "Generating variations..." text (10px)

### Mobile Bottom Bar

**Container:**

- Fixed bottom-0, full width, z-40
- bg-card, border-t, padding-16px
- Tappable to open scene sheet

**Content:**

- Current scene thumbnail: 48x27px, rounded
- Scene info:
  - "Scene X of Y" (12px font-medium)
  - Scene heading (10px text-muted-foreground, line-clamp-1)
- ChevronUp icon (16px)

### Mobile Scene Sheet

**Container:**

- Bottom sheet, 70vh height
- Full width

**Header:**

- "All Scenes" heading (14px font-semibold)
- "X scenes in this project" subtitle (12px text-muted-foreground)

**Scene List:**
Same scene cards as desktop but:

- Non-draggable (no drag handle)
- Clickable to select + auto-close sheet
- Shows completion checkbox on right

---

## 7. Features

### Multi-Model Generation

**Image Generation:**

- User selects 1-4 models from grid (Flux Krea, Nano Banana, Qwen, Seedream)
- Each model toggle shows visual feedback (checkmark badge, border highlight)
- "Multi-Generate" button shows count "(X models)"
- Clicking triggers regeneration panel with X versions

**Motion Generation:**

- User selects 1-5 models from grid (Ray3, Seedance, Kling 2.5, Veo 3.1, Wan 2.5)
- Same interaction pattern as image generation
- Different icons and model names

**Regeneration Flow:**

1. User clicks Multi-Generate button
2. Regeneration panel replaces version timeline
3. Shows grid of loading cards with matrix animation (5 seconds)
4. Cards become clickable with placeholder images
5. User selects preferred version
6. Clicks "Select" button
7. New version added to scene's version history
8. Panel closes, version timeline reappears with new version

### Version Management

**Version History:**

- Each scene maintains array of all generated versions
- Versions display in chronological order (left to right)
- Visual states:
  - Past versions: normal opacity, solid border
  - Current version: highlighted border + indicator dot
  - Future versions: reduced opacity, dashed border, blur effect
- Clicking any version makes it current (updates main image)

**Version Addition:**

- Plus button at end of timeline
- Simulates generation (2 second delay)
- Adds new version to end of array
- Automatically selects new version

### Playback Controls

**Auto-Play:**

- Play/Pause button toggles playback
- When playing: automatically advances through scenes every 3 seconds
- Loops back to first scene after last scene
- Pause stops auto-advance

**Manual Navigation:**

- Previous button: goes to previous scene (wraps to end)
- Next button: advances to next scene (wraps to start)

**Timeline Scrubber:**

- Visual progress bar shows current position
- Scene section markers divide timeline into equal segments
- Updates in real-time during playback

**Timecode:**

- Displays current time vs total duration
- Format: MM:SS / MM:SS
- Calculated based on: currentSceneIndex × 3 seconds

### Drag-Drop Reordering

**Desktop Only:**

- Each scene has drag handle (GripVertical icon)
- Vertical list sorting strategy
- Uses @dnd-kit library
- On drop: reorders scenes array, updates scene numbers
- Active drag state: opacity-50, z-50
- Smooth animations during reorder

**Sensors:**

- PointerSensor: mouse/touch dragging
- KeyboardSensor: keyboard navigation for accessibility

### Script & Prompt Editing

**Three Editable Fields per Scene:**

1. Script: scene description/action
2. Image Prompt: detailed prompt for image generation
3. Motion Prompt: camera movement and motion details

**Editing Behavior:**

- Real-time updates to scene data
- Changes persist in scenes array state
- No save button needed (auto-save pattern)
- Textareas resize vertically (min-height: 80px)

### Scene Management

**Add Scene:**

- Button at bottom of scene list
- Creates new scene with:
  - Auto-incremented scene number
  - Placeholder heading: "NEW SCENE X"
  - Placeholder script text
  - No image (null)
  - Status: "pending"
  - Empty versions array
- Automatically selects new scene

**Scene Completion Tracking:**

- Green checkmark button on each scene
- Toggles completion state
- Completed: green background, white check
- Incomplete: muted background, muted check
- State stored in Set for quick lookup

### Responsive Design

**Desktop (≥768px):**

- Two-column layout (scene list + main content)
- Fixed scene list (320px)
- Flexible main content
- Drag-drop reordering enabled
- Inline scene heading display

**Mobile (<768px):**

- Single column layout
- Top header with hamburger menu
- Full-width main content
- Bottom bar showing current scene
- Scene list in bottom sheet (70% height)
- No drag-drop (simpler touch interaction)
- Scene heading hidden (shown in tabs only)

---

## 8. Styling

### Theme System

Uses CSS variables from theme:

- `--background`: main background
- `--card`: card backgrounds
- `--muted`: muted backgrounds
- `--border`: border colors
- `--primary`: primary accent color
- `--foreground`: text color
- `--muted-foreground`: secondary text

### Color Scheme

**Scene Colors (unused in current implementation):**
Array of 8 colors for potential future use:

- pink-500, blue-500, purple-500, violet-500, orange-500, cyan-500, green-500, emerald-500

**Status Colors:**

- Completion: green-500 (checked), muted (unchecked)
- Selection: primary color for highlights
- Borders: border color with opacity variants (/50, /40, /30)

### Tailwind Patterns

**Layout:**

- `flex flex-col` for vertical stacking
- `flex items-center gap-X` for horizontal rows
- `max-w-3xl mx-auto` for centered content
- `aspect-video` for 16:9 images
- `fixed`/`sticky` for navigation elements

**Spacing:**

- gap-1, gap-2, gap-3, gap-4 (4px, 8px, 12px, 16px)
- p-1.5, p-2, p-3, p-4 for padding
- space-y-1, space-y-2, space-y-3 for vertical spacing

**Typography:**

- text-xs (12px), text-sm (14px), text-base (16px), text-lg (18px)
- text-[10px], text-[7px] for custom sizes
- font-medium, font-semibold for weights
- line-clamp-1, line-clamp-2 for truncation
- tabular-nums for timecode

**Borders:**

- rounded, rounded-md, rounded-lg, rounded-full
- border, border-2 for thickness
- border-border, border-primary, border-dashed

**Backgrounds:**

- bg-muted/10, bg-muted/20, bg-muted/50 for opacity variants
- bg-primary/10 for selection state
- bg-gradient-to-t for overlays

**Transitions:**

- transition-all, transition-colors for smooth changes
- hover: states for interactive elements
- duration-300 for theme toggle

**Effects:**

- backdrop-blur, backdrop-blur-xl for glassmorphism
- shadow-lg for depth
- ring-1, ring-primary/20 for focus states

### Responsive Classes

- `md:` prefix for desktop (768px+)
- `md:flex-row` vs default `flex-col`
- `md:pb-0` to remove mobile bottom padding
- `md:text-sm` vs `text-xs` for mobile

---

## 9. Dependencies

### React & Routing

- `react`: Core library
- `react-router-dom`: Routing (useLocation, useNavigate, Link)
- `useState`, `useEffect`: State management hooks

### UI Components (shadcn/ui)

- `Button`: Primary interactive elements
- `Badge`: Scene number indicators
- `Textarea`: Multi-line text inputs
- `ScrollArea`: Scrollable containers
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`: Tabbed interface
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`: Dropdowns
- `Checkbox`: Completion toggles
- `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`: Hover info
- `Sheet`, `SheetContent`, `SheetTrigger`: Mobile bottom sheets
- `Popover`, `PopoverContent`, `PopoverTrigger`: Desktop menu popovers
- `DropdownMenu` components: User account menu

### Icons (lucide-react)

Navigation: `Home`, `Video`, `Users`, `Settings`
Side nav: `Briefcase`, `Image`, `Edit`, `Lightbulb`, `Grid`
Actions: `Plus`, `Check`, `Wand2`, `Zap`, `Sparkles`
Playback: `Play`, `Pause`, `SkipBack`, `SkipForward`, `Film`, `Clapperboard`
UI: `ChevronRight`, `ChevronLeft`, `ChevronUp`, `Menu`, `Info`, `GripVertical`
Models: `Target`, `Sprout`, `Music`, `Waves`
Theme: `Moon`, `Sun`
User: `UserCircle`, `User`, `LogOut`

### Drag & Drop (@dnd-kit)

- `DndContext`: Drag context provider
- `closestCenter`: Collision detection
- `PointerSensor`, `KeyboardSensor`: Input sensors
- `useSensor`, `useSensors`: Sensor configuration
- `SortableContext`: Sortable list context
- `sortableKeyboardCoordinates`: Keyboard navigation
- `verticalListSortingStrategy`: Vertical sorting
- `useSortable`: Sortable item hook
- `arrayMove`: Array reordering utility
- `CSS` (from @dnd-kit/utilities): Transform utilities

### Theming

- `next-themes`: Theme provider (useTheme hook)

### Custom Components

- `RegenerationPanel`: Multi-version comparison UI

### Utilities

- `@/lib/utils` (cn): Conditional className utility
- `@/hooks/use-mobile`: Mobile detection hook

### Assets

- `velro-v-logo.svg`: Velro logo
- `scene1.webp` through `scene8.webp`: Default scene images

---

## 10. Default Data

### Default Scenes (8 total)

**Scene 1: INT. EGYPTIAN BREWERY - DAY**

- Script: "A man stands in an ancient Egyptian-themed brewery, surrounded by golden bottles and pharaoh statues."
- Image Prompt: "Wide shot of an ancient Egyptian-themed brewery interior, warm golden lighting, intricate hieroglyphics on stone walls, golden beer bottles displayed on carved pedestals, pharaoh statues flanking the scene, cinematic composition, ultra high resolution, 16:9 aspect ratio"
- Motion Prompt: "Slow dolly forward through the brewery, camera tracking past bottles with subtle lens flare, ambient lighting shifts across the pharaoh statues, gentle steam rising from brewing vats in background"
- Image: scene1.webp
- Status: complete
- Version: 1 (generated 1 hour ago)

**Scene 2: INT. GAMING ROOM - NIGHT**

- Script: "A person sits at their desk, gaming on a monitor while colorful drinks glow on the desk."
- Image Prompt: "Overhead medium shot of gaming setup at night, RGB keyboard glow, neon colored drinks on desk surface, person visible from behind at monitor, vibrant screen reflections, moody atmospheric lighting, cinematic depth of field"
- Motion Prompt: "Static camera with subtle handheld breathing, screen flickers with game action, RGB lights cycle through colors, person's hands move on keyboard and mouse"
- Image: scene2.webp
- Status: complete
- Version: 1 (generated 50 minutes ago)

**Scene 3: INT. DINING ROOM - EVENING**

- Script: "Friends gather around a table for a board game night, bottles and candles creating an intimate atmosphere."
- Image Prompt: "Wide shot of intimate dining room table, warm candlelight ambience, board game spread across table, bottles catching the light, friends gathered around, cozy evening atmosphere, shallow depth of field, cinematic warmth"
- Motion Prompt: "Slow push in towards the table, candlelight flickers naturally, hands reach for game pieces, subtle parallax as camera moves closer, warm atmospheric haze"
- Image: scene3.webp
- Status: complete
- Version: 1 (generated 40 minutes ago)

**Scene 4: CLOSE UP - EVENING**

- Script: "Close-up of sparkling bottles being toasted, bubbles rising in celebration."
- Image Prompt: "Extreme close-up of glass bottles clinking in toast, macro photography, bubbles rising through liquid, golden reflections, sharp focus on contact point, shallow depth of field, celebration lighting, high-speed detail"
- Motion Prompt: "High-speed camera, bottles approach in slow motion, glass contact creates ripple through liquid, bubbles accelerate upward, subtle camera shake on impact, sparkle highlights"
- Image: scene4.webp
- Status: complete
- Version: 1 (generated 30 minutes ago)

**Scene 5: EXT. COUNTRYSIDE - SUNSET**

- Script: "Two bottles of Greedy Bear honey whiskey sit in a field at sunset with bees flying around."
- Image Prompt: "Golden hour exterior shot of two honey whiskey bottles in tall grass field, warm sunset backlight, bees in motion around bottles, lens flare, pastoral countryside background, rich amber tones, ultra high resolution"
- Motion Prompt: "Slow orbit around bottles, bees fly through frame, grass sways gently in breeze, sun dips lower creating lens flare, golden light shifts across labels"
- Image: scene5.webp
- Status: complete
- Version: 1 (generated 20 minutes ago)

**Scene 6: INT. BAR - NIGHT**

- Script: "A bartender serves drinks in a vibrant arcade bar filled with neon lights and vintage games."
- Image Prompt: "Wide shot of neon-lit arcade bar interior, bartender center frame pouring drinks, vintage arcade cabinets glowing in background, vibrant purple and blue neon signage, cinematic cyberpunk aesthetic, atmospheric haze"
- Motion Prompt: "Slow dolly forward towards bar, neon lights flicker and pulse, arcade screens flash with game animations, bartender performs pour, atmospheric smoke drifts through colored lights"
- Image: scene6.webp
- Status: complete
- Version: 1 (generated 10 minutes ago)

**Scene 7: INT. LIVING ROOM - EVENING**

- Script: "Split screen showing someone shopping online while family relaxes in the living room."
- Image Prompt: "Split screen composition, left side shows laptop screen with online shopping interface, right side shows family on couch in living room, warm evening lighting, lifestyle photography aesthetic, balanced composition"
- Motion Prompt: "Static split screen, left side: cursor moves across shopping site, pages scroll, right side: subtle family movement, TV flickers in background, natural indoor lighting shifts"
- Image: scene7.webp
- Status: complete
- Version: 1 (generated 5 minutes ago)

**Scene 8: INT. LIVING ROOM - DAY**

- Script: "A man relaxes on a couch, holding a Greedy Bear bottle with a warm, satisfied smile."
- Image Prompt: "Medium shot of man on couch in natural daylight, holding Greedy Bear bottle, genuine satisfied expression, soft window light from side, comfortable home environment, shallow depth of field on bottle label, lifestyle photography"
- Motion Prompt: "Slow push in from medium to medium-close up, man takes satisfied sip, gentle head tilt back, natural breathing, soft focus rack to bottle label then back to face"
- Image: scene8.webp
- Status: complete
- Version: 1 (generated 1 minute ago)

### Default Model Selections

**Image Models (4 selected by default):**

- flux-krea
- nano-banana
- qwen
- seedream

**Motion Models (5 selected by default):**

- ray3
- seedance
- kling-2.5
- veo-3.1
- wan-2.5

---

## 11. Recreation Guide

### Step 1: Set Up Route & Basic Structure

1. Create route in routing configuration
2. Set up main component with responsive layout detection
3. Implement two-column desktop layout (scene list, main content)
4. Implement mobile layout with header and bottom bar

### Step 2: Implement State Management

1. Create Scene and ImageVersion interfaces
2. Initialize scenes state with 8 default scenes
3. Set up selection state (selectedSceneId)
4. Add playback state (isPlaying, playbackSpeed)
5. Add model selection states (selectedImageModels, selectedMotionModels)
6. Add regeneration states (showRegenerationPanel, regeneratingSceneId, regenerationType)
7. Add UI states (sideNavCollapsed, mobileNavOpen, mobileScenesOpen, completedScenes)

### Step 3: Add VerticalNavSidebar

1. Include the VerticalNavSidebar component (see component documentation)
2. Position as fixed 80px left column on desktop

### Step 4: Build Scene List (Desktop)

1. Create 320px middle column with ScrollArea
2. Add story title input at top
3. Implement DndContext and SortableContext
4. Create SortableSceneItem component with:
   - Drag handle
   - Thumbnail
   - Scene number badge
   - Heading and script preview
   - Completion checkbox
5. Add drag end handler to reorder scenes
6. Add "Generate ALL Motion" and "Add Scene" buttons at bottom

### Step 5: Build Image Preview Section

1. Create centered container with max-width
2. Add aspect-video image display
3. Implement always-visible controls overlay with:
   - Dark gradient background
   - Timeline scrubber with scene markers
   - Play/Pause button
   - Previous/Next buttons
   - Timecode display (current/total)
   - Scene indicator text
4. Implement playback logic with useEffect

### Step 6: Build Scene Details Tabs

1. Create Tabs component with 3 tabs (Script, Image Prompt, Motion Prompt)
2. For each tab:
   - Add label and textarea
   - Wire onChange to update scene state
3. For Image Prompt tab:
   - Create 4-column model grid
   - Add 4 model cards with icons, names, tooltips
   - Implement multi-select logic
   - Add Multi-Generate button
4. For Motion Prompt tab:
   - Create 5-column model grid
   - Add 5 model cards with icons, names, tooltips
   - Implement multi-select logic
   - Add Multi-Generate button

### Step 7: Build Version Timeline

1. Create horizontal scrollable container
2. Add version info text
3. Map through scene versions to create:
   - Thumbnail cards with version badge
   - Selection indicator
   - Past/current/future styling
   - Connector lines between versions
4. Add "+" button to generate new version
5. Implement version selection handler

### Step 8: Build Regeneration Panel

1. Create RegenerationPanel component with:
   - Header (frame label, close button)
   - Dynamic grid based on model count
   - Loading state (matrix animation, 5 seconds)
   - Loaded state (clickable cards)
   - Action buttons (Cancel, Select)
2. Wire up onSelect and onCancel handlers
3. Add conditional rendering in main component

### Step 9: Implement Mobile UI

1. Create mobile header with:
   - Hamburger menu button
   - Sheet for navigation menu
   - Logo and story title display
2. Create bottom bar with:
   - Current scene thumbnail
   - Scene number and heading
   - ChevronUp icon
3. Create bottom Sheet for scene list with:
   - Header text
   - Scene cards (non-draggable)
   - Click to select handler

### Step 10: Add Helper Functions

1. formatTime(seconds): Convert to MM:SS format
2. handlePlayPause(): Toggle playback state
3. handlePrevious(): Navigate to previous scene
4. handleNext(): Navigate to next scene
5. handleGenerateImage(sceneId): Simulate generation
6. handleSelectVersion(sceneId, versionIndex): Update current version
7. handleAddScene(): Create new scene
8. handleScenesReorder(reorderedScenes): Update scene numbers
9. handleDragEnd(event): Handle drag-drop reordering

### Step 11: Wire Up Navigation State

1. Use useLocation to receive script from navigation state
2. Load script into scriptInput state in useEffect
3. Set up navigation with useNavigate
4. Wire up all navigation buttons (logo, nav items, etc.)

### Step 12: Polish & Testing

1. Test drag-drop reordering on desktop
2. Test playback controls (play, pause, prev, next, scrubber)
3. Test model selection and multi-generate flow
4. Test version timeline and version switching
5. Test regeneration panel flow
6. Test scene completion checkboxes
7. Test theme toggle
8. Test responsive behavior (desktop ↔ mobile)
9. Test mobile bottom sheet interactions
10. Verify all text inputs update state correctly

### Key Implementation Notes

**Drag & Drop:**

- Use @dnd-kit/core and @dnd-kit/sortable
- Set up sensors for pointer and keyboard
- Use verticalListSortingStrategy
- Transform: CSS.Transform.toString(transform)
- Apply isDragging opacity style

**Playback Logic:**

- useEffect with isPlaying dependency
- setInterval to advance scenes every playbackSpeed ms
- Calculate next index with modulo for looping
- Clean up timer in useEffect return

**Model Selection:**

- Toggle pattern: check if ID in array, add or filter out
- Visual feedback: border, background, checkmark badge
- Disable generate button if selection empty

**Version Timeline:**

- Calculate isPast, isSelected, isFuture based on currentVersionIndex
- Apply different styling to each state
- Connector lines between items (except last)
- Placeholder image for new versions

**Regeneration Flow:**

- Show panel on Multi-Generate click
- Set regeneratingSceneId and regenerationType
- Panel displays loading animation for 5 seconds
- User selects version, clicks Select
- Create new ImageVersion, append to versions array
- Update currentVersionIndex, imageUrl
- Close panel, reset regeneratingSceneId

**Responsive Behavior:**

- Use useIsMobile hook throughout
- Conditional rendering: {isMobile && ...} or {!isMobile && ...}
- Different navigation patterns
- Adjust bottom padding on main content (pb-20 mobile, pb-0 desktop)
- ml-20 on desktop for side nav offset

**Theme Integration:**

- useTheme hook from next-themes
- Toggle between "dark" and "light"
- Moon/Sun icon based on current theme
- Theme-aware model icon colors

**State Updates:**

- Update scenes array with map pattern
- Preserve all fields except modified ones
- Use callbacks for complex updates
- Update dependent values (currentVersionIndex, imageUrl) together

**Accessibility:**

- Keyboard sensors for drag-drop
- aria-invalid on form inputs
- Semantic HTML (buttons, inputs)
- Focus management in modals
- Descriptive labels

---

## End of Documentation

This documentation provides complete specifications to recreate the Scene Editor page. All UI elements, interactions, state management, and features are described in detail without including actual code, enabling implementation in any codebase following the same patterns.
