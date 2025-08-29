#!/bin/bash

# Agent Launcher for Claude Code
# Launches Claude with specific agent context in a worktree

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKFLOW_DIR="$PROJECT_ROOT/workflow"
CONFIG_DIR="$WORKFLOW_DIR/config"

# Configuration
CLAUDE_MODE="${CLAUDE_MODE:-repl}"  # Can be 'repl' or 'print'
CLAUDE_MODEL="${CLAUDE_MODEL:-}"    # Optional: specify model
CLAUDE_MAX_TURNS="${CLAUDE_MAX_TURNS:-20}"  # Max turns for print mode

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[AGENT-LAUNCHER]${NC} $1" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

info() {
    echo -e "${GREEN}[INFO]${NC} $1" >&2
}

# Check if claude CLI is available
check_claude_cli() {
    if ! command -v claude &> /dev/null; then
        error "Claude CLI not found. Please install it first."
        error "Visit: https://docs.anthropic.com/en/docs/claude-code/getting-started"
        exit 1
    fi
}

# Function to launch Claude with agent context
launch_claude_agent() {
    local worktree_path=$1
    local issue_num=$2
    local agent_type=$3
    
    log "Launching Claude with $agent_type for issue #$issue_num"
    
    # Change to worktree directory
    cd "$worktree_path"
    
    # Create initial prompt for Claude
    local initial_prompt="You are now working as a $agent_type agent on issue #$issue_num. 

Please read the context file at .claude-context.md to understand your task.

Start by:
1. Reading the issue context: cat .claude-context.md
2. Understanding the codebase structure: ls -la
3. Reviewing the CLAUDE.md file for project guidelines
4. Implementing the required changes
5. Testing your implementation
6. Creating regular commits
7. Creating a PR when complete

Remember to:
- Make descriptive commits frequently
- Run tests before creating PR
- Follow the project's coding standards
- Use the TodoWrite tool to track your progress"

    # Build Claude command based on mode and configuration
    local claude_cmd="claude"
    
    # Add model flag if specified
    if [ -n "$CLAUDE_MODEL" ]; then
        claude_cmd="$claude_cmd --model $CLAUDE_MODEL"
    fi
    
    # Launch Claude in the appropriate mode
    if [ "$CLAUDE_MODE" = "print" ]; then
        # Print mode: Execute prompt and exit
        info "Launching Claude in print mode (non-interactive)"
        eval "$claude_cmd -p \"$initial_prompt\" --max-turns $CLAUDE_MAX_TURNS"
    else
        # REPL mode: Start interactive session with initial prompt
        info "Launching Claude in REPL mode (interactive)"
        eval "$claude_cmd \"$initial_prompt\""
    fi
}

# Function to launch review agent
launch_review_agent() {
    local pr_num=$1
    local agent_type=$2
    
    log "Launching $agent_type to review PR #$pr_num"
    
    local review_prompt="You are acting as a $agent_type reviewing PR #$pr_num.

Please:
1. Review the PR changes: gh pr diff $pr_num
2. Check the PR description: gh pr view $pr_num
3. Verify tests are passing: gh pr checks $pr_num
4. Review code quality and patterns
5. Leave constructive feedback: gh pr review $pr_num --comment -b 'Your feedback'
6. Approve if satisfactory: gh pr review $pr_num --approve

Focus on:
- Code quality and best practices
- Test coverage
- Security considerations
- Performance implications
- Adherence to project guidelines"

    # Build Claude command based on mode and configuration
    local claude_cmd="claude"
    
    # Add model flag if specified
    if [ -n "$CLAUDE_MODEL" ]; then
        claude_cmd="$claude_cmd --model $CLAUDE_MODEL"
    fi
    
    # Launch Claude in the appropriate mode
    if [ "$CLAUDE_MODE" = "print" ]; then
        # Print mode: Execute prompt and exit
        info "Launching Claude in print mode for review"
        eval "$claude_cmd -p \"$review_prompt\" --max-turns $CLAUDE_MAX_TURNS"
    else
        # REPL mode: Start interactive session with initial prompt
        info "Launching Claude in REPL mode for review"
        eval "$claude_cmd \"$review_prompt\""
    fi
}

# Main function
main() {
    # Check Claude CLI availability first
    check_claude_cli
    
    # Show configuration
    log "Configuration:"
    log "  CLAUDE_MODE: $CLAUDE_MODE"
    log "  CLAUDE_MODEL: ${CLAUDE_MODEL:-default}"
    log "  CLAUDE_MAX_TURNS: $CLAUDE_MAX_TURNS"
    
    case "$1" in
        implement)
            if [ $# -lt 4 ]; then
                error "Usage: $0 implement <worktree_path> <issue_num> <agent_type>"
                echo "Environment variables:" >&2
                echo "  CLAUDE_MODE=print|repl (default: repl)" >&2
                echo "  CLAUDE_MODEL=<model> (optional)" >&2
                echo "  CLAUDE_MAX_TURNS=<number> (default: 20)" >&2
                exit 1
            fi
            launch_claude_agent "$2" "$3" "$4"
            ;;
        review)
            if [ $# -lt 3 ]; then
                error "Usage: $0 review <pr_num> <agent_type>"
                echo "Environment variables:" >&2
                echo "  CLAUDE_MODE=print|repl (default: repl)" >&2
                echo "  CLAUDE_MODEL=<model> (optional)" >&2
                echo "  CLAUDE_MAX_TURNS=<number> (default: 20)" >&2
                exit 1
            fi
            launch_review_agent "$2" "$3"
            ;;
        *)
            error "Usage: $0 {implement|review} [args...]"
            echo "" >&2
            echo "Commands:" >&2
            echo "  implement <worktree_path> <issue_num> <agent_type>" >&2
            echo "    Launch Claude to implement an issue in a worktree" >&2
            echo "" >&2
            echo "  review <pr_num> <agent_type>" >&2
            echo "    Launch Claude to review a pull request" >&2
            echo "" >&2
            echo "Environment variables:" >&2
            echo "  CLAUDE_MODE=print|repl (default: repl)" >&2
            echo "  CLAUDE_MODEL=<model> (optional)" >&2
            echo "  CLAUDE_MAX_TURNS=<number> (default: 20)" >&2
            exit 1
            ;;
    esac
}

main "$@"