# API Routes Refactoring Guide

## Overview
This document outlines the refactoring of all API routes to move business logic from server actions directly into the routes.

## Completed Refactorings

### 1. Auth Routes (✓ COMPLETED)
- `/api/v1/auth/session` - Session logic moved from `getCurrentUserSession()`
- `/api/v1/auth/anonymous` - Anonymous session creation logic moved from `createAnonymousSessionAction()`
- `/api/v1/auth/profile` - Profile update logic moved from `updateUserProfile()`
- `/api/v1/auth/signout` - Sign out logic moved from `signOutAction()`

**Pattern Used:**
```typescript
// OLD: Import and call server action
import { someAction } from "@/app/actions/domain";
const result = await someAction();

// NEW: Direct logic with helper imports
import { getUser } from "@/lib/auth/server";
import { createServerClient } from "@/lib/supabase/server";
const user = await getUser();
const supabase = createServerClient();
// ... direct DB operations
```

### 2. User Routes (✓ COMPLETED)
- `/api/v1/user/me` - User profile logic moved from `getCurrentUser()`
- `/api/v1/user/team` - Team info logic moved from `getUserTeam()`
- `/api/v1/user/teams` - Teams list logic moved from `getUserTeams()`
- `/api/v1/user/teams/check` - Access check logic moved from `checkUserTeamAccess()`

### 3. Shared Schemas (✓ COMPLETED)
Created `/src/lib/schemas/` directory with:
- `auth.schemas.ts` - Auth validation schemas
- `team.schemas.ts` - Team operation schemas
- `sequence.schemas.ts` - Sequence operation schemas
- `frame.schemas.ts` - Frame operation schemas
- `style.schemas.ts` - Style operation schemas

## Remaining Refactorings

### Team Routes (26 files remaining)

#### `/api/v1/teams/[teamId]/invitations` (POST, GET)
**Current:** Calls `inviteTeamMember()` and `getTeamInvitations()`

**Refactor to:**
```typescript
import { requireUser, requireTeamAdminAccess } from "@/lib/auth/action-utils";
import { teamService } from "@/lib/services/team.service";
import { inviteMemberSchema } from "@/lib/schemas/team.schemas";

// POST - Invite member
const validated = inviteMemberSchema.parse(body);
const user = await requireUser();
await requireTeamAdminAccess(user.id, validated.teamId);
const invitation = await teamService.createInvitation({...});

// GET - List invitations
const user = await requireUser();
await requireTeamAdminAccess(user.id, teamId);
const invitations = await teamService.getInvitations(teamId);
```

#### `/api/v1/teams/invitations/[invitationId]/accept` (POST)
**Current:** Calls `acceptInvitation()`

**Refactor to:**
```typescript
import { requireUser } from "@/lib/auth/action-utils";
import { teamService } from "@/lib/services/team.service";
import { acceptInvitationSchema } from "@/lib/schemas/team.schemas";

const validated = acceptInvitationSchema.parse(body);
const user = await requireUser();
const teamId = await teamService.acceptInvitation({
  token: validated.token,
  userId: user.id,
});
```

#### `/api/v1/teams/[teamId]/members/[userId]/role` (PATCH)
**Current:** Calls `updateMemberRole()`

**Refactor to:**
```typescript
import { requireUser, requireTeamOwnerAccess } from "@/lib/auth/action-utils";
import { teamService } from "@/lib/services/team.service";
import { updateRoleSchema } from "@/lib/schemas/team.schemas";

const { teamId, userId } = await params;
const validated = updateRoleSchema.parse({ teamId, userId, ...body });
const user = await requireUser();
await requireTeamOwnerAccess(user.id, validated.teamId);
await teamService.updateMemberRole({...});
```

### Sequence Routes

#### `/api/v1/sequences` (POST, GET)
**Current:** Calls `saveSequence()` and `listSequences()`

