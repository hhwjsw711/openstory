---
allowed-tools: Task, Read, Bash
argument-hint: <issue_number>
description: Implement a triaged issue using the saved plan
---

# Implement Issue #$ARGUMENTS

Let me implement issue #$ARGUMENTS using the plan created during triage.

## Checking for Implementation Plan

!ls -la workflow/instructions/issue-$ARGUMENTS-plan.md 2>/dev/null || echo "No plan found for issue #$ARGUMENTS"

## Reading the Plan

First, let me read the implementation plan created by the tech lead:

@workflow/instructions/issue-$ARGUMENTS-plan.md

## Getting Issue Context

!gh issue view $ARGUMENTS --json number,title,body,labels,assignees,url

## Implementation

Based on the issue type and the plan above, I'll select the appropriate implementation engineer:
- Backend issues → `backend-engineer`
- Frontend issues → `frontend-react-engineer`
- QA/Testing → `qa-lead-tester`

I'll now use the Task tool to invoke the appropriate engineer(s) to implement the solution following the plan.

The engineer will:
1. **Follow the Plan** - Implement according to the tech lead's specifications
2. **Write Tests** - Create comprehensive test coverage
3. **Make Regular Commits** - Commit after each logical change
4. **Document Changes** - Update relevant documentation
5. **Create PR** - Open a pull request when complete

**Important Notes**:
- The engineer should follow the plan created during triage
- Work closely with `qa-lead-tester` for test coverage
- Make frequent, descriptive commits
- If no plan exists, run `/triage $ARGUMENTS` first
