import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { rankCodeMapLocations } from "../src/codeMapRanker.js";
import {
  detectLanguageAndStyle,
  generateAgentReadyBrief
} from "../src/briefEngine.js";
import {
  mcpGetAgentBrief,
  mcpGetReadiness,
  mcpListAgentReadyIssues,
  mcpPostReporterQuestions,
  mcpRecordCodeLocation,
  mcpRecordFixOutcome,
  codemapWebtriggerHandler,
  uiResolver,
  seedBenchmarkDemoData
} from "../src/index.js";
import { extractSymbolsFromSource } from "../scripts/export-codemap.js";
import { lookupSimilarResolvedBugsViaTwg, TWG_QUERIES } from "../src/twgSimilarIssues.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..");

test("1. Manifest and Rovo Skill structure comply with 2026 Atlassian Forge rules", () => {
  const manifestText = fs.readFileSync(path.join(APP_ROOT, "manifest.yml"), "utf8");

  // Required modules for Software Teams + Rovo MCP Bonus + Runs on Atlassian
  assert.match(manifestText, /rovo:mcp:/);
  assert.match(manifestText, /rovo:skill:/);
  assert.match(manifestText, /rovo:agent:/);
  assert.match(manifestText, /jira:issuePanel:/);
  assert.match(manifestText, /jira:adminPage:/);
  assert.match(manifestText, /jira:entityProperty:/);
  assert.match(manifestText, /llm:\s*\n\s*- key: llm-app/);
  assert.match(manifestText, /name: nodejs24\.x/);

  // Handler paths must be relative to src/ (`index.<fn>`, never `src/index.<fn>`)
  assert.doesNotMatch(manifestText, /handler:\s*src\//);
  assert.match(manifestText, /handler:\s*index\.uiResolver/);
  assert.match(manifestText, /read:graph:issue:jira/);
  assert.match(manifestText, /read:graph:project:jira/);

  // Zero egress check (keeps Runs-on-Atlassian eligibility)
  assert.doesNotMatch(manifestText, /external:\s*\n\s*fetch:/);

  // Verify bundled Rovo Skill frontmatter
  const skillPath = path.join(APP_ROOT, "skills", "agent-ready-brief", "SKILL.md");
  const skillText = fs.readFileSync(skillPath, "utf8");
  assert.match(skillText, /^---\r?\nname: agent-ready-brief\r?\n/);
  assert.match(
    skillText,
    /allowed-tools: get-agent-brief get-readiness list-agent-ready-issues post-reporter-questions record-code-location record-fix-outcome/
  );
  const lineCount = skillText.split(/\r?\n/).length;
  assert.ok(lineCount <= 500, `SKILL.md must be <= 500 lines (got ${lineCount})`);
});

test("2. Code-Mixed Indonesian & English Symptom Reports Localize to Correct Code Map Symbols", () => {
  const idCodeMixed =
    "Halo pak, ada kendala waktu tambahkan parameter `response: Response` di endpoint `@app.post('/items', status_code=201)`, muncul error 422 field required.";
  const detected = detectLanguageAndStyle("Endpoint error 422", idCodeMixed, []);
  assert.equal(detected.languageDetected, "id-en-codemixed");
  assert.equal(detected.reportStyle, "SYMPTOM_ONLY_USER");

  const ranked = rankCodeMapLocations(idCodeMixed);
  assert.ok(ranked.length >= 2);
  assert.equal(ranked[0].filePath, "fastapi/dependencies/utils.py");
  assert.ok(ranked[0].confidence >= 0.75);
});

test("3. Forge LLM integration omits temperature/top_p and parses structured JSON brief", async () => {
  let capturedPrompt = null;
  const mockLlmClient = {
    async list() {
      return {
        models: [
          { model: "claude-sonnet-5", status: "active" },
          { model: "claude-sonnet-4-6", status: "active" }
        ]
      };
    },
    async chat(prompt) {
      capturedPrompt = prompt;
      return {
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify({
                symptomSummary: "Custom Response parameter in @app.post triggers 422 when body is omitted.",
                expectedBehavior: "analyze_param() must keep Response as a non-body special parameter.",
                actualBehavior: "FastAPI treats Response as a required body field.",
                reproductionSteps: ["Declare response: Response in @app.post", "Send empty POST request"],
                acceptanceCriteria: [
                  {
                    given: "An @app.post route with `response: Response`",
                    when: "A client sends POST without body",
                    then: "analyze_param recognizes Response and returns 201"
                  }
                ],
                missingInfoQuestions: [
                  {
                    priority: 1,
                    dimension: "expectedVsActual",
                    questionEn: "Are you importing Response from `fastapi` or `starlette.responses`?",
                    questionId: "Apakah `Response` di-import dari `fastapi` atau `starlette.responses`?"
                  }
                ]
              })
            }
          }
        ],
        usage: { input_tokens: 410, output_tokens: 220, total_tokens: 630 }
      };
    }
  };

  const brief = await generateAgentReadyBrief({
    issueKey: "DEMO-101",
    summary: "Error 422 on Response parameter",
    description: "Waktu pakai parameter response: Response di @app.post muncul 422.",
    llmClient: mockLlmClient
  });

  assert.equal(capturedPrompt.model, "claude-sonnet-5");
  assert.equal(capturedPrompt.temperature, undefined, "temperature must be omitted for claude-sonnet-5");
  assert.equal(capturedPrompt.top_p, undefined, "top_p must be omitted for claude-sonnet-5");
  assert.equal(brief.engineUsed, "forge-llm:claude-sonnet-5");
  assert.match(brief.expectedBehavior, /analyze_param/);
});

