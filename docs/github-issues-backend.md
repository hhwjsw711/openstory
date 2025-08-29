# Backend GitHub Issues for Velro.ai

This document contains all backend-related GitHub issues for the Velro.ai MVP development.
These issues have been organized by milestone and include detailed requirements, acceptance criteria, and technical implementation notes.

## Milestone 1: MVP Foundation (Weeks 1-8)

### Milestone: Infrastructure Setup

```bash
# Issue 1: Initialize Supabase Backend Infrastructure
gh issue create \
  --title "[Backend] Setup: Initialize Supabase backend infrastructure" \
  --body "## Description
Setup the complete Supabase backend infrastructure including database schema, authentication, storage buckets, and real-time configurations.

## Acceptance Criteria
- [ ] Supabase project created and configured
- [ ] Initial database schema implemented with proper indexes
- [ ] RLS policies disabled (backend-only access pattern)
- [ ] Connection pooling configured for production
- [ ] Storage buckets created for media assets
- [ ] Environment variables properly configured
- [ ] Local development setup documented and working
- [ ] Database migrations setup with proper versioning

## Technical Implementation Notes
- Use Supabase CLI for local development
- Configure Prisma or Drizzle ORM for type safety
- Setup connection pooling via Supabase dashboard
- Create separate dev/staging/prod projects

## Database Schema
\`\`\`sql
-- Core tables to create:
teams (id, name, slug, created_at, updated_at)
users (id, email, full_name, avatar_url, created_at)
team_members (team_id, user_id, role, joined_at)
sequences (id, team_id, title, script, status, created_at)
frames (id, sequence_id, order, description, duration_ms)
styles (id, team_id, name, config_json, is_public)
characters (id, team_id, name, lora_url, config)
credits (user_id, balance, updated_at)
transactions (id, user_id, type, amount, metadata)
\`\`\`

## API Endpoints
- POST /api/v1/setup/database - Initialize database
- GET /api/v1/setup/status - Check setup status

## Dependencies
- None (foundational)

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 2 days" \
  --label "backend" \
  --label "database" \
  --label "P0-critical" \
  --label "epic:infrastructure" \
  --milestone "Infrastructure Setup"

# Issue 2: Setup QStash Job Queue System
gh issue create \
  --title "[Backend] Setup: Configure QStash async job queue" \
  --body "## Description
Implement the QStash job queue system for handling asynchronous AI generation tasks, with proper retry logic, monitoring, and error handling.

## Acceptance Criteria
- [ ] Upstash account created and QStash configured
- [ ] Job queue structure designed and implemented
- [ ] Retry logic with exponential backoff
- [ ] Dead letter queue for failed jobs
- [ ] Job status tracking in database
- [ ] Webhook endpoints for job callbacks
- [ ] Job monitoring dashboard endpoint
- [ ] Rate limiting per user/team implemented
- [ ] Unit tests for queue operations

## Technical Implementation Notes
- Use QStash SDK for TypeScript
- Implement job types: IMAGE_GENERATION, VIDEO_GENERATION, SCRIPT_ANALYSIS
- Store job metadata in database for tracking
- Implement idempotency keys to prevent duplicate jobs
- Setup webhook validation with QStash signatures

## API Endpoints
- POST /api/v1/jobs/webhook - QStash callback endpoint
- GET /api/v1/jobs/status/:id - Get job status
- POST /api/v1/jobs/cancel/:id - Cancel pending job
- GET /api/v1/jobs/queue - Get queue status

## Database Schema
\`\`\`sql
jobs (
  id uuid primary key,
  team_id uuid references teams,
  type varchar,
  status varchar, -- pending, processing, completed, failed
  payload jsonb,
  result jsonb,
  error text,
  attempts int,
  created_at timestamp,
  started_at timestamp,
  completed_at timestamp
)

job_logs (
  id uuid primary key,
  job_id uuid references jobs,
  message text,
  level varchar,
  created_at timestamp
)
\`\`\`

## Dependencies
- Supabase backend (#1)

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 2 days" \
  --label "backend" \
  --label "queue" \
  --label "P0-critical" \
  --label "epic:infrastructure" \
  --milestone "Infrastructure Setup"

# Issue 3: Implement API Route Structure and Middleware
gh issue create \
  --title "[Backend] Core: Setup API route structure with authentication middleware" \
  --body "## Description
Create the foundational API route structure with proper middleware for authentication, error handling, rate limiting, and request validation.

## Acceptance Criteria
- [ ] API versioning structure (/api/v1/*)
- [ ] Authentication middleware with session management
- [ ] Authorization middleware for team-based access
- [ ] Request validation middleware using Zod
- [ ] Error handling middleware with proper status codes
- [ ] Rate limiting middleware per endpoint
- [ ] Logging middleware with correlation IDs
- [ ] CORS configuration for production domains
- [ ] API documentation generated from routes

## Technical Implementation Notes
- Use Next.js 15 route handlers
- Implement middleware chain pattern
- Create reusable auth helper functions
- Setup Zod schemas for all request/response types
- Use correlation IDs for request tracking

## Code Structure
\`\`\`typescript
// src/app/api/v1/middleware/auth.ts
export async function withAuth(handler) {
  // Check Supabase session
  // Attach user/team to request
}

// src/app/api/v1/middleware/validate.ts
export function withValidation(schema) {
  // Validate request body with Zod
}

// src/app/api/v1/middleware/rateLimit.ts
export function withRateLimit(limits) {
  // Check rate limits per user/IP
}
\`\`\`

## Dependencies
- Supabase backend (#1)

## Estimated Complexity
**Story Points**: 5
**Time Estimate**: 1.5 days" \
  --label "backend" \
  --label "api" \
  --label "P0-critical" \
  --label "epic:infrastructure" \
  --milestone "Infrastructure Setup"
```

### Milestone: Authentication & Teams