**Refactor to:**
```typescript
import { requireUser, requireTeamMemberAccess } from "@/lib/auth/action-utils";
import { sequenceService } from "@/lib/services/sequence.service";
import { createSequenceSchema } from "@/lib/schemas/sequence.schemas";

// POST - Create sequence
const validated = createSequenceSchema.parse(body);
const user = await requireUser();
const supabase = createServerClient();

// Get user's team
const { data: membership } = await supabase
  .from("team_members")
  .select("team_id")
  .eq("user_id", user.id)
  .single();

const sequence = await sequenceService.createSequence({
  teamId: membership.team_id,
  userId: user.id,
  ...validated
});

// GET - List sequences
const user = await requireUser();
const supabase = createServerClient();
const { data: membership } = await supabase
  .from("team_members")
  .select("team_id")
  .eq("user_id", user.id)
  .single();

const sequences = await sequenceService.getSequencesByTeam(membership.team_id);
```

#### `/api/v1/sequences/[sequenceId]` (GET, PATCH, DELETE)
**Current:** Calls `getSequence()`, `saveSequence()`, `deleteSequence()`

**Refactor to:**
```typescript
import { requireUser, requireTeamMemberAccess } from "@/lib/auth/action-utils";
import { sequenceService } from "@/lib/services/sequence.service";
import { updateSequenceSchema } from "@/lib/schemas/sequence.schemas";

// GET
const user = await requireUser();
const supabase = createServerClient();
const { data: seq } = await supabase
  .from("sequences")
  .select("team_id")
  .eq("id", sequenceId)
  .single();

await requireTeamMemberAccess(user.id, seq.team_id);
const sequence = await sequenceService.getSequence(sequenceId, true);

// PATCH
const validated = updateSequenceSchema.parse({ id: sequenceId, ...body });
// ... similar pattern

// DELETE
await requireTeamMemberAccess(user.id, seq.team_id, "admin");
await sequenceService.deleteSequence(id);
```

#### `/api/v1/sequences/[sequenceId]/frames/generate` (POST)
**Current:** Calls `generateFrames()`

**Refactor to:**
```typescript
import { requireUser, requireTeamMemberAccess } from "@/lib/auth/action-utils";
import { getJobManager } from "@/lib/qstash/job-manager";
import { getQStashClient } from "@/lib/qstash/client";
import { JobType } from "@/lib/qstash/job-manager";

const user = await requireUser();
const supabase = createServerClient();

// Verify sequence and team access
const { data: sequence } = await supabase
  .from("sequences")
  .select("id, team_id")
  .eq("id", sequenceId)
  .single();

await requireTeamMemberAccess(user.id, sequence.team_id);

// Check for existing jobs
const jobManager = getJobManager();
const existingJobs = await jobManager.getJobsByStatus("running", {
  teamId: sequence.team_id,
});

// Create and queue job
const job = await jobManager.createJob({
  type: JobType.FRAME_GENERATION,
  payload: { sequenceId, options: {...} },
  userId: user.id,
  teamId: sequence.team_id,
});

const qstashClient = getQStashClient();
await qstashClient.publishFrameGenerationJob({...});
```

#### `/api/v1/sequences/[sequenceId]/storyboard` (POST)
**Current:** Calls `generateStoryboard()`

**Refactor to:**
```typescript
// This is essentially the same as generateFrames
// Just validate the sequence has script and style, then call generateFrames logic
```

### Frame Routes

All frame routes follow similar patterns:

#### `/api/v1/frames` (POST, GET)
**Current:** Calls `createFrame()` and various getters

**Pattern:**
```typescript
import { createFrameSchema } from "@/lib/schemas/frame.schemas";
import { createServerClient } from "@/lib/supabase/server";

const validated = createFrameSchema.parse(body);
const supabase = createServerClient();

const { data, error } = await supabase
  .from("frames")
  .insert(frameData)
  .select()
  .single();
```

#### `/api/v1/frames/[frameId]` (GET, PATCH, DELETE)
Similar pattern with validation and direct DB operations

#### `/api/v1/frames/[frameId]/regenerate` (POST)
**Current:** Calls `regenerateFrameAction()`

**Refactor to:**
```typescript
import { requireUser } from "@/lib/auth/action-utils";
import { getJobManager } from "@/lib/qstash/job-manager";
import { regenerateFrameSchema } from "@/lib/schemas/frame.schemas";

const validated = regenerateFrameSchema.parse(body);
const user = await requireUser();
const supabase = createServerClient();

// Get frame and verify access
const { data: frame } = await supabase
  .from("frames")
  .select("*, sequences!inner(id, team_id, script)")
  .eq("id", validated.frameId)
  .single();

// Verify team membership
const { data: member } = await supabase
  .from("team_members")
  .select("role")
  .eq("team_id", frame.sequences.team_id)
  .eq("user_id", user.id)
  .single();

// Create job
const jobManager = getJobManager();
const job = await jobManager.createJob({
  type: "frame_generation",
  payload: {...},
  userId: user.id,
  teamId: frame.sequences.team_id,
});
```

