# Privacy Policy — Agent-Ready Issues & Rovo MCP

**Last updated:** 2026-11-13  
**Atlassian Forge App ID:** `506d0189-c6a8-4156-b502-1fcb1e7e4b6f`  
**Support Contact:** Anton Prafanto (`anton.prafanto@gmail.com`)

## 1. Architecture & Data Residency (`Runs on Atlassian`)
`Agent-Ready Issues & Rovo MCP` is built on the Atlassian Forge platform with **zero external egress**:
- App logic executes exclusively on Atlassian-managed Forge compute.
- Structured readiness scores, repository code maps (symbol signatures, file paths, route/exception identifiers — never full source-code bodies), and configuration settings are stored within Atlassian-hosted Forge Key-Value Storage (`@forge/kvs`) and Jira issue entity properties inside your Atlassian tenant boundary.
- AI brief synthesis uses Atlassian-hosted Forge LLM (`@forge/llm`), with a deterministic local analyzer fallback.
- No issue content, user details, or repository metadata are transmitted to third-party servers, external analytics trackers, or external AI endpoints.

## 2. Personal Data Declaration
- **Does this app store personal data outside Atlassian?** No.
- Jira issue summaries, comments posted on your behalf via UI actions or Rovo MCP tools, and issue readiness scores remain inside your Atlassian Cloud site under Atlassian Cloud security and compliance controls.

## 3. Data Retention & Deletion
- Site administrators can inspect queued issue briefs and settings in Jira Apps administration at any time.
- Uninstalling the app from your Atlassian Cloud site immediately revokes tenant access, and Forge-hosted storage is governed by Atlassian's Forge app data lifecycle policies.

## 4. Contact
For privacy questions, support, or deletion requests, email: `anton.prafanto@gmail.com`.
