---
allowed-tools: Bash
description: Show current workflow status including active issues, worktrees, and PRs
---

# Workflow Status

I'll show you the current status of all active workflows, including:
- Active issues being worked on
- Git worktrees
- Open pull requests
- Agent assignments

!./workflow/scripts/workflow-manager.sh status

## Quick Commands

To work with the workflow:
- `/workflow-assign <issue_num>` - Assign issue for triage
- `/workflow-implement <issue_num>` - Start implementation
- `/workflow-review` - Check PRs needing review
- `/workflow-cleanup` - Clean up merged PRs
- `/workflow-reset` - Reset all worktrees (use with caution)