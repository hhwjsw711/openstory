---
allowed-tools: Task
argument-hint: <issue_number>
description: Analyze a GitHub issue and assign to the appropriate tech lead for planning
---

# Workflow: Assign Issue #$ARGUMENTS

Let me analyze issue #$ARGUMENTS and assign it to the appropriate tech lead/architect for planning.

!gh issue view $ARGUMENTS --json number,title,body,labels,assignees,url

Now I'll analyze the issue content and labels to determine the appropriate agent.

Based on the issue details above, I'll select the right tech lead/architect:
- If it mentions API, database, Supabase, QStash, or has backend labels → `backend-tech-lead`
- If it mentions UI, React, components, shadcn, or has frontend labels → `frontend-architect`
- If it mentions testing, QA, or has test labels → `qa-lead-tester`
- Otherwise → `engineering-lead`

I'll now use the Task tool to invoke the appropriate agent to create a comprehensive implementation plan.

The selected agent will:
1. **Analyze Requirements** - Review issue details and acceptance criteria
2. **Review Codebase** - Understand existing implementation and patterns
3. **Design Architecture** - Plan the technical approach and data flow
4. **Create Implementation Plan** - Break down into specific tasks using TodoWrite
5. **Identify Risks** - Note potential challenges and dependencies
6. **Prepare Specifications** - Document for the implementation engineer

**Important**: The tech lead creates the plan but does NOT implement. After the plan is approved, an engineer will implement it based on these specifications.