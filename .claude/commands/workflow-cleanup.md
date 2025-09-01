---
allowed-tools: Bash
description: Clean up worktrees and state for merged pull requests
---

# Workflow: Cleanup Merged PRs

I'll clean up worktrees and state files for any merged pull requests.

This will:
1. Remove worktrees for merged PRs
2. Delete local branches that have been merged
3. Clean up state files
4. Prune any stale worktree references

## Running cleanup:

!./workflow/scripts/workflow-manager.sh cleanup

## What gets cleaned:
- Git worktrees in `.trees/` for merged PRs
- Local branches that have been merged to main
- State files in `workflow/state/` for completed issues
- Instruction files for completed issues

This is safe to run regularly to keep your workspace clean.

To see what will be cleaned before running, you can check:
!gh pr list --state merged --json number,headRefName