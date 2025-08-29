#!/bin/bash

# Agent Launcher for Claude Code
# Launches Claude with specific agent context in a worktree

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKFLOW_DIR="$PROJECT_ROOT/workflow"
CONFIG_DIR="$WORKFLOW_DIR/config"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[AGENT-LAUNCHER]${NC} $1"
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

    # Launch Claude in the terminal
    # This assumes claude CLI is available
    echo "$initial_prompt" | claude chat --model claude-3-5-sonnet-20241022
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

    echo "$review_prompt" | claude chat --model claude-3-5-sonnet-20241022
}

# Main function
main() {
    case "$1" in
        implement)
            if [ $# -lt 4 ]; then
                echo "Usage: $0 implement <worktree_path> <issue_num> <agent_type>"
                exit 1
            fi
            launch_claude_agent "$2" "$3" "$4"
            ;;
        review)
            if [ $# -lt 3 ]; then
                echo "Usage: $0 review <pr_num> <agent_type>"
                exit 1
            fi
            launch_review_agent "$2" "$3"
            ;;
        *)
            echo "Usage: $0 {implement|review} [args...]"
            exit 1
            ;;
    esac
}

main "$@"