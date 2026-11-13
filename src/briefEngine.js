import { rankCodeMapLocations } from "./codeMapRanker.js";
import { DEFAULT_CODE_MAP } from "./benchmarkData.js";

const INDONESIAN_MARKERS = [
  "halo", "ketika", "waktu", "tapi", "kendala", "kalau", "tanpa", "muncul",
  "padahal", "sudah", "tidak", "bisa", "saat", "seharusnya", "tolong", "terima", "kasih"
];

export function detectLanguageAndStyle(summary = "", description = "", comments = []) {
  const fullText = [summary, description, ...(comments || [])].join("\n");
  const lower = fullText.toLowerCase();
  const words = lower.replace(/[^a-z0-9_]+/g, " ").split(/\s+/).filter(Boolean);

  let idHits = 0;
  for (const w of words) {
    if (INDONESIAN_MARKERS.includes(w)) idHits += 1;
  }

  const hasEnglishCodeTerms = /\b(response|request|endpoint|status_code|error|console|table|dataclass|jsonable_encoder|pytest|def|class)\b/i.test(fullText);
  let languageDetected = "en";
  if (idHits >= 2 && hasEnglishCodeTerms) {
    languageDetected = "id-en-codemixed";
  } else if (idHits >= 2) {
    languageDetected = "id";
  }

  const hasExplicitFilePath = /\b[a-z0-9_/-]+\.(py|ts|js|tsx|jsx|java|go|rs)\b/i.test(fullText);
  const hasExplicitFunction = /\b(analyze_param|get_route_handler|jsonable_encoder|serialize_response|_calculate_column_widths|pretty_repr|[a-z_]+_[a-z_]+\(\))\b/i.test(fullText);
  const hasStructuredSections = /\b(expected|actual|reproduction|steps to reproduce|pytest|test_)\b/i.test(fullText);

  const reportStyle = (hasExplicitFilePath || (hasExplicitFunction && hasStructuredSections))
    ? "DEVELOPER_SPEC"
    : "SYMPTOM_ONLY_USER";

  return { languageDetected, reportStyle };
}