test("4. Full 6-Tool Rovo MCP Lifecycle Loop (Seed -> List -> Brief -> Clarify -> Verify Location -> Record Fix)", async () => {
  const seeded = await seedBenchmarkDemoData();
  assert.equal(seeded.seededCount, 3);

  // 1. list-agent-ready-issues
  const readyList = await mcpListAgentReadyIssues({ minScore: 75 });
  assert.ok(readyList.totalMatching >= 1);
  assert.ok(readyList.issues.some((i) => i.issueKey === "DEMO-103"));

  // 2. get-readiness on symptom-only ticket DEMO-102
  const readiness102 = await mcpGetReadiness({ issueKey: "DEMO-102" });
  assert.equal(readiness102.issueKey, "DEMO-102");
  assert.ok(readiness102.score < 85);
  assert.equal(readiness102.topCodeLocation.filePath, "rich/console.py");

  // 3. post-reporter-questions on DEMO-102
  const qRes = await mcpPostReporterQuestions({ issueKey: "DEMO-102" });
  assert.equal(qRes.posted, true);
  assert.equal(qRes.status, "AWAITING_REPORTER");
  assert.match(qRes.preview, /\[EN\]/);
  assert.match(qRes.preview, /\[ID\]/);

  // 4. record-code-location from coding agent on DEMO-101
  const locRes = await mcpRecordCodeLocation({
    issueKey: "DEMO-101",
    filePath: "fastapi/dependencies/utils.py",
    symbolName: "analyze_param",
    rootCauseNote: "Confirmed special-type check in analyze_param()"
  });
  assert.equal(locRes.verifiedLocation.verifiedByAgent, true);
  assert.ok(locRes.updatedScore >= 75);

  // 5. record-fix-outcome from coding agent on DEMO-101
  const fixRes = await mcpRecordFixOutcome({
    issueKey: "DEMO-101",
    outcome: "SOLVED",
    testCommand: "pytest tests/test_response_param.py",
    patchSummary: "Preserved Response special type in analyze_param() when status_code is set."
  });
  assert.equal(fixRes.status, "SOLVED_BY_AGENT");

  // 6. UI resolver & Webtrigger
  const adminData = await uiResolver({ action: "getAdminDashboard" });
  assert.equal(adminData.benchmark.verifiedTasks, 101);
  assert.ok(adminData.issues.length >= 3);

  const wtRes = await codemapWebtriggerHandler({
    body: JSON.stringify({
      repoName: "custom-service",
      commitSha: "abc1234",
      entries: [
        {
          filePath: "src/auth.py",
          symbols: ["verify_token"],
          routesOrCommands: ["/login"],
          errorStrings: ["TokenExpiredError"],
          summary: "JWT verification"
        }
      ]
    })
  });
  assert.equal(wtRes.statusCode, 200);

  // 7. Code map exporter script check
  const extracted = extractSymbolsFromSource(
    "class AuthManager:\n  async def verify_user(token):\n    raise ValueError('bad')",
    ".py"
  );
  assert.deepEqual(extracted.symbols, ["AuthManager", "verify_user"]);
  assert.deepEqual(extracted.errorStrings, ["ValueError"]);

  // 8. Teamwork Graph curated Relay query check & UI context hydration priority
  assert.match(TWG_QUERIES.spaceWorkItemsAndPrs, /edges\s*\{\s*node\s*\{\s*\.\.\. on JiraWorkItem/);
  const mockTwgApi = {
    asUser() {
      return {
        async requestTeamworkGraph(query) {
          if (query.includes("echo")) {
            return { async json() { return { data: { echo: "agent-ready-issues-twg-ok" } }; } };
          }
          return {
            async json() {
              return {
                data: {
                  jiraSpaceWorkItems: {
                    edges: [
                      { node: { id: "KAN-42", title: "Past FastAPI Response 422 bug", status: { name: "Done" } } }
                    ]
                  }
                }
              };
            }
          };
        }
      };
    }
  };
  const twgRes = await lookupSimilarResolvedBugsViaTwg("fastapi/dependencies/utils.py", "ari:cloud:jira::project/1", mockTwgApi);
  assert.equal(twgRes.twgConnected, true);
  assert.equal(twgRes.precedents[0].pastIssueKey, "KAN-42");

  // UI context priority: context.extension.issue.key wins over default DEMO-101 fallback
  const panelBrief = await uiResolver({
    call: { functionKey: "getIssueBrief", payload: { issueKey: "DEMO-101" } },
    context: { extension: { issue: { key: "DEMO-102" } } }
  });
  assert.equal(panelBrief.issueKey, "DEMO-102");
});
