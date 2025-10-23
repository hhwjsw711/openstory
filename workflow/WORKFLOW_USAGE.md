# Claude Code Agent Workflow - Usage Guide

## Complete Workflow Example

This guide walks through a complete example of using the Claude Code agent workflow system to implement a GitHub issue.

## Prerequisites Setup

```bash
# Ensure you're in the project root
cd /Users/tom/code/velro

# Make all workflow scripts executable
chmod +x workflow/scripts/*.sh

# Verify GitHub CLI is authenticated
gh auth status

# Verify Claude Code is installed
claude --version

# Verify Cursor CLI is available
which cursor
```

## Step 1: View Available Issues

```bash
# List open GitHub issues
gh issue list --state open

# View a specific issue
gh issue view 123
```

## Step 2: Assign Issue to Agent

```bash
# Assign issue #123 to an appropriate agent
./workflow/scripts/workflow-manager.sh assign 123
```

This will:

1. Analyze the issue to determine type (backend/frontend/qa)
2. Select the appropriate agent (backend-engineer, frontend-react-engineer, etc.)
3. Create a git worktree at `.trees/123-issue-title`
4. Generate instructions at `workflow/instructions/issue-123-instructions.md`
5. Open Cursor IDE with the worktree
6. Create a launch script for Claude Code

## Step 3: Start Claude Code Agent

In the Cursor window that opens:

1. Open the integrated terminal (Cmd+J or View > Terminal)
2. Run the launch script:
   ```bash
   ./.launch-claude.sh
   ```
3. When Claude Code starts, tell it:
   ```
   Please read the instructions at workflow/instructions/issue-123-instructions.md and implement issue #123
   ```

Claude will then:

- Read the issue context
- Use the appropriate agent (backend-engineer, frontend-react-engineer, etc.)
- Implement the solution
- Make regular commits
- Run tests
- Create a PR when complete

## Step 4: Monitor Progress

While the agent is working, you can monitor progress:

```bash
# Check workflow status
./workflow/scripts/workflow-manager.sh status

# View the worktree
cd .trees/123-issue-title
git status
git log --oneline

# Return to main directory
cd ../..
```

## Step 5: Review Process

Once the agent creates a PR:

```bash
# Check for PRs needing review
./workflow/scripts/workflow-manager.sh review
```

To have the qa-lead-tester agent review:

1. In Claude Code, say:

   ```
   Use the qa-lead-tester agent to review PR #[PR_NUMBER]
   ```

2. Or create review instructions:
   ```bash
   # This creates review instructions
   ./workflow/scripts/workflow-manager.sh review
   ```

## Step 6: Cleanup After Merge

After the PR is merged:

```bash
# Clean up worktrees and state
./workflow/scripts/workflow-manager.sh cleanup
```

## Working with Multiple Issues

You can work on multiple issues simultaneously:

```bash
# Assign multiple issues
./workflow/scripts/workflow-manager.sh assign 123
./workflow/scripts/workflow-manager.sh assign 124
./workflow/scripts/workflow-manager.sh assign 125

# Each gets its own worktree and Cursor window
```

## Manual Agent Invocation

If you need to manually invoke an agent in Claude Code:

### For Implementation:

```
@Task Use the backend-engineer agent to implement issue #123.
Read the context from workflow/instructions/issue-123-instructions.md
Working directory is .trees/123-issue-title
```

### For Review:

```
@Task Use the qa-lead-tester agent to review PR #456.
Check the diff with: gh pr diff 456
Review CI checks with: gh pr checks 456
Leave feedback with: gh pr review 456 --comment
```

## Direct Agent Communication

You can directly invoke agents using Claude Code's Task tool:

```
@engineering-lead Please triage the open issues and determine which should be prioritized

@backend-engineer Implement the user profile API endpoint described in issue #123

@frontend-react-engineer Create the dashboard component for issue #124

@qa-lead-tester Review PR #456 for test coverage and quality
```

## Troubleshooting

### Issue: Cursor doesn't open

```bash
# Manually open Cursor with the worktree
cursor .trees/123-issue-title
```

### Issue: Claude Code doesn't start

```bash
# Start Claude Code manually in the worktree
cd .trees/123-issue-title
claude chat
```

### Issue: Worktree conflicts

```bash
# Reset all worktrees and state
./workflow/scripts/workflow-manager.sh reset
```

### Issue: Can't find instructions

```bash
# List all instruction files
ls -la workflow/instructions/

# Read specific instructions
cat workflow/instructions/issue-123-instructions.md
```

## Advanced Workflows

### Custom Agent Assignment

Override automatic agent selection:

```bash
# In Claude Code, directly assign to a specific agent
@backend-tech-lead Please review and implement the complex architecture change in issue #123
```

### Collaborative Review

Have multiple agents review a PR:

```
@backend-tech-lead Review PR #456 for architecture compliance
@qa-lead-tester Review PR #456 for test coverage
@engineering-lead Review PR #456 for overall quality
```

### Re-assigning Failed Issues

If an agent gets stuck:

```bash
# Reset the issue state
rm workflow/state/issue-123.json

# Re-assign to a different agent
./workflow/scripts/workflow-manager.sh assign 123
```

## Best Practices

1. **One Issue Per Worktree**: Don't work on multiple issues in the same worktree
2. **Regular Commits**: Agents should commit after each logical change
3. **Clear PR Descriptions**: Ensure PRs reference the issue number
4. **Clean Up Regularly**: Run cleanup after PRs are merged
5. **Monitor State**: Check workflow status regularly

## Command Reference

```bash
# Main workflow commands
./workflow/scripts/workflow-manager.sh assign <issue_num>  # Assign issue to agent
./workflow/scripts/workflow-manager.sh status              # Show workflow status
./workflow/scripts/workflow-manager.sh review              # Check PRs for review
./workflow/scripts/workflow-manager.sh cleanup             # Clean merged PRs
./workflow/scripts/workflow-manager.sh reset               # Reset everything

# GitHub CLI commands (useful in Claude Code)
gh issue list                                # List open issues
gh issue view <num>                          # View issue details
gh pr create                                 # Create pull request
gh pr diff <num>                            # View PR diff
gh pr checks <num>                          # View CI status
gh pr review <num> --comment                # Add review comment
gh pr review <num> --approve                # Approve PR
gh pr review <num> --request-changes        # Request changes

# Git worktree commands
git worktree list                           # List all worktrees
git worktree remove <path>                  # Remove a worktree
git worktree prune                          # Clean up stale worktrees
```
