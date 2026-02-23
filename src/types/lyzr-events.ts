/**
 * Lyzr WebSocket event types. Uses wss://metrics.studio.lyzr.ai/ws for events.
 */

export interface LyzrAgentEvent {
  log_id?: string;
  run_id?: string;
  agent_id?: string;
  agent_name?: string;
  event_type?: string;
  feature?: string;
  context_type?: string;
  message?: string;
  thinking?: string;
  status?: string;
  timestamp?: string;
  arguments?: Record<string, unknown>;
  response?: string;
  function_name?: string;
  tool_name?: string;
  [key: string]: unknown;
}

export const MANAGER_AGENT_ID = "698dad48b9ed9c0ad38387dc";

/** Agent keys: manager + rules pipeline + comparison; also allow any string from backend agent_id */
export type AgentKey = "manager" | "rules-extractor" | "rules-to-column" | "gap-analysis" | "rules-diff" | (string & {});

/** Patterns to infer agent from event text (rules pipeline, comparison, gap analysis) */
export const AGENT_PATTERNS: Record<string, RegExp> = {
  manager: /manager|orchestrat/i,
  "rules-extractor": /rules-extractor|extract.*rules|rules_extractor/i,
  "rules-to-column": /rules-to-column|rules_to_column|map.*column/i,
  "gap-analysis": /gap-analysis|gap_analysis|gap analysis|fidessa|gap_analysis/i,
  "rules-diff": /rules-diff|rules_diff|comparison|compare.*version|version.*diff|diff.*rule/i,
};

/** Extract sub-agent id from message/thinking (e.g. "calling agent X" or agent_id in text) */
export function extractSubAgentIdFromText(text: string): string | null {
  if (!text || !text.trim()) return null;
  const m = text.match(/agent[_\s]?(?:tool)?[:\s]*["']?([a-z0-9_-]+)/i)
    || text.match(/agent_id[:\s]*["']?([a-z0-9_-]+)/i)
    || text.match(/using agent tool[:\s]*["']?([a-z0-9_-]+)/i);
  return m?.[1]?.trim() ?? null;
}

/** Map backend agent id to AgentKey; unknown ids returned as-is */
export function getAgentKeyFromId(agentId: string): AgentKey | null {
  if (!agentId || !agentId.trim()) return null;
  const id = agentId.trim().toLowerCase();
  for (const [key, pattern] of Object.entries(AGENT_PATTERNS)) {
    if (key === "manager") continue;
    if (pattern.test(id) || id.includes(key.replace(/-/g, "_"))) return key as AgentKey;
  }
  return agentId.trim() as AgentKey;
}

export type CheckoutStage = 1 | 2 | 3 | 4;
export type StageStatus = "pending" | "active" | "completed";

export interface AgentEventsState {
  isConnected: boolean;
  events: LyzrAgentEvent[];
  thinkingEvents: LyzrAgentEvent[];
  lastThinkingMessage: string | null;
  activeAgent: AgentKey | null;
  currentStage: CheckoutStage | null;
  stageStatuses: Record<CheckoutStage, StageStatus>;
  isProcessing: boolean;
}

export function inferActiveAgent(event: LyzrAgentEvent): AgentKey | null {
  const textToSearch = `${event.thinking || ""} ${event.message || ""}`;
  const subAgentId = extractSubAgentIdFromText(textToSearch);
  if (subAgentId) {
    const agentKey = getAgentKeyFromId(subAgentId);
    if (agentKey) return agentKey;
  }
  const searchText = [
    event.message,
    event.feature,
    event.event_type,
    event.thinking,
    event.function_name,
    event.tool_name,
    event.agent_name,
  ]
    .filter(Boolean)
    .map(String)
    .join(" ");
  for (const [key, pattern] of Object.entries(AGENT_PATTERNS)) {
    if (key === "manager") continue;
    if (pattern.test(searchText)) return key as AgentKey;
  }
  if (event.agent_id === MANAGER_AGENT_ID) return "manager";
  if (event.agent_id && String(event.agent_id).trim()) return event.agent_id.trim() as AgentKey;
  if (
    event.event_type === "llm_generation" ||
    event.feature === "llm_generation" ||
    (event.thinking && event.thinking.length > 5)
  ) {
    return "manager";
  }
  return null;
}

export function getAgentKeyFromEvent(event: LyzrAgentEvent): string {
  const key = inferActiveAgent(event);
  return key ?? "manager";
}

export function getAgentFriendlyName(agentKey: string, events?: LyzrAgentEvent[]): string {
  if (events?.length) {
    const withName = events.find((e) => e.agent_name && String(e.agent_name).trim());
    if (withName?.agent_name) return String(withName.agent_name).trim();
  }
  const names: Record<string, string> = {
    manager: "Manager",
    "rules-extractor": "Rules Extractor",
    "rules-to-column": "Rules to Column",
    "gap-analysis": "Gap Analysis",
    "rules-diff": "Rules diff / Comparison",
  };
  if (names[agentKey]) return names[agentKey];
  return agentKey.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || agentKey;
}

/** Replace agent IDs in text with friendly names (for Agent Thinking display) */
export function replaceAgentIdsWithNames(text: string): string {
  const id = extractSubAgentIdFromText(text);
  if (!id) return text;
  const key = getAgentKeyFromId(id);
  const name = key ? getAgentFriendlyName(key) : id;
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), name);
}
