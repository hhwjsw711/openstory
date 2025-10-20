# Authentication & Authorization Utilities Guide

---

## Overview

Velro uses three separate auth utility modules, each with a specific purpose. This guide clarifies when to use which module.

---

## Module Separation

### 1. `src/lib/auth/action-utils.ts` - Server Actions

**Purpose:** Authentication and authorization for Next.js Server Actions  
**Context:** Session-based (uses cookies)  
**Returns:** Throws errors or returns data directly  
**Use When:** Writing Server Actions in `src/app/actions/**`

**Key Functions:**

```typescript
// Authentication
export async function requireUser(): Promise<User>
export async function requireAuthenticatedUser(): Promise<User>

// Team Authorization
export async function requireTeamMemberAccess(
  userId: string,
  teamId: string,
  minRole?: TeamRole
): Promise<TeamRole>

export async function requireTeamAdminAccess(
  userId: string,
  teamId: string
): Promise<TeamRole>

export async function requireTeamOwnerAccess(
  userId: string,
  teamId: string
): Promise<TeamRole>

// Feature Access
export function validateMotionAccess(user: User): void

// Utilities
export function isAnonymousUser(user: User): boolean
export function isAuthenticatedUser(user: User): boolean
```

**Example Usage:**

```typescript
// src/app/actions/sequence/index.ts
export async function createSequence(input: CreateSequenceInput) {
  try {
    const validated = createSequenceSchema.parse(input);
    const user = await requireUser();
    await requireTeamMemberAccess(user.id, validated.teamId);
    
    const sequence = await sequenceService.createSequence({
      ...validated,
      created_by: user.id,
    });
    
    revalidatePath(`/sequences`);
    return { success: true, data: sequence };
  } catch (error) {
    return createActionErrorResponse(error);
  }
}
```

---

### 2. `src/lib/auth/api-utils.ts` - API Routes

**Purpose:** Authentication and authorization for Next.js API Routes  
**Context:** Request-based (uses headers)  
**Returns:** NextResponse objects or throws NextResponse errors  
**Use When:** Writing API routes in `src/app/api/**`

**Key Functions:**

```typescript
// Authentication
export async function authenticateApiRequest(
  request: Request
): Promise<AuthResult | NextResponse<AuthError>>

export async function requireAuth(request: Request): Promise<AuthResult>

export async function requireAuthenticatedUser(
  request: Request
): Promise<AuthResult>

export async function getOptionalUser(
  request: Request
): Promise<AuthResult | null>

// Team Authorization
export async function checkTeamAccess(
  request: Request,
  teamId: string
): Promise<AuthResult | NextResponse<AuthError>>

// Feature Access
export function validateMotionAccess(user: User): void
export async function requireAuthenticatedUserForMotion(
  request: Request
): Promise<AuthResult>

// Response Helpers
export function createErrorResponse(
  message: string,
  status?: number,
  details?: Record<string, unknown>
): NextResponse<AuthError>

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status?: number
): NextResponse<{ success: true; data: T; message?: string; timestamp: string }>

// Utilities
export function isAnonymousUser(user: User): boolean
export function isAuthenticatedUser(user: User): boolean
```

**Example Usage:**

```typescript
// src/app/sequences/[sequenceId]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  try {
    const { sequenceId } = await params;
    const { user } = await requireAuth(request);
    
    const sequence = await sequenceService.getSequence(sequenceId);
    
    if (!sequence) {
      return createErrorResponse("Sequence not found", 404);
    }
    
    // Verify team access
    await requireTeamMemberAccess(user.id, sequence.team_id);
    
    return createSuccessResponse(sequence);
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}
```

---

### 3. `src/lib/auth/permissions.ts` - Permission Checking

**Purpose:** Role-based access control (RBAC) and team permission checking  
**Context:** Database-based (queries team_members table)  
**Returns:** Boolean results or throws NextResponse errors  
**Use When:** Need to check specific roles or permissions

**Key Functions:**