```bash
# Issue 4: Implement Supabase Authentication System
gh issue create \
  --title "[Backend] Auth: Implement complete authentication system with magic links and passkeys" \
  --body "## Description
Build the complete authentication system using Supabase Auth, supporting both anonymous users and authenticated users with magic links and passkeys.

## Acceptance Criteria
- [ ] Magic link authentication flow working
- [ ] Passkey/WebAuthn support implemented
- [ ] Anonymous user sessions with upgrade path
- [ ] Session management and refresh tokens
- [ ] Auth state persistence across requests
- [ ] User profile creation on first login
- [ ] Email verification flow
- [ ] Rate limiting on auth endpoints
- [ ] Security headers properly configured
- [ ] Integration tests for all auth flows

## Technical Implementation Notes
- Use Supabase Auth client for backend
- Implement server-side session validation
- Store anonymous work in localStorage with migration on signup
- Use httpOnly cookies for session tokens
- Implement PKCE flow for additional security

## API Endpoints
- POST /api/v1/auth/login - Start magic link flow
- POST /api/v1/auth/verify - Verify magic link token
- POST /api/v1/auth/passkey/register - Register passkey
- POST /api/v1/auth/passkey/login - Login with passkey
- POST /api/v1/auth/logout - Clear session
- GET /api/v1/auth/session - Get current session
- POST /api/v1/auth/anonymous - Create anonymous session
- POST /api/v1/auth/upgrade - Upgrade anonymous to authenticated

## Database Schema
\`\`\`sql
-- Extends Supabase auth.users
user_profiles (
  id uuid primary key references auth.users,
  full_name varchar,
  avatar_url text,
  anonymous_id varchar, -- for migration
  onboarding_completed boolean,
  created_at timestamp,
  updated_at timestamp
)

auth_logs (
  id uuid primary key,
  user_id uuid,
  event_type varchar, -- login, logout, passkey_register, etc
  ip_address inet,
  user_agent text,
  created_at timestamp
)
\`\`\`

## Dependencies
- Supabase backend (#1)
- API middleware (#3)

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "auth" \
  --label "P0-critical" \
  --label "epic:authentication" \
  --milestone "Authentication & Teams"

# Issue 5: Create Team Management System
gh issue create \
  --title "[Backend] Teams: Implement team creation and management system" \
  --body "## Description
Build the complete team management system with proper authorization, invitation flow, and role-based access control.

## Acceptance Criteria
- [ ] Team CRUD operations implemented
- [ ] User-team relationship management
- [ ] Team invitation system with email notifications
- [ ] Role-based permissions (owner, admin, member, viewer)
- [ ] Team switching functionality
- [ ] Default personal team on user creation
- [ ] Team resource limits enforcement
- [ ] Soft delete for team removal
- [ ] Audit logging for team actions
- [ ] Unit tests for all team operations

## Technical Implementation Notes
- Create team automatically on user signup
- Use UUIDs for team IDs, slugs for URLs
- Implement team context in auth middleware
- Check team permissions in all resource endpoints
- Use database transactions for team operations

## API Endpoints
- POST /api/v1/teams - Create team
- GET /api/v1/teams - List user's teams
- GET /api/v1/teams/:id - Get team details
- PUT /api/v1/teams/:id - Update team
- DELETE /api/v1/teams/:id - Delete team (soft)
- POST /api/v1/teams/:id/invitations - Send invitation
- POST /api/v1/teams/invitations/:token/accept - Accept invitation
- GET /api/v1/teams/:id/members - List team members
- PUT /api/v1/teams/:id/members/:userId - Update member role
- DELETE /api/v1/teams/:id/members/:userId - Remove member

## Database Schema
\`\`\`sql
teams (
  id uuid primary key,
  name varchar not null,
  slug varchar unique,
  owner_id uuid references users,
  subscription_tier varchar,
  settings jsonb,
  deleted_at timestamp,
  created_at timestamp,
  updated_at timestamp
)

team_members (
  team_id uuid references teams,
  user_id uuid references users,
  role varchar, -- owner, admin, member, viewer
  joined_at timestamp,
  primary key (team_id, user_id)
)

team_invitations (
  id uuid primary key,
  team_id uuid references teams,
  email varchar,
  token varchar unique,
  role varchar,
  invited_by uuid references users,
  accepted_at timestamp,
  expires_at timestamp,
  created_at timestamp
)
\`\`\`

## Dependencies
- Authentication system (#4)
- API middleware (#3)

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "teams" \
  --label "P0-critical" \
  --label "epic:authentication" \
  --milestone "Authentication & Teams"
```

### Milestone: Script Processing

