#!/bin/bash

# Workflow Manager for Claude Code Agent System
# Orchestrates issue assignment, worktree creation, and agent delegation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKFLOW_DIR="$PROJECT_ROOT/workflow"
WORKTREE_DIR="$PROJECT_ROOT/.trees"
STATE_DIR="$WORKFLOW_DIR/state"
INSTRUCTIONS_DIR="$WORKFLOW_DIR/instructions"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Initialize directories
mkdir -p "$STATE_DIR"
mkdir -p "$WORKTREE_DIR"
mkdir -p "$INSTRUCTIONS_DIR"

log() {
    echo -e "${GREEN}[WORKFLOW]${NC} $1" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

# Function to sanitize branch name
sanitize_branch_name() {
    local issue_num=$1
    local title=$2
    local sanitized=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
    sanitized="${sanitized:0:50}"
    echo "${issue_num}-${sanitized}"
}

# Function to determine issue type
determine_issue_type() {
    local title="$1"
    local body="$2"
    local labels="$3"
    
    if echo "$labels" | grep -qi "backend\|api\|database"; then
        echo "backend"
    elif echo "$labels" | grep -qi "frontend\|ui\|component"; then
        echo "frontend"
    elif echo "$labels" | grep -qi "qa\|test"; then
        echo "qa"
    else
        # Check content
        if echo "$title $body" | grep -qi "api\|endpoint\|database\|supabase\|qstash"; then
            echo "backend"
        elif echo "$title $body" | grep -qi "component\|ui\|react\|shadcn"; then
            echo "frontend"
        else
            echo "general"
        fi
    fi
}

# Function to select appropriate agent
select_agent() {
    local issue_type=$1
    local complexity=$2
    
    case "$issue_type" in
        backend)
            if [ "$complexity" = "high" ]; then
                echo "backend-tech-lead"
            else
                echo "backend-engineer"
            fi
            ;;
        frontend)
            if [ "$complexity" = "high" ]; then
                echo "frontend-architect"
            else
                echo "frontend-react-engineer"
            fi
            ;;
        qa)
            echo "qa-lead-tester"
            ;;
        *)
            echo "engineering-lead"
            ;;
    esac
}

# Function to create worktree
create_worktree() {
    local issue_num=$1
    local branch_name=$2
    local worktree_path="$WORKTREE_DIR/$branch_name"
    
    # Check if worktree already exists by checking git worktree list
    if git worktree list | grep -q "$worktree_path"; then
        info "Worktree already exists at $worktree_path"
        # Ensure we're on the right branch
        (cd "$worktree_path" && git checkout "$branch_name" 2>/dev/null || true)
        echo "$worktree_path"
        return 0
    fi
    
    log "Creating worktree for issue #$issue_num at $worktree_path"
    
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
    
    log "Setting up environment for worktree at $worktree_path"
    
    # Copy environment files from main project
    if [ -f "$PROJECT_ROOT/.env.local" ]; then
        cp "$PROJECT_ROOT/.env.local" "$worktree_path/"
        info "Copied .env.local"
    fi
    
    if [ -f "$PROJECT_ROOT/.env.development.local" ]; then
        cp "$PROJECT_ROOT/.env.development.local" "$worktree_path/"
        info "Copied .env.development.local"
    fi
    
    if [ -d "$PROJECT_ROOT/.vercel" ]; then
        cp -r "$PROJECT_ROOT/.vercel" "$worktree_path/"
        info "Copied .vercel directory"
    fi
    
    # Install dependencies
    log "Installing dependencies with pnpm..."
    (cd "$worktree_path" && pnpm install) || {
        error "Failed to install dependencies, but continuing..."
    }
    
    info "Worktree environment setup complete"
}