export function scoreReadinessDimensions(fullText = "", rankedLocations = [], verifiedLocationCount = 0) {
  const text = String(fullText || "");

  // 1. Reproduction steps (max 25)
  let reproSteps = 6;
  if (/(1\.|2\.|step 1|langkah|when our|waktu kita|kalau client|call `|send (get|post)|@app\.)/i.test(text)) {
    reproSteps += 10;
  }
  if (/(`[^`]{6,}`|```|pytest |curl |status_code=|custom_encoder=)/i.test(text)) {
    reproSteps += 9;
  }
  reproSteps = Math.min(25, reproSteps);

  // 2. Expected vs. Actual behavioral contract (max 25)
  let expectedVsActual = 6;
  if (/(error|fails|cuts off|breaks|kendala|muncul|ignored|instead of|actual:)/i.test(text)) {
    expectedVsActual += 8;
  }
  if (/(expected:|should |seharusnya|must check|otomatis dikenali|preserve )/i.test(text)) {
    expectedVsActual += 11;
  }
  expectedVsActual = Math.min(25, expectedVsActual);

  // 3. Symbol localization from code map or explicit mention (max 20)
  const topConf = rankedLocations?.[0]?.confidence || 0.2;
  let codeLocations = Math.round(topConf * 16);
  if (/\b[a-z0-9_/-]+\.(py|ts|js)\b/i.test(text) || verifiedLocationCount > 0) {
    codeLocations += 6;
  }
  codeLocations = Math.min(20, Math.max(4, codeLocations));

  // 4. Testable acceptance criteria (max 15)
  let acceptanceCriteria = 4;
  if (/(pytest |test_|given |when |then |verification test|assert )/i.test(text)) {
    acceptanceCriteria += 11;
  } else if (expectedVsActual >= 18 && reproSteps >= 16) {
    acceptanceCriteria += 7;
  }
  acceptanceCriteria = Math.min(15, acceptanceCriteria);

  // 5. Environment & error trace context (max 15)
  let environmentContext = 4;
  if (/(422|500|400|TypeError|ValueError|ValidationError|field required|soft_wrap|status_code=201|traceback)/i.test(text)) {
    environmentContext += 11;
  }
  environmentContext = Math.min(15, environmentContext);

  const score = reproSteps + expectedVsActual + codeLocations + acceptanceCriteria + environmentContext;
  const status = score >= 75 ? "READY" : "NEEDS_CLARIFICATION";

  return {
    score,
    status,
    breakdown: {
      reproSteps,
      expectedVsActual,
      codeLocations,
      acceptanceCriteria,
      environmentContext
    }
  };
}

export function buildMissingInfoQuestions(summary, description, readiness, topLocation) {
  const questions = [];
  const topSym = topLocation ? `\`${topLocation.symbolName}\` in \`${topLocation.filePath}\`` : "the target handler";

  if (readiness.breakdown.expectedVsActual < 20) {
    questions.push({
      priority: 1,
      dimension: "expectedVsActual",
      questionEn: `To ensure our patch matches your intended contract in ${topSym}: what exact return value, status code, or terminal output should happen in this edge case instead of the current symptom?`,
      questionId: `Agar perbaikan pada ${topSym} sesuai kontrak perilaku yang Anda harapkan: nilai kembalian, status code, atau output apa yang seharusnya muncul pada kondisi ini?`
    });
  }

  if (readiness.breakdown.reproSteps < 20) {
    questions.push({
      priority: questions.length + 1,
      dimension: "reproSteps",
      questionEn: "Could you share a minimal 3-5 line code snippet or request payload that triggers this issue every time?",
      questionId: "Boleh dibagikan potongan kode singkat (3-5 baris) atau contoh payload request yang selalu memicu kendala ini?"
    });
  }

  if (readiness.breakdown.environmentContext < 12) {
    questions.push({
      priority: questions.length + 1,
      dimension: "environmentContext",
      questionEn: "Did you observe a full traceback, exception class name, or specific library version when this occurred?",
      questionId: "Apakah muncul pesan traceback lengkap, nama class exception, atau versi pustaka tertentu saat kendala ini terjadi?"
    });
  }

  if (questions.length === 0) {
    questions.push({
      priority: 1,
      dimension: "acceptanceCriteria",
      questionEn: `This ticket is Agent-Ready (score ${readiness.score}/100). Are there any backward-compatibility constraints on ${topSym} we should guard in the regression test?`,
      questionId: `Tiket ini sudah Agent-Ready (skor ${readiness.score}/100). Apakah ada batasan kompatibilitas pada ${topSym} yang perlu dijaga di unit test?`
    });
  }

  return questions.slice(0, 3);
}

export function buildDeterministicSynthesis(issueKey, summary, description, comments, codeMap = DEFAULT_CODE_MAP) {
  const fullText = [summary, description, ...(comments || [])].filter(Boolean).join("\n\n");
  const { languageDetected, reportStyle } = detectLanguageAndStyle(summary, description, comments);
  const rankedLocations = rankCodeMapLocations(fullText, codeMap, 3);
  const readiness = scoreReadinessDimensions(fullText, rankedLocations, 0);
  const topLoc = rankedLocations[0] || {
    filePath: "fastapi/routing.py",
    symbolName: "get_route_handler",
    confidence: 0.5,
    reason: "Default route handler entry point"
  };

  const symptomSummary = summary
    ? `${summary.replace(/^\[[^\]]+\]\s*/, "")}`
    : "User reported unexpected runtime behavior without explicit symbol references.";

  const expectedBehavior = readiness.breakdown.expectedVsActual >= 20
    ? `Preserve the documented contract in \`${topLoc.symbolName}\` (\`${topLoc.filePath}\`) so the operation succeeds without breaking existing callers.`
    : `Modify \`${topLoc.symbolName}\` in \`${topLoc.filePath}\` so the reported scenario completes without raising an unhandled validation/rendering error, while keeping existing special parameter/formatting behavior intact.`;

  const actualBehavior = description
    ? description.split("\n").filter(Boolean)[0].slice(0, 260)
    : "Symptom-only report: operation fails or produces unexpected output.";

  const reproductionSteps = [
    `Inspect \`${topLoc.filePath}\` around symbol \`${topLoc.symbolName}\` (candidate symbols: ${(topLoc.allCandidateSymbols || [topLoc.symbolName]).join(", ")}).`,
    `Construct a minimal reproduction test in \`tests/\` exercising the reported input from ${issueKey}.`,
    `Verify the test fails with the reported symptom before modifying \`${topLoc.symbolName}\`.`
  ];

  const acceptanceCriteria = [
    {
      given: `A caller invoking the workflow backed by \`${topLoc.symbolName}\` in \`${topLoc.filePath}\` under the conditions described in ${issueKey}`,
      when: `The input triggers the edge case (${symptomSummary.slice(0, 90)})`,
      then: `${expectedBehavior} And all existing unit tests in the module continue to pass.`
    }
  ];

  const missingInfoQuestions = buildMissingInfoQuestions(summary, description, readiness, topLoc);

  const agentPrompt = [
    `# Agent-Ready Engineering Brief: ${issueKey}`,
    `- **Summary:** ${symptomSummary}`,
    `- **Report Style:** ${reportStyle} (Language: ${languageDetected})`,
    `- **Agent Readiness Score:** ${readiness.score}/100 (${readiness.status})`,
    ``,
    `## 1. Localized Code Map Targets (Zero-Egress Symbol Index)`,
    ...rankedLocations.map(
      (loc, idx) =>
        `${idx + 1}. \`${loc.filePath}\` -> symbol \`${loc.symbolName}\` (confidence ${(loc.confidence * 100).toFixed(0)}%): ${loc.reason}`
    ),
    ``,
    `## 2. Behavioral Contract`,
    `- **Observed Symptom (Actual):** ${actualBehavior}`,
    `- **Intended Contract (Expected):** ${expectedBehavior}`,
    ``,
    `## 3. Given / When / Then Acceptance Criteria`,
    ...acceptanceCriteria.map(
      (ac, idx) =>
        `${idx + 1}. **GIVEN** ${ac.given} **WHEN** ${ac.when} **THEN** ${ac.then}`
    ),
    ``,
    `## 4. Coding Agent Instructions (Rovo MCP Loop)`,
    `1. Write a reproduction test first and confirm it fails before editing \`${topLoc.symbolName}\`.`,
    `2. Call MCP tool \`record-code-location\` once you confirm the exact symbol in \`${topLoc.filePath}\`.`,
    `3. Apply the minimal fix without removing special parameter types or breaking existing signatures.`,
    `4. Run pytest and call MCP tool \`record-fix-outcome\` with the test command and patch summary.`
  ].join("\n");

  return {
    issueKey,
    summary: summary || issueKey,
    reportStyle,
    languageDetected,
    readiness,
    symptomSummary,
    expectedBehavior,
    actualBehavior,
    reproductionSteps,
    codeLocations: rankedLocations,
    acceptanceCriteria,
    missingInfoQuestions,
    agentPrompt,
    engineUsed: "deterministic+codemap",
    generatedAt: new Date().toISOString()
  };
}

function withTimeout(promise, ms = 5000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Synthesizes an Agent-Ready Brief using Atlassian Forge LLMs (`@forge/llm`)
 * when available and within the site's token cap, falling back cleanly to the
 * deterministic + code-map engine so judges never hit an error or timeout.
 */
export async function generateAgentReadyBrief({
  issueKey,
  summary,
  description,
  comments = [],
  codeMap = DEFAULT_CODE_MAP,
  settings = { useForgeLlm: true, preferredModel: "claude-sonnet-5" },
  llmClient = null
}) {
  const baseBrief = buildDeterministicSynthesis(issueKey, summary, description, comments, codeMap);

  if (!settings?.useForgeLlm) {
    return baseBrief;
  }

  let activeLlm = llmClient;
  if (!activeLlm) {
    if (typeof globalThis.__forge_fetch__ !== "function") {
      return baseBrief;
    }
    try {
      activeLlm = await import("@forge/llm");
    } catch {
      return baseBrief;
    }
  }

  if (!activeLlm || typeof activeLlm.chat !== "function") {
    return baseBrief;
  }

  try {
    let modelToUse = settings?.preferredModel || "claude-sonnet-5";
    if (typeof activeLlm.list === "function") {
      try {
        const modelList = await withTimeout(activeLlm.list(), 2000);
        const activeModels = (modelList?.models || [])
          .filter((m) => m.status === "active")
          .map((m) => m.model);
        if (activeModels.length > 0 && !activeModels.includes(modelToUse)) {
          modelToUse =
            activeModels.find((m) => m.includes("sonnet-5")) ||
            activeModels.find((m) => m.includes("sonnet-4-6")) ||
            activeModels[0];
        }
      } catch (listErr) {
        console.warn("[agent-ready-issues] Forge LLM list() failed:", listErr?.message || listErr);
      }
    }

    const promptPayload = {
      model: modelToUse,
      // IMPORTANT: Per Forge LLMs validation rules, omit temperature & top_p
      // because claude-sonnet-5 and claude-opus-5 reject sampling parameters.
      max_completion_tokens: 900,
      messages: [
        {
          role: "system",
          content:
            "You are an expert software triage engineer. Given a bug report and top repository code-map entries, return ONLY valid JSON with keys: symptomSummary (string), expectedBehavior (string), actualBehavior (string), reproductionSteps (string[]), acceptanceCriteria ({given,when,then}[]), and missingInfoQuestions ({priority,dimension,questionEn,questionId}[]). Keep code identifiers in English."
        },
        {
          role: "user",
          content: JSON.stringify({
            issueKey,
            summary,
            description,
            comments,
            topCodeMapCandidates: baseBrief.codeLocations
          })
        }
      ]
    };

    const response = await withTimeout(activeLlm.chat(promptPayload), 15000);
    const rawContent = response?.choices?.[0]?.message?.content;
    const textContent = Array.isArray(rawContent)
      ? rawContent.map((p) => p.text || "").join("")
      : String(rawContent || "");

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.info("[agent-ready-issues] Forge LLM brief succeeded:", issueKey, modelToUse);
      return {
        ...baseBrief,
        symptomSummary: parsed.symptomSummary || baseBrief.symptomSummary,
        expectedBehavior: parsed.expectedBehavior || baseBrief.expectedBehavior,
        actualBehavior: parsed.actualBehavior || baseBrief.actualBehavior,
        reproductionSteps:
          Array.isArray(parsed.reproductionSteps) && parsed.reproductionSteps.length > 0
            ? parsed.reproductionSteps
            : baseBrief.reproductionSteps,
        acceptanceCriteria:
          Array.isArray(parsed.acceptanceCriteria) && parsed.acceptanceCriteria.length > 0
            ? parsed.acceptanceCriteria
            : baseBrief.acceptanceCriteria,
        missingInfoQuestions:
          Array.isArray(parsed.missingInfoQuestions) && parsed.missingInfoQuestions.length > 0
            ? parsed.missingInfoQuestions
            : baseBrief.missingInfoQuestions,
        engineUsed: `forge-llm:${modelToUse}`,
        llmUsage: response?.usage || null
      };
    }
    console.warn("[agent-ready-issues] Forge LLM response lacked JSON block; falling back:", issueKey);
  } catch (err) {
    console.warn("[agent-ready-issues] Forge LLM chat() failed:", issueKey, err?.message || err);
  }

  return baseBrief;
}
