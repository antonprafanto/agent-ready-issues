import { DEMO_SEED_ISSUES, LINGUA_SWE_BENCHMARK } from "./benchmarkData.js";
import { generateAgentReadyBrief, scoreReadinessDimensions } from "./briefEngine.js";
import {
  getAppSettings,
  saveAppSettings,
  getCodeMap,
  saveCodeMap,
  getBrief,
  saveBrief,
  saveBriefBatch,
  listIndexedIssues
} from "./storage.js";
import {
  fetchJiraIssueContext,
  syncIssueEntityProperty,
  postJiraIssueComment
} from "./jiraClient.js";
import { lookupSimilarResolvedBugsViaTwg } from "./twgSimilarIssues.js";

/**
 * Generates (or refreshes) and persists the Agent-Ready Brief for a Jira issue.
 */
export async function analyzeAndStoreIssue(issueKey, overrideContext = null, options = {}) {
  const key = String(issueKey || "DEMO-101").toUpperCase();
  const context = overrideContext || (await fetchJiraIssueContext(key));
  const [codeMap, settings] = await Promise.all([getCodeMap(), getAppSettings()]);

  const effectiveSettings = options.fastMode ? { ...settings, useForgeLlm: false } : settings;

  const brief = await generateAgentReadyBrief({
    issueKey: key,
    summary: context.summary,
    description: context.description,
    comments: context.comments || [],
    codeMap,
    settings: effectiveSettings
  });

  const topFile = brief.codeLocations?.[0]?.filePath || "";
  const twgResult = await lookupSimilarResolvedBugsViaTwg(
    topFile,
    null,
    null,
    Boolean(options.fastMode)
  );
  brief.twgConnected = twgResult.twgConnected;
  brief.twgPrecedents = twgResult.precedents;

  if (!options.skipSave) {
    await saveBrief(brief);
    if (!/^DEMO-\d+$/i.test(key)) {
      await syncIssueEntityProperty(key, brief);
    }
  }
  return brief;
}

/**
 * Seeds the 3 Lingua-SWE-129 benchmark demo tickets + live PLAT Jira issues in < 200ms.
 */
export async function seedBenchmarkDemoData() {
  const codeMap = await getCodeMap();
  await saveCodeMap(codeMap);

  const liveKeyMapping = {
    "DEMO-101": "PLAT-33510",
    "DEMO-102": "PLAT-33511",
    "DEMO-103": "PLAT-33512"
  };

  const seededBriefs = [];
  const allBriefs = [];
  const entitySyncTasks = [];

  for (const demo of DEMO_SEED_ISSUES) {
    const brief = await analyzeAndStoreIssue(demo.issueKey, demo, {
      fastMode: true,
      skipSave: true
    });
    seededBriefs.push(brief);
    allBriefs.push(brief);

    const liveKey = liveKeyMapping[demo.issueKey];
    if (liveKey) {
      const liveBrief = await analyzeAndStoreIssue(
        liveKey,
        { ...demo, issueKey: liveKey },
        { fastMode: true, skipSave: true }
      );
      allBriefs.push(liveBrief);
      entitySyncTasks.push(syncIssueEntityProperty(liveKey, liveBrief));
    }
  }

  await Promise.all([saveBriefBatch(allBriefs), ...entitySyncTasks]);

  return {
    seededCount: seededBriefs.length,
    issues: seededBriefs.map((b) => ({
      issueKey: b.issueKey,
      score: b.readiness.score,
      status: b.readiness.status,
      topFile: b.codeLocations?.[0]?.filePath,
      topSymbol: b.codeLocations?.[0]?.symbolName
    }))
  };
}

// ============================================================================
// 1. Rovo MCP & Rovo Agent Action Handlers (6 tools exposed via `rovo:mcp`)
// ============================================================================

export async function mcpGetAgentBrief(payload = {}) {
  const issueKey = String(payload.issueKey || "DEMO-101").toUpperCase();
  let brief = await getBrief(issueKey);
  if (!brief) {
    brief = await analyzeAndStoreIssue(issueKey);
  }
  return {
    issueKey: brief.issueKey,
    summary: brief.summary,
    reportStyle: brief.reportStyle,
    languageDetected: brief.languageDetected,
    readiness: brief.readiness,
    symptomSummary: brief.symptomSummary,
    expectedBehavior: brief.expectedBehavior,
    actualBehavior: brief.actualBehavior,
    reproductionSteps: brief.reproductionSteps,
    codeLocations: brief.codeLocations,
    acceptanceCriteria: brief.acceptanceCriteria,
    missingInfoQuestions: brief.missingInfoQuestions,
    agentPrompt: brief.agentPrompt,
    twgConnected: Boolean(brief.twgConnected),
    twgPrecedents: brief.twgPrecedents || [],
    fixOutcome: brief.fixOutcome || null
  };
}