# Function to create agent instructions
create_agent_instructions() {
    local issue_num=$1
    local agent_type=$2
    local worktree_path=$3
    local issue_title=$4
    local issue_body=$5
    
    local instructions_file="$INSTRUCTIONS_DIR/issue-${issue_num}-instructions.md"
    
    cat > "$instructions_file" << EOF
# Agent Instructions for Issue #$issue_num

## Agent: $agent_type
## Working Directory: $worktree_path

## Issue Details
**Title:** $issue_title
**Description:**
$issue_body

## Your Task

You are tasked with implementing issue #$issue_num. Follow these steps:

### 1. Setup and Context
- Your working directory is already set to: $worktree_path
- You are on branch: $(cd "$worktree_path" && git branch --show-current)
- Review the project guidelines in CLAUDE.md

### 2. Implementation Steps
EOF

    # Add agent-specific instructions
    case "$agent_type" in
        backend-engineer|backend-tech-lead)
            cat >> "$instructions_file" << 'EOF'
- Review existing API patterns in /app/api/v1/
- Implement the required endpoint following REST principles
- Use Zod for input validation
- Ensure all DB operations go through API routes
- Queue long-running tasks with QStash if needed
- Write comprehensive tests using Vitest
EOF
            ;;
        frontend-react-engineer|frontend-architect)
            cat >> "$instructions_file" << 'EOF'
- Review existing components in /components/
- Use shadcn/ui components exclusively
- Apply theme variables, avoid inline Tailwind
- Use TanStack Query for server state
- Keep components pure and avoid useEffect when possible
- Write component tests
EOF
            ;;
        qa-lead-tester)
            cat >> "$instructions_file" << 'EOF'
- Review the implementation thoroughly
- Verify all acceptance criteria are met
- Check test coverage (>80% backend, >75% frontend)
- Validate error handling and edge cases
- Ensure no security vulnerabilities
- Verify performance is acceptable
EOF
            ;;
    esac

    cat >> "$instructions_file" << 'EOF'

### 3. Testing and Validation
- Run tests: `pnpm test`
- Check types: `pnpx tsc --noEmit`
- Lint code: `pnpx @biomejs/biome check --write .`

### 4. Commit Guidelines
- Make frequent, descriptive commits
- Format: `feat:` / `fix:` / `refactor:` + description
- Example: `feat: add user profile update endpoint`

### 5. Create Pull Request
When implementation is complete:
```bash
gh pr create \
  --title "fix: #ISSUE_NUM - ISSUE_TITLE" \
  --body "Closes #ISSUE_NUM\n\n## Changes\n- List changes here\n\n## Testing\n- Describe testing done"
```

### 6. Success Criteria
- [ ] All requirements implemented
- [ ] Tests written and passing
- [ ] Code linted and formatted
- [ ] Types check passing
- [ ] PR created with proper description

## Available Commands
- `pnpm dev` - Start development server
- `pnpm test` - Run tests
- `pnpm build` - Build the project
- `gh issue view ISSUE_NUM` - View issue details
- `gh pr create` - Create pull request
- `gh pr checks` - View PR checks status

Remember to use the TodoWrite tool to track your progress!
EOF

    # Replace placeholders
    sed -i.bak "s/ISSUE_NUM/$issue_num/g" "$instructions_file"
    sed -i.bak "s/ISSUE_TITLE/$issue_title/g" "$instructions_file"
    rm -f "${instructions_file}.bak"
    
    echo "$instructions_file"
}

