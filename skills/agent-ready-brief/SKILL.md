---
name: agent-ready-brief
description: Analyze symptom-only Jira and JSM bug reports, compute 5-dimension Agent Readiness Scores, localize likely files and functions from the repository code map, ask reporters ranked clarifying questions, and serve testable briefs to coding agents.
compatibility: Jira Cloud, Jira Service Management, Rovo Studio, and external MCP coding agents (Claude Code, Cursor, Rovo Dev).
license: MIT
allowed-tools: get-agent-brief get-readiness list-agent-ready-issues post-reporter-questions record-code-location record-fix-outcome
---

# Agent-Ready Brief Playbook

Use this skill whenever a developer, support engineer, or coding agent wants to triage a Jira/JSM bug report, evaluate whether it is ready for autonomous code repair, ask the reporter for missing reproduction or behavioral-contract details, or close the loop after a coding agent fixes the bug.

## Why This Playbook Exists (Empirical Grounding)

In controlled evaluations across 101 verified repository tasks (*Lingua-SWE-129*), rewriting developer pull-request specifications into symptom-only user reports reduces coding-agent solve rates by **31% on 31B models** and **62% on 12B models** (patch failure rates rise from 60% to 72–89%), regardless of whether the report is written in English or code-mixed Indonesian. Crucially, coding agents still reach the right file 83–85% of the time—what fails is **identifying the exact target function/symbol** and **knowing the intended behavioral contract**.

## Step-by-Step Orchestration

### 1. Inspect Issue Readiness & Brief (`get-agent-brief`, `get-readiness`)
- Always call `get-agent-brief` first when given an `issueKey`.
- If you only need the numeric readiness breakdown and missing-information questions, call `get-readiness`.
- Review the five readiness dimensions defined in `references/brief-schema.md`:
  1. **Reproduction Steps (25 pts)**
  2. **Expected vs. Actual Contract (25 pts)**
  3. **Code-Map Symbol Localization (20 pts)**
  4. **Verification / Failing Test Criteria (15 pts)**
  5. **Environment & Error Trace Context (15 pts)**

### 2. Decide: Dispatch to Coding Agent vs. Clarify with Reporter
- **Score >= 75 (`READY`):**
  - Present the structured brief, top candidate `filePath` + `symbolName` entries from the repository code map, and the `Given / When / Then` acceptance criteria.
  - Provide the ready-to-run MCP prompt for the coding agent.
- **Score < 75 (`NEEDS_CLARIFICATION`):**
  - **Never guess missing user intent.** Highlight which dimensions are missing (especially Expected Behavior or Reproduction Steps).
  - Select at most 3 highest-leverage questions using `references/question-bank.md`.
  - Ask the user for confirmation before calling `post-reporter-questions` (an `UPDATE` action) to post the questions on the Jira/JSM ticket.

### 3. Batch Triage Across a Project (`list-agent-ready-issues`)
- When a user asks *"Which bugs can my coding agent fix today?"* or *"Which JSM tickets need customer follow-up?"*, invoke `list-agent-ready-issues` with `minScore: 75` (for agent-ready work) or `statusFilter: "NEEDS_CLARIFICATION"` (for support follow-up).

### 4. Close the Loop From Coding Agents (`record-code-location`, `record-fix-outcome`)
- When an engineer or external MCP coding agent confirms the root-cause file and symbol in the repository, invoke `record-code-location` to pin the verified `filePath` and `symbolName` on the issue brief.
- After running the failing-then-passing reproduction test, invoke `record-fix-outcome` with `outcome` (`SOLVED`, `PARTIAL`, or `BLOCKED_NEEDS_INFO`), `testCommand`, and `patchSummary`.

## Reference Documents
- Detailed JSON schema and 5-dimension scoring rubric: `references/brief-schema.md`
- Ranked reporter question templates (English & bilingual Indonesian): `references/question-bank.md`