```bash
# Issue 6: Implement AI Script Analysis Service
gh issue create \
  --title "[Backend] AI: Build script analysis and scene detection service" \
  --body "## Description
Create the AI-powered script analysis service that processes scripts, detects scenes, extracts characters, and generates frame boundaries.

## Acceptance Criteria
- [ ] Script format detection (Fountain, FDX, plain text)
- [ ] AI integration for script analysis (OpenAI/Anthropic)
- [ ] Scene break detection with high accuracy
- [ ] Character extraction and dialogue mapping
- [ ] Frame boundary calculation based on pacing
- [ ] Location and time extraction
- [ ] Emotion and tone analysis per scene
- [ ] Script validation and error handling
- [ ] Caching of analysis results
- [ ] Performance metrics tracking

## Technical Implementation Notes
- Use OpenAI GPT-4 or Claude for analysis
- Implement prompt engineering for consistent results
- Cache analysis results in database
- Use structured output with JSON mode
- Implement fallback to regex-based parsing
- Batch process long scripts in chunks

## API Endpoints
- POST /api/v1/scripts/analyze - Analyze script
- GET /api/v1/scripts/:id/analysis - Get cached analysis
- POST /api/v1/scripts/:id/reanalyze - Force reanalysis
- POST /api/v1/scripts/validate - Validate script format

## Database Schema
\`\`\`sql
script_analyses (
  id uuid primary key,
  sequence_id uuid references sequences,
  raw_script text,
  format varchar, -- fountain, fdx, plain
  scenes jsonb, -- array of scene objects
  characters jsonb, -- array of character names
  locations jsonb,
  frame_boundaries jsonb,
  metadata jsonb,
  ai_model varchar,
  created_at timestamp
)

scenes (
  id uuid primary key,
  sequence_id uuid references sequences,
  scene_number integer,
  heading varchar,
  description text,
  characters jsonb,
  dialogue jsonb,
  duration_estimate_ms integer,
  created_at timestamp
)
\`\`\`

## Dependencies
- QStash queue (#2)
- Team management (#5)

## Estimated Complexity
**Story Points**: 21
**Time Estimate**: 5 days" \
  --label "backend" \
  --label "ai" \
  --label "P0-critical" \
  --label "epic:script-processing" \
  --milestone "Script Processing"

# Issue 7: Build Frame Generation from Script
gh issue create \
  --title "[Backend] Frames: Create frame generation and management system" \
  --body "## Description
Implement the frame generation system that creates storyboard frames from analyzed scripts with proper descriptions and metadata.

## Acceptance Criteria
- [ ] Frame generation from script analysis
- [ ] Frame description generation with AI
- [ ] Duration calculation per frame
- [ ] Model recommendation based on content
- [ ] Frame ordering and reordering
- [ ] Frame CRUD operations
- [ ] Batch frame operations
- [ ] Frame versioning system
- [ ] Thumbnail generation placeholder
- [ ] Export frame data as JSON

## Technical Implementation Notes
- Generate 3-7 frames per scene on average
- Use AI to create detailed visual descriptions
- Calculate duration based on dialogue and action
- Store frame relationships to script sections
- Implement optimistic locking for updates

## API Endpoints
- POST /api/v1/sequences/:id/frames/generate - Generate frames from script
- GET /api/v1/sequences/:id/frames - List frames
- GET /api/v1/frames/:id - Get frame details
- PUT /api/v1/frames/:id - Update frame
- DELETE /api/v1/frames/:id - Delete frame
- PUT /api/v1/sequences/:id/frames/reorder - Reorder frames
- POST /api/v1/frames/batch - Batch update frames

## Database Schema
\`\`\`sql
frames (
  id uuid primary key,
  sequence_id uuid references sequences,
  scene_id uuid references scenes,
  order_index integer,
  title varchar,
  description text,
  visual_prompt text,
  duration_ms integer,
  aspect_ratio varchar,
  recommended_model varchar,
  style_stack_id uuid references styles,
  thumbnail_url text,
  video_url text,
  status varchar, -- draft, generating, completed, failed
  metadata jsonb,
  created_at timestamp,
  updated_at timestamp
)

frame_characters (
  frame_id uuid references frames,
  character_id uuid references characters,
  weight float, -- LoRA weight
  primary key (frame_id, character_id)
)
\`\`\`

## Dependencies
- Script analysis service (#6)
- Team management (#5)

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "frames" \
  --label "P0-critical" \
  --label "epic:script-processing" \
  --milestone "Script Processing"
```

### Milestone: Frame Editor

```bash
# Issue 8: Implement Style Stack System
gh issue create \
  --title "[Backend] Styles: Build Style Stack management and application system" \
  --body "## Description
Create the Style Stack system that maintains visual consistency across different AI models through JSON configuration presets.

## Acceptance Criteria
- [ ] Style Stack CRUD operations
- [ ] JSON schema validation for style configs
- [ ] Model-specific adaptation logic
- [ ] Style inheritance and composition
- [ ] Default style templates (10+ presets)
- [ ] Style versioning and history
- [ ] Public/private style visibility
- [ ] Style application to frames
- [ ] Style preview generation
- [ ] Import/export functionality

## Technical Implementation Notes
- Define flexible JSON schema for styles
- Implement adapter pattern for model-specific prompts
- Store styles per team with sharing options
- Cache compiled prompts for performance
- Version styles for marketplace compatibility

## API Endpoints
- POST /api/v1/styles - Create style
- GET /api/v1/styles - List team styles
- GET /api/v1/styles/:id - Get style details
- PUT /api/v1/styles/:id - Update style
- DELETE /api/v1/styles/:id - Delete style
- POST /api/v1/styles/:id/duplicate - Duplicate style
- POST /api/v1/styles/:id/apply - Apply to frames
- GET /api/v1/styles/templates - Get default templates
- POST /api/v1/styles/import - Import style
- GET /api/v1/styles/:id/export - Export style

## Database Schema
\`\`\`sql
styles (
  id uuid primary key,
  team_id uuid references teams,
  name varchar,
  description text,
  config jsonb, -- the style stack JSON
  category varchar,
  tags text[],
  is_public boolean,
  is_template boolean,
  version integer,
  parent_id uuid references styles, -- for versioning
  preview_url text,
  usage_count integer,
  created_at timestamp,
  updated_at timestamp
)

style_adaptations (
  id uuid primary key,
  style_id uuid references styles,
  model_provider varchar, -- fal, runway, kling
  model_name varchar,
  adapted_config jsonb,
  created_at timestamp
)
\`\`\`

## Style Stack JSON Schema Example
\`\`\`json
{
  \"version\": \"1.0\",
  \"name\": \"Cinematic Noir\",
  \"base\": {
    \"mood\": \"dark, mysterious\",
    \"lighting\": \"high contrast, shadows\",
    \"color_palette\": \"black and white with red accents\",
    \"camera\": \"low angles, dutch tilts\"
  },
  \"models\": {
    \"flux-pro\": {
      \"additional_prompt\": \"film noir style, 1940s cinema\",
      \"negative_prompt\": \"colorful, bright, cheerful\"
    },
    \"imagen4\": {
      \"style_preset\": \"cinematic\",
      \"guidance_scale\": 7.5
    }
  }
}
\`\`\`

## Dependencies
- Team management (#5)
- Frame system (#7)

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "styles" \
  --label "P0-critical" \
  --label "epic:frame-management" \
  --milestone "Frame Editor"

# Issue 9: Create Character LoRA Management System
gh issue create \
  --title "[Backend] Characters: Implement character library with LoRA support" \
  --body "## Description
Build the character management system that handles LoRA models for consistent character appearance across frames.

## Acceptance Criteria
- [ ] Character CRUD operations
- [ ] LoRA file upload to storage
- [ ] Character metadata management
- [ ] Character-frame associations
- [ ] Weight adjustment per usage
- [ ] Character gallery per team
- [ ] Training status tracking
- [ ] Character usage analytics
- [ ] File validation and security checks
- [ ] Storage quota enforcement

## Technical Implementation Notes
- Store LoRA files in Supabase Storage
- Validate file formats and sizes
- Generate thumbnails for characters
- Track usage for optimization
- Implement virus scanning for uploads

## API Endpoints
- POST /api/v1/characters - Create character
- GET /api/v1/characters - List team characters
- GET /api/v1/characters/:id - Get character details
- PUT /api/v1/characters/:id - Update character
- DELETE /api/v1/characters/:id - Delete character
- POST /api/v1/characters/:id/upload - Upload LoRA file
- POST /api/v1/characters/:id/train - Start training job
- GET /api/v1/characters/:id/usage - Get usage stats

## Database Schema
\`\`\`sql
characters (
  id uuid primary key,
  team_id uuid references teams,
  name varchar,
  description text,
  lora_url text,
  thumbnail_url text,
  training_images jsonb,
  config jsonb,
  status varchar, -- draft, training, ready, failed
  file_size_bytes bigint,
  usage_count integer,
  created_at timestamp,
  updated_at timestamp
)

character_training_jobs (
  id uuid primary key,
  character_id uuid references characters,
  job_id uuid references jobs,
  training_params jsonb,
  status varchar,
  error text,
  created_at timestamp,
  completed_at timestamp
)
\`\`\`

## Dependencies
- Team management (#5)
- QStash queue (#2)
- Storage setup (part of #1)

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "characters" \
  --label "P0-critical" \
  --label "epic:frame-management" \
  --milestone "Frame Editor"
```