# Function to launch Claude with agent
launch_claude_with_agent() {
    local worktree_path=$1
    local agent_type=$2
    local instructions_file=$3
    
    log "Launching Claude Code with $agent_type agent"
    
    # Open Cursor in the worktree
    info "Opening Cursor IDE at $worktree_path"
    cursor "$worktree_path" &
    
    sleep 3
    
    # Create a launch script that can be run in Cursor's terminal
    local launch_script="$worktree_path/.launch-claude.sh"
    
    cat > "$launch_script" << EOF
#!/bin/bash
# Launch Claude Code with agent context

echo "Starting Claude Code with $agent_type agent..."
echo ""
echo "Instructions are available at: $instructions_file"
echo ""
echo "To begin, tell Claude:"
echo "  'Please read the instructions at $instructions_file and implement issue #$issue_num'"
echo ""
echo "Claude will use the $agent_type agent to complete the task."
echo ""

# Start Claude Code
claude chat
EOF

    chmod +x "$launch_script"
    
    # Create VS Code tasks.json for auto-launch
    mkdir -p "$worktree_path/.vscode"
    cat > "$worktree_path/.vscode/tasks.json" << 'EOF'
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Launch Claude Agent",
      "type": "shell",
      "command": "${workspaceFolder}/.launch-claude.sh",
      "presentation": {
        "reveal": "always",
        "panel": "new",
        "focus": true
      },
      "runOptions": {
        "runOn": "folderOpen"
      },
      "problemMatcher": []
    }
  ]
}
EOF
    
    # Also create settings to enable task auto-run
    cat > "$worktree_path/.vscode/settings.json" << 'EOF'
{
  "task.allowAutomaticTasks": "on"
}
EOF
    
    info "Launch script created at $launch_script"
    info "Claude will auto-launch when Cursor opens (via VS Code task)"
}

