# Authentication System Implementation Plan
## Issue #5: Complete Authentication System with Anonymous and Magic Links

### Executive Summary
This plan outlines the implementation of a comprehensive authentication system supporting both anonymous users and authenticated users via magic links. The system prioritizes security, user experience, and seamless migration from anonymous to authenticated states.

---

## 🏗️ Architecture Overview

### Core Principles
- **Anonymous-first**: Users can start using the app without signup
- **Progressive Enhancement**: Seamless upgrade from anonymous to authenticated
- **Server-side Authority**: All auth logic in API routes, no client-side DB access
- **Secure by Default**: HTTP-only cookies, rate limiting, comprehensive logging

### Session Management Strategy
```typescript
// Session Flow
Anonymous User → LocalStorage (client) + Database (server)
     ↓ (upgrade via magic link)
Authenticated User → HTTP-only Cookie + Supabase Session
```

---

## 📊 Database Schema

### Migration SQL
```sql
-- 1. Extend users table with anonymous tracking
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS
  anonymous_id VARCHAR(36),
  anonymous_created_at TIMESTAMP,
  upgraded_from_anonymous BOOLEAN DEFAULT FALSE;

-- 2. User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  avatar_url TEXT,
  anonymous_id VARCHAR(36) UNIQUE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Authentication logs for audit trail
CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  anonymous_id VARCHAR(36),
  event_type VARCHAR(50) NOT NULL, -- login, logout, magic_link_sent, etc
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  identifier VARCHAR(255) PRIMARY KEY, -- email or IP
  action VARCHAR(50) NOT NULL,
  attempts INTEGER DEFAULT 1,
  first_attempt TIMESTAMP DEFAULT NOW(),
  last_attempt TIMESTAMP DEFAULT NOW()
);

-- 5. Anonymous sessions tracking
CREATE TABLE IF NOT EXISTS anonymous_sessions (
  id VARCHAR(36) PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  ip_address INET,
  user_agent TEXT,
  data JSONB, -- Store temporary work
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

-- Indexes for performance
CREATE INDEX idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX idx_auth_logs_event_type ON auth_logs(event_type);
CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX idx_anonymous_sessions_expires ON anonymous_sessions(expires_at);
```

---

## 🔧 Implementation Tasks

### Phase 1: Core Infrastructure (Priority: Critical)

#### 1.1 Create Auth Service (`/src/lib/auth/service.ts`)
```typescript
export class AuthService {
  // Core methods to implement:
  async createAnonymousSession(): Promise<AnonymousSession>
  async sendMagicLink(email: string): Promise<void>
  async verifyMagicLink(token: string): Promise<User>
  async upgradeAnonymousUser(anonymousId: string, userId: string): Promise<void>
  async refreshSession(refreshToken: string): Promise<Session>
  async logout(sessionId: string): Promise<void>
  
  // Helper methods:
  private async checkRateLimit(identifier: string, action: string): Promise<boolean>
  private async logAuthEvent(event: AuthEvent): Promise<void>
  private async migrateAnonymousData(anonymousId: string, userId: string): Promise<void>
}
```

#### 1.2 Environment Variables Setup
```env
# Add to .env.local
SUPABASE_SERVICE_ROLE_KEY=your_service_key
AUTH_SECRET=generate_32_char_secret
MAGIC_LINK_REDIRECT_URL=http://localhost:3000/auth/verify
SESSION_COOKIE_NAME=velro_session
SESSION_DURATION_HOURS=24
ANONYMOUS_SESSION_DURATION_DAYS=30
RATE_LIMIT_MAGIC_LINK_PER_HOUR=3
RATE_LIMIT_LOGIN_ATTEMPTS_PER_HOUR=10
```

### Phase 2: API Endpoints (Priority: High)

#### 2.1 Anonymous Session Creation
**File**: `/src/app/api/v1/auth/anonymous/route.ts`
```typescript
export async function POST(request: Request) {
  // 1. Generate unique anonymous ID
  // 2. Create anonymous session in database
  // 3. Return session data to store in localStorage
  // 4. Log anonymous session creation
}
```

#### 2.2 Magic Link Request
**File**: `/src/app/api/v1/auth/magic-link/route.ts`
```typescript
export async function POST(request: Request) {
  // 1. Validate email format
  // 2. Check rate limits
  // 3. Send magic link via Supabase
  // 4. Log magic link request
  // 5. Return success (always, for security)
}
```

#### 2.3 Magic Link Verification
**File**: `/src/app/api/v1/auth/verify/route.ts`
```typescript
export async function POST(request: Request) {
  // 1. Verify magic link token
  // 2. Create/update user profile
  // 3. Check for anonymous session to upgrade
  // 4. Migrate anonymous data if exists
  // 5. Set HTTP-only session cookie
  // 6. Log successful login
  // 7. Return user data and redirect URL
}
```