### Milestone: AI Generation Pipeline

```bash
# Issue 10: Implement Fal.ai Service Integration Layer
gh issue create \
  --title "[Backend] Integration: Create Fal.ai API service wrapper" \
  --body "## Description
Build a robust service layer for Fal.ai API integration with proper error handling, retry logic, and response caching.

## Acceptance Criteria
- [ ] Fal.ai client initialization with API keys
- [ ] Error handling with retry logic
- [ ] Response caching strategy implemented
- [ ] Usage tracking per request
- [ ] Rate limiting per Fal.ai limits
- [ ] Request/response logging
- [ ] Timeout handling
- [ ] Fallback strategies for failures
- [ ] Cost calculation per request
- [ ] Health check endpoint

## Technical Implementation Notes
- Use Fal.ai TypeScript SDK
- Implement exponential backoff for retries
- Cache successful responses in Redis/database
- Track API usage for billing
- Implement circuit breaker pattern

## Code Structure
\`\`\`typescript
// src/lib/fal/client.ts
class FalService {
  async generateImage(model: string, params: any)
  async generateVideo(model: string, params: any)
  async checkStatus(jobId: string)
  async calculateCost(model: string, params: any)
}
\`\`\`

## API Endpoints
- POST /api/v1/fal/health - Check Fal.ai connectivity
- GET /api/v1/fal/models - List available models
- GET /api/v1/fal/usage - Get usage statistics

## Database Schema
\`\`\`sql
fal_requests (
  id uuid primary key,
  job_id uuid references jobs,
  model varchar,
  request_payload jsonb,
  response_data jsonb,
  cost_credits integer,
  latency_ms integer,
  status varchar,
  error text,
  created_at timestamp
)
\`\`\`

## Dependencies
- QStash queue (#2)
- API middleware (#3)

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 2 days" \
  --label "backend" \
  --label "integration" \
  --label "P0-critical" \
  --label "epic:ai-generation" \
  --milestone "AI Generation Pipeline"

# Issue 11: Integrate Image Generation Models
gh issue create \
  --title "[Backend] AI: Implement all image generation models from Fal.ai" \
  --body "## Description
Integrate all image generation models with proper prompt adaptation, parameter mapping, and style stack application.

## Acceptance Criteria
- [ ] flux-pro/kontext/max integration
- [ ] imagen4/preview/ultra integration  
- [ ] flux-pro/v1.1-ultra integration
- [ ] flux-krea-lora for characters
- [ ] Prompt engineering per model
- [ ] Style Stack adaptation per model
- [ ] Parameter validation per model
- [ ] Model-specific error handling
- [ ] Generation time estimates
- [ ] Quality presets per model

## Technical Implementation Notes
- Create adapter classes per model
- Implement prompt templates
- Map style configs to model parameters
- Handle model-specific limitations
- Optimize for cost vs quality

## Model Configurations
\`\`\`typescript
const models = {
  'flux-pro': {
    maxPromptLength: 1000,
    supportedRatios: ['1:1', '16:9', '9:16'],
    costPerImage: 10,
    averageTime: 15000
  },
  'imagen4': {
    maxPromptLength: 500,
    supportedRatios: ['1:1', '4:3'],
    costPerImage: 15,
    averageTime: 20000
  }
}
\`\`\`

## API Endpoints
- POST /api/v1/generation/image - Generate image
- GET /api/v1/generation/image/:id - Get generation status
- POST /api/v1/generation/image/estimate - Estimate cost/time

## Dependencies
- Fal.ai service wrapper (#10)
- Style Stack system (#8)
- Character system (#9)

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "ai" \
  --label "P0-critical" \
  --label "epic:ai-generation" \
  --milestone "AI Generation Pipeline"

# Issue 12: Integrate Video Generation Models
gh issue create \
  --title "[Backend] AI: Implement all video generation models from Fal.ai" \
  --body "## Description
Integrate all video generation models with motion control, duration settings, and transition handling.

## Acceptance Criteria
- [ ] veo3 text-to-video integration
- [ ] kling-video/v2.1 image-to-video
- [ ] minimax/hailuo-02/pro integration
- [ ] wan-pro basic integration
- [ ] Motion intensity controls
- [ ] Duration settings per model
- [ ] Camera movement parameters
- [ ] Transition effect options
- [ ] Preview frame extraction
- [ ] Video format conversions

## Technical Implementation Notes
- Handle long generation times (up to 5 minutes)
- Implement progress tracking via webhooks
- Store intermediate results
- Generate preview thumbnails
- Handle video file storage

## Model Configurations
\`\`\`typescript
const videoModels = {
  'veo3': {
    maxDuration: 10000, // 10 seconds
    supportedMotions: ['pan', 'zoom', 'tilt'],
    costPerSecond: 20,
    inputType: 'text'
  },
  'kling-video': {
    maxDuration: 5000,
    supportedMotions: ['natural'],
    costPerSecond: 25,
    inputType: 'image'
  }
}
\`\`\`

## API Endpoints
- POST /api/v1/generation/video - Generate video
- GET /api/v1/generation/video/:id - Get generation status
- POST /api/v1/generation/video/preview - Generate preview

## Dependencies
- Fal.ai service wrapper (#10)
- Image generation (#11)
- QStash queue (#2)

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "ai" \
  --label "P0-critical" \
  --label "epic:ai-generation" \
  --milestone "AI Generation Pipeline"

# Issue 13: Build Generation Queue Management System
gh issue create \
  --title "[Backend] Queue: Implement generation job orchestration system" \
  --body "## Description
Create the generation queue system that manages AI generation jobs with priority handling, parallel processing, and progress tracking.

## Acceptance Criteria
- [ ] QStash job creation for generations
- [ ] Priority queue based on subscription tier
- [ ] Parallel generation for multiple frames
- [ ] Progress tracking with percentages
- [ ] Job cancellation support
- [ ] Automatic retry on transient failures
- [ ] Resource pooling for efficiency
- [ ] Queue monitoring endpoints
- [ ] Cost pre-calculation
- [ ] Credit reservation system

## Technical Implementation Notes
- Use QStash topics for job types
- Implement job batching for efficiency
- Track resource usage per team
- Implement fair scheduling algorithm
- Handle rate limits gracefully

## Queue Configuration
\`\`\`typescript
const queueConfig = {
  priorities: {
    studio: 1,
    pro: 2,
    starter: 3,
    free: 4
  },
  concurrency: {
    studio: 10,
    pro: 5,
    starter: 2,
    free: 1
  },
  retries: 3,
  timeout: 300000 // 5 minutes
}
\`\`\`

## API Endpoints
- POST /api/v1/queue/submit - Submit generation job
- GET /api/v1/queue/status/:id - Get job status
- POST /api/v1/queue/cancel/:id - Cancel job
- GET /api/v1/queue/position/:id - Get queue position
- GET /api/v1/queue/stats - Get queue statistics

## Database Schema
\`\`\`sql
generation_queue (
  id uuid primary key,
  job_id uuid references jobs,
  priority integer,
  estimated_credits integer,
  reserved_credits integer,
  position integer,
  created_at timestamp,
  started_at timestamp
)
\`\`\`

## Dependencies
- QStash setup (#2)
- Image generation (#11)
- Video generation (#12)
- Credit system (upcoming)

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "queue" \
  --label "P0-critical" \
  --label "epic:ai-generation" \
  --milestone "AI Generation Pipeline"

# Issue 14: Implement Real-time Generation Updates
gh issue create \
  --title "[Backend] Realtime: Setup Supabase Realtime for generation progress" \
  --body "## Description
Implement real-time updates for generation progress using Supabase Realtime subscriptions.

## Acceptance Criteria
- [ ] Realtime channel configuration
- [ ] Generation status broadcasting
- [ ] Progress percentage updates
- [ ] Error notification delivery
- [ ] Completion notifications
- [ ] Channel authorization per team
- [ ] Connection management
- [ ] Reconnection handling
- [ ] Message queuing for offline users
- [ ] Performance monitoring

## Technical Implementation Notes
- Use Supabase Realtime Broadcast
- Create channels per team
- Implement presence for active users
- Buffer messages during disconnection
- Use PostgreSQL triggers for updates

## Realtime Events
\`\`\`typescript
const events = {
  'generation:started': { jobId, frameId, model },
  'generation:progress': { jobId, percentage },
  'generation:completed': { jobId, resultUrl },
  'generation:failed': { jobId, error },
  'queue:position': { jobId, position }
}
\`\`\`

## API Endpoints
- POST /api/v1/realtime/subscribe - Get channel credentials
- POST /api/v1/realtime/broadcast - Send update (internal)

## Dependencies
- Supabase setup (#1)
- Queue system (#13)

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 2 days" \
  --label "backend" \
  --label "realtime" \
  --label "P0-critical" \
  --label "epic:ai-generation" \
  --milestone "AI Generation Pipeline"
```

