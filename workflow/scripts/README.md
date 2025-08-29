# Workflow Scripts for Claude Code Integration

This directory contains scripts for automating development workflows with Claude Code CLI.

## Scripts

### agent-launcher.sh
Launches Claude CLI with specific agent contexts for implementing issues or reviewing PRs.

**Usage:**
```bash
# For implementing an issue
./agent-launcher.sh implement <worktree_path> <issue_num> <agent_type>

# For reviewing a PR
./agent-launcher.sh review <pr_num> <agent_type>
```

**Environment Variables:**
- `CLAUDE_MODE`: Set to `print` for non-interactive mode or `repl` for interactive (default: `repl`)
- `CLAUDE_MODEL`: Specify a Claude model (optional)
- `CLAUDE_MAX_TURNS`: Maximum turns for print mode (default: 20)

**Examples:**
```bash
# Interactive implementation
./agent-launcher.sh implement /path/to/worktree 123 backend-engineer

# Non-interactive implementation with specific model
CLAUDE_MODE=print CLAUDE_MODEL=claude-3-5-sonnet-20241022 \
  ./agent-launcher.sh implement /path/to/worktree 123 frontend-react-engineer

# Review a PR interactively
./agent-launcher.sh review 456 qa-lead-tester
```

### orchestrator.sh
Main workflow orchestrator that manages issue assignment, worktree creation, and agent coordination.

**Usage:**
```bash
./orchestrator.sh
```

**Environment Variables:**
- `LAUNCH_METHOD`: Set to `claude-cli` to use Claude CLI or `cursor` for Cursor IDE (default: `cursor`)
- All `CLAUDE_*` variables from agent-launcher.sh are also respected when using `claude-cli`

**Examples:**
```bash
# Use Cursor IDE (default)
./orchestrator.sh

# Use Claude CLI in interactive mode
LAUNCH_METHOD=claude-cli ./orchestrator.sh

# Use Claude CLI in print mode with specific configuration
LAUNCH_METHOD=claude-cli CLAUDE_MODE=print CLAUDE_MAX_TURNS=30 ./orchestrator.sh
```

### workflow-manager.sh
Comprehensive workflow management including issue routing, PR monitoring, and agent coordination.

## Claude CLI Integration

The scripts now properly integrate with Claude CLI using the correct command syntax:

1. **REPL Mode (Interactive)**: `claude "<initial_prompt>"` - Starts an interactive session with an initial prompt
2. **Print Mode (Non-interactive)**: `claude -p "<prompt>" --max-turns N` - Executes the prompt and exits

The agent-launcher script automatically:
- Checks if Claude CLI is installed
- Provides context about the issue or PR
- Configures the appropriate mode based on environment variables
- Passes the initial prompt to guide Claude's work

## Workflow

1. The orchestrator monitors GitHub issues
2. When an issue is assigned, it creates a git worktree
3. It generates a context file with issue details
4. Based on `LAUNCH_METHOD`:
   - `cursor`: Opens Cursor IDE with the context
   - `claude-cli`: Launches Claude CLI with the appropriate prompt
5. Claude works on the issue with the provided context
6. The workflow continues with PR creation and review

## Requirements

- Claude CLI must be installed and available in PATH
- GitHub CLI (`gh`) must be configured
- Git worktrees support
- Proper GitHub repository access

## Agent Types

The following agent types are supported:
- `backend-engineer`: Backend development tasks
- `frontend-react-engineer`: Frontend React development
- `qa-lead-tester`: Testing and QA tasks
- `frontend-architect`: Frontend architecture decisions
- `backend-tech-lead`: Backend architecture and tech decisions
- `general`: General development tasks

## Troubleshooting

If Claude CLI is not found:
1. Install Claude Code: https://docs.anthropic.com/en/docs/claude-code/getting-started
2. Ensure `claude` is in your PATH
3. Verify with: `which claude`

For issues with prompts:
- Check that quotes are properly escaped in the prompts
- Use `CLAUDE_MODE=print` for debugging to see the full output
- Review the generated `.claude-context.md` file in the worktree