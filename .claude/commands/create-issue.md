---
allowed-tools: Bash
argument-hint: <title>
description: Create a GitHub issue, branch, and checkout the branch
---

# Create Issue: $ARGUMENTS

Creating GitHub issue and development branch.

## Step 1: Create the Issue

!gh issue create --title "$ARGUMENTS" --body ""

## Step 2: Create Branch and Checkout

Parse the issue number from the output above, then create and checkout the development branch:

!gh issue develop {issue_number} --checkout

The branch follows GitHub's naming convention: `{issue-number}-{slugified-title}`

Done! Your IDE status bar should now show the new branch.