export async function mcpGetReadiness(payload = {}) {
  const brief = await mcpGetAgentBrief(payload);
  return {
    issueKey: brief.issueKey,
    summary: brief.summary,
    reportStyle: brief.reportStyle,
    languageDetected: brief.languageDetected,
    score: brief.readiness.score,
    status: brief.readiness.status,
    breakdown: brief.readiness.breakdown,
    topCodeLocation: brief.codeLocations?.[0] || null,
    missingInfoQuestions: brief.missingInfoQuestions
  };
}

export async function mcpListAgentReadyIssues(payload = {}) {
  let items = await listIndexedIssues({
    projectKey: payload.projectKey,
    minScore: typeof payload.minScore === "number" ? payload.minScore : undefined,
    statusFilter: payload.statusFilter
  });

  if (items.length === 0) {
    await seedBenchmarkDemoData();
    items = await listIndexedIssues({
      projectKey: payload.projectKey,
      minScore: typeof payload.minScore === "number" ? payload.minScore : undefined,
      statusFilter: payload.statusFilter
    });
  }

  return {
    totalMatching: items.length,
    jqlHint:
      typeof payload.minScore === "number"
        ? `agentReadyScore >= ${payload.minScore}`
        : `agentReadyStatus = "READY"`,
    issues: items
  };
}

export async function mcpPostReporterQuestions(payload = {}) {
  const issueKey = String(payload.issueKey || "DEMO-101").toUpperCase();
  const brief = await mcpGetAgentBrief({ issueKey });
  const settings = await getAppSettings();

  const customLines = payload.questionsMarkdown
    ? [payload.questionsMarkdown]
    : (brief.missingInfoQuestions || []).map((q, idx) =>
        settings.bilingualQuestions && q.questionId
          ? `${idx + 1}. [EN] ${q.questionEn}\n   [ID] ${q.questionId}`
          : `${idx + 1}. ${q.questionEn}`
      );

  const commentLines = [
    `[Agent-Ready Issues Triage] Thanks for reporting ${issueKey}! Before we dispatch this ticket to our engineering/coding agent pipeline (current Readiness Score: ${brief.readiness.score}/100), could you help clarify:`,
    ...customLines,
    `Once you reply, Agent-Ready Issues will automatically re-score this ticket.`
  ];

  const postResult = await postJiraIssueComment(issueKey, commentLines);
  brief.lastQuestionsPostedAt = new Date().toISOString();
  brief.readiness.status = "AWAITING_REPORTER";
  await saveBrief(brief);

  return {
    issueKey,
    posted: postResult.posted,
    questionsPosted: customLines.length,
    status: brief.readiness.status,
    preview: commentLines.join("\n\n")
  };
}

export async function mcpRecordCodeLocation(payload = {}) {
  const issueKey = String(payload.issueKey || "DEMO-101").toUpperCase();
  const brief = await mcpGetAgentBrief({ issueKey });

  const verifiedEntry = {
    filePath: String(payload.filePath || "").trim(),
    symbolName: String(payload.symbolName || "").trim(),
    confidence: 0.99,
    reason: payload.rootCauseNote || "Verified directly in repository by coding agent over Rovo MCP.",
    verifiedByAgent: true,
    verifiedAt: new Date().toISOString()
  };

  const remaining = (brief.codeLocations || []).filter(
    (loc) => !(loc.filePath === verifiedEntry.filePath && loc.symbolName === verifiedEntry.symbolName)
  );
  brief.codeLocations = [verifiedEntry, ...remaining].slice(0, 4);

  // Recalculate readiness with verified symbol bonus
  const fullText = [brief.summary, brief.actualBehavior, brief.expectedBehavior, verifiedEntry.filePath, verifiedEntry.symbolName].join("\n");
  brief.readiness = scoreReadinessDimensions(fullText, brief.codeLocations, 1);
  await saveBrief(brief);
  await syncIssueEntityProperty(issueKey, brief);

  return {
    issueKey,
    updatedScore: brief.readiness.score,
    updatedStatus: brief.readiness.status,
    verifiedLocation: verifiedEntry
  };
}

