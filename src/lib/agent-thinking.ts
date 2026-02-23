/**
 * Extract "Agent Thinking" content from WebSocket events for display in Agent Activity.
 */

import type { LyzrAgentEvent } from "@/types/lyzr-events";
import {
  replaceAgentIdsWithNames,
  extractSubAgentIdFromText,
  getAgentKeyFromId,
  getAgentFriendlyName,
} from "@/types/lyzr-events";

const FILTERED_MESSAGES = [
  "message role converted",
  "tool output",
  "process complete",
  "summary retrieved",
  "documents retrieved",
  "memory updated",
  "context updated",
];

function isFilteredMessage(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  return FILTERED_MESSAGES.some(
    (filter) => lowerText.includes(filter) || lowerText === filter
  );
}

function parseMessageFromJson(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return message;
  try {
    const parsed = JSON.parse(message);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      parsed.internal_call === true
    )
      return null;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.message === "string"
    )
      return parsed.message;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    )
      return null;
    return message;
  } catch {
    return message;
  }
}

export function extractThinkingContent(event: LyzrAgentEvent): string | null {
  let content: string | null = null;

  if (event.thinking && event.thinking.trim().length > 3) {
    content = event.thinking;
  } else if (
    event.event_type === "thinking_log" &&
    event.message &&
    event.message.trim().length > 3
  ) {
    const parsed = parseMessageFromJson(event.message);
    if (parsed) content = parsed;
  } else if (
    event.context_type === "tool_result" &&
    event.message &&
    event.message.trim().length > 3
  ) {
    const parsed = parseMessageFromJson(event.message);
    if (parsed) content = parsed;
  } else if (
    (event.event_type === "tool_calling" ||
      event.event_type === "tool_calling_iteration" ||
      event.feature === "tool_calling") &&
    event.message &&
    event.message.trim().length > 3
  ) {
    const parsed = parseMessageFromJson(event.message);
    if (parsed) content = parsed;
  } else if (
    (event.event_type === "thinking" ||
      event.event_type === "manager_thought" ||
      event.event_type === "agent_reasoning") &&
    event.message
  ) {
    const parsed = parseMessageFromJson(event.message);
    if (parsed) content = parsed;
  } else if (
    event.event_type === "llm_generation" &&
    event.message &&
    event.message.trim().length > 10
  ) {
    const parsed = parseMessageFromJson(event.message);
    if (parsed) content = parsed;
  } else if (
    (event.feature === "knowledge_base" || event.feature === "retrieval") &&
    event.message &&
    event.message.trim().length > 3
  ) {
    const parsed = parseMessageFromJson(event.message);
    if (parsed) content = `[Knowledge] ${parsed}`;
  }

  if (content) {
    if (isFilteredMessage(content)) return null;
    return replaceAgentIdsWithNames(content);
  }
  return null;
}

export interface ThoughtStep {
  id: string;
  content: string;
  timestamp: Date;
  type: "reasoning" | "action" | "observation" | "conclusion" | "agent_call";
  calledAgent?: string;
}

function extractCalledAgent(content: string): string | null {
  const agentId = extractSubAgentIdFromText(content);
  if (agentId) {
    const key = getAgentKeyFromId(agentId);
    return key ? getAgentFriendlyName(key) : agentId;
  }
  return null;
}

function categorizeThought(content: string): ThoughtStep["type"] {
  const lowerContent = content.toLowerCase();
  const calledAgent = extractCalledAgent(content);
  if (
    calledAgent ||
    lowerContent.includes("agent tool") ||
    lowerContent.includes("using agent")
  )
    return "agent_call";
  if (
    lowerContent.includes("therefore") ||
    lowerContent.includes("conclusion") ||
    lowerContent.includes("result")
  )
    return "conclusion";
  if (
    lowerContent.includes("checking") ||
    lowerContent.includes("fetching") ||
    lowerContent.includes("calling") ||
    lowerContent.includes("@")
  )
    return "action";
  if (
    lowerContent.includes("found") ||
    lowerContent.includes("received") ||
    lowerContent.includes("shows")
  )
    return "observation";
  return "reasoning";
}

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++)
    hash = (hash << 5) + hash ^ input.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

export function buildThoughtsFromEvents(
  events: LyzrAgentEvent[],
  lastThinkingMessage: string | null
): ThoughtStep[] {
  const newThoughts: ThoughtStep[] = [];
  const seenContent = new Set<string>();
  const seenStepIds = new Set<string>();

  for (const event of events) {
    const rawContent = extractThinkingContent(event);
    if (rawContent) {
      const processedContent = replaceAgentIdsWithNames(rawContent);
      if (!seenContent.has(processedContent)) {
        seenContent.add(processedContent);
        const thoughtType = categorizeThought(processedContent);
        const calledAgent = extractCalledAgent(processedContent);
        const baseId = event.log_id || "evt";
        const stepId = `${baseId}-${hashString(processedContent)}`;
        if (seenStepIds.has(stepId)) continue;
        seenStepIds.add(stepId);
        newThoughts.push({
          id: stepId,
          content: processedContent,
          timestamp: new Date(event.timestamp || Date.now()),
          type: thoughtType,
          calledAgent: calledAgent || undefined,
        });
      }
    }
  }

  if (lastThinkingMessage) {
    const parsedMessage = parseMessageFromJson(lastThinkingMessage);
    if (parsedMessage) {
      const processedMessage = replaceAgentIdsWithNames(parsedMessage);
      if (!seenContent.has(processedMessage)) {
        seenContent.add(processedMessage);
        newThoughts.push({
          id: `last-${hashString(processedMessage)}`,
          content: processedMessage,
          timestamp: new Date(),
          type: categorizeThought(processedMessage),
          calledAgent: extractCalledAgent(processedMessage) || undefined,
        });
      }
    }
  }

  return newThoughts.slice(-20);
}

export function getLatestToolCallFromEvents(
  events: LyzrAgentEvent[]
): LyzrAgentEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (
      (event.event_type === "tool_calling" ||
        event.event_type === "tool_response" ||
        event.feature === "tool_calling") &&
      event.arguments &&
      Object.keys(event.arguments).length > 0
    ) {
      return event;
    }
  }
  return null;
}
