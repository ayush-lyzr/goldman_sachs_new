"use client";

import { useMemo } from "react";
import { CheckCircle2, Clock, AlertCircle, Loader2, Zap, MessageSquare, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAgentFriendlyName } from "@/types/lyzr-events";
import type { LyzrAgentEvent } from "@/types/lyzr-events";
import {
  buildThoughtsFromEvents,
  getLatestToolCallFromEvents,
  type ThoughtStep,
} from "@/lib/agent-thinking";

export interface ProcessingActivityEntry {
  timestamp: Date;
  fileId: string;
  fileName: string;
  step: string;
  event: "started" | "completed" | "failed";
}

interface ProcessingActivityPanelProps {
  activityLog: ProcessingActivityEntry[];
  isProcessing: boolean;
  currentFile?: { fileName: string; step: string } | null;
  /** WebSocket events grouped by agent (derived from stream, not hardcoded) */
  wsEventsByAgent?: Record<string, LyzrAgentEvent[]>;
  /** Ordered list of agent keys that have events */
  wsActiveAgentKeys?: string[];
  wsConnected?: boolean;
  /** Agent keys currently active from local state (comparison, gap-analysis) so we show them even before WS events */
  activeLocalAgentKeys?: string[];
  /** Raw WebSocket events (for Agent Thinking extraction) */
  wsEvents?: LyzrAgentEvent[];
  /** Latest thinking message from WebSocket */
  wsLastThinkingMessage?: string | null;
}

/**
 * Agent Activity panel for the loader/processing page.
 * Matches the style of SubAgentTimeline from agentic-shopping-experience:
 * - Header "Agent Activity" with Zap icon
 * - Execution timeline with timestamp, name, event (started/completed/failed)
 * - Empty and loading states
 */