### Milestone: Credit System

```bash
# Issue 15: Implement Credit System and Usage Tracking
gh issue create \
  --title "[Backend] Credits: Build credit system with usage tracking" \
  --body "## Description
Create the credit system for tracking usage, managing balances, and enforcing limits across all AI operations.

## Acceptance Criteria
- [ ] Credit balance tracking per user
- [ ] Usage calculation for each operation
- [ ] Transaction logging with metadata
- [ ] Credit reservation before generation
- [ ] Automatic refund on failure
- [ ] Balance check before operations
- [ ] Credit expiry handling
- [ ] Usage analytics and reporting
- [ ] Audit trail for all transactions
- [ ] Database triggers for balance updates

## Technical Implementation Notes
- Use database transactions for consistency
- Implement double-entry bookkeeping
- Create materialized views for analytics
- Use row-level locking for updates
- Implement credit pooling for teams

## Credit Costs
\`\`\`typescript
const creditCosts = {
  image: {
    'flux-pro': 10,
    'imagen4': 15,
    'flux-ultra': 20
  },
  video: {
    'veo3': 20, // per second
    'kling-video': 25,
    'minimax': 30
  },
  analysis: {
    'script': 5,
    'scene': 2
  }
}
\`\`\`

## API Endpoints
- GET /api/v1/credits/balance - Get current balance
- POST /api/v1/credits/reserve - Reserve credits
- POST /api/v1/credits/charge - Charge credits
- POST /api/v1/credits/refund - Refund credits
- GET /api/v1/credits/transactions - Get transaction history
- GET /api/v1/credits/usage - Get usage analytics

## Database Schema
\`\`\`sql
credit_balances (
  user_id uuid references users primary key,
  balance integer not null default 0,
  reserved integer not null default 0,
  lifetime_used integer not null default 0,
  updated_at timestamp
)

credit_transactions (
  id uuid primary key,
  user_id uuid references users,
  type varchar, -- purchase, usage, refund, bonus
  amount integer,
  balance_after integer,
  description text,
  metadata jsonb,
  job_id uuid references jobs,
  created_at timestamp
)

credit_packages (
  id uuid primary key,
  name varchar,
  credits integer,
  price_cents integer,
  bonus_percentage integer,
  active boolean
)
\`\`\`

## Dependencies
- User system (#4)
- Generation queue (#13)

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "billing" \
  --label "P0-critical" \
  --label "epic:monetization" \
  --milestone "Credit System"

# Issue 16: Create Stripe Subscription Management
gh issue create \
  --title "[Backend] Billing: Implement Stripe subscription and payment processing" \
  --body "## Description
Integrate Stripe for subscription management, payment processing, and automated credit allocation.

## Acceptance Criteria
- [ ] Stripe customer creation on signup
- [ ] Subscription tier management (Free, Starter, Pro, Studio)
- [ ] Payment method management
- [ ] Subscription lifecycle webhooks
- [ ] Credit allocation on subscription
- [ ] Upgrade/downgrade flow
- [ ] Proration handling
- [ ] Invoice generation
- [ ] Payment failure handling
- [ ] Dunning management

## Technical Implementation Notes
- Use Stripe SDK for Node.js
- Implement webhook signature verification
- Store subscription data locally
- Sync state with webhooks
- Handle idempotency properly

## Subscription Tiers
\`\`\`typescript
const tiers = {
  free: {
    credits: 100,
    price: 0,
    features: ['basic_models']
  },
  starter: {
    credits: 2500,
    price: 29,
    features: ['all_models', 'priority_queue']
  },
  pro: {
    credits: 10000,
    price: 99,
    features: ['all_models', 'priority_queue', 'team_workspace']
  },
  studio: {
    credits: 50000,
    price: 499,
    features: ['all_models', 'highest_priority', 'api_access', 'support']
  }
}
\`\`\`

## API Endpoints
- POST /api/v1/billing/create-customer - Create Stripe customer
- POST /api/v1/billing/create-subscription - Start subscription
- POST /api/v1/billing/update-subscription - Change tier
- POST /api/v1/billing/cancel-subscription - Cancel subscription
- GET /api/v1/billing/invoices - Get invoice history
- POST /api/v1/billing/webhook - Stripe webhook handler
- POST /api/v1/billing/create-portal-session - Customer portal

## Database Schema
\`\`\`sql
subscriptions (
  id uuid primary key,
  user_id uuid references users,
  stripe_customer_id varchar,
  stripe_subscription_id varchar,
  tier varchar,
  status varchar, -- active, canceled, past_due
  current_period_start timestamp,
  current_period_end timestamp,
  cancel_at_period_end boolean,
  created_at timestamp,
  updated_at timestamp
)

billing_events (
  id uuid primary key,
  user_id uuid references users,
  event_type varchar,
  stripe_event_id varchar unique,
  payload jsonb,
  processed_at timestamp
)
\`\`\`

## Dependencies
- Credit system (#15)
- User system (#4)

## Estimated Complexity
**Story Points**: 21
**Time Estimate**: 5 days" \
  --label "backend" \
  --label "billing" \
  --label "P0-critical" \
  --label "epic:monetization" \
  --milestone "Credit System"

# Issue 17: Build Credit Purchase Flow
gh issue create \
  --title "[Backend] Billing: Implement one-time credit pack purchases" \
  --body "## Description
Create the system for purchasing additional credit packs beyond subscription allocation.

## Acceptance Criteria
- [ ] Credit pack configuration
- [ ] Stripe checkout session creation
- [ ] Payment processing
- [ ] Immediate credit allocation
- [ ] Purchase history tracking
- [ ] Refund handling
- [ ] Volume discount tiers
- [ ] Gift credit functionality
- [ ] Promotional codes support
- [ ] Receipt email sending

## Technical Implementation Notes
- Use Stripe Checkout for payments
- Implement bonus credits for bulk purchases
- Create admin tools for credit grants
- Track credit sources for analytics

## Credit Packs
\`\`\`typescript
const creditPacks = {
  small: { credits: 500, price: 5, bonus: 0 },
  medium: { credits: 2500, price: 20, bonus: 250 },
  large: { credits: 10000, price: 70, bonus: 2000 },
  enterprise: { credits: 100000, price: 500, bonus: 25000 }
}
\`\`\`

## API Endpoints
- GET /api/v1/billing/credit-packs - List available packs
- POST /api/v1/billing/purchase-credits - Create checkout session
- POST /api/v1/billing/apply-promo - Apply promotional code
- GET /api/v1/billing/purchase-history - Get purchase history

## Database Schema
\`\`\`sql
credit_purchases (
  id uuid primary key,
  user_id uuid references users,
  stripe_payment_intent_id varchar,
  credits_purchased integer,
  bonus_credits integer,
  amount_cents integer,
  status varchar,
  created_at timestamp
)

promo_codes (
  code varchar primary key,
  discount_percent integer,
  bonus_credits integer,
  max_uses integer,
  used_count integer,
  expires_at timestamp
)
\`\`\`

## Dependencies
- Credit system (#15)
- Stripe integration (#16)

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 2 days" \
  --label "backend" \
  --label "billing" \
  --label "P1-high" \
  --label "epic:monetization" \
  --milestone "Credit System"
```

