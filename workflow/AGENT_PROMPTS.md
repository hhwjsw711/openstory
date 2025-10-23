# Agent Prompt Templates

This document contains the prompt templates used by the workflow system to coordinate multiple agents using the `@agent-name` syntax.

## Tech Lead/Architect Prompts

### Backend Tech Lead

```
Can you get the @agent-backend-tech-lead to validate the plan for this issue, delegate the work to @agent-backend-engineer who should make regular commits then validate the work at the end through a PR. Involve the @agent-qa-lead-tester to create a test suite and mock data for all API endpoints.
```

### Frontend Architect

```
Can you get the @agent-frontend-architect to review the UI/UX requirements, create component architecture, then delegate to @agent-frontend-react-engineer for implementation. Coordinate with @agent-qa-lead-tester for comprehensive frontend testing including unit tests and e2e tests.
```

## Implementation Engineer Prompts

### Backend Engineer

```
Can you get the @agent-backend-engineer to implement this feature following the plan from @agent-backend-tech-lead. Make regular, descriptive commits and work with @agent-qa-lead-tester to ensure >80% test coverage. Create a PR when complete.
```

### Frontend React Engineer

```
Can you get the @agent-frontend-react-engineer to implement these components following the architecture from @agent-frontend-architect. Use shadcn/ui components, make frequent commits, and coordinate with @agent-qa-lead-tester for testing.
```

## QA/Testing Prompts

### QA Lead Tester

```
Can you get the @agent-qa-lead-tester to:
1. Create comprehensive test suites for the implementation
2. Generate mock data for all API endpoints
3. Validate error handling and edge cases
4. Ensure test coverage meets standards (>80% backend, >75% frontend)
5. Review the PR and approve when quality standards are met
```

## Multi-Agent Coordination Examples

### Full Feature Implementation

```
For this feature:
1. @agent-backend-tech-lead should create the technical plan
2. @agent-backend-engineer implements the API following the plan
3. @agent-frontend-architect designs the UI components
4. @agent-frontend-react-engineer implements the frontend
5. @agent-qa-lead-tester creates tests and validates everything
6. All agents should make regular commits and coordinate through PR comments
```

### Bug Fix Workflow

```
For this bug:
1. @agent-backend-tech-lead or @agent-frontend-architect should investigate and create a fix plan
2. Appropriate @agent-backend-engineer or @agent-frontend-react-engineer implements the fix
3. @agent-qa-lead-tester creates regression tests and validates the fix
4. Create PR with detailed explanation of the bug and fix
```

### API Endpoint Creation

```
Can you coordinate the following:
1. @agent-backend-tech-lead designs the API endpoint structure
2. @agent-backend-engineer implements with Zod validation and proper error handling
3. @agent-qa-lead-tester creates integration tests and mock data
4. All work should follow REST principles and CLAUDE.md guidelines
```

## Key Guidelines for Agent Prompts

1. **Always use @agent- prefix** for agent references
2. **Specify collaboration** between agents explicitly
3. **Emphasize regular commits** for tracking progress
4. **Include QA in all workflows** for quality assurance
5. **Reference CLAUDE.md** for project-specific guidelines
6. **Use TodoWrite** for task tracking
7. **Create PRs** with detailed descriptions

## Agent Capabilities Reference

- **@agent-backend-tech-lead**: Architecture, API design, technical planning
- **@agent-backend-engineer**: API implementation, database, services
- **@agent-frontend-architect**: UI/UX decisions, component architecture
- **@agent-frontend-react-engineer**: React components, state management
- **@agent-qa-lead-tester**: Test suites, mock data, quality validation
- **@agent-engineering-lead**: Overall coordination, standards enforcement
