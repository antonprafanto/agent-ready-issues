/**
 * Empirical benchmark data from the published Lingua-SWE-129 dataset
 * (https://www.kaggle.com/datasets/antonpraf/lingua-swe-129, CC BY 4.0)
 * plus a built-in zero-egress Code Map and 1-click Judge Seed Scenarios.
 */

export const LINGUA_SWE_BENCHMARK = {
  datasetUrl: "https://www.kaggle.com/datasets/antonpraf/lingua-swe-129",
  verifiedTasks: 101,
  repositories: ["tiangolo/fastapi (60 tasks)", "Textualize/rich (41 tasks)"],
  keyFindings: [
    {
      metric: "31B Solve Rate Drop on Symptom-Only Reports",
      value: "-31% (95% CI: 15-46%)",
      detail: "Gemma 4 31B solves 36.0/101 tasks on developer specs vs. 25.0/101 on symptom-only user reports (two-run mean)."
    },
    {
      metric: "12B Solve Rate Drop on Symptom-Only Reports",
      value: "-62% (95% CI: 43-78%)",
      detail: "Gemma 4 12B solves 26/101 tasks on developer specs vs. 10.0/101 on symptom-only user reports (two-run mean)."
    },
    {
      metric: "File Localization vs. Patch Failure Bottleneck",
      value: "85% reach file -> 72-89% fail patch",
      detail: "Coding agents still find the target file 83-85% of the time, but patches fail because function symbols and expected behavioral contracts are missing."
    },
    {
      metric: "Code-Mixed Indonesian vs. English",
      value: "0% loss when identifiers stay in English",
      detail: "Casual code-mixed Indonesian (ID-casual: 43/101 on 31B, 27/101 on 12B) performs on par with English when code symbols remain untranslated."
    },
    {
      metric: "Why Naming Symbols Matters (Real GitHub Issues)",
      value: "37% vs. 5% symbol mention rate (p = 0.0005)",
      detail: "When only the developer spec names the edited function/class (13 tasks), 31B loses 5 tasks and gains 0 on symptom-only text."
    }
  ]
};

export const DEFAULT_CODE_MAP = {
  repoName: "fastapi + rich (Lingua-SWE-129 Reference Code Map)",
  commitSha: "lingua-swe-129-v10",
  updatedAt: "2026-11-09T08:00:00Z",
  entries: [
    {
      filePath: "fastapi/dependencies/utils.py",
      symbols: ["analyze_param", "solve_dependencies", "get_dependant", "get_body_field"],
      routesOrCommands: ["@app.get", "@app.post", "Depends", "Response", "Request"],
      errorStrings: ["ResponseValidationError", "RequestValidationError", "status_code", "response_class"],
      summary: "Inspects endpoint parameter annotations, separates special types (Request, Response, WebSocket) from Pydantic body/query fields, and resolves dependency trees."
    },
    {
      filePath: "fastapi/routing.py",
      symbols: ["APIRoute", "APIRouter", "get_route_handler", "serialize_response", "run_endpoint_function"],
      routesOrCommands: ["include_router", "response_model", "status_code", "response_class"],
      errorStrings: ["ResponseValidationError", "Invalid response status code", "field required"],
      summary: "Builds ASGI route handlers, merges route-level status_code and response_class defaults, and serializes endpoint return values against response_model."
    },
    {
      filePath: "fastapi/encoders.py",
      symbols: ["jsonable_encoder", "generate_encoders_by_class_tuples"],
      routesOrCommands: ["jsonable_encoder", "custom_encoder", "sqlalchemy", " dataclasses"],
      errorStrings: ["TypeError: Object of type", "is not JSON serializable", "ValueError"],
      summary: "Converts Pydantic models, dataclasses, enums, PurePath, and custom objects into JSON-compatible dictionaries and lists."
    },
    {
      filePath: "fastapi/openapi/utils.py",
      symbols: ["get_openapi", "get_openapi_path", "get_openapi_operation_metadata"],
      routesOrCommands: ["/openapi.json", "/docs", "responses", "operation_id"],
      errorStrings: ["KeyError: '$ref'", "OpenAPI schema generation failed"],
      summary: "Generates OpenAPI 3.1 schemas for routes, query/body parameters, security schemes, and custom response definitions."
    },
    {
      filePath: "rich/console.py",
      symbols: ["Console", "Console.print", "Console.log", "Console.export_text", "Capture"],
      routesOrCommands: ["console.print", "soft_wrap", "crop", "overflow", "no_wrap"],
      errorStrings: ["ConsoleError", "MarkupError", " UnicodeEncodeError"],
      summary: "Core terminal rendering engine handling ANSI escape sequences, width wrapping, soft_wrap truncation, and text export."
    },
    {
      filePath: "rich/table.py",
      symbols: ["Table", "Table.add_row", "Table.add_column", "Table._calculate_column_widths"],
      routesOrCommands: ["Table()", "expand", "min_width", "max_width", "ratio"],
      errorStrings: ["NotRenderableError", "column width overflow"],
      summary: "Calculates responsive terminal column widths, ratios, padding, and row borders for Rich tables."
    },
    {
      filePath: "rich/pretty.py",
      symbols: ["Pretty", "pretty_repr", "traverse", "_has_default_namedtuple_repr"],
      routesOrCommands: ["pprint", "pretty_repr", "max_depth", "indent_guides"],
      errorStrings: ["RecursionError", "TypeError in __repr__"],
      summary: "Pretty-prints nested Python data structures, dataclasses, namedtuples, and custom __rich_repr__ objects with cycle detection."
    }
  ]
};

