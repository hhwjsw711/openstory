#!/bin/bash

# Workflow Orchestrator for Claude Code
# Manages issue assignment, worktree creation, and agent coordination

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKFLOW_DIR="$PROJECT_ROOT/workflow"
WORKTREE_DIR="$PROJECT_ROOT/.trees"
STATE_DIR="$WORKFLOW_DIR/state"
CONFIG_DIR="$WORKFLOW_DIR/config"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize state directory
mkdir -p "$STATE_DIR"
mkdir -p "$WORKTREE_DIR"

# Function to log messages
log() {
    echo -e "${GREEN}[ORCHESTRATOR]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to get open issues from GitHub
get_open_issues() {
    log "Fetching open issues from GitHub..."
    gh issue list --state open --json number,title,labels,assignees,body --limit 50
}

# Function to sanitize branch name
sanitize_branch_name() {
    local issue_num=$1
    local title=$2
    # Convert to lowercase, replace spaces with hyphens, remove special chars
    local sanitized=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
    # Truncate to 50 chars
    sanitized="${sanitized:0:50}"
    echo "${issue_num}-${sanitized}"
}

# Function to determine issue type (backend/frontend)
determine_issue_type() {
    local title="$1"
    local body="$2"
    local labels="$3"
    
    # Check labels first
    if echo "$labels" | grep -qi "backend\|api\|database\|supabase"; then
        echo "backend"
    elif echo "$labels" | grep -qi "frontend\|ui\|component\|react"; then
        echo "frontend"
    # Check title and body for keywords
    elif echo "$title $body" | grep -qi "api\|endpoint\|database\|supabase\|auth\|queue"; then
        echo "backend"
    elif echo "$title $body" | grep -qi "component\|ui\|react\|form\|page\|button"; then
        echo "frontend"
    else
        echo "general"
    fi
}

# Function to create worktree for issue
create_worktree() {
    local issue_num=$1
    local branch_name=$2
    local worktree_path="$WORKTREE_DIR/$branch_name"
    
    log "Creating worktree for issue #$issue_num..."
    
    # Check if worktree already exists by checking git worktree list
    if git worktree list | grep -q "$worktree_path"; then
        log "Worktree already exists for $branch_name"
        # Ensure we're on the right branch
        (cd "$worktree_path" && git checkout "$branch_name" 2>/dev/null || true)
        echo "$worktree_path"
        return 0
    fi
    
    # Check if directory exists but is not a worktree (cleanup needed)
    if [ -d "$worktree_path" ]; then
        warning "Directory exists but is not a worktree, cleaning up..."
        rm -rf "$worktree_path"
    fi
    
    # Check if branch exists locally
    if git show-ref --verify --quiet "refs/heads/$branch_name"; then
        log "Branch $branch_name already exists locally"
        git worktree add "$worktree_path" "$branch_name"
    # Check if branch exists on remote
    elif git ls-remote --heads origin "$branch_name" | grep -q "$branch_name"; then
        log "Branch $branch_name exists on remote, checking out"
        git fetch origin "$branch_name":"$branch_name"
        git worktree add "$worktree_path" "$branch_name"
    else
        log "Creating new branch $branch_name from main"
        git worktree add -b "$branch_name" "$worktree_path" main
    fi
    
    # Setup worktree environment
    setup_worktree_environment "$worktree_path"
    
    echo "$worktree_path"
}

# Function to setup worktree environment
setup_worktree_environment() {
    local worktree_path=$1
    
    log "Setting up environment for worktree..."
    
    # Copy environment files from main project
    if [ -f "$PROJECT_ROOT/.env.local" ]; then
        cp "$PROJECT_ROOT/.env.local" "$worktree_path/"
        log "Copied .env.local"
    fi
    
    if [ -f "$PROJECT_ROOT/.env.development.local" ]; then
        cp "$PROJECT_ROOT/.env.development.local" "$worktree_path/"
        log "Copied .env.development.local"
    fi
    
    if [ -d "$PROJECT_ROOT/.vercel" ]; then
        cp -r "$PROJECT_ROOT/.vercel" "$worktree_path/"
        log "Copied .vercel directory"
    fi
    
    # Install dependencies
    log "Installing dependencies with pnpm..."
    (cd "$worktree_path" && pnpm install --frozen-lockfile) || {
        warning "Failed to install dependencies, but continuing..."
    }
    
    log "Worktree environment setup complete"
}

# Function to open Cursor with Claude
open_cursor_with_claude() {
    local worktree_path=$1
    local issue_num=$2
    local issue_type=$3
    local agent_type=$4
    
    log "Opening Cursor IDE for issue #$issue_num with $agent_type agent..."
    
    # Open Cursor in the worktree directory
    cursor "$worktree_path" &
    
    # Wait for Cursor to open
    sleep 3
    
    # Create agent context file
    create_agent_context "$worktree_path" "$issue_num" "$agent_type"
    
    log "Cursor opened with context for $agent_type agent"
}

# Function to create agent context
create_agent_context() {
    local worktree_path=$1
    local issue_num=$2
    local agent_type=$3
    
    local context_file="$worktree_path/.claude-context.md"
    local issue_data=$(gh issue view "$issue_num" --json number,title,body,labels,assignees)
    
    cat > "$context_file" << EOF
# Agent Context

## Agent Type: $agent_type

## Issue Information
- **Issue Number**: #$issue_num
- **Branch**: $(cd "$worktree_path" && git branch --show-current)

## Issue Details
$(echo "$issue_data" | jq -r '
"### Title: " + .title + "\n\n" +
"### Description:\n" + .body + "\n\n" +
"### Labels: " + (.labels | map(.name) | join(", "))
')

## Instructions for $agent_type

You are working on issue #$issue_num in an isolated git worktree. Please:

1. **Understand the Issue**: Review the issue description and requirements
2. **Implement the Solution**: Make the necessary code changes
3. **Test Your Changes**: Run tests to ensure everything works
4. **Commit Regularly**: Make commits with descriptive messages
5. **Create PR When Done**: Use 'gh pr create' to create a pull request

### Commit Guidelines
- Make commits after each logical change
- Use descriptive commit messages
- Format: "feat: " / "fix: " / "refactor: " + description

### Testing Requirements
- Run 'pnpm test' before creating PR
- Run 'pnpx @biomejs/biome check --write .' for linting
- Run 'pnpx tsc --noEmit' for type checking

### PR Creation
When implementation is complete, create a PR with:
\`\`\`bash
gh pr create --title "fix: #$issue_num - [Issue Title]" --body "[PR Description]"
\`\`\`

## Available Commands
- pnpm dev - Start development server
- pnpm test - Run tests
- pnpx @biomejs/biome check --write . - Lint and format
- pnpx tsc --noEmit - Type check
- gh pr create - Create pull request

EOF
    
    log "Created context file at $context_file"
}

# Function to track state
track_state() {
    local issue_num=$1
    local state=$2
    local agent=$3
    local worktree_path=$4
    
    local state_file="$STATE_DIR/issue-$issue_num.json"
    
    cat > "$state_file" << EOF
{
  "issue_number": $issue_num,
  "state": "$state",
  "agent": "$agent",
  "worktree_path": "$worktree_path",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

# Function to process single issue
process_issue() {
    local issue_num=$1
    local title=$2
    local body=$3
    local labels=$4
    
    log "Processing issue #$issue_num: $title"
    
    # Check if already being processed
    if [ -f "$STATE_DIR/issue-$issue_num.json" ]; then
        warning "Issue #$issue_num is already being processed"
        return
    fi
    
    # Determine issue type
    local issue_type=$(determine_issue_type "$title" "$body" "$labels")
    log "Issue type determined: $issue_type"
    
    # Determine agent
    local agent_type
    case "$issue_type" in
        backend)
            agent_type="backend-engineer"
            ;;
        frontend)
            agent_type="frontend-react-engineer"
            ;;
        *)
            agent_type="general"
            ;;
    esac
    
    # Create branch name
    local branch_name=$(sanitize_branch_name "$issue_num" "$title")
    
    # Create worktree
    local worktree_path=$(create_worktree "$issue_num" "$branch_name")
    if [ $? -ne 0 ]; then
        error "Failed to create worktree for issue #$issue_num"
        return
    fi
    
    # Track state
    track_state "$issue_num" "in_progress" "$agent_type" "$worktree_path"
    
    # Open Cursor with Claude context
    open_cursor_with_claude "$worktree_path" "$issue_num" "$issue_type" "$agent_type"
    
    log "Issue #$issue_num is now being processed by $agent_type agent"
}

# Function to monitor PR status
monitor_prs() {
    log "Monitoring pull requests..."
    
    # Get open PRs
    local prs=$(gh pr list --json number,headRefName,state)
    
    echo "$prs" | jq -r '.[] | "\(.number) \(.headRefName) \(.state)"' | while read -r pr_num branch state; do
        # Check if this PR corresponds to a tracked issue
        local issue_num=$(echo "$branch" | cut -d'-' -f1)
        local state_file="$STATE_DIR/issue-$issue_num.json"
        
        if [ -f "$state_file" ]; then
            local current_state=$(jq -r '.state' "$state_file")
            
            if [ "$current_state" = "in_progress" ] && [ "$state" = "OPEN" ]; then
                log "PR #$pr_num created for issue #$issue_num - initiating review"
                track_state "$issue_num" "in_review" "qa-lead-tester" "$(jq -r '.worktree_path' "$state_file")"
                initiate_pr_review "$pr_num" "$issue_num"
            fi
        fi
    done
}

# Function to initiate PR review
initiate_pr_review() {
    local pr_num=$1
    local issue_num=$2
    
    log "Initiating review for PR #$pr_num (Issue #$issue_num)"
    
    # Add reviewers
    gh pr edit "$pr_num" --add-reviewer "@me" 2>/dev/null || true
    
    # Add labels
    gh pr edit "$pr_num" --add-label "needs-review" 2>/dev/null || true
    
    # Comment on PR
    gh pr comment "$pr_num" --body "Review initiated by orchestrator. QA Lead will review for test coverage and quality."
}

# Function to cleanup after merge
cleanup_merged() {
    log "Checking for merged PRs to cleanup..."
    
    # Get merged PRs
    local merged_prs=$(gh pr list --state merged --json number,headRefName)
    
    echo "$merged_prs" | jq -r '.[] | "\(.number) \(.headRefName)"' | while read -r pr_num branch; do
        local issue_num=$(echo "$branch" | cut -d'-' -f1)
        local state_file="$STATE_DIR/issue-$issue_num.json"
        
        if [ -f "$state_file" ]; then
            local worktree_path=$(jq -r '.worktree_path' "$state_file")
            
            if [ -d "$worktree_path" ]; then
                log "Cleaning up worktree for merged PR #$pr_num"
                git worktree remove "$worktree_path" --force 2>/dev/null || true
                git branch -D "$branch" 2>/dev/null || true
                rm -f "$state_file"
                log "Cleanup complete for issue #$issue_num"
            fi
        fi
    done
}

# Main orchestration loop
main() {
    log "Starting workflow orchestrator..."
    
    while true; do
        # Get open issues
        local issues=$(get_open_issues)
        
        # Process each issue
        echo "$issues" | jq -c '.[]' | while read -r issue; do
            local issue_num=$(echo "$issue" | jq -r '.number')
            local title=$(echo "$issue" | jq -r '.title')
            local body=$(echo "$issue" | jq -r '.body // ""')
            local labels=$(echo "$issue" | jq -r '.labels | map(.name) | join(" ")')
            
            # Skip if already assigned
            local assignees=$(echo "$issue" | jq -r '.assignees | length')
            if [ "$assignees" -eq 0 ]; then
                process_issue "$issue_num" "$title" "$body" "$labels"
                sleep 5  # Avoid overwhelming the system
            fi
        done
        
        # Monitor PRs
        monitor_prs
        
        # Cleanup merged PRs
        cleanup_merged
        
        # Wait before next iteration
        log "Waiting 60 seconds before next check..."
        sleep 60
    done
}

# Handle script arguments
case "${1:-}" in
    start)
        main
        ;;
    status)
        log "Current workflow state:"
        ls -la "$STATE_DIR"/*.json 2>/dev/null | while read -r file; do
            echo "$(basename "$file"): $(jq -c '.' "$file")"
        done
        ;;
    cleanup)
        log "Cleaning up all worktrees..."
        git worktree prune
        rm -rf "$WORKTREE_DIR"/*
        rm -f "$STATE_DIR"/*.json
        log "Cleanup complete"
        ;;
    *)
        echo "Usage: $0 {start|status|cleanup}"
        exit 1
        ;;
esac