### Style Routes

#### `/api/v1/styles` (POST, GET)
**Current:** Calls `createStyle()` and `listStyles()`

**Refactor to:**
```typescript
import { createStyleSchema } from "@/lib/schemas/style.schemas";
import { createServerClient } from "@/lib/supabase/server";

// POST
const validated = createStyleSchema.parse(body);
const supabase = createServerClient();

// Get user's team
const user = await getUser();
const { data: membership } = await supabase
  .from("team_members")
  .select("team_id")
  .eq("user_id", user.id)
  .eq("role", "owner")
  .single();

const { data } = await supabase
  .from("styles")
  .insert({
    team_id: membership.team_id,
    ...validated
  })
  .select()
  .single();

// GET
const { data } = await supabase
  .from("styles")
  .select("*")
  .or(`team_id.eq.${teamId},is_public.eq.true`)
  .order("created_at", { ascending: false });
```

#### `/api/v1/styles/templates` (GET)
**Current:** Calls `getTemplateStyles()`

**Refactor to:**
```typescript
const supabase = createServerClient();
const { data } = await supabase
  .from("styles")
  .select("*")
  .eq("is_template", true)
  .order("name", { ascending: true });
```

### Script Routes

#### `/api/v1/script/enhance` (POST)
**Current:** Calls `enhanceScriptDirect()`

**Refactor to:**
```typescript
import { requireUser } from "@/lib/auth/action-utils";

const user = await requireUser();
const { script, targetDuration, tone } = body;

// Import AI service
const { enhanceScript } = await import("@/lib/ai/script-enhancer");

const result = await enhanceScript(script, {
  targetDuration,
  tone,
});
```

## Key Patterns

### 1. Authentication
```typescript
import { requireUser, requireTeamMemberAccess } from "@/lib/auth/action-utils";

const user = await requireUser();  // Throws if not authenticated
await requireTeamMemberAccess(user.id, teamId);  // Throws if no access
```

### 2. Database Operations
```typescript
import { createServerClient } from "@/lib/supabase/server";

const supabase = createServerClient();
const { data, error } = await supabase.from("table")...;
```

### 3. Validation
```typescript
import { someSchema } from "@/lib/schemas/domain.schemas";

const validated = someSchema.parse(body);  // Throws ZodError if invalid
```

### 4. Services
```typescript
import { sequenceService } from "@/lib/services/sequence.service";
import { teamService } from "@/lib/services/team.service";

// Use service methods for complex operations
const result = await sequenceService.createSequence({...});
```

### 5. Error Handling
```typescript
try {
  // ... logic
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({
      success: false,
      message: "Invalid request data",
      errors: error.issues,
    }, { status: 400 });
  }

  const handledError = handleApiError(error);
  return NextResponse.json({
    success: false,
    message: "Operation failed",
    error: handledError.toJSON(),
  }, { status: handledError.statusCode });
}
```

### 6. Revalidation
```typescript
import { revalidatePath } from "next/cache";

revalidatePath(`/sequences/${sequenceId}`);
revalidatePath(`/sequences/${sequenceId}/storyboard`);
```

## Benefits

1. **Clearer Separation**: Business logic lives in routes, not scattered across actions
2. **Better Type Safety**: Direct imports from services and utils
3. **Easier Testing**: Can test routes without going through action layer
4. **Reduced Indirection**: Fewer layers to trace through
5. **Consistent Patterns**: All routes follow same structure

## Next Steps

1. Complete team routes refactoring
2. Complete sequence routes refactoring
3. Complete frame routes refactoring
4. Complete style routes refactoring
5. Complete script routes refactoring
6. Run full type check
7. Run test suite
8. Update any documentation

## Testing

After refactoring each route:

```bash
# Type check
bun tsc --noEmit

# Run tests
bun test

# Format
bun biome check --write .
```
