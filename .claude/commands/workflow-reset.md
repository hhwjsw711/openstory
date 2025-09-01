---
allowed-tools: Bash
description: Reset all worktrees and workflow state (use with caution)
---

# Workflow: Reset All Worktrees and State

⚠️ **WARNING**: This will reset ALL workflow state and remove ALL worktrees!

This command will:
1. Remove all git worktrees (except main)
2. Delete all workflow state files
3. Delete all instruction files
4. Clean up the `.trees/` directory

## Are you sure you want to reset everything?

If yes, I'll run the reset command:

!echo "Resetting all workflow state..."
!./workflow/scripts/workflow-manager.sh reset

## After reset:
- All active issue work will be lost
- You'll need to re-assign any issues you want to work on
- Any uncommitted changes in worktrees will be lost

## Alternative commands:
- `/workflow-cleanup` - Only clean up merged PRs (safer)
- `/workflow-status` - Check what's active before resetting

Only use this command if you need to completely start fresh or if there are issues with the workflow state.