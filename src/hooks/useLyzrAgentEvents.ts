"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  LyzrAgentEvent,
  AgentKey,
  CheckoutStage,
  StageStatus,
  AgentEventsState,
} from "@/types/lyzr-events";
import {
  AGENT_PATTERNS,
  getAgentKeyFromId,
  extractSubAgentIdFromText,
  MANAGER_AGENT_ID,
  inferActiveAgent,
} from "@/types/lyzr-events";
import { API_KEY } from "@/lib/api";

const WS_BASE_URL = "wss://metrics.studio.lyzr.ai/ws";

function agentToStage(_agent: AgentKey): CheckoutStage | null {
  return null;
}

function isThinkingEvent(event: LyzrAgentEvent): boolean {
  if (event.thinking && event.thinking.trim().length > 3) return true;
  if (event.event_type === "thinking_log") return true;
  if (
    event.event_type === "tool_calling" ||
    event.event_type === "tool_calling_iteration" ||
    event.feature === "tool_calling"
  ) {
    if (event.message && event.message.trim().length > 3) return true;
  }
  if (event.context_type === "tool_result" && event.message && event.message.trim().length > 3) return true;
  if (
    event.event_type === "thinking" ||
    event.event_type === "manager_thought" ||
    event.event_type === "agent_reasoning"
  )
    return true;
  if (event.feature?.toLowerCase().includes("thinking")) return true;
  return false;
}

const initialStageStatuses: Record<CheckoutStage, StageStatus> = {
  1: "pending",
  2: "pending",
  3: "pending",
  4: "pending",
};

interface RunIdInfo {
  runId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  eventCount: number;
  inferredAgent: AgentKey | null;
  firstMessage: string;
}

