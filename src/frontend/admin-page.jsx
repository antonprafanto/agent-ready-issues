import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Code,
  CodeBlock,
  Heading,
  Inline,
  Lozenge,
  SectionMessage,
  Stack,
  Text
} from "@forge/react";
import { invoke } from "@forge/bridge";

const AdminPageApp = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await invoke("getAdminDashboard", {});
      setDashboard(data);
    } catch (err) {
      setBanner(`Error loading admin dashboard: ${String(err?.message || err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleSeedDemo = async () => {
    setLoading(true);
    try {
      const res = await invoke("seedDemoData", {});
      setBanner(
        `Seeded ${res.seededCount} Lingua-SWE-129 benchmark scenarios (${res.issues
          .map((i) => `${i.issueKey}: ${i.score}/100`)
          .join(", ")}) and repository Code Map.`
      );
      await loadDashboard();
    } catch (err) {
      setBanner(`Failed to seed demo data: ${String(err?.message || err)}`);
      setLoading(false);
    }
  };

  if (loading && !dashboard) {
    return <Text>Loading Agent-Ready Issues Admin Console & Benchmark Evidence...</Text>;
  }

  const issues = dashboard?.issues || [];
  const benchmark = dashboard?.benchmark || {};
  const codeMap = dashboard?.codeMap || {};
  const settings = dashboard?.settings || {};

  return (
    <Stack space="space.300">
      <Stack space="space.100">
        <Heading size="large">Agent-Ready Issues for Jira & Rovo MCP</Heading>
        <Text>
          Turns symptom-only customer reports into code-localized, testable briefs served directly to
          coding agents (Claude Code, Cursor, Rovo Dev) over Atlassian Rovo MCP.
        </Text>
      </Stack>

      {banner && (
        <SectionMessage appearance="confirmation" title="Benchmark & Configuration Updated">
          <Text>{banner}</Text>
        </SectionMessage>
      )}

      <ButtonGroup>
        <Button appearance="primary" onClick={handleSeedDemo}>
          1-Click Seed Lingua-SWE-129 Demo Scenarios
        </Button>
        <Button onClick={loadDashboard}>Refresh Dashboard</Button>
      </ButtonGroup>

      <Box>
        <Heading size="medium">1. Empirical Benchmark Evidence (Lingua-SWE-129, 101 Verified Tasks)</Heading>
        <Stack space="space.100">
          <Text>
            Published dataset: {benchmark.datasetUrl} ({benchmark.verifiedTasks} tasks across{" "}
            {(benchmark.repositories || []).join(", ")}).
          </Text>
          {(benchmark.keyFindings || []).map((item, idx) => (
            <Stack key={idx} space="space.025">
              <Inline space="space.100" rowSpace="space.075" alignBlock="center" shouldWrap>
                <Lozenge appearance="inprogress" maxWidth={320}>{item.value}</Lozenge>
                <Text>{item.metric}</Text>
              </Inline>
              <Text>{item.detail}</Text>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box>
        <Heading size="medium">2. Live Issue Readiness Queue (Indexed for JQL & Rovo MCP)</Heading>
        <Text>
          JQL Filter for Autonomous Agents: <Code>agentReadyScore &gt;= 75 AND agentReadyStatus = "READY"</Code>
        </Text>
        <Stack space="space.150">
          {issues.map((item) => (
            <Stack key={item.issueKey} space="space.050">
              <Inline space="space.100" rowSpace="space.075" alignBlock="center" shouldWrap>
                <Code>{item.issueKey}</Code>
                <Lozenge appearance={item.score >= 75 ? "success" : "moved"} maxWidth={320}>
                  {item.status} ({item.score}/100)
                </Lozenge>
                <Lozenge appearance="new" maxWidth={320}>{item.reportStyle}</Lozenge>
                <Badge>{item.languageDetected}</Badge>
                {item.topFile && (
                  <Code>
                    {item.topFile} :: {item.topSymbol}
                  </Code>
                )}
              </Inline>
              <Text>{item.summary}</Text>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box>
        <Heading size="medium">3. Connect Claude Code / Cursor via Rovo MCP (`rovo:mcp`)</Heading>
        <Text>
          After enabling external MCP tools under Admin -&gt; Apps -&gt; Sites -&gt; Connected apps,
          connect your coding agent in one command:
        </Text>
        <CodeBlock
          language="bash"
          shouldWrapLongLines
          text={[
            "claude mcp add --transport http agent-ready-issues https://mcp.atlassian.com/forge/506d0189-c6a8-4156-b502-1fcb1e7e4b6f",
            "# Exposed MCP Tools (6):",
            "# - get-agent-brief          (GET structured brief, contract, and code-map symbols)",
            "# - get-readiness            (GET 5-dimension score and missing-info questions)",
            "# - list-agent-ready-issues  (GET issues filtered by minScore / statusFilter)",
            "# - post-reporter-questions  (UPDATE issue with polite bilingual reporter questions)",
            "# - record-code-location     (UPDATE brief with verified filePath + symbolName)",
            "# - record-fix-outcome       (UPDATE brief with failing->passing test command & patch)"
          ].join("\n")}
        />
      </Box>

      <Box>
        <Heading size="medium">
          4. Zero-Egress Repository Code Map ({codeMap.repoName || "Default"})
        </Heading>
        <Text>
          Only symbol signatures, routes, and exception names are stored in Forge KVS ({(codeMap.entries || []).length}{" "}
          modules indexed; zero source-code bodies leave your repository).
        </Text>
        <Stack space="space.075">
          {(codeMap.entries || []).map((entry, idx) => (
            <Inline key={idx} space="space.100" rowSpace="space.075" alignBlock="center" shouldWrap>
              <Code>{entry.filePath}</Code>
              <Text>Symbols: {(entry.symbols || []).join(", ")}</Text>
            </Inline>
          ))}
        </Stack>
      </Box>

      <Box>
        <Heading size="medium">5. Forge LLM & Cost Guard Settings (Runs on Atlassian Eligible)</Heading>
        <Text>
          Preferred Forge LLM: {settings.preferredModel || "claude-sonnet-5"} · Ready Threshold:{" "}
          {settings.readyScoreThreshold ?? 75}/100 · Daily Site Brief Cap:{" "}
          {settings.dailyBriefCap ?? 200} · Bilingual EN/ID Questions:{" "}
          {settings.bilingualQuestions ? "Enabled" : "Disabled"}
        </Text>
      </Box>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <AdminPageApp />
  </React.StrictMode>
);

export default AdminPageApp;
