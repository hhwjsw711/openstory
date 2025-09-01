---
allowed-tools: Bash
argument-hint: [command] [args]
description: Main workflow management command for issue assignment and agent orchestration
---

# Claude Code Agent Workflow Manager

The workflow system orchestrates GitHub issue assignment, worktree creation, and agent delegation.

## Available Commands:

### Issue Management
- `/workflow-assign <issue_num>` - Assign issue to tech lead for triage and planning
- `/workflow-implement <issue_num>` - Assign issue to engineer for implementation

### Status and Maintenance
- `/workflow-status` - Show current workflow status
- `/workflow-review` - Check for PRs needing review
- `/workflow-cleanup` - Clean up merged PR worktrees
- `/workflow-reset` - Reset all worktrees and state (use with caution!)

## Two-Stage Workflow (Recommended)

**Stage 1: Triage** - Tech lead analyzes and plans
```
/workflow-assign 123
```

**Stage 2: Implementation** - Engineer implements the plan
```
/workflow-implement 123
```

## Quick Start Example

1. List open issues:
!gh issue list --state open --limit 5

2. Pick an issue and assign it for triage:
```
/workflow-assign <issue_number>
```

3. After triage is complete, start implementation:
```
/workflow-implement <issue_number>
```

4. Check progress:
```
/workflow-status
```

## How It Works

Each issue gets:
- A dedicated git worktree in `.trees/`
- An appropriate agent assignment (backend, frontend, QA)
- Instructions tailored to the issue type
- Isolated environment with dependencies

The workflow automatically:
- Determines issue type from labels and content
- Selects the right agent for the job
- Creates branches and worktrees
- Tracks state and progress
- Manages PR reviews

## Agent Types

**Tech Leads/Architects** (Triage Stage):
- `backend-tech-lead` - Backend architecture and planning
- `frontend-architect` - Frontend architecture and planning
- `engineering-lead` - General technical leadership

**Engineers** (Implementation Stage):
- `backend-engineer` - Backend implementation
- `frontend-react-engineer` - Frontend implementation
- `qa-lead-tester` - Testing and validation

Need help with a specific command? Just run it without arguments to see usage information.