export function useLyzrAgentEvents(sessionId: string | null): AgentEventsState & {
  reset: () => void;
  setProcessing: (processing: boolean) => void;
  runIdMap: Map<string, RunIdInfo>;
  currentRunId: string | null;
  eventsByAgent: Record<string, LyzrAgentEvent[]>;
  activeAgentKeys: string[];
} {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<LyzrAgentEvent[]>([]);
  const [thinkingEvents, setThinkingEvents] = useState<LyzrAgentEvent[]>([]);
  const [lastThinkingMessage, setLastThinkingMessage] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentKey | null>(null);
  const [currentStage, setCurrentStage] = useState<CheckoutStage | null>(null);
  const [stageStatuses, setStageStatuses] = useState<Record<CheckoutStage, StageStatus>>(initialStageStatuses);
  const [isProcessing, setIsProcessing] = useState(false);
  const [runIdMap, setRunIdMap] = useState<Map<string, RunIdInfo>>(new Map());
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isProcessingRef = useRef(false);
  const activeSubAgentRef = useRef<AgentKey | null>(null);
  const subAgentCallStartTimeRef = useRef<number | null>(null);
  const maxReconnectAttempts = 5;

  const reset = useCallback(() => {
    setEvents([]);
    setThinkingEvents([]);
    setLastThinkingMessage(null);
    setActiveAgent(null);
    setCurrentStage(null);
    setStageStatuses(initialStageStatuses);
    setIsProcessing(false);
    setRunIdMap(new Map());
    setCurrentRunId(null);
    activeSubAgentRef.current = null;
    subAgentCallStartTimeRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    setIsConnected(false);
  }, []);

  const setProcessingState = useCallback((processing: boolean) => {
    setIsProcessing(processing);
    isProcessingRef.current = processing;
    if (processing) setActiveAgent("manager");
    else setActiveAgent(null);
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: LyzrAgentEvent = JSON.parse(event.data);
      const runId = data.run_id;
      if (runId) {
        setCurrentRunId(runId);
        setRunIdMap((prevMap) => {
          const newMap = new Map(prevMap);
          const existing = newMap.get(runId);
          if (existing) {
            newMap.set(runId, {
              ...existing,
              lastSeenAt: new Date(),
              eventCount: existing.eventCount + 1,
              inferredAgent: inferActiveAgent(data) || existing.inferredAgent,
            });
          } else {
            newMap.set(runId, {
              runId,
              firstSeenAt: new Date(),
              lastSeenAt: new Date(),
              eventCount: 1,
              inferredAgent: inferActiveAgent(data),
              firstMessage: data.message || data.feature || data.event_type || "",
            });
          }
          return newMap;
        });
      }
      setEvents((prev) => [...prev.slice(-99), data]);
      const isThinking = isThinkingEvent(data);
      if (isThinking) {
        const thinkingContent = data.thinking || data.message;
        setThinkingEvents((prev) => [...prev.slice(-19), data]);
        if (thinkingContent) setLastThinkingMessage(thinkingContent);
      }
      if (data.thinking && data.thinking.length > 5) setLastThinkingMessage(data.thinking);

      const inferred = inferActiveAgent(data);
      const messageText = `${data.message || ""} ${data.thinking || ""}`.toLowerCase();
      const isCallingAgent = messageText.includes("calling agent") || messageText.includes("using agent tool");
      const isToolResult =
        messageText.includes("got the results from agent tool") ||
        data.event_type === "tool_result" ||
        data.context_type === "tool_result";

      let detectedSubAgent: AgentKey | null = null;
      if (isCallingAgent) {
        for (const [key, pattern] of Object.entries(AGENT_PATTERNS)) {
          if (key !== "manager" && pattern.test(messageText)) {
            detectedSubAgent = key as AgentKey;
            break;
          }
        }
      }

      let agentToSet: AgentKey | null = null;
      if (detectedSubAgent) {
        agentToSet = detectedSubAgent;
        activeSubAgentRef.current = detectedSubAgent;
        subAgentCallStartTimeRef.current = Date.now();
      } else if (activeSubAgentRef.current && !isToolResult && data.status !== "completed") {
        agentToSet = activeSubAgentRef.current;
      } else if (inferred) {
        agentToSet = inferred;
        if (agentToSet !== "manager") {
          activeSubAgentRef.current = agentToSet;
          subAgentCallStartTimeRef.current = Date.now();
        }
      } else if (activeSubAgentRef.current && isToolResult) {
        agentToSet = activeSubAgentRef.current;
        setTimeout(() => {
          if (activeSubAgentRef.current === agentToSet) {
            activeSubAgentRef.current = null;
            subAgentCallStartTimeRef.current = null;
          }
        }, 1000);
      }

      if (agentToSet) {
        setActiveAgent(agentToSet);
        const stage = agentToStage(agentToSet);
        if (stage !== null) {
          setCurrentStage(stage);
          setStageStatuses((prev) => {
            const newStatuses = { ...prev };
            for (let s = 1; s < stage; s++) newStatuses[s as CheckoutStage] = "completed";
            if (data.status === "completed" || isToolResult) newStatuses[stage] = "completed";
            else newStatuses[stage] = "active";
            return newStatuses;
          });
        }
      } else if (isToolResult && activeSubAgentRef.current) {
        activeSubAgentRef.current = null;
        subAgentCallStartTimeRef.current = null;
      }

      if (data.status === "completed" && data.event_type === "llm_generation") {
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Error parsing WebSocket message:", err, event.data);
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;
    if (wsRef.current) wsRef.current.close();
    const wsUrl = `${WS_BASE_URL}/${sessionId}?x-api-key=${encodeURIComponent(API_KEY)}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };
      ws.onmessage = handleMessage;
      ws.onerror = () => setIsConnected(false);
      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (isProcessingRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };
    } catch (err) {
      console.error("Error creating WebSocket:", err);
    }
  }, [sessionId, handleMessage]);

  useEffect(() => {
    if (!sessionId || !isProcessing) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setIsConnected(false);
      return;
    }
    const timeoutId = setTimeout(() => connect(), 100);
    return () => {
      clearTimeout(timeoutId);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [sessionId, connect, isProcessing]);

  type Acc = {
    eventsByAgent: Record<string, LyzrAgentEvent[]>;
    seen: Set<string>;
    activeAgentKeys: string[];
  };
  const { eventsByAgent, activeAgentKeys } = events.reduce<Acc>(
    (acc, evt) => {
      const agent = inferActiveAgent(evt) ?? "manager";
      const key = String(agent);
      const list = acc.eventsByAgent[key] ?? [];
      acc.eventsByAgent[key] = [...list, evt];
      if (!acc.seen.has(key)) {
        acc.seen.add(key);
        acc.activeAgentKeys.push(key);
      }
      return acc;
    },
    { eventsByAgent: {}, seen: new Set<string>(), activeAgentKeys: [] }
  );

  return {
    isConnected,
    events,
    thinkingEvents,
    lastThinkingMessage,
    activeAgent,
    currentStage,
    stageStatuses,
    isProcessing,
    reset,
    setProcessing: setProcessingState,
    runIdMap,
    currentRunId,
    eventsByAgent,
    activeAgentKeys,
  };
}
