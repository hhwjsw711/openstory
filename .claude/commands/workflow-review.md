---
allowed-tools: Bash, Task
description: Check for pull requests that need review and launch review agents
---

# Workflow: Review Pull Requests

I'll check for PRs that need review and can launch the QA lead agent to perform reviews.

## Checking for PRs needing review:

!gh pr list --json number,headRefName,state,reviews

!./workflow/scripts/workflow-manager.sh review

## Review Process

For any PRs needing review, I can invoke the qa-lead-tester agent to:
1. Check the diff and changes
2. Verify CI checks are passing
3. Review for code quality, test coverage, and security
4. Leave constructive feedback
5. Approve or request changes

To review a specific PR, you can also use:
- `gh pr diff <pr_number>` - View the changes
- `gh pr checks <pr_number>` - Check CI status
- `gh pr review <pr_number> --comment` - Leave feedback
- `gh pr review <pr_number> --approve` - Approve the PR
- `gh pr review <pr_number> --request-changes` - Request changes

Would you like me to launch the qa-lead-tester agent for any specific PR?