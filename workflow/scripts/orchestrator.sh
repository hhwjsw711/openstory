#!/bin/bash

# Simplified Workflow Orchestrator for Claude Code
# Monitors GitHub Project for "ready to code" issues and delegates to workflow-manager

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKFLOW_DIR="$PROJECT_ROOT/workflow"
STATE_DIR="$WORKFLOW_DIR/state"

# GitHub Project configuration
GITHUB_ORG="velro-ai"
GITHUB_PROJECT_NUMBER="1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Initialize state directory
mkdir -p "$STATE_DIR"

# Function to log messages
log() {
    echo -e "${GREEN}[ORCHESTRATOR]${NC} $1" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

# Function to get issues with "ready to code" status from GitHub Project
get_ready_to_code_issues() {
    log "Fetching 'ready to code' issues from GitHub Project #${GITHUB_PROJECT_NUMBER}..."
    
    # Use GitHub GraphQL API to query project items
    local query='query($org: String!, $number: Int!) {
      organization(login: $org) {
        projectV2(number: $number) {
          items(first: 100) {
            nodes {
              id
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2SingleSelectField {
                        name
                      }
                    }
                  }
                }
              }
              content {
                ... on Issue {
                  number
                  title
                  body
                  state
                  assignees(first: 10) {
                    nodes {
                      login
                    }
                  }
                  labels(first: 10) {
                    nodes {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }'
    
    # Execute GraphQL query and check for errors
    local response=$(gh api graphql -f query="$query" -f org="$GITHUB_ORG" -F number="$GITHUB_PROJECT_NUMBER" 2>&1)
    
    # Check if we have permission errors
    if echo "$response" | grep -q "read:project"; then
        error "GitHub token missing 'read:project' scope!"
        warning "Please add the 'project' scope to your GitHub token at: https://github.com/settings/tokens"
        warning "Or set GH_TOKEN with a token that has the required scope"
        
        # Fallback to label-based detection if configured
        if [ "${FALLBACK_TO_LABELS:-yes}" = "yes" ]; then
            warning "Falling back to label-based detection..."
            get_ready_to_code_by_label
        fi
        return 1
    fi
    
    # Parse and filter for "ready to code" status (and optionally unassigned)
    local skip_assigned="${SKIP_ASSIGNED_ISSUES:-true}"
    
    if [ "$skip_assigned" = "true" ]; then
        # Filter for unassigned issues only
        echo "$response" | jq -r '
          .data.organization.projectV2.items.nodes[] |
          select(
            .content.state == "OPEN" and
            (.fieldValues.nodes[] | select(.field.name == "Status" and .name == "Ready to Code")) and
            (.content.assignees.nodes | length == 0)
          ) |
          .content | {
            number: .number,
            title: .title,
            body: .body,
            labels: [.labels.nodes[].name],
            assignees: [.assignees.nodes[].login]
          }
        ' 2>/dev/null || echo ""
    else
        # Include all ready to code issues
        echo "$response" | jq -r '
          .data.organization.projectV2.items.nodes[] |
          select(
            .content.state == "OPEN" and
            (.fieldValues.nodes[] | select(.field.name == "Status" and .name == "Ready to Code"))
          ) |
          .content | {
            number: .number,
            title: .title,
            body: .body,
            labels: [.labels.nodes[].name],
            assignees: [.assignees.nodes[].login]
          }
        ' 2>/dev/null || echo ""
    fi
}

# Fallback function to get issues by label
get_ready_to_code_by_label() {
    log "Using label-based detection for 'ready-to-code' issues..."
    
    # Get issues with "ready-to-code" label
    gh issue list \
        --state open \
        --label "ready-to-code" \
        --json number,title,body,labels \
        --limit 100 \
        2>/dev/null | jq -r '.[] | {
            number: .number,
            title: .title,
            body: .body,
            labels: [.labels[].name]
        }' || echo ""
}

# Function to check if issue is already being processed
is_issue_processed() {
    local issue_num=$1
    [ -f "$STATE_DIR/issue-${issue_num}-processed.flag" ]
}

# Function to mark issue as processed
mark_issue_processed() {
    local issue_num=$1
    touch "$STATE_DIR/issue-${issue_num}-processed.flag"
}

# Function to delegate to workflow-manager
delegate_to_workflow_manager() {
    local issue_num=$1
    local stage=${2:-triage}  # Default to triage stage
    
    log "Delegating issue #$issue_num to workflow-manager (stage: $stage)"
    
    # Call workflow-manager script
    if [ -f "$SCRIPT_DIR/workflow-manager.sh" ]; then
        # Export environment variables that workflow-manager might need
        export LAUNCH_METHOD="${LAUNCH_METHOD:-cursor}"
        export CLAUDE_MODE="${CLAUDE_MODE:-repl}"
        export CLAUDE_MODEL="${CLAUDE_MODEL:-}"
        export CLAUDE_MAX_TURNS="${CLAUDE_MAX_TURNS:-20}"
        
        # Execute workflow-manager
        "$SCRIPT_DIR/workflow-manager.sh" "$stage" "$issue_num"
        
        if [ $? -eq 0 ]; then
            mark_issue_processed "$issue_num"
            log "Successfully delegated issue #$issue_num to workflow-manager"
        else
            error "Failed to delegate issue #$issue_num to workflow-manager"
        fi
    else
        error "workflow-manager.sh not found at $SCRIPT_DIR/workflow-manager.sh"
        return 1
    fi
}

# Function to cleanup processed flags for closed/merged issues
cleanup_processed_flags() {
    log "Cleaning up processed flags for closed issues..."
    
    # Get all closed issues
    local closed_issues=$(gh issue list --state closed --json number --limit 100 | jq -r '.[].number')
    
    # Remove flags for closed issues
    for issue_num in $closed_issues; do
        local flag_file="$STATE_DIR/issue-${issue_num}-processed.flag"
        if [ -f "$flag_file" ]; then
            rm -f "$flag_file"
            info "Cleaned up flag for closed issue #$issue_num"
        fi
    done
}

# Main orchestration loop
main() {
    log "Starting simplified workflow orchestrator..."
    log "Monitoring GitHub Project #${GITHUB_PROJECT_NUMBER} for 'ready to code' issues"
    
    local check_interval="${CHECK_INTERVAL:-60}"
    local stage="${DEFAULT_STAGE:-assign}"  # Default to triage/assign stage
    
    while true; do
        log "Checking for 'ready to code' issues..."
        
        # Get issues with "ready to code" status
        local ready_issues=$(get_ready_to_code_issues)
        
        if [ -z "$ready_issues" ] || [ "$ready_issues" = "null" ]; then
            info "No issues with 'ready to code' status found"
        else
            # Process each ready issue
            echo "$ready_issues" | jq -c '.' | while read -r issue; do
                local issue_num=$(echo "$issue" | jq -r '.number')
                
                # Skip if already processed
                if is_issue_processed "$issue_num"; then
                    info "Issue #$issue_num already processed, skipping"
                    continue
                fi
                
                log "Found issue #$issue_num with 'ready to code' status"
                
                # Delegate to workflow-manager
                delegate_to_workflow_manager "$issue_num" "$stage"
                
                # Add delay between processing issues
                sleep 5
            done
        fi
        
        # Cleanup old processed flags periodically
        cleanup_processed_flags
        
        # Wait before next check
        info "Waiting ${check_interval} seconds before next check..."
        sleep "$check_interval"
    done
}

# Function to show status
show_status() {
    echo -e "${MAGENTA}=== Orchestrator Status ===${NC}"
    
    echo -e "\n${BLUE}Configuration:${NC}"
    echo "  GitHub Org: $GITHUB_ORG"
    echo "  Project Number: $GITHUB_PROJECT_NUMBER"
    echo "  Launch Method: ${LAUNCH_METHOD:-cursor}"
    echo "  Default Stage: ${DEFAULT_STAGE:-assign}"
    
    echo -e "\n${BLUE}Processed Issues:${NC}"
    local processed_count=$(ls -1 "$STATE_DIR"/issue-*-processed.flag 2>/dev/null | wc -l)
    echo "  Total processed: $processed_count"
    
    if [ "$processed_count" -gt 0 ]; then
        echo "  Recent issues:"
        ls -1t "$STATE_DIR"/issue-*-processed.flag 2>/dev/null | head -5 | while read -r flag; do
            local issue_num=$(basename "$flag" | sed 's/issue-\([0-9]*\)-processed.flag/\1/')
            echo "    - Issue #$issue_num"
        done
    fi
    
    # Check workflow-manager status if available
    if [ -f "$SCRIPT_DIR/workflow-manager.sh" ]; then
        echo -e "\n${BLUE}Workflow Manager Status:${NC}"
        "$SCRIPT_DIR/workflow-manager.sh" status 2>/dev/null || echo "  Unable to get workflow-manager status"
    fi
}

# Function to reset state
reset_state() {
    log "Resetting orchestrator state..."
    
    # Remove all processed flags
    rm -f "$STATE_DIR"/issue-*-processed.flag
    
    # Call workflow-manager reset if available
    if [ -f "$SCRIPT_DIR/workflow-manager.sh" ]; then
        log "Resetting workflow-manager state..."
        "$SCRIPT_DIR/workflow-manager.sh" reset
    fi
    
    log "State reset complete"
}

# Handle script arguments
case "${1:-}" in
    start)
        main
        ;;
    status)
        show_status
        ;;
    reset)
        reset_state
        ;;
    test)
        # Test mode - just check for ready issues once
        log "Test mode - checking for 'ready to code' issues..."
        get_ready_to_code_issues | jq '.'
        ;;
    *)
        echo "Simplified Workflow Orchestrator"
        echo ""
        echo "Usage: $0 {start|status|reset|test}"
        echo ""
        echo "Commands:"
        echo "  start   - Start monitoring GitHub Project for 'ready to code' issues"
        echo "  status  - Show current orchestrator status"
        echo "  reset   - Reset all state and processed flags"
        echo "  test    - Test mode - check for ready issues once"
        echo ""
        echo "Environment Variables:"
        echo "  GITHUB_ORG=<org>                - GitHub organization (default: velro-ai)"
        echo "  GITHUB_PROJECT_NUMBER=<num>     - Project number (default: 1)"
        echo "  CHECK_INTERVAL=<seconds>        - Check interval in seconds (default: 60)"
        echo "  DEFAULT_STAGE=assign|implement  - Default workflow stage (default: assign)"
        echo "  LAUNCH_METHOD=cursor|claude-cli - How to launch agents (default: cursor)"
        echo "  SKIP_ASSIGNED_ISSUES=true|false - Skip already assigned issues (default: true)"
        echo "  FALLBACK_TO_LABELS=yes|no       - Use label fallback if no project access (default: yes)"
        echo ""
        echo "Examples:"
        echo "  # Start with default settings (triage stage):"
        echo "  $0 start"
        echo ""
        echo "  # Start with direct implementation (skip triage):"
        echo "  DEFAULT_STAGE=implement $0 start"
        echo ""
        echo "  # Use Claude CLI instead of Cursor:"
        echo "  LAUNCH_METHOD=claude-cli $0 start"
        echo ""
        echo "  # Check status:"
        echo "  $0 status"
        exit 0
        ;;
esac