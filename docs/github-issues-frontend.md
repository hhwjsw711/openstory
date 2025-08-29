# Frontend GitHub Issues for Velro.ai

## How to Create These Issues

Execute each command using GitHub CLI:
```bash
gh issue create --title "TITLE" --body "BODY" --label "LABELS" --milestone "MILESTONE"
```

---

## Milestone 1: MVP Foundation (Weeks 1-8)

### Week 1-2: Infrastructure Setup

```bash
# Issue 1: Setup Tailwind CSS v4 with Theme System
gh issue create \
  --title "[Frontend] Infrastructure: Setup Tailwind CSS v4 with Theme System" \
  --body "## Description
Configure Tailwind CSS v4 with a comprehensive theme variable system for consistent styling across the application. This will establish the design foundation for all UI components.

## Acceptance Criteria
- [ ] Tailwind CSS v4 installed and configured
- [ ] Theme variables structure implemented for colors, spacing, typography
- [ ] Dark/light mode support with CSS variables
- [ ] Responsive breakpoints configured (mobile-first: 375px, 640px, 768px, 1024px, 1280px)
- [ ] Base styles for common elements (buttons, inputs, cards)
- [ ] Theme provider context implemented with TanStack Query for persistence
- [ ] Documentation for theme usage created

## Technical Approach
- Use CSS custom properties for theme variables
- Create theme configuration in /src/styles/theme.ts
- Implement ThemeProvider using React Context (no global state)
- Use system preference detection with manual override option
- Store preference in localStorage via TanStack Query mutation

## Component Structure
\`\`\`
/src/styles/
  ├── globals.css (Tailwind directives)
  ├── theme.ts (theme configuration)
  └── variables.css (CSS custom properties)

/src/components/providers/
  └── theme-provider.tsx (React Context)
\`\`\`

## UI/UX Considerations
- Smooth theme transitions (300ms)
- Respect system preferences by default
- No flash of unstyled content (FOUC)
- Accessible color contrasts (WCAG AA minimum)

## Dependencies
- None

## Estimated Complexity
**Story Points**: 3
**Time Estimate**: 1 day" \
  --label "frontend,ui,infrastructure,p0-critical" \
  --milestone "MVP-Foundation"

# Issue 2: Create Component Library Foundation with Shadcn/ui
gh issue create \
  --title "[Frontend] Components: Initialize Shadcn/ui Component Library" \
  --body "## Description
Set up shadcn/ui as the foundation for our component library with proper theming, Storybook integration, and documentation.

## Acceptance Criteria
- [ ] Shadcn/ui CLI configured and components directory structured
- [ ] Base components installed: Button, Input, Card, Dialog, Dropdown, Toast
- [ ] All components use theme variables (no inline Tailwind)
- [ ] Components follow React.FC pattern with expanded props
- [ ] Storybook configured for component documentation
- [ ] Unit tests for each component using Vitest
- [ ] Component variants created (primary, secondary, destructive, ghost)

## Technical Approach
- Install shadcn/ui with custom component path: @/components/ui
- Modify components to use theme variables exclusively
- Create variant system using cva (class-variance-authority)
- Implement compound components pattern where appropriate
- Keep all components under 100 lines (extract logic to utils)

## Component Structure
\`\`\`typescript
// Example: button.tsx
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

const buttonVariants = cva(
  'base-button-styles',
  {
    variants: {
      variant: {
        primary: 'theme-primary',
        secondary: 'theme-secondary',
      },
      size: {
        sm: 'theme-size-sm',
        md: 'theme-size-md',
      }
    }
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  isLoading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  ...props
}) => {
  // Component logic under 100 lines
}
\`\`\`

## UI/UX Considerations
- Consistent focus states across all interactive elements
- Loading states for async actions
- Proper disabled states with cursor changes
- Keyboard navigation support

## Dependencies
- Tailwind CSS v4 setup complete

## Estimated Complexity
**Story Points**: 5
**Time Estimate**: 2 days" \
  --label "frontend,components,ui,p0-critical" \
  --milestone "MVP-Foundation"

# Issue 3: Setup TanStack Query for State Management
gh issue create \
  --title "[Frontend] State: Configure TanStack Query and State Management Patterns" \
  --body "## Description
Implement TanStack Query for server state management and establish patterns for local UI state using reducers instead of excessive useState.

## Acceptance Criteria
- [ ] TanStack Query configured with proper default options
- [ ] Query client provider setup with error boundaries
- [ ] Custom hooks pattern established for API calls
- [ ] Optimistic updates pattern implemented
- [ ] Reducer pattern examples for complex UI state
- [ ] Query invalidation strategy documented
- [ ] Stale-while-revalidate patterns implemented

## Technical Approach
- Configure query client with sensible defaults (staleTime: 5 min, cacheTime: 10 min)
- Create typed API hooks in /src/hooks/api/
- Implement mutation hooks with optimistic updates
- Use reducers for any component with 3+ useState hooks
- Avoid useEffect for data fetching entirely

## Code Structure
\`\`\`typescript
// /src/hooks/api/use-sequences.ts
export const useSequences = (teamId: string) => {
  return useQuery({
    queryKey: ['sequences', teamId],
    queryFn: () => api.sequences.list(teamId),
    staleTime: 5 * 60 * 1000,
  })
}

export const useCreateSequence = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.sequences.create,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['sequences', variables.teamId])
    },
    // Optimistic update
    onMutate: async (newSequence) => {
      await queryClient.cancelQueries(['sequences', newSequence.teamId])
      const previous = queryClient.getQueryData(['sequences', newSequence.teamId])
      queryClient.setQueryData(['sequences', newSequence.teamId], old => [...old, newSequence])
      return { previous }
    }
  })
}
\`\`\`

## State Management Patterns
- Server state: TanStack Query exclusively
- Complex UI state: useReducer
- Simple UI state: useState (max 2 per component)
- Form state: React Hook Form with Zod validation
- Global UI state: None (use URL params or context sparingly)

## Dependencies
- None

## Estimated Complexity
**Story Points**: 5
**Time Estimate**: 2 days" \
  --label "frontend,state-management,architecture,p0-critical" \
  --milestone "MVP-Foundation"

### Week 2-3: Authentication & Team System

# Issue 4: Build Authentication UI Components
gh issue create \
  --title "[Frontend] Auth: Create Authentication UI Flow" \
  --body "## Description
Implement complete authentication UI flow supporting magic links and passkeys with proper anonymous user handling and team context.

## Acceptance Criteria
- [ ] Login/signup form with email input for magic link
- [ ] Passkey registration and authentication UI
- [ ] Magic link confirmation page with loading state
- [ ] Anonymous user upgrade prompt component
- [ ] Team selection interface after authentication
- [ ] User profile dropdown with logout
- [ ] Session management with auto-refresh
- [ ] Error handling for auth failures
- [ ] Mobile-responsive authentication flow

## Technical Approach
- Single AuthForm component handling both login/signup
- Use reducer for auth flow state management
- Store anonymous work in localStorage with migration on signup
- Implement WebAuthn for passkeys using SimpleWebAuthn library
- Use TanStack Query for session management

## Component Structure
\`\`\`
/src/components/auth/
  ├── auth-form.tsx (email + passkey options)
  ├── auth-modal.tsx (modal wrapper)
  ├── magic-link-confirm.tsx (confirmation page)
  ├── passkey-register.tsx (passkey setup)
  ├── team-selector.tsx (post-auth team choice)
  └── user-menu.tsx (profile dropdown)

/src/hooks/auth/
  ├── use-auth.ts (auth state hook)
  ├── use-session.ts (session management)
  └── use-anonymous-upgrade.ts (upgrade flow)
\`\`\`

## UI/UX Considerations
- Clear indication of anonymous vs authenticated state
- Seamless upgrade flow without losing work
- Loading states during magic link send
- Clear error messages for failed auth
- Accessible form inputs with proper labels
- Auto-focus on first input field

## API Endpoints to Consume
- POST /api/v1/auth/magic-link
- POST /api/v1/auth/passkey/register
- POST /api/v1/auth/passkey/authenticate
- GET /api/v1/auth/session
- POST /api/v1/auth/logout
- POST /api/v1/auth/anonymous-upgrade

## Dependencies
- Component library setup
- TanStack Query configuration

## Estimated Complexity
**Story Points**: 5
**Time Estimate**: 2 days" \
  --label "frontend,auth,ui,components,p0-critical" \
  --milestone "MVP-Foundation"

# Issue 5: Implement Team Management UI
gh issue create \
  --title "[Frontend] Teams: Create Team Management Interface" \
  --body "## Description
Build the complete team management interface including team creation, member management, and team switching functionality.

## Acceptance Criteria
- [ ] Team creation modal with name and description
- [ ] Team members list with roles display
- [ ] Invite team member form with email input
- [ ] Team settings page with edit capabilities
- [ ] Team switcher component in navigation
- [ ] Permission-based UI rendering (owner/admin/member)
- [ ] Activity feed showing recent team actions
- [ ] Invitation acceptance flow

## Technical Approach
- Use reducer for team management state
- Implement role-based component rendering
- Real-time updates for team changes using Supabase Realtime
- Optimistic UI for member invitations

## Component Structure
\`\`\`
/src/components/teams/
  ├── team-create-modal.tsx
  ├── team-members-list.tsx
  ├── team-invite-form.tsx
  ├── team-settings.tsx
  ├── team-switcher.tsx
  ├── team-activity-feed.tsx
  └── team-role-badge.tsx

/src/hooks/teams/
  ├── use-team.ts
  ├── use-team-members.ts
  └── use-team-permissions.ts
\`\`\`

## State Management
\`\`\`typescript
interface TeamState {
  currentTeam: Team | null
  teams: Team[]
  members: TeamMember[]
  invitations: Invitation[]
  activity: Activity[]
}

type TeamAction = 
  | { type: 'SET_CURRENT_TEAM'; payload: Team }
  | { type: 'ADD_MEMBER'; payload: TeamMember }
  | { type: 'UPDATE_MEMBER_ROLE'; payload: { userId: string; role: Role }}
\`\`\`

## UI/UX Considerations
- Clear visual hierarchy for roles (color coding)
- Confirmation dialogs for destructive actions
- Search/filter for large member lists
- Responsive table for member management
- Real-time presence indicators

## API Endpoints to Consume
- GET /api/v1/teams
- POST /api/v1/teams
- GET /api/v1/teams/:id/members
- POST /api/v1/teams/:id/invite
- PATCH /api/v1/teams/:id/members/:userId
- DELETE /api/v1/teams/:id/members/:userId

## Dependencies
- Authentication UI complete

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 3 days" \
  --label "frontend,teams,ui,components,p0-critical" \
  --milestone "MVP-Foundation"

### Week 3-4: Script Processing Pipeline

# Issue 6: Create Script Input and Editor Interface
gh issue create \
  --title "[Frontend] Script: Build Script Input and Editor Component" \
  --body "## Description
Implement a comprehensive script input interface supporting multiple formats with syntax highlighting and real-time validation.

## Acceptance Criteria
- [ ] Multi-format script input (paste, upload, type)
- [ ] Format detection (Fountain, FDX, plain text)
- [ ] Syntax highlighting for Fountain format
- [ ] Character count with limit indicator (10,000 chars)
- [ ] Script validation with error messages
- [ ] Auto-save to localStorage
- [ ] Import from file drag-and-drop
- [ ] Export script option
- [ ] Mobile-responsive editor

## Technical Approach
- Use Monaco Editor or CodeMirror for syntax highlighting
- Implement reducer for editor state management
- Parse scripts client-side for immediate feedback
- Debounced auto-save to localStorage
- File parsing using FileReader API

## Component Structure
\`\`\`
/src/components/script/
  ├── script-editor.tsx (main editor component)
  ├── script-toolbar.tsx (format selector, actions)
  ├── script-uploader.tsx (drag-drop upload)
  ├── script-validator.tsx (validation messages)
  ├── script-parser.tsx (format detection)
  └── script-preview.tsx (formatted preview)

/src/utils/script/
  ├── fountain-parser.ts
  ├── fdx-parser.ts
  └── script-validator.ts
\`\`\`

## Editor State
\`\`\`typescript
interface ScriptEditorState {
  content: string
  format: 'fountain' | 'fdx' | 'plain'
  isValid: boolean
  errors: ValidationError[]
  isDirty: boolean
  lastSaved: Date | null
  characterCount: number
}
\`\`\`

## UI/UX Considerations
- Smooth typing experience (no lag)
- Clear format indicators
- Non-intrusive validation errors
- Keyboard shortcuts (Cmd+S to save)
- Responsive on mobile (simplified toolbar)
- Undo/redo support

## API Endpoints to Consume
- POST /api/v1/scripts/analyze
- POST /api/v1/scripts/validate
- GET /api/v1/scripts/:id

## Dependencies
- None

## Estimated Complexity
**Story Points**: 5
**Time Estimate**: 2 days" \
  --label "frontend,script,editor,ui,p0-critical" \
  --milestone "MVP-Foundation"

# Issue 7: Build Storyboard Timeline Visualization
gh issue create \
  --title "[Frontend] Storyboard: Create Timeline and Frame Visualization" \
  --body "## Description
Implement an interactive timeline component showing script-generated frames with drag-and-drop reordering and frame editing capabilities.

## Acceptance Criteria
- [ ] Horizontal scrollable timeline with frame thumbnails
- [ ] Drag-and-drop frame reordering
- [ ] Frame selection with multi-select support
- [ ] Frame duration indicators
- [ ] Zoom in/out timeline controls
- [ ] Frame status indicators (pending, generating, complete, error)
- [ ] Playback preview with frame transitions
- [ ] Frame details panel on selection
- [ ] Responsive vertical layout on mobile

## Technical Approach
- Use framer-motion for drag animations
- Implement virtualization for large frame counts
- Use reducer for timeline state management
- Intersection Observer for lazy loading thumbnails
- Keyboard navigation support (arrow keys)

## Component Structure
\`\`\`
/src/components/storyboard/
  ├── timeline.tsx (main container)
  ├── timeline-controls.tsx (zoom, playback)
  ├── frame-card.tsx (individual frame)
  ├── frame-details-panel.tsx (selected frame info)
  ├── frame-drag-overlay.tsx (drag preview)
  ├── timeline-ruler.tsx (time indicators)
  └── playback-modal.tsx (preview player)

/src/hooks/storyboard/
  ├── use-timeline.ts
  ├── use-frame-selection.ts
  └── use-playback.ts
\`\`\`

## Timeline State
\`\`\`typescript
interface TimelineState {
  frames: Frame[]
  selectedFrames: Set<string>
  zoom: number
  playbackPosition: number
  isPlaying: boolean
  draggedFrame: string | null
  viewportRange: [number, number]
}
\`\`\`

## UI/UX Considerations
- Smooth scrolling performance (60fps)
- Clear visual feedback for drag operations
- Thumbnail quality optimization
- Touch-friendly on mobile devices
- Keyboard shortcuts for power users
- Loading skeletons for generating frames

## API Endpoints to Consume
- GET /api/v1/sequences/:id/frames
- PATCH /api/v1/frames/:id/reorder
- GET /api/v1/frames/:id

## Dependencies
- Script processing complete

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 3 days" \
  --label "frontend,storyboard,timeline,ui,p0-critical" \
  --milestone "MVP-Foundation"

### Week 4-5: Frame Editor & Customization

# Issue 8: Build Frame Editor Component
gh issue create \
  --title "[Frontend] Frame Editor: Create Comprehensive Frame Editing Interface" \
  --body "## Description
Implement a detailed frame editor allowing users to customize frame properties, apply styles, and configure generation parameters.

## Acceptance Criteria
- [ ] Frame property panel with all editable fields
- [ ] Rich text description editor with formatting
- [ ] Model selection dropdown with previews
- [ ] Duration adjustment with timeline preview
- [ ] Aspect ratio selector (16:9, 9:16, 1:1, custom)
- [ ] Style Stack application interface
- [ ] Character LoRA selection and weight adjustment
- [ ] Batch edit mode for multiple frames
- [ ] Undo/redo functionality
- [ ] Mobile-responsive panel layout

## Technical Approach
- Side panel that slides in from right
- Use reducer for complex editor state
- Implement command pattern for undo/redo
- Debounced saves to prevent excessive API calls
- Optimistic updates with rollback on error

## Component Structure
\`\`\`
/src/components/frame-editor/
  ├── frame-editor-panel.tsx (main container)
  ├── frame-description-editor.tsx (rich text)
  ├── frame-model-selector.tsx (AI model choice)
  ├── frame-duration-control.tsx (timing)
  ├── frame-aspect-selector.tsx (dimensions)
  ├── frame-style-applicator.tsx (Style Stack)
  ├── frame-character-selector.tsx (LoRA)
  ├── frame-batch-actions.tsx (bulk operations)
  └── frame-history-controls.tsx (undo/redo)

/src/hooks/frame-editor/
  ├── use-frame-editor.ts
  ├── use-frame-history.ts
  └── use-batch-edit.ts
\`\`\`

## Editor State
\`\`\`typescript
interface FrameEditorState {
  activeFrame: Frame | null
  selectedFrames: Frame[]
  editHistory: EditAction[]
  historyIndex: number
  isDirty: boolean
  isSaving: boolean
  validationErrors: ValidationError[]
}

interface EditAction {
  type: 'UPDATE_DESCRIPTION' | 'CHANGE_MODEL' | 'APPLY_STYLE' | 'BATCH_UPDATE'
  previousValue: any
  newValue: any
  frameIds: string[]
  timestamp: Date
}
\`\`\`

## UI/UX Considerations
- Collapsible sections for organization
- Visual previews for style/model changes
- Real-time validation feedback
- Tooltips for complex options
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- Auto-save indicator

## API Endpoints to Consume
- PATCH /api/v1/frames/:id
- POST /api/v1/frames/batch-update
- GET /api/v1/models
- GET /api/v1/styles
- GET /api/v1/teams/:id/characters

## Dependencies
- Timeline visualization complete

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 3 days" \
  --label "frontend,frame-editor,ui,components,p0-critical" \
  --milestone "MVP-Foundation"

# Issue 9: Create Style Stack Builder UI
gh issue create \
  --title "[Frontend] Style Stack: Build Style Stack Creation and Management Interface" \
  --body "## Description
Implement the Style Stack builder interface allowing users to create, edit, and apply consistent visual styles across their sequences.

## Acceptance Criteria
- [ ] Style Stack creation wizard
- [ ] JSON editor with schema validation
- [ ] Visual preview of style parameters
- [ ] Style Stack library grid view
- [ ] Quick apply to frames/sequences
- [ ] Style Stack versioning interface
- [ ] Import/export Style Stack JSON
- [ ] Model compatibility indicators
- [ ] Template gallery with presets

## Technical Approach
- Step-by-step wizard for creation
- Monaco Editor for JSON editing
- Real-time preview using sample prompts
- Grid layout with lazy loading
- Optimistic updates for quick apply

## Component Structure
\`\`\`
/src/components/style-stack/
  ├── style-stack-builder.tsx (creation wizard)
  ├── style-stack-editor.tsx (JSON editor)
  ├── style-stack-preview.tsx (visual preview)
  ├── style-stack-library.tsx (grid view)
  ├── style-stack-card.tsx (individual style)
  ├── style-stack-applicator.tsx (apply UI)
  ├── style-stack-templates.tsx (preset gallery)
  └── style-compatibility-badge.tsx (model support)

/src/hooks/style-stack/
  ├── use-style-stack.ts
  ├── use-style-preview.ts
  └── use-style-templates.ts
\`\`\`

## Builder State
\`\`\`typescript
interface StyleStackBuilderState {
  currentStep: number
  styleData: {
    name: string
    description: string
    basePrompt: string
    negativePrompt: string
    modelSettings: Record<string, ModelConfig>
    colorPalette: Color[]
    moodKeywords: string[]
  }
  validation: ValidationResult
  previewUrl: string | null
}
\`\`\`

## UI/UX Considerations
- Guided creation process
- Live JSON validation with error highlighting
- Side-by-side editor and preview
- Searchable template gallery
- Clear model compatibility indicators
- Responsive grid layout

## API Endpoints to Consume
- POST /api/v1/styles
- GET /api/v1/styles
- PATCH /api/v1/styles/:id
- POST /api/v1/styles/preview
- GET /api/v1/styles/templates

## Dependencies
- Frame editor complete

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 5 days" \
  --label "frontend,style-stack,ui,components,p0-critical" \
  --milestone "MVP-Foundation"

### Week 5-6: AI Generation Pipeline

# Issue 10: Build Generation Status and Progress UI
gh issue create \
  --title "[Frontend] Generation: Create Real-time Generation Status Interface" \
  --body "## Description
Implement comprehensive generation status UI with real-time updates, progress tracking, and error handling for AI generation pipeline.

## Acceptance Criteria
- [ ] Generation queue display with position indicator
- [ ] Real-time progress bars for each frame
- [ ] Estimated time remaining calculations
- [ ] Generation history with filters
- [ ] Error state handling with retry options
- [ ] Cancel generation functionality
- [ ] Batch generation status overview
- [ ] Credit consumption tracking
- [ ] Success notifications with thumbnails
- [ ] Mobile-optimized status cards

## Technical Approach
- Supabase Realtime for status updates
- Progress calculation based on historical data
- Exponential backoff for retries
- Toast notifications for completion
- Virtual scrolling for history

## Component Structure
\`\`\`
/src/components/generation/
  ├── generation-queue.tsx (queue display)
  ├── generation-progress.tsx (progress bars)
  ├── generation-status-card.tsx (individual status)
  ├── generation-history.tsx (past generations)
  ├── generation-error.tsx (error handling)
  ├── generation-actions.tsx (cancel/retry)
  ├── credit-meter.tsx (credit tracking)
  └── generation-notifications.tsx (toast system)

/src/hooks/generation/
  ├── use-generation-status.ts
  ├── use-generation-queue.ts
  ├── use-generation-history.ts
  └── use-realtime-updates.ts
\`\`\`

## Generation State
\`\`\`typescript
interface GenerationState {
  queue: QueueItem[]
  activeGenerations: Map<string, GenerationProgress>
  history: GenerationRecord[]
  errors: GenerationError[]
  creditBalance: number
  estimatedCredits: number
}

interface GenerationProgress {
  frameId: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  progress: number
  estimatedTime: number
  startedAt: Date
  model: string
}
\`\`\`

## UI/UX Considerations
- Smooth progress animations
- Clear queue position indicators
- Non-blocking error messages
- Persistent progress during navigation
- Sound notification option
- Accessibility for screen readers

## API Endpoints to Consume
- GET /api/v1/generation/queue
- GET /api/v1/generation/status/:id
- POST /api/v1/generation/cancel/:id
- POST /api/v1/generation/retry/:id
- WebSocket: /api/v1/generation/realtime

## Dependencies
- Frame editor complete
- Supabase Realtime configured

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 3 days" \
  --label "frontend,generation,realtime,ui,p0-critical" \
  --milestone "MVP-Foundation"

### Week 6-7: Credit System & UI

# Issue 11: Create Credit System UI Components
gh issue create \
  --title "[Frontend] Credits: Build Credit Management and Purchase Interface" \
  --body "## Description
Implement complete credit system UI including balance display, consumption tracking, purchase flow, and subscription management.

## Acceptance Criteria
- [ ] Persistent credit balance display in header
- [ ] Credit consumption calculator before generation
- [ ] Credit purchase modal with pack options
- [ ] Subscription management interface
- [ ] Usage history with detailed breakdown
- [ ] Low credit warnings
- [ ] Credit transfer between team members
- [ ] Invoice download functionality
- [ ] Mobile-optimized purchase flow

## Technical Approach
- Global credit balance using TanStack Query
- Stripe Elements for payment
- Optimistic credit deduction with rollback
- Chart.js for usage visualization
- PDF generation for invoices

## Component Structure
\`\`\`
/src/components/credits/
  ├── credit-balance.tsx (header display)
  ├── credit-calculator.tsx (pre-generation estimate)
  ├── credit-purchase-modal.tsx (buy credits)
  ├── subscription-manager.tsx (plan management)
  ├── credit-usage-chart.tsx (visualization)
  ├── credit-history-table.tsx (transaction log)
  ├── credit-alerts.tsx (low balance warnings)
  ├── payment-form.tsx (Stripe Elements)
  └── invoice-list.tsx (billing history)

/src/hooks/credits/
  ├── use-credit-balance.ts
  ├── use-credit-estimate.ts
  ├── use-subscription.ts
  └── use-payment.ts
\`\`\`

## Credit State
\`\`\`typescript
interface CreditState {
  balance: number
  pendingCharges: number
  subscription: Subscription | null
  usageHistory: CreditTransaction[]
  estimatedCost: number
}

interface CreditTransaction {
  id: string
  type: 'purchase' | 'consumption' | 'refund' | 'bonus'
  amount: number
  description: string
  timestamp: Date
  metadata: Record<string, any>
}
\`\`\`

## UI/UX Considerations
- Always visible credit balance
- Clear pricing information
- Secure payment form
- Transaction history filtering
- Export usage data as CSV
- Subscription comparison table

## API Endpoints to Consume
- GET /api/v1/credits/balance
- POST /api/v1/credits/estimate
- POST /api/v1/credits/purchase
- GET /api/v1/subscriptions
- POST /api/v1/subscriptions/update
- GET /api/v1/billing/invoices

## Dependencies
- Stripe integration ready

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 3 days" \
  --label "frontend,credits,payment,ui,p0-critical" \
  --milestone "MVP-Foundation"

# Issue 12: Build Main Dashboard Interface
gh issue create \
  --title "[Frontend] Dashboard: Create Main Dashboard and Navigation" \
  --body "## Description
Implement the main dashboard interface serving as the application's home with navigation, recent activity, and quick actions.

## Acceptance Criteria
- [ ] Responsive navigation bar with team switcher
- [ ] Dashboard grid with sequence cards
- [ ] Recent generations display
- [ ] Quick action buttons (New Sequence, Import Script)
- [ ] Activity feed for team actions
- [ ] Search and filter functionality
- [ ] Empty states with CTAs
- [ ] Mobile navigation drawer
- [ ] Breadcrumb navigation
- [ ] User menu with profile/logout

## Technical Approach
- CSS Grid for responsive layout
- Virtualized lists for large datasets
- Skeleton loading states
- Mobile-first responsive design
- URL-based navigation state

## Component Structure
\`\`\`
/src/components/dashboard/
  ├── dashboard-layout.tsx (main container)
  ├── navigation-bar.tsx (top nav)
  ├── navigation-drawer.tsx (mobile menu)
  ├── sequence-grid.tsx (sequence cards)
  ├── sequence-card.tsx (individual item)
  ├── recent-activity.tsx (activity feed)
  ├── quick-actions.tsx (CTA buttons)
  ├── dashboard-search.tsx (search/filter)
  ├── empty-state.tsx (no content)
  └── breadcrumbs.tsx (navigation trail)

/src/hooks/dashboard/
  ├── use-dashboard.ts
  ├── use-navigation.ts
  └── use-search.ts
\`\`\`

## Dashboard State
\`\`\`typescript
interface DashboardState {
  sequences: Sequence[]
  recentActivity: Activity[]
  filters: {
    search: string
    status: Status[]
    dateRange: [Date, Date]
  }
  view: 'grid' | 'list'
  sortBy: 'recent' | 'name' | 'modified'
}
\`\`\`

## UI/UX Considerations
- Fast initial load (skeleton states)
- Responsive grid (auto-fit columns)
- Hover previews for sequences
- Keyboard navigation support
- Persistent view preferences
- Pull-to-refresh on mobile

## API Endpoints to Consume
- GET /api/v1/sequences
- GET /api/v1/activity
- GET /api/v1/teams/:id/stats

## Dependencies
- Authentication complete
- Team management complete

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 3 days" \
  --label "frontend,dashboard,navigation,ui,p0-critical" \
  --milestone "MVP-Foundation"

### Week 7-8: Export & Polish

# Issue 13: Create Export Interface
gh issue create \
  --title "[Frontend] Export: Build Export Options and Download Interface" \
  --body "## Description
Implement comprehensive export interface supporting multiple formats with quality settings and download management.

## Acceptance Criteria
- [ ] Export modal with format selection
- [ ] Quality/resolution settings per format
- [ ] Export progress tracking
- [ ] Download manager with history
- [ ] Preview before export
- [ ] Batch export for multiple sequences
- [ ] Export queue management
- [ ] Format-specific options (fps, codec, etc.)
- [ ] Mobile download handling

## Technical Approach
- Step-by-step export wizard
- Background export processing
- Browser download API management
- IndexedDB for export history
- Service worker for large downloads

## Component Structure
\`\`\`
/src/components/export/
  ├── export-modal.tsx (main interface)
  ├── export-format-selector.tsx (format choice)
  ├── export-settings.tsx (quality options)
  ├── export-preview.tsx (pre-export preview)
  ├── export-progress.tsx (progress tracking)
  ├── export-queue.tsx (queue management)
  ├── download-manager.tsx (download history)
  └── export-batch.tsx (multiple exports)

/src/hooks/export/
  ├── use-export.ts
  ├── use-download.ts
  └── use-export-queue.ts
\`\`\`

## Export State
\`\`\`typescript
interface ExportState {
  activeExports: Map<string, ExportProgress>
  exportQueue: ExportJob[]
  downloadHistory: Download[]
  settings: ExportSettings
}

interface ExportSettings {
  format: 'mp4' | 'mov' | 'webm' | 'gif' | 'image-sequence'
  resolution: '1080p' | '720p' | '480p' | '4k'
  fps: 24 | 30 | 60
  quality: 'low' | 'medium' | 'high' | 'maximum'
  codec: string
}
\`\`\`

## UI/UX Considerations
- Clear format descriptions
- Size estimates before export
- Resume failed downloads
- Background export indicator
- Format compatibility warnings

## API Endpoints to Consume
- POST /api/v1/export/video
- POST /api/v1/export/images
- GET /api/v1/export/status/:id
- GET /api/v1/export/download/:id

## Dependencies
- Generation pipeline complete

## Estimated Complexity
**Story Points**: 5
**Time Estimate**: 2 days" \
  --label "frontend,export,ui,p1-high" \
  --milestone "MVP-Foundation"

### Mobile Responsive Views

# Issue 14: Implement Mobile-First Responsive Design
gh issue create \
  --title "[Frontend] Mobile: Create Mobile-Optimized Responsive Views" \
  --body "## Description
Ensure all components and views are fully responsive with mobile-first design, providing optimal experience on phones and tablets.

## Acceptance Criteria
- [ ] Touch-friendly interface elements (44px minimum touch targets)
- [ ] Responsive navigation with drawer pattern
- [ ] Mobile-optimized timeline (vertical layout)
- [ ] Simplified frame editor for mobile
- [ ] Gesture support (swipe, pinch-zoom)
- [ ] Mobile-specific loading states
- [ ] Responsive data tables (card view on mobile)
- [ ] Optimized image loading for mobile bandwidth
- [ ] PWA configuration for installability
- [ ] Viewport meta tag optimization

## Technical Approach
- CSS Grid and Flexbox for layouts
- Container queries for component responsiveness
- Touch event handlers for gestures
- Responsive images with srcset
- Service worker for offline capability

## Component Updates Needed
\`\`\`
- Navigation → Drawer pattern on mobile
- Timeline → Vertical scrolling on mobile
- Frame Editor → Bottom sheet pattern
- Dashboard Grid → Single column on mobile
- Tables → Card view transformation
- Modals → Full-screen on mobile
- Forms → Stacked layout
\`\`\`

## Mobile Breakpoints
\`\`\`css
/* Mobile first approach */
/* Base: 0-639px (mobile) */
/* sm: 640px+ (large mobile/tablet) */
/* md: 768px+ (tablet) */
/* lg: 1024px+ (desktop) */
/* xl: 1280px+ (large desktop) */
\`\`\`

## UI/UX Considerations
- Fast touch response (100ms max)
- Momentum scrolling
- Pull-to-refresh patterns
- Bottom navigation for key actions
- Reduced animations on low-end devices
- Offline mode indicators

## Testing Requirements
- iPhone SE (375px) minimum
- iPad portrait/landscape
- Android various screen sizes
- Touch interaction testing
- Performance on 3G networks

## Dependencies
- All core components complete

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 3 days" \
  --label "frontend,mobile,responsive,ui,p0-critical" \
  --milestone "MVP-Foundation"

### Performance & Polish

# Issue 15: Implement Performance Optimizations
gh issue create \
  --title "[Frontend] Performance: Optimize Bundle Size and Runtime Performance" \
  --body "## Description
Implement comprehensive performance optimizations to ensure fast load times and smooth interactions across all devices.

## Acceptance Criteria
- [ ] Bundle size under 200KB (initial)
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Code splitting implemented
- [ ] Image optimization with next/image
- [ ] Font optimization with next/font
- [ ] React component memoization
- [ ] Virtual scrolling for long lists
- [ ] Debounced/throttled event handlers
- [ ] Lighthouse score > 90

## Technical Approach
- Dynamic imports for code splitting
- React.memo for expensive components
- useMemo/useCallback where appropriate
- Intersection Observer for lazy loading
- Web Workers for heavy computations

## Optimization Areas
\`\`\`
/src/optimizations/
  ├── lazy-routes.ts (route-based splitting)
  ├── lazy-components.ts (component splitting)
  ├── image-loader.ts (optimized loading)
  ├── virtual-list.ts (virtualization)
  └── web-workers/ (background processing)
\`\`\`

## Performance Monitoring
\`\`\`typescript
// Performance tracking
interface PerformanceMetrics {
  FCP: number // First Contentful Paint
  LCP: number // Largest Contentful Paint
  FID: number // First Input Delay
  CLS: number // Cumulative Layout Shift
  TTI: number // Time to Interactive
}
\`\`\`

## Bundle Analysis
- Implement bundle analyzer
- Remove unused dependencies
- Tree-shaking verification
- Minimize third-party scripts
- Optimize critical CSS

## Dependencies
- All features complete

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 3 days" \
  --label "frontend,performance,optimization,p1-high" \
  --milestone "MVP-Foundation"

---

## Milestone 2: Production Ready (Months 3-4)

### Marketplace Features

# Issue 16: Build Style Stack Marketplace UI
gh issue create \
  --title "[Frontend] Marketplace: Create Style Stack Marketplace Interface" \
  --body "## Description
Implement complete marketplace interface for browsing, purchasing, and managing Style Stacks with seller dashboard.

## Acceptance Criteria
- [ ] Marketplace homepage with featured styles
- [ ] Advanced search with filters
- [ ] Style preview with example generations
- [ ] Purchase flow with credit transactions
- [ ] User ratings and reviews
- [ ] Seller dashboard with analytics
- [ ] Style submission workflow
- [ ] Category browsing
- [ ] Trending and popular sections
- [ ] Mobile-optimized marketplace

## Technical Approach
- Algolia for search (if needed)
- Infinite scroll for browsing
- Optimistic purchase updates
- Real-time popularity tracking
- Server-side filtering

## Component Structure
\`\`\`
/src/components/marketplace/
  ├── marketplace-home.tsx
  ├── marketplace-search.tsx
  ├── style-listing-card.tsx
  ├── style-detail-modal.tsx
  ├── purchase-dialog.tsx
  ├── seller-dashboard.tsx
  ├── style-submit-form.tsx
  ├── review-system.tsx
  └── trending-styles.tsx
\`\`\`

## Dependencies
- Style Stack system complete

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 5 days" \
  --label "frontend,marketplace,ui,p1-high" \
  --milestone "Production-Ready"

### Collaboration Features

# Issue 17: Implement Real-time Collaboration UI
gh issue create \
  --title "[Frontend] Collaboration: Build Real-time Collaboration Features" \
  --body "## Description
Implement real-time collaboration features including comments, presence, and version history for team workflows.

## Acceptance Criteria
- [ ] Real-time cursor presence
- [ ] Frame commenting system
- [ ] Version history browser
- [ ] Change tracking display
- [ ] Live activity indicators
- [ ] Conflict resolution UI
- [ ] @mentions in comments
- [ ] Notification center
- [ ] Diff viewer for changes

## Technical Approach
- Supabase Realtime for presence
- Operational Transform for conflicts
- Virtual scrolling for history
- Rich text editor for comments

## Component Structure
\`\`\`
/src/components/collaboration/
  ├── presence-indicators.tsx
  ├── comment-thread.tsx
  ├── version-history.tsx
  ├── change-tracker.tsx
  ├── activity-feed.tsx
  ├── notification-center.tsx
  └── diff-viewer.tsx
\`\`\`

## Dependencies
- Team system complete

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 5 days" \
  --label "frontend,collaboration,realtime,p1-high" \
  --milestone "Production-Ready"

---

## Milestone 3: Scale & Innovation (Months 5-6)

### Advanced Features

# Issue 18: Build Advanced Analytics Dashboard
gh issue create \
  --title "[Frontend] Analytics: Create Advanced Analytics and Insights Dashboard" \
  --body "## Description
Implement comprehensive analytics dashboard for usage tracking, performance metrics, and business insights.

## Acceptance Criteria
- [ ] Usage charts and graphs
- [ ] Generation success metrics
- [ ] Credit consumption analytics
- [ ] Team activity reports
- [ ] Export data functionality
- [ ] Custom date ranges
- [ ] Comparative analysis
- [ ] Predictive insights

## Technical Approach
- Chart.js or Recharts for visualizations
- Data aggregation on backend
- CSV/PDF export capability
- Dashboard customization

## Component Structure
\`\`\`
/src/components/analytics/
  ├── analytics-dashboard.tsx
  ├── usage-charts.tsx
  ├── metric-cards.tsx
  ├── report-generator.tsx
  └── insight-panels.tsx
\`\`\`

## Dependencies
- Data collection implemented

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 3 days" \
  --label "frontend,analytics,dashboard,p2-medium" \
  --milestone "Scale-Innovation"

# Issue 19: Implement Progressive Web App Features
gh issue create \
  --title "[Frontend] PWA: Add Progressive Web App Capabilities" \
  --body "## Description
Transform the application into a full Progressive Web App with offline support and native-like features.

## Acceptance Criteria
- [ ] Service worker for offline mode
- [ ] App manifest configuration
- [ ] Install prompts
- [ ] Push notifications
- [ ] Background sync
- [ ] Offline data persistence
- [ ] Update notifications
- [ ] Native app shortcuts

## Technical Approach
- Workbox for service worker
- IndexedDB for offline storage
- Web Push API for notifications
- Background Sync API

## Dependencies
- Core app complete

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 3 days" \
  --label "frontend,pwa,mobile,p2-medium" \
  --milestone "Scale-Innovation"

---

## Testing & Quality

# Issue 20: Implement Comprehensive Frontend Testing
gh issue create \
  --title "[Frontend] Testing: Create Complete Frontend Test Suite" \
  --body "## Description
Implement comprehensive testing strategy including unit tests, integration tests, and E2E tests for all frontend components.

## Acceptance Criteria
- [ ] Unit tests for all components (>80% coverage)
- [ ] Integration tests for key flows
- [ ] E2E tests for critical paths
- [ ] Visual regression tests
- [ ] Accessibility testing
- [ ] Performance testing
- [ ] Cross-browser testing
- [ ] Mobile device testing

## Technical Approach
- Vitest for unit/integration tests
- Playwright for E2E tests
- Chromatic for visual regression
- axe-core for accessibility

## Test Structure
\`\`\`
/src/__tests__/
  ├── unit/ (component tests)
  ├── integration/ (flow tests)
  ├── e2e/ (end-to-end)
  └── utils/ (test helpers)
\`\`\`

## Dependencies
- Components complete

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 5 days" \
  --label "frontend,testing,qa,p0-critical" \
  --milestone "MVP-Foundation"

---

## How to Create All Issues

Run this script to create all frontend issues:

\`\`\`bash
#!/bin/bash
# Create all frontend issues for Velro.ai

# First, ensure you're in the right repository
gh repo set-default velro-ai/velro

# Create milestones if they don't exist
gh milestone create --title "MVP-Foundation" --description "Weeks 1-8: Core functionality"
gh milestone create --title "Production-Ready" --description "Months 3-4: Marketplace and collaboration"
gh milestone create --title "Scale-Innovation" --description "Months 5-6: Enterprise and mobile"

# Then run each gh issue create command above
# The commands are formatted for direct execution
\`\`\`

## Issue Summary

Total Frontend Issues: 20

By Priority:
- P0-Critical: 14 issues (MVP foundation)
- P1-High: 4 issues (Production features)
- P2-Medium: 2 issues (Scale features)

By Complexity:
- 13 points: 4 issues
- 8 points: 9 issues
- 5 points: 5 issues
- 3 points: 2 issues

Total Story Points: 145
Estimated Timeline: 8 weeks for MVP

## Labels to Create

\`\`\`bash
# Create frontend-specific labels
gh label create "frontend" --description "Frontend development" --color "0e8a16"
gh label create "ui" --description "User interface" --color "d4c5f9"
gh label create "components" --description "React components" --color "f9d0c4"
gh label create "state-management" --description "State and data flow" --color "fef2c0"
gh label create "responsive" --description "Responsive design" --color "c5def5"
gh label create "mobile" --description "Mobile specific" --color "bfd4f2"
gh label create "performance" --description "Performance optimization" --color "fbca04"
gh label create "realtime" --description "Real-time features" --color "5319e7"
gh label create "testing" --description "Test coverage" --color "0052cc"
\`\`\`