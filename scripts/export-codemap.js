#!/usr/bin/env node
/**
 * Zero-Egress Repository Code Map Exporter
 * Scans a local repository for Python / JS / TS modules and extracts ONLY:
 * - relative filePath
 * - function / class / method symbols
 * - route decorators or CLI commands
 * - exception / error strings
 * Zero function bodies or secrets are exported.
 */
import fs from "node:fs";
import path from "node:path";

export function extractSymbolsFromSource(sourceCode = "", ext = ".py") {
  const symbols = new Set();
  const routesOrCommands = new Set();
  const errorStrings = new Set();

  const lines = String(sourceCode).split(/\r?\n/);
  for (const line of lines) {
    if (ext === ".py") {
      const defMatch = line.match(/^\s*(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
      if (defMatch && !defMatch[1].startsWith("__")) symbols.add(defMatch[1]);
      const clsMatch = line.match(/^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/);
      if (clsMatch) symbols.add(clsMatch[1]);
      const decMatch = line.match(/^\s*(@[a-zA-Z0-9_.]+)/);
      if (decMatch) routesOrCommands.add(decMatch[1]);
    } else {
      const fnMatch = line.match(/\b(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/);
      if (fnMatch) symbols.add(fnMatch[1]);
      const clsMatch = line.match(/\b(?:export\s+)?class\s+([a-zA-Z0-9_]+)\b/);
      if (clsMatch) symbols.add(clsMatch[1]);
    }

    const errMatch = line.match(/\b([A-Z][a-zA-Z0-9_]*(?:Error|Exception))\b/);
    if (errMatch) errorStrings.add(errMatch[1]);
  }

  return {
    symbols: [...symbols].slice(0, 15),
    routesOrCommands: [...routesOrCommands].slice(0, 10),
    errorStrings: [...errorStrings].slice(0, 10)
  };
}

export function buildCodeMapFromDir(rootDir) {
  const entries = [];
  const ignoreDirs = new Set([".git", "node_modules", ".venv", "dist", "build", "__pycache__"]);

  function walk(currentDir) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      if (ignoreDirs.has(item.name)) continue;
      const fullPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        walk(fullPath);
      } else {
        const ext = path.extname(item.name);
        if ([".py", ".js", ".ts", ".jsx", ".tsx"].includes(ext)) {
          const content = fs.readFileSync(fullPath, "utf8");
          const extracted = extractSymbolsFromSource(content, ext);
          if (extracted.symbols.length > 0) {
            entries.push({
              filePath: path.relative(rootDir, fullPath).replace(/\\/g, "/"),
              ...extracted,
              summary: `Module exporting ${extracted.symbols.slice(0, 5).join(", ")}`
            });
          }
        }
      }
    }
  }

  walk(rootDir);
  return {
    repoName: path.basename(path.resolve(rootDir)),
    commitSha: "local-scan",
    updatedAt: new Date().toISOString(),
    entries
  };
}