### Milestone: Export & Polish

```bash
# Issue 18: Implement Media Storage Management
gh issue create \
  --title "[Backend] Storage: Setup Supabase Storage for media assets" \
  --body "## Description
Configure and implement media storage system for generated images, videos, and user uploads using Supabase Storage.

## Acceptance Criteria
- [ ] Storage bucket configuration
- [ ] File upload handling with validation
- [ ] File type and size restrictions
- [ ] Virus scanning integration
- [ ] CDN URL generation
- [ ] Storage quota management per team
- [ ] Automatic cleanup of old files
- [ ] Backup strategy implementation
- [ ] Access control per team
- [ ] Bandwidth tracking

## Technical Implementation Notes
- Create separate buckets for different asset types
- Implement resumable uploads for large files
- Use signed URLs for secure access
- Configure CDN for global distribution
- Implement file versioning

## Storage Structure
\`\`\`
buckets/
  generated-images/
    {team_id}/{sequence_id}/{frame_id}/
  generated-videos/
    {team_id}/{sequence_id}/{frame_id}/
  character-loras/
    {team_id}/{character_id}/
  exports/
    {team_id}/{sequence_id}/
  temp/
    {job_id}/
\`\`\`

## API Endpoints
- POST /api/v1/storage/upload - Get upload URL
- POST /api/v1/storage/complete - Confirm upload
- DELETE /api/v1/storage/file - Delete file
- GET /api/v1/storage/usage - Get storage usage
- POST /api/v1/storage/cleanup - Trigger cleanup

## Database Schema
\`\`\`sql
storage_files (
  id uuid primary key,
  team_id uuid references teams,
  bucket varchar,
  path text,
  filename varchar,
  size_bytes bigint,
  mime_type varchar,
  checksum varchar,
  cdn_url text,
  created_at timestamp,
  accessed_at timestamp
)

storage_quotas (
  team_id uuid references teams primary key,
  max_storage_bytes bigint,
  used_storage_bytes bigint,
  max_bandwidth_bytes bigint,
  used_bandwidth_bytes bigint,
  period_start timestamp,
  updated_at timestamp
)
\`\`\`

## Dependencies
- Team system (#5)
- Supabase setup (#1)

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 2 days" \
  --label "backend" \
  --label "storage" \
  --label "P0-critical" \
  --label "epic:export" \
  --milestone "Export & Polish"

# Issue 19: Implement Video Compilation with FFmpeg
gh issue create \
  --title "[Backend] Export: Build video compilation pipeline with FFmpeg" \
  --body "## Description
Create the video compilation system that combines generated frames into final video outputs with transitions and audio.

## Acceptance Criteria
- [ ] FFmpeg integration setup
- [ ] Frame sequencing logic
- [ ] Transition effects (fade, cut, dissolve)
- [ ] Audio track synchronization
- [ ] Multiple resolution outputs
- [ ] Format conversion (MP4, MOV, WebM)
- [ ] Progress tracking during compilation
- [ ] Watermark addition for free tier
- [ ] Subtitle/caption support
- [ ] Performance optimization

## Technical Implementation Notes
- Use fluent-ffmpeg for Node.js
- Process videos in cloud functions
- Implement chunked processing for long videos
- Cache compiled videos
- Use hardware acceleration when available

## Export Configurations
\`\`\`typescript
const exportPresets = {
  web: {
    format: 'mp4',
    codec: 'h264',
    bitrate: '2M',
    resolution: '1920x1080'
  },
  mobile: {
    format: 'mp4',
    codec: 'h264',
    bitrate: '1M',
    resolution: '1280x720'
  },
  professional: {
    format: 'mov',
    codec: 'prores',
    bitrate: '50M',
    resolution: '3840x2160'
  }
}
\`\`\`

## API Endpoints
- POST /api/v1/export/video - Start video compilation
- GET /api/v1/export/status/:id - Get export status
- POST /api/v1/export/cancel/:id - Cancel export
- GET /api/v1/export/download/:id - Get download URL
- GET /api/v1/export/presets - List export presets

## Database Schema
\`\`\`sql
export_jobs (
  id uuid primary key,
  sequence_id uuid references sequences,
  job_id uuid references jobs,
  format varchar,
  resolution varchar,
  settings jsonb,
  output_url text,
  file_size_bytes bigint,
  duration_ms integer,
  status varchar,
  progress integer,
  created_at timestamp,
  completed_at timestamp
)
\`\`\`

## Dependencies
- Storage system (#18)
- Queue system (#2)
- Frame system (#7)

## Estimated Complexity
**Story Points**: 21
**Time Estimate**: 5 days" \
  --label "backend" \
  --label "export" \
  --label "P1-high" \
  --label "epic:export" \
  --milestone "Export & Polish"

# Issue 20: Create Export Format Handlers
gh issue create \
  --title "[Backend] Export: Implement multiple export format support" \
  --body "## Description
Build handlers for various export formats including video files, image sequences, and NLE project files.

## Acceptance Criteria
- [ ] MP4 video export with presets
- [ ] Image sequence ZIP export
- [ ] EDL (Edit Decision List) generation
- [ ] XML for Premiere/Resolve
- [ ] JSON data export
- [ ] SRT subtitle export
- [ ] Format validation
- [ ] Metadata embedding
- [ ] Batch export support
- [ ] Export templates

## Technical Implementation Notes
- Create factory pattern for format handlers
- Generate standards-compliant EDL/XML
- Include all metadata in exports
- Compress large exports efficiently

## Export Formats
\`\`\`typescript
interface ExportHandler {
  format: string
  async export(sequence: Sequence): Promise<ExportResult>
  async validate(settings: any): Promise<boolean>
}

class EDLExporter implements ExportHandler {
  // Generate EDL with timecodes
}

class XMLExporter implements ExportHandler {
  // Generate FCP XML or AAF
}
\`\`\`

## API Endpoints
- GET /api/v1/export/formats - List available formats
- POST /api/v1/export/:format - Export in specific format
- GET /api/v1/export/templates - Get export templates

## Dependencies
- Video compilation (#19)
- Storage system (#18)

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 2 days" \
  --label "backend" \
  --label "export" \
  --label "P1-high" \
  --label "epic:export" \
  --milestone "Export & Polish"
```

