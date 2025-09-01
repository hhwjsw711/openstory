---
allowed-tools: Task, Write, Bash
argument-hint: <issue_number>
description: Triage a GitHub issue and create an implementation plan
---

# Triage Issue #$ARGUMENTS

Let me analyze issue #$ARGUMENTS and create an implementation plan.

!gh issue view $ARGUMENTS --json number,title,body,labels,assignees,url

Now I'll analyze the issue content and labels to determine the appropriate tech lead agent.

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
4. **Create Implementation Plan** - Break down into specific tasks
5. **Identify Risks** - Note potential challenges and dependencies
6. **Document Specifications** - Create detailed implementation instructions

After the tech lead creates the plan, I'll save it to `workflow/instructions/issue-$ARGUMENTS-plan.md` for the implementation phase.

**Important**: This creates the plan only. Use `/implement $ARGUMENTS` to execute the plan with an engineer.