# Function to process issue
process_issue() {
    local issue_num=$1
    
    log "Processing issue #$issue_num"
    
    # Get issue details
    local issue_json=$(gh issue view "$issue_num" --json number,title,body,labels)
    local title=$(echo "$issue_json" | jq -r '.title')
    local body=$(echo "$issue_json" | jq -r '.body // ""')
    local labels=$(echo "$issue_json" | jq -r '.labels | map(.name) | join(" ")')
    
    # Determine issue type and complexity
    local issue_type=$(determine_issue_type "$title" "$body" "$labels")
    local complexity="normal"  # Could be enhanced with complexity detection
    
    # Select appropriate agent
    local agent_type=$(select_agent "$issue_type" "$complexity")
    
    log "Issue type: $issue_type, Agent: $agent_type"
    
    # Create branch name
    local branch_name=$(sanitize_branch_name "$issue_num" "$title")
    
    # Create worktree
    local worktree_path=$(create_worktree "$issue_num" "$branch_name")
    
    # Create agent instructions
    local instructions_file=$(create_agent_instructions "$issue_num" "$agent_type" "$worktree_path" "$title" "$body")
    
    # Track state
    local state_file="$STATE_DIR/issue-${issue_num}.json"
    cat > "$state_file" << EOF
{
  "issue_number": $issue_num,
  "title": "$title",
  "agent": "$agent_type",
  "worktree_path": "$worktree_path",
  "branch": "$branch_name",
  "instructions": "$instructions_file",
  "status": "assigned",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

    # Launch Claude with agent
    launch_claude_with_agent "$worktree_path" "$agent_type" "$instructions_file"
    
    log "Issue #$issue_num assigned to $agent_type"
}

# Function to monitor PR reviews
monitor_pr_reviews() {
    log "Checking for PRs that need review..."
    
    local prs=$(gh pr list --json number,headRefName,state,reviews)
    
    echo "$prs" | jq -c '.[]' | while read -r pr; do
        local pr_num=$(echo "$pr" | jq -r '.number')
        local branch=$(echo "$pr" | jq -r '.headRefName')
        local reviews=$(echo "$pr" | jq -r '.reviews | length')
        
        if [ "$reviews" -eq 0 ]; then
            log "PR #$pr_num needs review"
            
            # Create review instructions
            local review_file="$INSTRUCTIONS_DIR/pr-${pr_num}-review.md"
            cat > "$review_file" << EOF
# Review Instructions for PR #$pr_num

Please review this PR using the qa-lead-tester agent:

1. Check the diff: gh pr diff $pr_num
2. Verify CI checks: gh pr checks $pr_num
3. Review for:
   - Code quality and patterns
   - Test coverage
   - Security issues
   - Performance concerns
4. Leave feedback: gh pr review $pr_num --comment -b "feedback"
5. Approve or request changes

Use the Task tool to invoke the qa-lead-tester agent for this review.
EOF
            
            info "Review instructions created at $review_file"
        fi
    done
}

# Function to cleanup merged PRs
cleanup_merged() {
    log "Cleaning up merged PRs..."
    
    # First prune any stale worktrees
    git worktree prune
    
    local merged=$(gh pr list --state merged --json number,headRefName)
    
    echo "$merged" | jq -c '.[]' | while read -r pr; do
        local pr_num=$(echo "$pr" | jq -r '.number')
        local branch=$(echo "$pr" | jq -r '.headRefName')
        local issue_num=$(echo "$branch" | cut -d'-' -f1)
        
        local worktree_path="$WORKTREE_DIR/$branch"
        
        if [ -d "$worktree_path" ]; then
            log "Cleaning up worktree for PR #$pr_num"
            git worktree remove "$worktree_path" --force 2>/dev/null || true
            git branch -D "$branch" 2>/dev/null || true
            rm -f "$STATE_DIR/issue-${issue_num}.json"
            rm -f "$INSTRUCTIONS_DIR/issue-${issue_num}-instructions.md"
        fi
    done
    
    # Clean up any orphaned worktrees
    cleanup_orphaned_worktrees
}

# Function to cleanup orphaned worktrees
cleanup_orphaned_worktrees() {
    log "Checking for orphaned worktrees..."
    
    # Get list of all worktrees
    git worktree list --porcelain | grep "^worktree " | cut -d' ' -f2 | while read -r worktree_path; do
        # Skip the main worktree
        if [ "$worktree_path" = "$PROJECT_ROOT" ]; then
            continue
        fi
        
        # Check if worktree directory exists
        if [ ! -d "$worktree_path" ]; then
            warning "Removing stale worktree entry: $worktree_path"
            git worktree prune
        fi
    done
}

# Function to show status
show_status() {
    echo -e "${MAGENTA}=== Workflow Status ===${NC}"
    
    echo -e "\n${BLUE}Active Issues:${NC}"
    if ls "$STATE_DIR"/*.json >/dev/null 2>&1; then
        for state_file in "$STATE_DIR"/*.json; do
            local issue_num=$(jq -r '.issue_number' "$state_file")
            local agent=$(jq -r '.agent' "$state_file")
            local status=$(jq -r '.status' "$state_file")
            echo "  Issue #$issue_num - Agent: $agent - Status: $status"
        done
    else
        echo "  No active issues"
    fi
    
    echo -e "\n${BLUE}Worktrees:${NC}"
    git worktree list | grep -v "$(pwd)" || echo "  No active worktrees"
    
    echo -e "\n${BLUE}Open PRs:${NC}"
    gh pr list --limit 10 || echo "  No open PRs"
}

# Main command handler
case "${1:-}" in
    assign)
        if [ -z "${2:-}" ]; then
            error "Usage: $0 assign <issue_number>"
            exit 1
        fi
        process_issue "$2"
        ;;
    review)
        monitor_pr_reviews
        ;;
    cleanup)
        cleanup_merged
        ;;
    status)
        show_status
        ;;
    reset)
        log "Resetting all worktrees and state..."
        git worktree prune
        rm -rf "$WORKTREE_DIR"/*
        rm -f "$STATE_DIR"/*.json
        rm -f "$INSTRUCTIONS_DIR"/*.md
        log "Reset complete"
        ;;
    *)
        echo "Claude Code Workflow Manager"
        echo ""
        echo "Usage: $0 {assign|review|cleanup|status|reset}"
        echo ""
        echo "Commands:"
        echo "  assign <issue_num>  - Assign issue to appropriate agent"
        echo "  review             - Check for PRs needing review"
        echo "  cleanup            - Clean up merged PR worktrees"
        echo "  status             - Show current workflow status"
        echo "  reset              - Reset all worktrees and state"
        echo ""
        echo "Example workflow:"
        echo "  1. $0 assign 123    # Assign issue #123 to an agent"
        echo "  2. Agent works in Cursor with Claude Code"
        echo "  3. $0 review        # Check for PRs to review"
        echo "  4. $0 cleanup       # Clean up after merge"
        exit 1
        ;;
esac