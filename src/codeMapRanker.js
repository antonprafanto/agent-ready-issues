import { DEFAULT_CODE_MAP } from "./benchmarkData.js";

/**
 * Tokenizes text while preserving snake_case, CamelCase, and dotted code symbols
 * (e.g. `analyze_param`, `Console.print`, `fastapi/routing.py`).
 */
export function extractTokensAndSymbols(text = "") {
  const raw = String(text || "");
  const codeSymbols = new Set();

  // Match backticked identifiers, snake_case, dotted calls, and file paths
  const symbolRegex = /`([^`]+)`|\b([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*|[a-zA-Z_][a-zA-Z0-9_]*_[a-zA-Z0-9_]+|[a-zA-Z0-9_/-]+\.py)\b/g;
  let match;
  while ((match = symbolRegex.exec(raw)) !== null) {
    const sym = (match[1] || match[2] || "").trim();
    if (sym.length >= 2) {
      codeSymbols.add(sym);
      codeSymbols.add(sym.toLowerCase());
    }
  }

  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9_./@-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  return {
    words: new Set(words),
    codeSymbols
  };
}

/**
 * Ranks repository Code Map entries against an issue's summary + description + comments.
 * Zero source-code bodies leave the repo; runs entirely inside Atlassian Forge.
 */
export function rankCodeMapLocations(issueText, codeMap = DEFAULT_CODE_MAP, topK = 3) {
  const entries = Array.isArray(codeMap?.entries) && codeMap.entries.length > 0
    ? codeMap.entries
    : DEFAULT_CODE_MAP.entries;

  const { words, codeSymbols } = extractTokensAndSymbols(issueText);
  const rawLower = String(issueText || "").toLowerCase();

  const scored = entries.map((entry) => {
    let rawScore = 0;
    const matchedReasons = [];
    let bestSymbol = entry.symbols?.[0] || "module";

    // 1. Direct file path mention
    if (entry.filePath && rawLower.includes(entry.filePath.toLowerCase())) {
      rawScore += 45;
      matchedReasons.push(`Direct file path match (${entry.filePath})`);
    }

    // 2. Symbol matches (functions, classes, methods)
    for (const sym of entry.symbols || []) {
      const symLower = sym.toLowerCase();
      const shortSym = symLower.split(".").pop();
      if (rawLower.includes(symLower) || codeSymbols.has(symLower)) {
        rawScore += 35;
        bestSymbol = sym;
        matchedReasons.push(`Mentions symbol \`${sym}\``);
      } else if (shortSym && shortSym.length >= 4 && words.has(shortSym)) {
        rawScore += 20;
        bestSymbol = sym;
        matchedReasons.push(`Matches identifier token \`${sym}\``);
      }
    }

    // 3. Route, decorator, or CLI flag matches
    for (const route of entry.routesOrCommands || []) {
      const routeLower = route.trim().toLowerCase();
      if (routeLower && rawLower.includes(routeLower)) {
        rawScore += 18;
        matchedReasons.push(`Matches API/route surface \`${route}\``);
      }
    }

    // 4. Error string or exception class matches
    for (const errStr of entry.errorStrings || []) {
      const errLower = errStr.trim().toLowerCase();
      if (errLower && rawLower.includes(errLower)) {
        rawScore += 22;
        matchedReasons.push(`Matches error/exception pattern \`${errStr}\``);
      }
    }

    // 5. Lexical overlap with module summary
    const summaryWords = String(entry.summary || "")
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4);

    let overlapCount = 0;
    for (const sw of summaryWords) {
      if (words.has(sw)) {
        overlapCount += 1;
      }
    }
    if (overlapCount > 0) {
      rawScore += Math.min(18, overlapCount * 4);
      if (matchedReasons.length === 0) {
        matchedReasons.push(`Semantic/lexical overlap with module responsibility (${overlapCount} terms)`);
      }
    }

    const confidence = Number(Math.min(0.98, Math.max(0.15, rawScore / 75)).toFixed(2));

    return {
      filePath: entry.filePath,
      symbolName: bestSymbol,
      allCandidateSymbols: entry.symbols || [],
      confidence,
      rawScore,
      reason: matchedReasons.length > 0
        ? `${matchedReasons.slice(0, 2).join("; ")}. ${entry.summary}`
        : entry.summary,
      verifiedByAgent: false
    };
  });

  scored.sort((a, b) => b.rawScore - a.rawScore);
  return scored.slice(0, topK);
}
