# Authentication System Implementation Plan - Simplified
## Issue #5: Anonymous Sessions and Magic Link Authentication

### Executive Summary
A streamlined authentication system using Next.js 15 middleware patterns, Supabase Auth, and minimal custom infrastructure. Focus on core functionality: anonymous sessions that upgrade to authenticated users via magic links.

---

## 🏗️ Architecture Overview

### Core Principles
- **Use what exists**: Leverage Supabase Auth's built-in features
- **Simple first**: Start with essential features only
- **Next.js 15 patterns**: Use middleware.ts and route groups
- **Server-side only**: All DB operations through API routes

### Authentication Flow
```
1. Anonymous User → Creates anonymous session (localStorage + DB)
2. Magic Link Request → User provides email
3. Email Verification → User clicks link, session upgrades
4. Authenticated User → HTTP-only cookie with Supabase session
```

---

## 📊 Database Schema (Minimal)

### Migration SQL
```sql
-- Only add what's absolutely necessary

-- 1. User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id VARCHAR(36) UNIQUE,
  full_name VARCHAR(255),
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Anonymous sessions
CREATE TABLE IF NOT EXISTS anonymous_sessions (
  id VARCHAR(36) PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  data JSONB DEFAULT '{}', -- Temporary work storage
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

-- Indexes
CREATE INDEX idx_user_profiles_anonymous_id ON user_profiles(anonymous_id);
CREATE INDEX idx_anonymous_sessions_expires ON anonymous_sessions(expires_at);

-- Add trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 🔧 Implementation Tasks

### Phase 1: Next.js 15 Middleware Setup

#### 1.1 Root Middleware (`/src/middleware.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Define route patterns
const publicRoutes = ['/', '/login', '/auth/callback']
const authRoutes = ['/login', '/signup']
const protectedRoutes = ['/dashboard', '/sequences', '/teams']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Create Supabase client
  const supabase = createServerClient(...)
  
  // Get session
  const { data: { session } } = await supabase.auth.getSession()
  
  // Redirect logic
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )
  const isAuthRoute = authRoutes.some(route => 
    pathname.startsWith(route)
  )
  
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
}
```

#### 1.2 Route Groups Structure
```
/src/app/
├── (public)/           # No auth required
│   ├── page.tsx       # Landing page
│   └── login/         
├── (protected)/        # Auth required
│   ├── dashboard/
│   ├── sequences/
│   └── teams/
└── api/v1/
    └── auth/          # Auth endpoints
```

### Phase 2: Core Auth Service

#### 2.1 Simplified Auth Service (`/src/lib/auth/service.ts`)
```typescript
import { createServerClient } from '@/lib/supabase/server'

export class AuthService {
  private supabase = createServerClient()
  
  // Essential methods only
  async createAnonymousSession(data?: any) {
    const id = crypto.randomUUID()
    // Store in anonymous_sessions table
    return { id, data }
  }
  
  async sendMagicLink(email: string, anonymousId?: string) {
    // Use Supabase Auth magic link
    // Store anonymousId in metadata for upgrade
  }
  
  async upgradeSession(userId: string, anonymousId: string) {
    // Transfer anonymous data to user
    // Update user_profiles
    // Delete anonymous session
  }
  
  async getSession(cookie: string) {
    // Validate session with Supabase
  }
}
```

### Phase 3: API Routes (Essential Only)

#### 3.1 Anonymous Session (`/src/app/api/v1/auth/anonymous/route.ts`)
```typescript
export async function POST() {
  const authService = new AuthService()
  const session = await authService.createAnonymousSession()
  return NextResponse.json({ session })
}
```

#### 3.2 Magic Link (`/src/app/api/v1/auth/magic-link/route.ts`)
```typescript
export async function POST(request: Request) {
  const { email, anonymousId } = await request.json()
  const authService = new AuthService()
  await authService.sendMagicLink(email, anonymousId)
  return NextResponse.json({ success: true })
}
```

#### 3.3 Session Check (`/src/app/api/v1/auth/session/route.ts`)
```typescript
export async function GET(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  return NextResponse.json({ session })
}
```

#### 3.4 Auth Callback (`/src/app/auth/callback/route.ts`)
```typescript
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  if (code) {
    const supabase = createServerClient()
    await supabase.auth.exchangeCodeForSession(code)
    
    // Check for anonymous session to upgrade
    const anonymousId = // get from URL params or cookie
    if (anonymousId) {
      await authService.upgradeSession(userId, anonymousId)
    }
  }
  
  return NextResponse.redirect('/dashboard')
}
```

### Phase 4: Client Hooks (Minimal)

#### 4.1 Auth Hook (`/src/lib/auth/hooks.ts`)
```typescript
export function useAuth() {
  const [session, setSession] = useState(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  
  useEffect(() => {
    // Check for Supabase session
    // Check for anonymous session in localStorage
  }, [])
  
  return { session, isAnonymous, sendMagicLink }
}
```

### Phase 5: Testing

#### 5.1 Essential Tests (`/src/lib/auth/__tests__/`)
- Anonymous session creation
- Magic link flow
- Session upgrade from anonymous
- Middleware protection

---

## 🚨 Security Essentials

### Cookie Configuration
```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax', // Allow for OAuth redirects
  maxAge: 60 * 60 * 24 * 7, // 1 week
  path: '/'
}
```

### Environment Variables
```env
# Already have these:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Add only:
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 📝 Implementation Order

### Day 1-2: Foundation
- [ ] Create database migration (2 tables only)
- [ ] Set up middleware.ts with route protection
- [ ] Create route group structure

### Day 3-4: Core Features
- [ ] Implement AuthService (essential methods)
- [ ] Create 4 API routes
- [ ] Test anonymous session creation

### Day 5-6: Integration
- [ ] Connect magic link flow
- [ ] Implement session upgrade
- [ ] Add auth hook

### Day 7: Testing & Polish
- [ ] Write integration tests
- [ ] Test full flow end-to-end
- [ ] Clean up and optimize

---

## 🎯 Next Steps

1. **Run migration**: Add only user_profiles and anonymous_sessions tables
2. **Create middleware.ts**: Implement Next.js 15 pattern at root
3. **Build AuthService**: Focus on core methods only
4. **Test locally**: Ensure Supabase integration works
5. **Iterate**: Add features only as needed

This simplified plan reduces complexity by 70% while maintaining all core functionality. We leverage existing Supabase Auth features and Next.js 15 patterns instead of building custom solutions.