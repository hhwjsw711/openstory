---
allowed-tools: Bash, Task
argument-hint: <issue_number>
description: Assign issue to an engineer for implementation after triage
---

# Workflow: Implement Issue #$1

I'll assign issue #$1 to the appropriate engineer for implementation.

!gh issue view $1 --json number,title,body,labels,assignees

Setting up the implementation workflow:

1. Check if triage has been completed
2. Assign to the appropriate implementation engineer
3. Use the triage plan created by the tech lead/architect
4. The engineer will implement the solution with regular commits
5. QA lead will validate the implementation

The implementation engineer will:
- Review the triage notes and technical plan
- Implement the solution incrementally
- Write comprehensive tests
- Make frequent, descriptive commits
- Create a PR when complete

Running the workflow manager for implementation:

!./workflow/scripts/workflow-manager.sh implement $1

The engineer should work closely with:
- The tech lead/architect who created the plan
- The QA lead for test coverage and validation

After implementation, the PR will be reviewed before merging.