#### 2.4 Session Check
**File**: `/src/app/api/v1/auth/session/route.ts`
```typescript
export async function GET(request: Request) {
  // 1. Check session cookie
  // 2. Validate with Supabase
  // 3. Refresh if near expiry
  // 4. Return user data or null
}
```

#### 2.5 Logout
**File**: `/src/app/api/v1/auth/logout/route.ts`
```typescript
export async function POST(request: Request) {
  // 1. Get session from cookie
  // 2. Revoke Supabase session
  // 3. Clear session cookie
  // 4. Log logout event
  // 5. Return success
}
```

#### 2.6 Session Refresh
**File**: `/src/app/api/v1/auth/refresh/route.ts`
```typescript
export async function POST(request: Request) {
  // 1. Get refresh token from cookie
  // 2. Refresh with Supabase
  // 3. Update session cookie
  // 4. Return new session data
}
```

### Phase 3: Middleware & Guards (Priority: High)

#### 3.1 Auth Middleware
**File**: `/src/lib/auth/middleware.ts`
```typescript
export async function withAuth(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // 1. Check session cookie
    // 2. Validate with Supabase
    // 3. Attach user to request
    // 4. Call handler or return 401
  }
}

export async function withTeamAccess(handler: NextApiHandler) {
  return withAuth(async (req, res) => {
    // 1. Check user's team membership
    // 2. Verify permissions
    // 3. Call handler or return 403
  })
}
```

### Phase 4: Client Integration (Priority: Medium)

#### 4.1 Auth Hooks
**File**: `/src/lib/auth/hooks.ts`
```typescript
export function useAuth() {
  // Return current auth state
  // Handle anonymous vs authenticated
  // Provide upgrade method
}

export function useSession() {
  // Check and refresh session
  // Handle auto-refresh
}

export function useMagicLink() {
  // Send magic link
  // Handle rate limiting feedback
}
```

### Phase 5: Testing (Priority: Critical)

#### 5.1 Unit Tests
**File**: `/src/lib/auth/__tests__/service.test.ts`
- Test all AuthService methods
- Mock Supabase client
- Test rate limiting logic
- Test data migration

#### 5.2 Integration Tests
**File**: `/src/app/api/v1/auth/__tests__/integration.test.ts`
- Complete auth flow testing
- Anonymous to authenticated upgrade
- Session refresh scenarios
- Rate limiting enforcement

#### 5.3 Security Tests
- SQL injection attempts
- XSS prevention
- CSRF protection
- Session hijacking prevention

---

## 🚨 Security Considerations

### Rate Limiting Rules
```typescript
const RATE_LIMITS = {
  magic_link: { max: 3, window: '1 hour' },
  login_attempts: { max: 10, window: '1 hour' },
  session_refresh: { max: 100, window: '1 hour' }
}
```

### Cookie Configuration
```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 60 * 60 * 24, // 24 hours
  path: '/'
}
```

### Security Headers
```typescript
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
}
```

---

## 📈 Success Metrics

- **Authentication Success Rate**: >95%
- **Magic Link Delivery Time**: <30 seconds
- **Session Creation Time**: <100ms
- **Anonymous to Authenticated Conversion**: >20%
- **Security Incidents**: 0

---

## 🔄 Rollback Plan

1. **Feature Flag**: Add `ENABLE_NEW_AUTH` environment variable
2. **Database Backup**: Before deployment
3. **Rollback Steps**:
   - Disable feature flag
   - Restore previous API routes
   - Clear session cookies
   - Revert database migrations if needed
4. **Validation**: Test core flows after rollback

---

## 📝 Implementation Checklist

### Week 1
- [ ] Database migrations executed
- [ ] AuthService class implemented
- [ ] Basic session management working
- [ ] Unit tests for core logic

### Week 2
- [ ] All 6 API endpoints functional
- [ ] Anonymous session tracking
- [ ] Magic link flow complete
- [ ] Rate limiting active

### Week 3
- [ ] Middleware integration
- [ ] Client hooks implemented
- [ ] Integration tests passing
- [ ] Security tests passing

### Week 4
- [ ] Performance optimization
- [ ] Documentation complete
- [ ] Staging deployment
- [ ] Production ready

---

## 🎯 Next Steps

1. **Create migration file**: `/supabase/migrations/002_authentication.sql`
2. **Implement AuthService**: Start with core methods
3. **Build API endpoints**: Follow the order specified
4. **Add comprehensive tests**: Unit → Integration → Security
5. **Deploy to staging**: Full testing before production

This plan provides a complete roadmap for implementing a secure, scalable authentication system that meets all requirements while maintaining the project's architectural principles.