export function ProcessingActivityPanel({
  activityLog,
  isProcessing,
  currentFile = null,
  wsEventsByAgent = {},
  wsActiveAgentKeys = [],
  wsConnected = false,
  activeLocalAgentKeys = [],
  wsEvents = [],
  wsLastThinkingMessage = null,
}: ProcessingActivityPanelProps) {
  const mergedAgentKeys = Array.from(
    new Set([...activeLocalAgentKeys, ...wsActiveAgentKeys])
  );
  const hasWsEvents = mergedAgentKeys.length > 0;
  const thoughts = useMemo(
    () => buildThoughtsFromEvents(wsEvents, wsLastThinkingMessage),
    [wsEvents, wsLastThinkingMessage]
  );
  const latestToolCall = useMemo(
    () => getLatestToolCallFromEvents(wsEvents),
    [wsEvents]
  );
  const hasThinking = thoughts.length > 0 || (latestToolCall?.arguments && Object.keys(latestToolCall.arguments).length > 0);
  const hasData = currentFile || hasWsEvents || hasThinking;

  return (
    <div className="flex flex-col h-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header - same style as reference Agent View header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Zap className="h-4 w-4 text-yellow-500" />
        <h3 className="text-sm font-semibold text-foreground">
          Agent Activity
        </h3>
        <span className="text-xs text-muted-foreground flex items-center gap-2 ml-auto">
          {wsConnected && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Live
            </span>
          )}
          {isProcessing && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing…
            </>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Current file step (when processing) */}
        {currentFile && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Current
            </h4>
            <div
              className={cn(
                "rounded-lg border p-3 transition-all",
                "border-blue-500/50 bg-blue-500/5 animate-pulse"
              )}
            >
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {currentFile.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentFile.step}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasData && !isProcessing && (
          <div className="text-sm text-muted-foreground text-center py-6">
            No activity yet.
            <br />
            <span className="text-xs">
              Activity will appear when files are processed.
            </span>
          </div>
        )}

        {/* Processing indicator when no entries yet */}
        {isProcessing && !currentFile && !hasWsEvents && !hasThinking && (
          <div className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Starting processing…</span>
          </div>
        )}

        {/* Agent Thinking (extracted from WebSocket events) */}
        {(thoughts.length > 0 || latestToolCall) && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Brain className="h-3.5 w-3.5 text-primary" />
              Agent Thinking
            </h4>
            {thoughts.length > 0 && (
              <div className="rounded-lg border bg-muted/20 overflow-hidden">
                <div className="max-h-48 overflow-y-auto space-y-1 p-2">
                  {thoughts.map((thought) => (
                    <ThoughtRow key={thought.id} thought={thought} />
                  ))}
                </div>
              </div>
            )}
            {latestToolCall?.arguments && Object.keys(latestToolCall.arguments).length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-2 space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase">
                  Latest tool call
                </p>
                <p className="text-xs text-foreground font-mono truncate">
                  {latestToolCall.function_name || latestToolCall.tool_name || "tool"}
                </p>
                <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
                  {JSON.stringify(latestToolCall.arguments, null, 0).slice(0, 300)}
                  {JSON.stringify(latestToolCall.arguments).length > 300 ? "…" : ""}
                </pre>
                {latestToolCall.response && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                    {String(latestToolCall.response).slice(0, 120)}…
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Live WebSocket events under each agent */}
        {hasWsEvents && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Live events
            </h4>
            {mergedAgentKeys.map((agentKey) => {
              const list = wsEventsByAgent[agentKey] ?? [];
              const isLocalOnly = activeLocalAgentKeys.includes(agentKey) && list.length === 0;
              return (
                <div key={agentKey} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    {getAgentFriendlyName(agentKey, list)}
                    {list.length > 0 && (
                      <span className="text-muted-foreground font-normal">
                        ({list.length})
                      </span>
                    )}
                    {isLocalOnly && (
                      <span className="text-muted-foreground font-normal flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Running…
                      </span>
                    )}
                  </div>
                  {list.length > 0 ? (
                    <div className="rounded-lg border bg-muted/20 overflow-hidden">
                      <div className="max-h-32 overflow-y-auto space-y-0.5 p-1.5">
                        {list.slice(-20).map((evt, idx) => (
                          <WsEventRow key={`${agentKey}-${evt.log_id ?? idx}-${idx}`} event={evt} />
                        ))}
                      </div>
                    </div>
                  ) : isLocalOnly ? (
                    <div className="rounded-lg border border-dashed bg-muted/10 p-2 text-xs text-muted-foreground">
                      Waiting for events from WebSocket…
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const THOUGHT_TYPE_STYLES: Record<
  ThoughtStep["type"],
  { chip: string; dot: string }
> = {
  reasoning: { chip: "bg-violet-500/20 text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  action: { chip: "bg-blue-500/20 text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  observation: { chip: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  conclusion: { chip: "bg-amber-500/20 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  agent_call: { chip: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400", dot: "bg-cyan-500" },
};

function ThoughtRow({ thought }: { thought: ThoughtStep }) {
  const style = THOUGHT_TYPE_STYLES[thought.type];
  return (
    <div className="flex items-start gap-2 text-[11px] py-1.5 px-2 rounded bg-background/60">
      <span className={cn("h-2 w-2 rounded-full shrink-0 mt-1", style.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", style.chip)}>
            {thought.type.replace("_", " ")}
          </span>
          {thought.calledAgent && (
            <span className="text-[10px] text-muted-foreground">
              → {thought.calledAgent}
            </span>
          )}
          <span className="text-muted-foreground text-[10px] ml-auto">
            {thought.timestamp.toLocaleTimeString()}
          </span>
        </div>
        <p className="text-foreground/90 mt-0.5 line-clamp-3 break-words text-xs">
          {thought.content}
        </p>
      </div>
    </div>
  );
}

function WsEventRow({ event }: { event: LyzrAgentEvent }) {
  const time = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString()
    : "";
  const text = [event.thinking, event.message].filter(Boolean)[0];
  const label = event.event_type || event.feature || "event";
  const status = event.status ?? "in_progress";
  return (
    <div className="flex items-start gap-2 text-[11px] py-1 px-1.5 rounded bg-background/50">
      <span className="text-muted-foreground shrink-0 w-12 text-right">{time}</span>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "px-1 py-0.5 rounded text-[10px] font-medium",
            status === "completed" && "bg-green-500/20 text-green-700 dark:text-green-400",
            status === "failed" && "bg-red-500/20 text-red-700 dark:text-red-400",
            (status === "in_progress" || !status) && "bg-blue-500/20 text-blue-700 dark:text-blue-400"
          )}
        >
          {status}
        </span>
        <span className="text-muted-foreground ml-1">{label}</span>
        {text && (
          <p className="text-foreground/90 mt-0.5 line-clamp-2 break-words" title={String(text)}>
            {String(text).slice(0, 120)}
            {String(text).length > 120 ? "…" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

export function StatusIcon({ status }: { status: "pending" | "running" | "completed" | "failed" }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}
