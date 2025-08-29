#!/bin/bash
#
# Issue Triage Module
# Fetches and triages GitHub issues using the engineering-lead agent
#

# Fetch open issues from GitHub
fetch_open_issues() {
    local repo="${1:-$(get_current_repo)}"
    
    log "Fetching open issues from ${repo}..."
    
    gh issue list \
        --repo "$repo" \
        --state open \
        --json number,title,body,labels,assignees,createdAt,updatedAt \
        --limit 100
}

# Get current repository from git
get_current_repo() {
    local remote_url=$(git config --get remote.origin.url)
    
    # Extract owner/repo from various URL formats
    if [[ "$remote_url" =~ github\.com[:/]([^/]+)/([^/]+)(\.git)?$ ]]; then
        echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]%.git}"
    else
        error "Could not determine repository from remote URL: $remote_url"
        exit 1
    fi
}

# Check if issue is already being worked on
is_issue_in_progress() {
    local issue_num="$1"
    
    [[ -f "${STATE_DIR}/issues/${issue_num}.json" ]] && \
        [[ "$(jq -r '.status' "${STATE_DIR}/issues/${issue_num}.json")" == "in_progress" ]]
}

# Triage issues using engineering-lead agent
triage_issues() {
    local issues_json=$(fetch_open_issues)
    local triaged_count=0
    
    # Save raw issues for reference
    echo "$issues_json" > "${STATE_DIR}/open_issues.json"
    
    # Process each issue
    echo "$issues_json" | jq -c '.[]' | while read -r issue; do
        local issue_num=$(echo "$issue" | jq -r '.number')
        local issue_title=$(echo "$issue" | jq -r '.title')
        
        # Skip if already in progress
        if is_issue_in_progress "$issue_num"; then
            log "Issue #${issue_num} already in progress, skipping"
            continue
        fi
        
        # Skip if already triaged recently (within 1 hour)
        local state_file="${STATE_DIR}/issues/${issue_num}.json"
        if [[ -f "$state_file" ]]; then
            local last_triaged=$(jq -r '.triaged_at // 0' "$state_file")
            local now=$(date +%s)
            if (( now - last_triaged < 3600 )); then
                log "Issue #${issue_num} recently triaged, skipping"
                continue
            fi
        fi
        
        log "Triaging issue #${issue_num}: ${issue_title}"
        
        # Create triage context for agent
        local triage_context=$(cat <<EOF
{
    "task": "triage_issue",
    "issue": $issue,
    "repository": "$(get_current_repo)",
    "decision_needed": {
        "priority": "P0-P3",
        "team": "backend|frontend|fullstack|qa",
        "complexity": "story_points",
        "agent": "backend-lead|frontend-architect|backend-engineer|frontend-react-engineer|qa-lead-tester",
        "blockers": []
    }
}
EOF
        )
        
        # Invoke engineering-lead agent for triage
        local triage_result=$(invoke_agent_for_triage "engineering-lead" "$triage_context")
        
        # Save triage result
        echo "$triage_result" | jq '. + {
            issue_number: '"$issue_num"',
            issue_title: "'"$issue_title"'",
            triaged_at: '"$(date +%s)"',
            status: "triaged"
        }' > "$state_file"
        
        ((triaged_count++))
        
        # Add labels based on triage
        local team=$(echo "$triage_result" | jq -r '.team')
        local priority=$(echo "$triage_result" | jq -r '.priority')
        
        if [[ "$DRY_RUN" != "1" ]]; then
            gh issue edit "$issue_num" \
                --add-label "team:${team}" \
                --add-label "priority:${priority}" \
                2>/dev/null || true
        fi
    done
    
    log "Triaged ${triaged_count} issues"
}

# Special function to invoke agent for triage (uses Claude Code's Task tool)
invoke_agent_for_triage() {
    local agent_name="$1"
    local context="$2"
    
    # Create a temporary task file for the agent
    local task_file="${STATE_DIR}/tasks/triage_$(date +%s).json"
    mkdir -p "${STATE_DIR}/tasks"
    echo "$context" > "$task_file"
    
    # Create agent instruction
    local instruction=$(cat <<'EOF'
You are the Engineering Lead. Analyze the provided GitHub issue and make triage decisions.

Read the issue context from the task file and provide a JSON response with:
1. Priority (P0=critical, P1=high, P2=medium, P3=low)
2. Team assignment (backend/frontend/fullstack/qa)
3. Complexity estimate in story points (1,2,3,5,8,13,21)
4. Recommended agent for implementation
5. Any identified blockers

Base your decisions on:
- Issue description and requirements
- Technical stack (Next.js, Supabase, etc.)
- Current architecture patterns
- Team capabilities defined in agents.yaml

Output only valid JSON in this format:
{
    "priority": "P1",
    "team": "backend",
    "complexity": 5,
    "agent": "backend-engineer",
    "blockers": [],
    "reasoning": "Brief explanation"
}
EOF
    )
    
    # Simulate agent response for now (will be replaced with actual Claude Code invocation)
    # In production, this would invoke Claude Code with the specific agent
    local mock_response=$(cat <<EOF
{
    "priority": "P2",
    "team": "$(determine_team_from_issue "$context")",
    "complexity": 5,
    "agent": "$(determine_agent_from_issue "$context")",
    "blockers": [],
    "reasoning": "Automated triage based on keywords and patterns"
}
EOF
    )
    
    echo "$mock_response"
}

# Helper function to determine team from issue content
determine_team_from_issue() {
    local context="$1"
    local title=$(echo "$context" | jq -r '.issue.title' 2>/dev/null || echo "")
    local body=$(echo "$context" | jq -r '.issue.body' 2>/dev/null || echo "")
    local content="${title} ${body}"
    
    # Check for backend keywords
    if echo "$content" | grep -qiE "(api|database|supabase|queue|qstash|auth|endpoint)"; then
        echo "backend"
    # Check for frontend keywords
    elif echo "$content" | grep -qiE "(component|ui|react|state|shadcn|form|page)"; then
        echo "frontend"
    # Check for QA keywords
    elif echo "$content" | grep -qiE "(test|qa|quality|bug|regression)"; then
        echo "qa"
    else
        echo "fullstack"
    fi
}

# Helper function to determine agent from issue content
determine_agent_from_issue() {
    local context="$1"
    local team=$(determine_team_from_issue "$context")
    
    case "$team" in
        backend)
            echo "backend-engineer"
            ;;
        frontend)
            echo "frontend-react-engineer"
            ;;
        qa)
            echo "qa-lead-tester"
            ;;
        *)
            echo "backend-engineer"
            ;;
    esac
}