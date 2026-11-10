# Agent-Ready Brief Schema & 5-Dimension Scoring Rubric

## 1. The 5-Dimension Agent Readiness Score (0–100)

| Dimension | Max Points | What Earns Full Credit | Why Coding Agents Need It |
|---|---|---|---|
| **1. Reproduction Steps (`reproSteps`)** | 25 | Ordered steps, minimal input payload, CLI command, or HTTP request that triggers the bug | Without a deterministic trigger, agents waste 15–25 tool calls guessing how to reproduce the symptom |
| **2. Behavioral Contract (`expectedVsActual`)** | 25 | Explicit statement of *Actual* symptom AND *Expected* behavior (including edge-case return value or status code) | In *Lingua-SWE-129*, missing expected behavior was the #1 driver of the 72–89% patch failure rate on user reports |
| **3. Symbol Localization (`codeLocations`)** | 20 | At least one high-confidence repository `filePath` and `symbolName` (`function`/`class`) matched from the code map or traceback | Naming the edited function/class increases 31B agent solve rates significantly (`p = 0.063` paired) |
| **4. Testable Acceptance Criteria (`acceptanceCriteria`)** | 15 | Concrete `Given / When / Then` assertions that fail before the patch and pass after | Prevents regressions such as deleting special types from `analyze_param()` in `fastapi_14794` |
| **5. Environment & Error Evidence (`environmentContext`)** | 15 | Stack trace, error message string, version/OS details, or HTTP route | Narrows lexical + semantic code-map ranking to the exact module |

**Readiness Status Thresholds:**
- `READY` (`score >= 75`): Safe to assign directly to an autonomous coding agent over Rovo MCP.
- `NEEDS_CLARIFICATION` (`score < 75`): Missing critical contract or reproduction facts; post ranked reporter questions first.

## 2. Brief JSON Structure Stored in Forge KVS (`brief:<issueKey>`)

```json
{
  "issueKey": "SUP-101",
  "summary": "Custom response_class status code ignored when returning Response directly",
  "reportStyle": "SYMPTOM_ONLY_USER",
  "languageDetected": "id-en-codemixed",
  "readiness": {
    "score": 84,
    "status": "READY",
    "breakdown": {
      "reproSteps": 22,
      "expectedVsActual": 23,
      "codeLocations": 18,
      "acceptanceCriteria": 13,
      "environmentContext": 8
    }
  },
  "symptomSummary": "Returning a Response instance without an explicit status_code inside an endpoint that declares a custom response_class/status_code fails or loses parameter handling.",
  "expectedBehavior": "FastAPI should treat raw Response annotations as non-body special parameters in analyze_param() while preserving route-level status code behavior.",
  "actualBehavior": "Endpoint raises validation error or ignores expected Response handling.",
  "reproductionSteps": [
    "Define a @app.get('/items', status_code=201) endpoint with a parameter annotated as Response.",
    "Send GET /items without query/body parameters.",
    "Observe parameter analysis / response status mismatch."
  ],
  "codeLocations": [
    {
      "filePath": "fastapi/dependencies/utils.py",
      "symbolName": "analyze_param",
      "confidence": 0.92,
      "reason": "Inspects parameter annotations and separates Response/Request special types from Pydantic body/query fields.",
      "verifiedByAgent": false
    },
    {
      "filePath": "fastapi/routing.py",
      "symbolName": "get_route_handler",
      "confidence": 0.78,
      "reason": "Constructs response serialization and merges injected Response headers/status codes.",
      "verifiedByAgent": false
    }
  ],
  "acceptanceCriteria": [
    {
      "given": "An endpoint function declaring `response: Response` in its signature",
      "when": "`analyze_param()` inspects the parameter annotation",
      "then": "`Response` remains recognized as a special non-body parameter and existing tests in `tests/test_response_Legacy.py` pass"
    }
  ],
  "missingInfoQuestions": [
    {
      "priority": 1,
      "dimension": "expectedVsActual",
      "questionEn": "When your endpoint returns a custom Response object directly, should the route decorator's `status_code` apply as the default, or should `Response.status_code` override it?",
      "questionId": "Saat endpoint mengembalikan objek `Response` secara langsung, apakah `status_code` pada decorator route harus menjadi default, atau mengikuti `Response.status_code`?"
    }
  ],
  "agentPrompt": "..."
}
```
