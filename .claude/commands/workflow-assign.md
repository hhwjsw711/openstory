---
allowed-tools: Bash, Task
argument-hint: <issue_number>
description: Assign a GitHub issue to an appropriate agent for triage
---

# Workflow: Assign Issue #$1 for Triage

I'll assign issue #$1 to the appropriate tech lead/architect for triage and planning.

!gh issue view $1 --json number,title,body,labels,assignees

First, let me analyze the issue and set up the workflow:

1. Determine the issue type and appropriate agent
2. Create a dedicated worktree for this issue
3. Generate triage instructions for the agent
4. Launch the agent to create an implementation plan

The triage stage agent will:
- Analyze technical requirements
- Design the solution architecture  
- Create a detailed implementation plan
- Prepare specifications for the implementation engineer
- NOT implement the solution (that's done with /workflow-implement)

Let me run the workflow manager to assign this issue:

!./workflow/scripts/workflow-manager.sh assign $1

After the triage is complete, use `/workflow-implement $1` to have an engineer implement the solution based on the plan.