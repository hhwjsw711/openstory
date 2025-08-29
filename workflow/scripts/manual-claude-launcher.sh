#!/bin/bash

# Manual Claude Launcher for Workflow Issues
# This script helps launch Claude Code manually when automatic launch fails

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKTREE_DIR="$PROJECT_ROOT/.trees"
STATE_DIR="$PROJECT_ROOT/workflow/state"
INSTRUCTIONS_DIR="$PROJECT_ROOT/workflow/instructions"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[LAUNCHER]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to list active worktrees with issues
list_active_worktrees() {
    echo -e "${MAGENTA}=== Active Worktrees ===${NC}"
    
    if [ ! -d "$STATE_DIR" ]; then
        warning "No state directory found. No issues being worked on."
        return 1
    fi
    
    local found=0
    for state_file in "$STATE_DIR"/issue-*.json; do
        if [ -f "$state_file" ]; then
            local issue_num=$(jq -r '.issue_number' "$state_file")
            local title=$(jq -r '.title' "$state_file")
            local agent=$(jq -r '.agent' "$state_file")
            local stage=$(jq -r '.stage' "$state_file")
            local worktree=$(jq -r '.worktree_path' "$state_file")
            local branch=$(jq -r '.branch' "$state_file")
            
            echo ""
            echo "Issue #$issue_num: $title"
            echo "  Agent: $agent"
            echo "  Stage: $stage"
            echo "  Branch: $branch"
            echo "  Path: $worktree"
            
            found=1
        fi
    done
    
    if [ $found -eq 0 ]; then
        warning "No active issues found."
        return 1
    fi
    
    return 0
}

# Function to launch Claude for a specific issue
launch_claude_for_issue() {
    local issue_num=$1
    
    local state_file="$STATE_DIR/issue-${issue_num}.json"
    if [ ! -f "$state_file" ]; then
        error "No state file found for issue #$issue_num"
        return 1
    fi
    
    local agent=$(jq -r '.agent' "$state_file")
    local stage=$(jq -r '.stage' "$state_file")
    local worktree=$(jq -r '.worktree_path' "$state_file")
    local instructions=$(jq -r '.instructions' "$state_file")
    
    log "Launching Claude for issue #$issue_num"
    info "Agent: $agent"
    info "Stage: $stage"
    info "Worktree: $worktree"
    
    # Check if worktree exists
    if [ ! -d "$worktree" ]; then
        error "Worktree directory not found: $worktree"
        return 1
    fi
    
    # Change to worktree directory
    cd "$worktree"
    
    # Create prompt
    local prompt="You are working as a $agent agent on issue #$issue_num.

Please read the instructions at $instructions and implement the issue.

Start by:
1. Reading the instructions file: cat $instructions
2. Understanding the codebase structure: ls -la
3. Reviewing the CLAUDE.md file for project guidelines
4. Implementing the required changes
5. Testing your implementation
6. Creating commits with descriptive messages
7. Creating a PR when complete

Remember to:
- Make descriptive commits frequently
- Run tests before creating PR
- Follow the project's coding standards
- Use the TodoWrite tool to track your progress"
    
    echo ""
    echo -e "${MAGENTA}=== Launching Claude ===${NC}"
    echo ""
    
    # Check if Claude CLI is available
    if command -v claude &> /dev/null; then
        echo "Claude CLI found. Launching..."
        echo ""
        echo "Working directory: $worktree"
        echo ""
        
        # Launch Claude
        claude "$prompt" --dangerously-skip-permissions
    else
        error "Claude CLI not found!"
        echo ""
        echo "Install Claude with:"
        echo "  npm install -g @anthropic-ai/claude"
        echo ""
        echo "Or run manually with this prompt:"
        echo ""
        echo "================================"
        echo "$prompt"
        echo "================================"
        return 1
    fi
}

# Function to show help
show_help() {
    echo "Manual Claude Launcher for Workflow Issues"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  list              - List all active worktrees and issues"
    echo "  launch <issue#>   - Launch Claude for a specific issue"
    echo "  help              - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 list                # Show all active issues"
    echo "  $0 launch 42           # Launch Claude for issue #42"
    echo ""
    echo "This script helps manually launch Claude when automatic launch fails."
    echo "It reads the workflow state and launches Claude with the correct context."
}

# Main logic
case "${1:-}" in
    list)
        list_active_worktrees
        ;;
    launch)
        if [ -z "${2:-}" ]; then
            error "Please specify an issue number"
            echo "Usage: $0 launch <issue#>"
            exit 1
        fi
        launch_claude_for_issue "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -n "${1:-}" ]; then
            error "Unknown command: $1"
            echo ""
        fi
        show_help
        exit 1
        ;;
esac