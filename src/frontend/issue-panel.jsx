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
  ProgressBar,
  SectionMessage,
  Stack,
  Text,
  useProductContext
} from "@forge/react";
import { invoke } from "@forge/bridge";

const statusAppearance = (status) => {
  if (status === "READY" || status === "SOLVED_BY_AGENT") return "success";
  if (status === "AWAITING_REPORTER") return "moved";
  return "inprogress";
};

const IssuePanelApp = () => {
  const context = useProductContext();
  const contextIssueKey = context?.extension?.issue?.key;
  const displayIssueKey = contextIssueKey || "DEMO-101";

  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusBanner, setStatusBanner] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);

  const loadBrief = async (action = "getIssueBrief") => {
    setLoading(true);
    try {
      const payload = contextIssueKey ? { issueKey: contextIssueKey } : {};
      const data = await invoke(action, payload);
      setBrief(data);
    } catch (err) {
      setStatusBanner(`Could not load brief: ${String(err?.message || err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrief("getIssueBrief");
  }, [contextIssueKey]);

  const handlePostQuestions = async () => {
    setLoading(true);
    try {
      const payload = contextIssueKey ? { issueKey: contextIssueKey } : {};
      const res = await invoke("postReporterQuestions", payload);
      setStatusBanner(
        `Posted ${res.questionsPosted} ranked clarifying question(s) to ${res.issueKey || displayIssueKey}. Status updated to ${res.status}.`
      );
      await loadBrief("getIssueBrief");
    } catch (err) {
      setStatusBanner(`Failed to post comment: ${String(err?.message || err)}`);
      setLoading(false);
    }
  };

  if (loading && !brief) {
    return (
      <Stack space="space.150">
        <Text>Analyzing issue {displayIssueKey} against repository Code Map & Forge LLM...</Text>
        <ProgressBar isIndeterminate />
      </Stack>
    );
  }

  if (!brief) {
    return (
      <SectionMessage appearance="warning" title="No Agent-Ready Brief available">
        <Text>Click Regenerate Brief to analyze this issue.</Text>
        <Button appearance="primary" onClick={() => loadBrief("regenerateBrief")}>
          Generate Brief
        </Button>
      </SectionMessage>
    );
  }

  const score = brief.readiness?.score ?? 0;
  const bd = brief.readiness?.breakdown || {};

  return (
    <Stack space="space.200">
      <Inline space="space.100" rowSpace="space.075" alignBlock="center" spread="space-between" shouldWrap>
        <Inline space="space.100" rowSpace="space.075" alignBlock="center" shouldWrap>
          <Lozenge appearance={statusAppearance(brief.readiness?.status)} maxWidth={320}>
            {brief.readiness?.status || "NEEDS_CLARIFICATION"} ({score}/100)
          </Lozenge>
          <Lozenge appearance="new" maxWidth={320}>{brief.reportStyle}</Lozenge>
          <Badge>{brief.languageDetected}</Badge>
          <Lozenge appearance={brief.twgConnected ? "success" : "default"} maxWidth={320}>
            {brief.twgConnected ? "TWG Live" : "TWG Precedents"}
          </Lozenge>
        </Inline>
        <Text>Engine: {brief.engineUsed || "codemap"}</Text>
      </Inline>

      <ProgressBar value={Math.min(1, Math.max(0, score / 100))} />

      <Text>
        Repro: {bd.reproSteps ?? 0}/25 · Contract: {bd.expectedVsActual ?? 0}/25 · Symbols:{" "}
        {bd.codeLocations ?? 0}/20 · Tests: {bd.acceptanceCriteria ?? 0}/15 · Env/Trace:{" "}
        {bd.environmentContext ?? 0}/15
      </Text>

      {loading && (
        <Stack space="space.050">
          <Text>Refreshing Agent-Ready Brief via Code Map & Forge LLM...</Text>
          <ProgressBar isIndeterminate />
        </Stack>
      )}

      {statusBanner && (
        <SectionMessage appearance="information" title="Action Complete">
          <Text>{statusBanner}</Text>
        </SectionMessage>
      )}

      {score < 75 && (
        <SectionMessage
          appearance="warning"
          title="Why Coding Agents Struggle Here (Lingua-SWE-129 Benchmark)"
        >
          <Text>
            Symptom-only reports lower coding-agent solve rates by 31% (31B) to 62% (12B) because
            72-89% of patches fail when expected behavioral contracts or target symbols are missing.
            Post the ranked questions below before dispatching an autonomous coding agent.
          </Text>
        </SectionMessage>
      )}

      <Box>
        <Heading size="small">1. Behavioral Contract (Symptom vs. Expected)</Heading>
        <Stack space="space.075">
          <Text>
            <StrongText label="Observed Symptom:" /> {brief.actualBehavior}
          </Text>
          <Text>
            <StrongText label="Expected Contract:" /> {brief.expectedBehavior}
          </Text>
        </Stack>
      </Box>

      <Box>
        <Heading size="small">2. Zero-Egress Code Map Localization</Heading>
        <Stack space="space.100">
          {(brief.codeLocations || []).map((loc, idx) => (
            <Stack key={`${loc.filePath}-${idx}`} space="space.050">
              <Inline space="space.100" rowSpace="space.075" alignBlock="center" shouldWrap>
                <Code>{loc.filePath}</Code>
                <Lozenge appearance={loc.verifiedByAgent ? "success" : "inprogress"} maxWidth={360}>
                  {loc.symbolName} ({Math.round((loc.confidence || 0) * 100)}%)
                </Lozenge>
                {loc.verifiedByAgent && <Lozenge appearance="success">MCP VERIFIED</Lozenge>}
              </Inline>
              <Text>{loc.reason}</Text>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box>
        <Heading size="small">3. Given / When / Then Acceptance Criteria</Heading>
        <Stack space="space.075">
          {(brief.acceptanceCriteria || []).map((ac, idx) => (
            <Text key={idx}>
              GIVEN {ac.given} | WHEN {ac.when} | THEN {ac.then}
            </Text>
          ))}
        </Stack>
      </Box>

      <Box>
        <Heading size="small">4. Ranked Reporter Questions (Bilingual EN / ID)</Heading>
        <Stack space="space.075">
          {(brief.missingInfoQuestions || []).map((q, idx) => (
            <Stack key={idx} space="space.025">
              <Text>
                Q{idx + 1} [{q.dimension}] (EN): {q.questionEn}
              </Text>
              {q.questionId && <Text>Q{idx + 1} (ID): {q.questionId}</Text>}
            </Stack>
          ))}
        </Stack>
      </Box>

      {(brief.twgPrecedents || []).length > 0 && (
        <Box>
          <Heading size="small">5. Similar Resolved Bugs & Linked PRs (Teamwork Graph)</Heading>
          <Stack space="space.075">
            {(brief.twgPrecedents || []).map((item, idx) => (
              <Inline key={idx} space="space.100" rowSpace="space.075" alignBlock="center" shouldWrap>
                <Badge>{item.pastIssueKey}</Badge>
                <Text>{item.pastSummary}</Text>
                {item.linkedPrTitle && <Lozenge appearance="moved" maxWidth={380}>{item.linkedPrTitle}</Lozenge>}
              </Inline>
            ))}
          </Stack>
        </Box>
      )}

      <ButtonGroup>
        <Button appearance="primary" isDisabled={loading} onClick={handlePostQuestions}>
          Post Questions to Reporter
        </Button>
        <Button onClick={() => setShowPrompt(!showPrompt)}>
          {showPrompt ? "Hide Coding Agent Prompt" : "Show MCP Coding Agent Prompt"}
        </Button>
        <Button appearance="subtle" isDisabled={loading} onClick={() => loadBrief("regenerateBrief")}>
          Regenerate Brief
        </Button>
      </ButtonGroup>

      {showPrompt && (
        <CodeBlock language="markdown" text={brief.agentPrompt || ""} shouldWrapLongLines />
      )}
    </Stack>
  );
};

const StrongText = ({ label }) => <Text>{label}</Text>;

ForgeReconciler.render(
  <React.StrictMode>
    <IssuePanelApp />
  </React.StrictMode>
);

export default IssuePanelApp;