export const DEMO_SEED_ISSUES = [
  {
    issueKey: "DEMO-101",
    summary: "[JSM Customer - ID/EN Code-Mixed] Endpoint error 422 waktu pakai parameter Response tanpa body di route @app.post",
    description:
      "Halo tim support, sudah works untuk endpoint GET, tapi ada kendala waktu kita tambahkan parameter `response: Response` di endpoint `@app.post('/items', status_code=201)`. Kalau client kirim request tanpa JSON body, tiba-tiba muncul error 422 `field required` untuk `response`. Padahal sebelumnya `Response` otomatis dikenali FastAPI untuk set header/cookie.",
    reporterName: "Budi Santoso (Koding Indonesia)",
    benchmarkTaskId: "fastapi_14794"
  },
  {
    issueKey: "DEMO-102",
    summary: "[JSM Customer - Symptom Only] Terminal output cuts off long URLs when copying from console",
    description:
      "When our CLI prints long log lines with URLs using Rich, copying the text from the terminal breaks the URL across multiple lines with extra spaces at the end of each line. We tried setting soft_wrap, but it still seems to pad or crop the line width.",
    reporterName: "Sarah Jenkins (Support Portal)",
    benchmarkTaskId: "rich_3180"
  },
  {
    issueKey: "DEMO-103",
    summary: "[Engineering Spec - Agent Ready] Preserve custom_encoder in jsonable_encoder when serializing nested dataclasses inside lists",
    description:
      "### Reproduction Steps\n1. Create a `@dataclass class Item: created_at: datetime`.\n2. Call `jsonable_encoder([Item(created_at=dt)], custom_encoder={datetime: lambda v: int(v.timestamp())})`.\n\n### Actual vs Expected Behavior\n- **Actual:** `fastapi/encoders.py` inside `jsonable_encoder()` calls `asdict(obj)` or recurses on list items without forwarding `custom_encoder` to dataclass field values, returning an ISO string instead of the integer timestamp.\n- **Expected:** `jsonable_encoder` must check `custom_encoder` before ` dataclasses.is_dataclass(obj)` field conversion and forward `custom_encoder` recursively so `Item.created_at` serializes as `int(v.timestamp())`.\n\n### Verification Test\nRun `pytest tests/test_jsonable_encoder.py -k test_dataclass_custom_encoder`.",
    reporterName: "Anton Prafanto (Lead Maintainer)",
    benchmarkTaskId: "fastapi_14812"
  }
];