```typescript
// Role Queries
export async function getUserRole(
  userId: string,
  teamId: string
): Promise<TeamRole | null>

export async function getUserTeams(userId: string): Promise<Array<{
  teamId: string;
  role: TeamRole;
  teamName: string;
  joinedAt: string;
}>>

// Permission Checks (boolean)
export async function canManageTeam(
  userId: string,
  teamId: string
): Promise<boolean>

export async function canDeleteResource(
  userId: string,
  teamId: string
): Promise<boolean>

export async function isTeamOwner(
  userId: string,
  teamId: string
): Promise<boolean>

export async function checkUserRole(
  userId: string,
  teamId: string,
  requiredRole: TeamRole
): Promise<RoleCheckResult>

// API Route Helpers (throws errors)
export async function requireAdmin(
  request: Request,
  teamId: string
): Promise<{ user: User; role: TeamRole; teamId: string }>

export async function requireOwner(
  request: Request,
  teamId: string
): Promise<{ user: User; role: TeamRole; teamId: string }>

export async function verifyTeamResourceAccess(
  request: Request,
  resourceTeamId: string,
  requiredRole?: TeamRole
): Promise<{ user: User; role: TeamRole; teamId: string }>
```

**Example Usage:**

```typescript
// In a Server Action
const canManage = await canManageTeam(user.id, teamId);
if (!canManage) {
  throw new Error("Insufficient permissions");
}

// In an API Route
const { user, role } = await requireAdmin(request, teamId);
```

---

## Decision Matrix

| Scenario | Use Module | Function |
|----------|------------|----------|
| Server Action needs auth | `action-utils.ts` | `requireUser()` |
| Server Action needs team access | `action-utils.ts` | `requireTeamMemberAccess()` |
| API Route needs auth | `api-utils.ts` | `requireAuth()` |
| API Route needs team access | `api-utils.ts` + `action-utils.ts` | `requireAuth()` + `requireTeamMemberAccess()` |
| Check if user is admin | `permissions.ts` | `canManageTeam()` or `requireAdmin()` |
| Get user's role | `permissions.ts` | `getUserRole()` |
| Check motion access | `action-utils.ts` or `api-utils.ts` | `validateMotionAccess()` |
| Create API response | `api-utils.ts` | `createSuccessResponse()` / `createErrorResponse()` |

---

## Shared Functions

Some functions exist in multiple modules for convenience:

### `validateMotionAccess(user: User): void`
- **In:** `action-utils.ts` and `api-utils.ts`
- **Why:** Both Server Actions and API Routes need to validate motion access
- **Implementation:** Identical in both files

### `isAnonymousUser(user: User): boolean`
- **In:** `action-utils.ts` and `api-utils.ts`
- **Why:** Both contexts need to check anonymous status
- **Implementation:** Identical in both files

### `isAuthenticatedUser(user: User): boolean`
- **In:** `action-utils.ts` and `api-utils.ts`
- **Why:** Both contexts need to check authenticated status
- **Implementation:** Identical in both files

---

## Best Practices

### 1. Server Actions Pattern

```typescript
export async function myAction(input: InputType): Promise<ActionResponse<OutputType>> {
  try {
    // 1. Validate input
    const validated = schema.parse(input);
    
    // 2. Authenticate user
    const user = await requireUser();
    
    // 3. Authorize team access
    await requireTeamMemberAccess(user.id, validated.teamId);
    
    // 4. Call service layer
    const result = await service.doSomething(validated);
    
    // 5. Revalidate paths
    revalidatePath(`/path`);
    
    // 6. Return success
    return { success: true, data: result };
  } catch (error) {
    return createActionErrorResponse(error);
  }
}
```

### 2. API Route Pattern

```typescript
export async function GET(request: Request) {
  try {
    // 1. Authenticate
    const { user } = await requireAuth(request);
    
    // 2. Authorize (if needed)
    await requireTeamMemberAccess(user.id, teamId);
    
    // 3. Call service layer
    const result = await service.doSomething();
    
    // 4. Return success response
    return createSuccessResponse(result);
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}
```

### 3. Service Layer Pattern

```typescript
// Services should NOT import auth utilities
// They assume the caller has already verified auth/authorization

export class MyService {
  async doSomething(params: Params): Promise<Result> {
    // Pure business logic only
    // No auth checks here
  }
}
```

---

## Migration Notes

### Old Pattern (Deprecated)

```typescript
// ❌ DON'T: Old pattern with getCurrentUser()
const user = await getCurrentUser();
if (!user.success || !user.data) {
  return { success: false, error: "User not found" };
}
const userId = user.data.user.id; // Complex nested structure
```

### New Pattern (Current)

```typescript
// ✅ DO: New pattern with requireUser()
const user = await requireUser(); // Throws if not authenticated
const userId = user.id; // Clean, direct access
```

---

## Summary

- **Server Actions** → Use `action-utils.ts`
- **API Routes** → Use `api-utils.ts`
- **Permission Checks** → Use `permissions.ts`
- **Service Layer** → Don't use any auth utilities (assume caller verified)

This separation keeps concerns focused and makes the codebase easier to understand and maintain.

