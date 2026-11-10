---
name: fix-from-agent-brief
description: Connect Claude Code, Cursor, or Rovo Dev to the Agent-Ready Issues for Jira MCP server to pull code-localized bug briefs, implement verified fixes, and record failing-to-passing test outcomes back to Jira.
license: MIT
---

# Fix from Agent-Ready Brief (External Coding Agent Skill)

Use this skill in **Claude Code**, **Cursor**, or **Rovo Dev** when connected to the **Agent-Ready Issues MCP** server (`https://mcp.atlassian.com/forge/<appId>`).

## Setup (One-Time)
```bash
claude mcp add --transport http agent-ready-issues https://mcp.atlassian.com/forge/<YOUR_FORGE_APP_ID>
```
Then run `/mcp` inside Claude Code to complete Atlassian OAuth 2.1 authentication.

## Workflow for Autonomous Bug Resolution

1. **Discover Ready Issues (`list-agent-ready-issues`)**
   - Call `list-agent-ready-issues` with `minScore: 75` and `statusFilter: "READY"`.
   - Pick the highest-priority issue or the issue key specified by the developer.

2. **Load the Structured Engineering Brief (`get-agent-brief`)**
   - Call `get-agent-brief` with `issueKey`.
   - Read `symptomSummary`, `expectedBehavior`, `reproductionSteps`, `codeLocations`, and `acceptanceCriteria`.
   - If `readiness.score < 70` and critical behavioral contracts are ambiguous, **do not guess**—call `post-reporter-questions` and stop.

3. **Verify Code Location & Write a Failing Test First**
   - Inspect the top candidate files and symbols listed in `codeLocations`.
   - Once you confirm the exact function or class responsible for the bug, call `record-code-location` (`issueKey`, `filePath`, `symbolName`, `rootCauseNote`).
   - Write or locate a reproduction test matching the `Given / When / Then` acceptance criteria and confirm that it **fails before your edit**.

4. **Implement the Fix & Record the Outcome (`record-fix-outcome`)**
   - Apply the minimal patch that satisfies `expectedBehavior` without breaking existing tests (keep special parameter types and public API signatures intact).
   - Run the verification test suite.
   - Call `record-fix-outcome` with `issueKey`, `outcome: "SOLVED"`, `testCommand`, and `patchSummary`.
