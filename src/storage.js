import { DEFAULT_CODE_MAP } from "./benchmarkData.js";

const memoryStore = new Map();

function withTimeout(promise, ms = 2500) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("kvs-timeout")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function getKvsClient() {
  let rawKvs = null;
  if (typeof globalThis.__forge_fetch__ === "function") {
    try {
      const mod = await import("@forge/kvs");
      rawKvs = mod.kvs || mod.default;
    } catch {
      rawKvs = null;
    }
  }
  const hasForgeRuntime = Boolean(rawKvs && typeof globalThis.__forge_fetch__ === "function");
  return {
    async get(key) {
      if (memoryStore.has(key)) {
        return memoryStore.get(key);
      }
      if (hasForgeRuntime) {
        try {
          const val = await withTimeout(rawKvs.get(key), 2500);
          if (val !== undefined) {
            memoryStore.set(key, val);
          }
          return val;
        } catch {
          return memoryStore.get(key);
        }
      }
      return memoryStore.get(key);
    },
    async set(key, value) {
      memoryStore.set(key, value);
      if (hasForgeRuntime) {
        try {
          await withTimeout(rawKvs.set(key, value), 2500);
        } catch {
          // Fallback to in-memory copy
        }
      }
    },
    async delete(key) {
      memoryStore.delete(key);
      if (hasForgeRuntime) {
        try {
          await withTimeout(rawKvs.delete(key), 2500);
        } catch {
          // Fallback to in-memory delete
        }
      }
    }
  };
}

export const DEFAULT_SETTINGS = {
  useForgeLlm: true,
  preferredModel: "claude-sonnet-5",
  dailyBriefCap: 200,
  readyScoreThreshold: 75,
  bilingualQuestions: true
};

export async function getAppSettings() {
  const kvs = await getKvsClient();
  const saved = await kvs.get("settings:app");
  return { ...DEFAULT_SETTINGS, ...(saved || {}) };
}

export async function saveAppSettings(partialSettings = {}) {
  const kvs = await getKvsClient();
  const current = await getAppSettings();
  const updated = { ...current, ...partialSettings, updatedAt: new Date().toISOString() };
  await kvs.set("settings:app", updated);
  return updated;
}

export async function getCodeMap() {
  const kvs = await getKvsClient();
  const saved = await kvs.get("codemap:default");
  return saved && Array.isArray(saved.entries) ? saved : DEFAULT_CODE_MAP;
}

export async function saveCodeMap(codeMap) {
  const kvs = await getKvsClient();
  const normalized = {
    repoName: codeMap?.repoName || "Custom Repository Code Map",
    commitSha: codeMap?.commitSha || "HEAD",
    updatedAt: new Date().toISOString(),
    entries: Array.isArray(codeMap?.entries) ? codeMap.entries : DEFAULT_CODE_MAP.entries
  };
  await kvs.set("codemap:default", normalized);
  return normalized;
}

export async function getBrief(issueKey) {
  if (!issueKey) return null;
  const kvs = await getKvsClient();
  return (await kvs.get(`brief:${String(issueKey).toUpperCase()}`)) || null;
}

function buildIndexEntry(key, brief) {
  return {
    issueKey: key,
    summary: brief.summary || key,
    score: brief.readiness?.score ?? 0,
    status: brief.readiness?.status || "UNANALYZED",
    reportStyle: brief.reportStyle || "SYMPTOM_ONLY_USER",
    languageDetected: brief.languageDetected || "en",
    topFile: brief.codeLocations?.[0]?.filePath || "",
    topSymbol: brief.codeLocations?.[0]?.symbolName || "",
    fixOutcome: brief.fixOutcome?.outcome || null,
    updatedAt: brief.generatedAt || new Date().toISOString()
  };
}

export async function saveBrief(brief) {
  if (!brief || !brief.issueKey) {
    throw new Error("saveBrief requires brief.issueKey");
  }
  const key = String(brief.issueKey).toUpperCase();
  const kvs = await getKvsClient();
  const index = { ...((await kvs.get("index:issues")) || {}) };
  index[key] = buildIndexEntry(key, brief);
  await Promise.all([kvs.set(`brief:${key}`, brief), kvs.set("index:issues", index)]);
  return brief;
}

export async function saveBriefBatch(briefs = []) {
  const valid = briefs.filter((b) => b && b.issueKey);
  if (valid.length === 0) return [];
  const kvs = await getKvsClient();
  const index = { ...((await kvs.get("index:issues")) || {}) };
  const writes = [];
  for (const brief of valid) {
    const key = String(brief.issueKey).toUpperCase();
    index[key] = buildIndexEntry(key, brief);
    writes.push(kvs.set(`brief:${key}`, brief));
  }
  writes.push(kvs.set("index:issues", index));
  await Promise.all(writes);
  return valid;
}

export async function listIndexedIssues({ projectKey, minScore, statusFilter } = {}) {
  const kvs = await getKvsClient();
  const index = (await kvs.get("index:issues")) || {};
  let items = Object.values(index);

  if (projectKey) {
    const prefix = `${String(projectKey).toUpperCase()}-`;
    items = items.filter((item) => item.issueKey.startsWith(prefix));
  }
  if (typeof minScore === "number" && !Number.isNaN(minScore)) {
    items = items.filter((item) => (item.score ?? 0) >= minScore);
  }
  if (statusFilter) {
    const sf = String(statusFilter).toUpperCase();
    items = items.filter((item) => String(item.status).toUpperCase() === sf);
  }

  items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return items;
}
