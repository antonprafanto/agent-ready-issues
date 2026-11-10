# Devpost Submission Copy & 3-Minute Video Script (`Agent-Ready Issues for Jira`)

## 1. Project Title & Tagline
- **Title:** Agent-Ready Issues for Jira
- **Tagline:** Turn symptom-only JSM & Jira bug reports into code-localized, testable briefs served to coding agents over Atlassian Rovo MCP.
- **Primary Category:** Apps for Software Teams
- **Bonus Prizes:**
  - Best App with Atlassian MCP (`rovo:mcp`)
  - Best Rovo Agent / Skill (`rovo:agent` + `rovo:skill`)
  - Best App with Teamwork Graph Integration (`read:graph:issue:jira`, `read:graph:project:jira`, `read:graph:pull-request:external`)
  - Runs on Atlassian (Verified `Eligible for the Runs on Atlassian program` via `forge eligibility`)
- **Deployed App ARI:** `ari:cloud:ecosystem::app/506d0189-c6a8-4156-b502-1fcb1e7e4b6f`
- **Live Installed Jira Cloud Site:** `https://one-atlas-rrth.atlassian.net`
- **Direct Admin Page URL on Jira:** `https://one-atlas-rrth.atlassian.net/jira/settings/apps/506d0189-c6a8-4156-b502-1fcb1e7e4b6f/26057567-7107-47e7-b0e9-d5c3feeef962`
- **Developer Console Distribution Link:** `https://developer.atlassian.com/console/myapps/506d0189-c6a8-4156-b502-1fcb1e7e4b6f/manage/distribution`

---

## 2. Inspiration (Backed by Our 101-Task Empirical Study)
Coding agents excel when given developer pull-request specifications, yet real customer bug reports in Jira Service Management (JSM) and WhatsApp/support channels describe only **symptoms**. In our 101-task benchmark study (**Lingua-SWE-129**, CC BY 4.0), rewriting developer specifications into symptom-only user reports cut solve rates by **31% on 31B models** and **62% on 12B models**, with **72–89% of generated patches failing hidden tests**. Surprisingly, coding agents still reached the right file 83–85% of the time—what was missing was **the exact function/class symbol to edit** and **the intended behavioral contract**. We built **Agent-Ready Issues for Jira** to close that exact gap natively inside Atlassian Forge and Rovo MCP.

---

## 3. What It Does
1. **5-Dimension Agent Readiness Score (0–100):** Evaluates every Jira/JSM issue across *Reproduction Steps (25)*, *Behavioral Contract (25)*, *Code-Map Symbol Localization (20)*, *Acceptance Criteria (15)*, and *Environment/Trace Context (15)*, syncing the result to Jira Entity Properties (`agentReadyScore`, `agentReadyStatus`) for JQL (`agentReadyScore >= 75`).
2. **Zero-Egress Code Map Localization:** Ranks candidate repository files and symbols (`fastapi/dependencies/utils.py :: analyze_param`) inside Forge KVS without ever sending source-code bodies outside Atlassian.
3. **Bilingual Reporter Clarification Loop (EN / ID):** When a report is underspecified (`< 75`), drafts at most 3 ranked clarifying questions in English and code-mixed Indonesian and posts them to the reporter in one click.
4. **Closed-Loop Rovo MCP Server (`rovo:mcp`):** Exposes 6 tools (`get-agent-brief`, `get-readiness`, `list-agent-ready-issues`, `post-reporter-questions`, `record-code-location`, `record-fix-outcome`) to both **Rovo Studio** (`Bug Brief Engineer` agent + `agent-ready-brief` skill) and **external MCP coding agents** (Claude Code, Cursor, Rovo Dev).

---

## 4. 3-Minute Video Script (Judges Watch 0:00–3:00)

- **0:00–0:30 — The Problem & Empirical Proof:**
  - Show a real code-mixed Indonesian/English customer ticket in Jira (`DEMO-101`: *"Endpoint error 422 waktu pakai parameter Response tanpa body di route @app.post"*).
  - Show the Admin Page's **Lingua-SWE-129 Benchmark Card**: across 101 verified tasks, symptom-only reports drop agent solve rates by 31–62% because 72–89% of patches fail without target symbols and behavioral contracts.
- **0:30–1:20 — Inside the Jira Issue Panel & Zero-Egress Code Map:**
  - Open the **Agent-Ready Brief & MCP** panel on `DEMO-101` and `DEMO-102`.
  - Highlight the 5-dimension Readiness Score bar, the zero-egress Code Map localization pinning `fastapi/dependencies/utils.py :: analyze_param (92%)`, the `Given / When / Then` acceptance criteria, and click **Post Questions to Reporter** to post bilingual EN/ID clarifying questions on `DEMO-102`.
- **1:20–2:25 — Closing the Loop Over Rovo MCP (`rovo:mcp`) & Rovo Agent:**
  - Open Rovo Chat (`Bug Brief Engineer`) and ask: *"Which open bugs are ready for a coding agent right now?"* (`list-agent-ready-issues`).
  - Switch to Claude Code connected via `https://mcp.atlassian.com/forge/<appId>` using our `fix-from-agent-brief` skill: pull the brief with `get-agent-brief`, verify the symbol with `record-code-location`, run `pytest`, and call `record-fix-outcome` — watching the Jira Issue Panel badge flip to `SOLVED_BY_AGENT` in real time.
- **2:25–2:55 — Architecture & Runs-on-Atlassian Trust Story:**
  - Show `manifest.yml`: zero external egress (`Runs on Atlassian` eligible), `@forge/llm` (`claude-sonnet-5`) inside an async event consumer (`timeoutSeconds: 600`), plus a deterministic code-map fallback so the app never times out.