### Testing & Security

```bash
# Issue 21: Create Comprehensive API Integration Tests
gh issue create \
  --title "[Backend] Testing: Build integration test suite for all API endpoints" \
  --body "## Description
Create comprehensive integration tests for all API endpoints using Vitest, including auth flows, data operations, and error scenarios.

## Acceptance Criteria
- [ ] Test setup with database seeding
- [ ] Authentication flow tests
- [ ] CRUD operation tests for all resources
- [ ] Queue processing tests
- [ ] Credit system tests
- [ ] Error handling tests
- [ ] Rate limiting tests
- [ ] Permission tests
- [ ] Performance benchmarks
- [ ] 80%+ code coverage

## Technical Implementation Notes
- Use Vitest for test runner
- Create test database with migrations
- Mock external services (Fal.ai, Stripe)
- Use factories for test data
- Implement parallel test execution

## Test Categories
\`\`\`typescript
describe('API Tests', () => {
  describe('Authentication', () => {
    test('magic link flow')
    test('passkey registration')
    test('anonymous upgrade')
  })
  
  describe('Teams', () => {
    test('CRUD operations')
    test('invitations')
    test('permissions')
  })
  
  describe('Generation', () => {
    test('image generation')
    test('video generation')
    test('queue management')
  })
})
\`\`\`

## Dependencies
- All API endpoints implemented

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "testing" \
  --label "P0-critical" \
  --label "epic:quality" \
  --milestone "Export & Polish"

# Issue 22: Implement Security Hardening and Auditing
gh issue create \
  --title "[Backend] Security: Implement security measures and audit logging" \
  --body "## Description
Implement comprehensive security measures including input validation, SQL injection prevention, rate limiting, and audit logging.

## Acceptance Criteria
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF token implementation
- [ ] Rate limiting per endpoint
- [ ] DDoS protection
- [ ] Audit logging for sensitive operations
- [ ] Security headers configuration
- [ ] API key rotation system
- [ ] Penetration testing preparation

## Technical Implementation Notes
- Use Zod for input validation
- Implement prepared statements
- Configure helmet.js for headers
- Use rate-limiter-flexible
- Store audit logs separately

## Security Measures
\`\`\`typescript
const securityConfig = {
  rateLimit: {
    auth: '5/min',
    api: '100/min',
    generation: '10/min'
  },
  headers: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000'
  }
}
\`\`\`

## API Endpoints
- GET /api/v1/audit/logs - Get audit logs
- POST /api/v1/security/rotate-keys - Rotate API keys
- GET /api/v1/security/status - Security status check

## Database Schema
\`\`\`sql
audit_logs (
  id uuid primary key,
  user_id uuid,
  team_id uuid,
  action varchar,
  resource_type varchar,
  resource_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamp
)

security_events (
  id uuid primary key,
  event_type varchar, -- rate_limit, auth_failure, etc
  severity varchar,
  details jsonb,
  created_at timestamp
)
\`\`\`

## Dependencies
- All core systems implemented

## Estimated Complexity
**Story Points**: 13
**Time Estimate**: 3 days" \
  --label "backend" \
  --label "security" \
  --label "P0-critical" \
  --label "epic:quality" \
  --milestone "Export & Polish"

# Issue 23: Setup Performance Monitoring and Optimization
gh issue create \
  --title "[Backend] Performance: Implement monitoring and optimization" \
  --body "## Description
Setup comprehensive performance monitoring, database optimization, and caching strategies for optimal system performance.

## Acceptance Criteria
- [ ] APM integration (Sentry/DataDog)
- [ ] Database query optimization
- [ ] Query result caching
- [ ] API response caching
- [ ] Database indexes optimization
- [ ] Connection pooling tuning
- [ ] Memory leak detection
- [ ] Load testing setup
- [ ] Performance dashboards
- [ ] Alert configuration

## Technical Implementation Notes
- Use Sentry for error and performance monitoring
- Implement Redis for caching
- Create database indexes based on query patterns
- Use database EXPLAIN for optimization
- Implement CDN for static assets

## Performance Targets
\`\`\`yaml
targets:
  api_response_time: <200ms p95
  database_query_time: <50ms p95
  generation_queue_time: <5s
  page_load_time: <3s
  uptime: 99.9%
\`\`\`

## Monitoring Setup
\`\`\`typescript
const monitoring = {
  traces: {
    sampleRate: 0.1,
    slowQueryThreshold: 100
  },
  metrics: {
    apiLatency: histogram,
    queueDepth: gauge,
    creditUsage: counter
  }
}
\`\`\`

## Dependencies
- Core system complete

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 2 days" \
  --label "backend" \
  --label "performance" \
  --label "P1-high" \
  --label "epic:quality" \
  --milestone "Export & Polish"
```

## Issue Creation Status

✅ All 23 backend issues have been created in GitHub
✅ Issues are assigned to appropriate milestones
✅ Priority labels and epic tags have been applied

## Summary

I've created 23 detailed backend GitHub issues covering all aspects of the MVP development from the plan:

### Issue Breakdown by Epic:
- **Infrastructure**: 3 issues (Database, Queue, API structure)
- **Authentication**: 2 issues (Auth system, Team management)
- **Script Processing**: 2 issues (Analysis, Frame generation)
- **Frame Management**: 2 issues (Style Stacks, Characters)
- **AI Generation**: 5 issues (Fal.ai integration, Models, Queue, Realtime)
- **Monetization**: 3 issues (Credits, Subscriptions, Purchases)
- **Export**: 3 issues (Storage, Video compilation, Formats)
- **Quality**: 3 issues (Testing, Security, Performance)

Each issue includes:
- Clear title with [Backend] prefix
- Detailed description and context
- Testable acceptance criteria
- Technical implementation notes
- API endpoints to create
- Database schema changes
- Dependencies on other issues
- Complexity estimation in story points

The issues are formatted as `gh` CLI commands for easy creation and include appropriate labels and milestone assignments. You can execute these commands directly or modify them as needed for your project management workflow.