export async function mcpRecordFixOutcome(payload = {}) {
  const issueKey = String(payload.issueKey || "DEMO-101").toUpperCase();
  const brief = await mcpGetAgentBrief({ issueKey });

  const fixOutcome = {
    outcome: String(payload.outcome || "SOLVED").toUpperCase(),
    testCommand: payload.testCommand || "pytest",
    patchSummary: payload.patchSummary || "Applied verified fix.",
    recordedAt: new Date().toISOString()
  };

  brief.fixOutcome = fixOutcome;
  if (fixOutcome.outcome === "SOLVED") {
    brief.readiness.status = "SOLVED_BY_AGENT";
  }
  await saveBrief(brief);

  await postJiraIssueComment(issueKey, [
    `[Agent-Ready Issues MCP Outcome] Status: ${fixOutcome.outcome}`,
    `Verification Test: ${fixOutcome.testCommand}`,
    `Patch Summary: ${fixOutcome.patchSummary}`
  ]);

  return {
    issueKey,
    fixOutcome,
    status: brief.readiness.status
  };
}

// ============================================================================
// 2. Async Event Trigger & Consumer (`avi:jira:created/updated/commented:issue`)
// ============================================================================

export async function triggerHandler(event) {
  const issueKey = event?.issue?.key;
  if (!issueKey) {
    return { queued: false };
  }

  try {
    const eventsMod = await import("@forge/events");
    const Queue = eventsMod.Queue || eventsMod.default?.Queue;
    if (Queue) {
      const queue = new Queue({ key: "brief-pipeline-queue" });
      await queue.push({
        issueKey,
        eventType: event.eventType || "avi:jira:updated:issue",
        queuedAt: new Date().toISOString()
      });
      return { queued: true, issueKey };
    }
  } catch {
    // Fallback to direct processing when running outside Queue runtime
  }

  await analyzeAndStoreIssue(issueKey);
  return { queued: false, processedInline: true, issueKey };
}

export const consumerHandler = {
  async processBriefEvent(event) {
    const body = event?.body || event || {};
    const issueKey = body.issueKey;
    if (!issueKey) return { ok: false };
    const brief = await analyzeAndStoreIssue(issueKey);
    return { ok: true, issueKey: brief.issueKey, score: brief.readiness.score };
  }
};

// ============================================================================
// 3. Inbound CI Code-Map Webtrigger (Zero-Egress Symbol Index Upload)
// ============================================================================

export async function codemapWebtriggerHandler(req) {
  try {
    const body = typeof req?.body === "string" ? JSON.parse(req.body) : req?.body || {};
    const saved = await saveCodeMap(body);
    return {
      statusCode: 200,
      headers: { "Content-Type": ["application/json"] },
      body: JSON.stringify({
        ok: true,
        repoName: saved.repoName,
        entryCount: saved.entries.length,
        updatedAt: saved.updatedAt
      })
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: { "Content-Type": ["application/json"] },
      body: JSON.stringify({ ok: false, error: String(err?.message || err) })
    };
  }
}

// ============================================================================
// 4. UI Kit Resolver (`jira:issuePanel` + `jira:adminPage`)
// ============================================================================

export async function dispatchUiAction(actionName, payload = {}, context = {}) {
  const extensionIssueKey = context?.extension?.issue?.key;
  const requestedKey =
    payload.issueKey && payload.issueKey !== "DEMO-101" ? payload.issueKey : null;
  const issueKey = requestedKey || extensionIssueKey || payload.issueKey || "DEMO-101";

  switch (actionName) {
    case "getIssueBrief":
      return await mcpGetAgentBrief({ issueKey });
    case "regenerateBrief":
      return await analyzeAndStoreIssue(issueKey);
    case "postReporterQuestions":
      return await mcpPostReporterQuestions({
        issueKey,
        questionsMarkdown: payload.questionsMarkdown
      });
    case "recordCodeLocation":
      return await mcpRecordCodeLocation({ issueKey, ...payload });
    case "recordFixOutcome":
      return await mcpRecordFixOutcome({ issueKey, ...payload });
    case "getAdminDashboard": {
      const [settings, codeMap, issuesResult] = await Promise.all([
        getAppSettings(),
        getCodeMap(),
        mcpListAgentReadyIssues({})
      ]);
      return {
        settings,
        codeMap,
        issues: issuesResult.issues,
        benchmark: LINGUA_SWE_BENCHMARK
      };
    }
    case "saveSettings":
      return await saveAppSettings(payload);
    case "uploadCodeMap":
      return await saveCodeMap(payload);
    case "seedDemoData":
      return await seedBenchmarkDemoData();
    default:
      throw new Error(`Unknown resolver action: ${actionName}`);
  }
}

export async function uiResolver(req) {
  const call = req?.call || {};
  const actionName = call.functionKey || req?.action || "getIssueBrief";
  const payload = call.payload || req?.payload || {};
  const context = req?.context || {};
  return await dispatchUiAction(actionName, payload, context);
}
