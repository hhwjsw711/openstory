# AI Development Workflow System

An automated development workflow system that orchestrates multiple Claude agents to manage GitHub issues, implement features, and maintain code quality.

## System Overview

This system automates the entire development lifecycle from issue triage to PR merge:

1. **Issue Triage**: Engineering lead agent organizes and prioritizes GitHub issues
2. **Assignment**: Issues are assigned to appropriate lead agents (backend/frontend)
3. **Delegation**: Leads delegate to implementation engineers
4. **Implementation**: Engineers work in isolated git worktrees with Cursor IDE
5. **Review**: Multi-stage review by leads and QA
6. **Merge**: Automated cleanup after successful merge

## Architecture

```
workflow/
├── README.md                   # This file
├── config/
│   ├── agents.yaml            # Agent configurations and personas
│   ├── workflow.yaml          # Workflow state machine definition
│   └── environment.yaml       # Environment settings
├── src/
│   ├── orchestrator/          # Main orchestration service
│   ├── agents/                # Agent implementations
│   ├── git/                   # Git and worktree management
│   ├── github/                # GitHub API integration
│   ├── cursor/                # Cursor IDE automation
│   ├── claude/                # Claude CLI wrapper
│   └── state/                 # State management
├── scripts/
│   ├── setup.sh               # System setup script
│   ├── start.sh               # Start orchestrator
│   └── reset.sh               # Reset system state
├── data/
│   ├── state.db               # SQLite state database
│   └── logs/                  # System logs
└── .trees/                    # Git worktrees directory
```

## Quick Start

```bash
# Setup the system
./scripts/setup.sh

# Configure GitHub token
export GITHUB_TOKEN="your-token"

# Configure Claude API
export ANTHROPIC_API_KEY="your-key"

# Start the orchestrator
./scripts/start.sh

# The system will now:
# 1. Monitor GitHub issues
# 2. Assign to agents
# 3. Create worktrees
# 4. Launch Cursor windows
# 5. Start Claude agents
# 6. Monitor progress
# 7. Create PRs
# 8. Handle reviews
```

## Agent Roles

### Engineering Lead
- Triages and prioritizes issues
- Assigns to appropriate teams
- Reviews architecture decisions
- Ensures code quality standards

### Backend Lead
- Reviews backend architecture
- Delegates to backend engineers
- Ensures API consistency
- Reviews database changes

### Frontend Architect
- Reviews UI/UX decisions
- Delegates to React engineers
- Ensures component patterns
- Reviews state management

### Backend Engineer
- Implements API endpoints
- Writes database queries
- Integrates with services
- Writes backend tests

### Frontend React Engineer
- Implements React components
- Manages state with TanStack Query
- Uses shadcn/ui components
- Writes frontend tests

### QA Lead Tester
- Reviews test coverage
- Ensures quality standards
- Validates acceptance criteria
- Performs integration testing

## Workflow States

```yaml
states:
  - new_issue
  - triaged
  - assigned
  - in_progress
  - implementation_complete
  - in_review
  - changes_requested
  - approved
  - merged
  - closed
```

## Configuration

See `config/` directory for detailed configuration options:
- `agents.yaml`: Agent personas and capabilities
- `workflow.yaml`: State transitions and rules
- `environment.yaml`: System settings

## Monitoring

Access the dashboard at http://localhost:3001 to:
- View active workflows
- Monitor agent progress
- Review system logs
- Manage worktrees
- Track PR status

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Start in development mode
pnpm dev

# Build for production
pnpm build
```

## Troubleshooting

### Common Issues

1. **Worktree conflicts**: Run `./scripts/reset.sh` to clean up
2. **Agent stuck**: Check logs in `data/logs/`
3. **Cursor not opening**: Ensure Cursor CLI is installed
4. **Claude timeout**: Increase timeout in `config/agents.yaml`

## Security

- GitHub tokens are stored encrypted
- Claude API keys use environment variables
- Worktrees are isolated per issue
- Automatic cleanup on errors

## License

MIT