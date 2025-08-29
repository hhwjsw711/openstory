# Agent Instructions for Issue #2

## Agent: backend-engineer
## Working Directory: [0;32m[WORKFLOW][0m Creating worktree for issue #2 at /Users/tom/code/velro/.trees/2-backend-setup-initialize-supabase-backend-infrastr
HEAD is now at 72cd2b4 Updated setup env
/Users/tom/code/velro/.trees/2-backend-setup-initialize-supabase-backend-infrastr

## Issue Details
**Title:** [Backend] Setup: Initialize Supabase backend infrastructure
**Description:**
## Description
Setup the complete Supabase backend infrastructure including database schema, authentication, storage buckets, and real-time configurations.

## Acceptance Criteria
- [x] Supabase project created and configured
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
```sql
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
```

## API Endpoints
- POST /api/v1/setup/database - Initialize database
- GET /api/v1/setup/status - Check setup status

## Dependencies
- None (foundational)

## Estimated Complexity
**Story Points**: 8
**Time Estimate**: 2 days

## Your Task

You are tasked with implementing issue #2. Follow these steps:

### 1. Setup and Context
- Your working directory is already set to: [0;32m[WORKFLOW][0m Creating worktree for issue #2 at /Users/tom/code/velro/.trees/2-backend-setup-initialize-supabase-backend-infrastr
HEAD is now at 72cd2b4 Updated setup env
/Users/tom/code/velro/.trees/2-backend-setup-initialize-supabase-backend-infrastr
- You are on branch: 
- Review the project guidelines in CLAUDE.md

### 2. Implementation Steps
- Review existing API patterns in /app/api/v1/
- Implement the required endpoint following REST principles
- Use Zod for input validation
- Ensure all DB operations go through API routes
- Queue long-running tasks with QStash if needed
- Write comprehensive tests using Vitest

### 3. Testing and Validation
- Run tests: `pnpm test`
- Check types: `pnpx tsc --noEmit`
- Lint code: `pnpx @biomejs/biome check --write .`

### 4. Commit Guidelines
- Make frequent, descriptive commits
- Format: `feat:` / `fix:` / `refactor:` + description
- Example: `feat: add user profile update endpoint`

### 5. Create Pull Request
When implementation is complete:
```bash
gh pr create \
  --title "fix: #2 - [Backend] Setup: Initialize Supabase backend infrastructure" \
  --body "Closes #2\n\n## Changes\n- List changes here\n\n## Testing\n- Describe testing done"
```

### 6. Success Criteria
- [ ] All requirements implemented
- [ ] Tests written and passing
- [ ] Code linted and formatted
- [ ] Types check passing
- [ ] PR created with proper description

## Available Commands
- `pnpm dev` - Start development server
- `pnpm test` - Run tests
- `pnpm build` - Build the project
- `gh issue view 2` - View issue details
- `gh pr create` - Create pull request
- `gh pr checks` - View PR checks status

Remember to use the TodoWrite tool to track your progress!
