#!/bin/bash
#
# Main Workflow Orchestrator
# Coordinates the entire development workflow using Claude Code's native capabilities
#

set -e

# Configuration
WORKFLOW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$WORKFLOW_DIR")"
CONFIG_DIR="${WORKFLOW_DIR}/config"
STATE_DIR="${WORKFLOW_DIR}/state"
WORKTREE_DIR="${PROJECT_ROOT}/.trees"
LOGS_DIR="${WORKFLOW_DIR}/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize directories
init_directories() {
    mkdir -p "$STATE_DIR"
    mkdir -p "$WORKTREE_DIR"
    mkdir -p "$LOGS_DIR"
    mkdir -p "${STATE_DIR}/issues"
    mkdir -p "${STATE_DIR}/agents"
    mkdir -p "${STATE_DIR}/worktrees"
}

# Logging functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "${LOGS_DIR}/orchestrator.log"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    echo "[ERROR] $1" >> "${LOGS_DIR}/orchestrator.log"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[WARNING] $1" >> "${LOGS_DIR}/orchestrator.log"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check for required tools
    command -v gh >/dev/null 2>&1 || { error "gh CLI is not installed"; exit 1; }
    command -v git >/dev/null 2>&1 || { error "git is not installed"; exit 1; }
    command -v jq >/dev/null 2>&1 || { error "jq is not installed"; exit 1; }
    command -v yq >/dev/null 2>&1 || { error "yq is not installed"; exit 1; }
    
    # Check GitHub authentication
    gh auth status >/dev/null 2>&1 || { error "Not authenticated with GitHub. Run 'gh auth login'"; exit 1; }
    
    # Check if we're in a git repository
    git rev-parse --git-dir >/dev/null 2>&1 || { error "Not in a git repository"; exit 1; }
    
    log "All prerequisites met"
}

# Main workflow functions
source "${WORKFLOW_DIR}/lib/issue-triage.sh"
source "${WORKFLOW_DIR}/lib/agent-manager.sh"
source "${WORKFLOW_DIR}/lib/worktree-manager.sh"
source "${WORKFLOW_DIR}/lib/pr-manager.sh"
source "${WORKFLOW_DIR}/lib/state-manager.sh"

# Main workflow loop
run_workflow() {
    local mode="${1:-continuous}"
    local max_concurrent="${2:-4}"
    
    log "Starting workflow in ${mode} mode with max ${max_concurrent} concurrent agents"
    
    while true; do
        # Step 1: Triage new issues
        log "Triaging issues..."
        triage_issues
        
        # Step 2: Assign issues to agents
        log "Assigning issues to agents..."
        assign_issues_to_agents "$max_concurrent"
        
        # Step 3: Monitor active agents
        log "Monitoring active agents..."
        monitor_active_agents
        
        # Step 4: Handle completed work
        log "Processing completed work..."
        process_completed_work
        
        # Step 5: Coordinate PR reviews
        log "Coordinating PR reviews..."
        coordinate_pr_reviews
        
        # Step 6: Cleanup merged PRs
        log "Cleaning up merged PRs..."
        cleanup_merged_prs
        
        if [[ "$mode" == "once" ]]; then
            log "Single run complete"
            break
        fi
        
        log "Sleeping for 60 seconds..."
        sleep 60
    done
}

# Command line interface
show_usage() {
    cat << EOF
Usage: $(basename "$0") [COMMAND] [OPTIONS]

Commands:
    start           Start the workflow orchestrator
    stop            Stop all active agents
    status          Show current workflow status
    triage          Run issue triage only
    cleanup         Clean up completed worktrees
    reset           Reset all state (dangerous!)

Options:
    --mode MODE     Run mode: continuous or once (default: continuous)
    --max N         Maximum concurrent agents (default: 4)
    --dry-run       Simulate without making changes

Examples:
    $(basename "$0") start                    # Start continuous workflow
    $(basename "$0") start --mode once        # Run once and exit
    $(basename "$0") status                   # Show current status
    $(basename "$0") stop                     # Stop all agents

EOF
}

# Parse command line arguments
main() {
    init_directories
    check_prerequisites
    
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        start)
            local mode="continuous"
            local max_concurrent=4
            
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --mode)
                        mode="$2"
                        shift 2
                        ;;
                    --max)
                        max_concurrent="$2"
                        shift 2
                        ;;
                    --dry-run)
                        export DRY_RUN=1
                        shift
                        ;;
                    *)
                        error "Unknown option: $1"
                        show_usage
                        exit 1
                        ;;
                esac
            done
            
            run_workflow "$mode" "$max_concurrent"
            ;;
            
        stop)
            log "Stopping all active agents..."
            stop_all_agents
            ;;
            
        status)
            show_workflow_status
            ;;
            
        triage)
            triage_issues
            ;;
            
        cleanup)
            cleanup_all_worktrees
            ;;
            
        reset)
            warning "This will reset all workflow state. Are you sure? (y/N)"
            read -r response
            if [[ "$response" == "y" ]]; then
                reset_workflow_state
            fi
            ;;
            
        help|--help|-h)
            show_usage
            ;;
            
        *)
            error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi