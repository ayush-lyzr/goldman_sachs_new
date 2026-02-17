"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemo } from "react";
import * as React from "react";

type ChangeTag = "unchanged" | "modified" | "added" | "removed";

interface ConstraintChangeLine {
  tag: Exclude<ChangeTag, "modified">;
  text: string;
}

interface VersionComparison {
  from: string;
  to: string;
  changes_by_constraint: Array<{
    constraint_title: string;
    status: ChangeTag;
    changes: ConstraintChangeLine[];
  }>;
}

interface VersionInfo {
  version: number;
  versionName: string;
  createdAt: string;
}

interface MultiVersionDiffData {
  versions: VersionInfo[];
  comparisons: VersionComparison[];
}

interface RulesVersionTableProps {
  data: MultiVersionDiffData;
  onStatsCalculated?: (stats: { total: number; modified: number; added: number; removed: number }) => void;
}

interface ConstraintRow {
  constraintTitle: string;
  versions: Record<
    string,
    {
      status: ChangeTag | "not-present";
      lines: Array<{ text: string; tag: Exclude<ChangeTag, "modified"> }>;
    }
  >;
}

export function RulesVersionTable({ data, onStatsCalculated }: RulesVersionTableProps) {
  const [showUnchangedLines, setShowUnchangedLines] = React.useState(true);
  const [showAddedLines, setShowAddedLines] = React.useState(true);
  const [showRemovedLines, setShowRemovedLines] = React.useState(true);
  const [changedOnly, setChangedOnly] = React.useState(false);
  const [sortMode, setSortMode] = React.useState<"alpha" | "most-changed" | "latest-change">("most-changed");

  const { constraintRows, stats } = useMemo(() => {
    const rowByConstraint = new Map<string, ConstraintRow>();
    const statusByConstraintByToVersion = new Map<string, Record<string, ChangeTag>>();

    const ensureRow = (constraintTitle: string) => {
      const existing = rowByConstraint.get(constraintTitle);
      if (existing) return existing;
      const next: ConstraintRow = { constraintTitle, versions: {} };
      rowByConstraint.set(constraintTitle, next);
      return next;
    };

    const ensureStatusMap = (constraintTitle: string) => {
      const existing = statusByConstraintByToVersion.get(constraintTitle);
      if (existing) return existing;
      const next: Record<string, ChangeTag> = {};
      statusByConstraintByToVersion.set(constraintTitle, next);
      return next;
    };

    data.comparisons.forEach((comparison) => {
      comparison.changes_by_constraint.forEach((constraintDiff) => {
        const title = constraintDiff.constraint_title;
        const row = ensureRow(title);
        const statusMap = ensureStatusMap(title);
        statusMap[comparison.to] = constraintDiff.status;

        const previousLines = constraintDiff.changes
          .filter((c) => c.tag !== "added")
          .map((c) => ({ text: c.text, tag: c.tag }));
        const currentLines = constraintDiff.changes
          .filter((c) => c.tag !== "removed")
          .map((c) => ({ text: c.text, tag: c.tag }));

        // For the "from" version we want what existed previously (unchanged + removed).
        // For the "to" version we want what exists now (unchanged + added).
        // We merge conservatively to avoid nuking previously set cells in multi-hop comparisons.
        const mergeLines = (
          existing: Array<{ text: string; tag: Exclude<ChangeTag, "modified"> }> | undefined,
          incoming: Array<{ text: string; tag: Exclude<ChangeTag, "modified"> }>
        ) => {
          if (!existing || existing.length === 0) return incoming;
          if (incoming.length === 0) return existing;
          const seen = new Set(existing.map((l) => `${l.tag}::${l.text}`));
          const merged = [...existing];
          incoming.forEach((l) => {
            const key = `${l.tag}::${l.text}`;
            if (!seen.has(key)) merged.push(l);
          });
          return merged;
        };

        row.versions[comparison.from] = {
          status: row.versions[comparison.from]?.status ?? "unchanged",
          lines: mergeLines(row.versions[comparison.from]?.lines, previousLines),
        };
        row.versions[comparison.to] = {
          status: row.versions[comparison.to]?.status ?? "unchanged",
          lines: mergeLines(row.versions[comparison.to]?.lines, currentLines),
        };
      });
    });

    // Ensure every constraint row has every version cell (so new constraints render "Not Present" in older versions).
    const versionNames = data.versions.map((v) => v.versionName);
    rowByConstraint.forEach((row) => {
      versionNames.forEach((vn) => {
        if (!row.versions[vn]) {
          row.versions[vn] = { status: "not-present", lines: [] };
        }
      });
    });

    // Compute per-cell status (status is "into this version": v2 cell shows v1->v2 status).
    const rows = Array.from(rowByConstraint.values())
      .map((row) => {
        const perToStatus = statusByConstraintByToVersion.get(row.constraintTitle) ?? {};
        data.versions.forEach((v, idx) => {
          const cell = row.versions[v.versionName];
          if (!cell) return;

          if (idx === 0) {
            row.versions[v.versionName] = {
              ...cell,
              status: cell.lines.length > 0 ? "unchanged" : "not-present",
            };
            return;
          }

          const intoStatus = perToStatus[v.versionName];
          row.versions[v.versionName] = {
            ...cell,
            status: intoStatus ?? (cell.lines.length > 0 ? "unchanged" : "not-present"),
          };
        });
        return row;
      })
      .sort((a, b) => a.constraintTitle.localeCompare(b.constraintTitle));

    // Calculate statistics across constraints (unique constraints with any non-unchanged status).
    let modified = 0,
      added = 0,
      removed = 0;
    rows.forEach((row) => {
      const statuses = Object.values(row.versions).map((v) => v.status);
      if (statuses.includes("modified")) modified++;
      if (statuses.includes("added")) added++;
      if (statuses.includes("removed")) removed++;
    });

    return {
      constraintRows: rows,
      stats: { total: modified + added + removed, modified, added, removed },
    };
  }, [data]);

  // Notify parent of calculated stats
  React.useEffect(() => {
    if (onStatsCalculated) {
      onStatsCalculated(stats);
    }
  }, [stats, onStatsCalculated]);

  // Current/latest version on the RIGHT (fixed); older versions on the left (scrollable)
  const latestVersionObj = data.versions[data.versions.length - 1];
  const otherVersionObjs = data.versions.slice(0, -1); // older versions, left to right
  const versionIndexByName = useMemo(() => {
    return Object.fromEntries(data.versions.map((v, idx) => [v.versionName, idx]));
  }, [data.versions]);

  const getCellClass = (tag: string) => {
    const classMap: Record<string, string> = {
      unchanged: "bg-slate-50 dark:bg-slate-900/30",
      modified: "bg-amber-50 dark:bg-amber-900/10 border-l-2 border-amber-400",
      added: "bg-emerald-50 dark:bg-emerald-900/10 border-l-2 border-emerald-400",
      removed: "bg-rose-50 dark:bg-rose-900/10 border-l-2 border-rose-400",
      "not-present": "bg-slate-100/50 dark:bg-slate-800/20"
    };
    return classMap[tag] || classMap.unchanged;
  };

  const formatStatus = (status: string): string => {
    return status
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getLinePill = (tag: Exclude<ChangeTag, "modified">) => {
    const map: Record<Exclude<ChangeTag, "modified">, string> = {
      unchanged: "bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200",
      added: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
      removed: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
    };
    return map[tag];
  };

  const getStatusChipClass = (status: ChangeTag | "not-present") => {
    const map: Record<ChangeTag | "not-present", string> = {
      unchanged: "bg-slate-200/70 dark:bg-slate-700/50",
      modified: "bg-amber-200/80 dark:bg-amber-800/40",
      added: "bg-emerald-200/80 dark:bg-emerald-800/40",
      removed: "bg-rose-200/80 dark:bg-rose-800/40",
      "not-present": "bg-slate-200/40 dark:bg-slate-700/25",
    };
    return map[status];
  };

  const getStatusDot = (status: ChangeTag | "not-present") => {
    const map: Record<ChangeTag | "not-present", string> = {
      unchanged: "bg-slate-400 dark:bg-slate-500",
      modified: "bg-amber-500",
      added: "bg-emerald-500",
      removed: "bg-rose-500",
      "not-present": "bg-slate-300 dark:bg-slate-700",
    };
    return map[status];
  };

  const filterLines = (lines: Array<{ text: string; tag: Exclude<ChangeTag, "modified"> }>) => {
    return lines.filter((l) => {
      if (l.tag === "unchanged") return showUnchangedLines;
      if (l.tag === "added") return showAddedLines;
      if (l.tag === "removed") return showRemovedLines;
      return true;
    });
  };

  const rowChangeScore = React.useCallback(
    (row: ConstraintRow) => {
      const statuses = data.versions.map((v) => row.versions[v.versionName]?.status ?? "not-present");
      // Ignore the first version for scoring since it is "baseline"
      const later = statuses.slice(1);
      const score = later.filter((s) => s === "modified" || s === "added" || s === "removed").length;
      return score;
    },
    [data.versions]
  );

  const hasAnyChange = React.useCallback(
    (row: ConstraintRow) => rowChangeScore(row) > 0,
    [rowChangeScore]
  );

  const latestChangeStatus = React.useCallback(
    (row: ConstraintRow): ChangeTag | "not-present" => {
      const latest = data.versions[data.versions.length - 1]?.versionName;
      if (!latest) return "not-present";
      return row.versions[latest]?.status ?? "not-present";
    },
    [data.versions]
  );

  const displayedRows = useMemo(() => {
    let rows = constraintRows;
    if (changedOnly) {
      rows = rows.filter(hasAnyChange);
    }

    if (sortMode === "alpha") {
      return [...rows].sort((a, b) => a.constraintTitle.localeCompare(b.constraintTitle));
    }

    if (sortMode === "latest-change") {
      const rank: Record<ChangeTag | "not-present", number> = {
        modified: 0,
        added: 1,
        removed: 2,
        unchanged: 3,
        "not-present": 4,
      };
      return [...rows].sort((a, b) => {
        const ra = rank[latestChangeStatus(a)];
        const rb = rank[latestChangeStatus(b)];
        if (ra !== rb) return ra - rb;
        // tie-breaker: most changed, then alpha
        const sa = rowChangeScore(a);
        const sb = rowChangeScore(b);
        if (sa !== sb) return sb - sa;
        return a.constraintTitle.localeCompare(b.constraintTitle);
      });
    }

    // most-changed
    return [...rows].sort((a, b) => {
      const sa = rowChangeScore(a);
      const sb = rowChangeScore(b);
      if (sa !== sb) return sb - sa;
      return a.constraintTitle.localeCompare(b.constraintTitle);
    });
  }, [changedOnly, constraintRows, hasAnyChange, latestChangeStatus, rowChangeScore, sortMode]);

  return (
    <TooltipProvider>
      <div className="space-y-4">

      {/* Legend */}
      <Card className="bg-slate-50/50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Guide
              </span>

              <button
                type="button"
                onClick={() => setShowUnchangedLines((v) => !v)}
                className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
                  showUnchangedLines
                    ? "border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200"
                    : "border-slate-200 dark:border-slate-800 bg-transparent text-slate-400 dark:text-slate-500"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                  • Unchanged lines
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddedLines((v) => !v)}
                className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
                  showAddedLines
                    ? "border-emerald-300 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-200"
                    : "border-slate-200 dark:border-slate-800 bg-transparent text-slate-400 dark:text-slate-500"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />+ Added lines
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowRemovedLines((v) => !v)}
                className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
                  showRemovedLines
                    ? "border-rose-300 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-900/10 text-rose-800 dark:text-rose-200"
                    : "border-slate-200 dark:border-slate-800 bg-transparent text-slate-400 dark:text-slate-500"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />– Removed lines
                </span>
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

              <button
                type="button"
                onClick={() => setChangedOnly((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
                  changedOnly
                    ? "border-amber-300 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200"
                    : "border-slate-200 dark:border-slate-800 bg-transparent text-slate-600 dark:text-slate-400"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${changedOnly ? "bg-amber-500" : "bg-slate-400 dark:bg-slate-600"}`} />
                Changed only
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Sort</span>
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                  className="h-8 rounded-md border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 px-2 text-xs font-mono text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700"
                >
                  <option value="most-changed">Most changed</option>
                  <option value="latest-change">Latest change</option>
                  <option value="alpha">A → Z</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table - Single table with sticky left + sticky current (right) for perfect row alignment */}
      <Card className="border-2 border-slate-200 dark:border-slate-800 overflow-hidden bg-gradient-to-br from-slate-50/80 to-slate-100/50 dark:from-slate-900/40 dark:to-slate-950/60">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-950 dark:to-slate-900 text-white px-6 py-3 border-b border-slate-700">
          <h3 className="font-mono font-semibold text-base">
            Version Comparison ({data.versions.map(v => v.versionName).join(' → ')} — current fixed on right)
          </h3>
        </div>

        <div className="relative overflow-x-auto bg-white/30 dark:bg-slate-950/20">
          <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
            <thead>
              <tr className="bg-gradient-to-b from-slate-100/90 to-slate-50/70 dark:from-slate-800/60 dark:to-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                <th
                  className="sticky left-0 z-30 bg-gradient-to-b from-slate-100/90 to-slate-50/70 dark:from-slate-800/60 dark:to-slate-900/40 text-left px-5 py-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-800"
                  style={{ width: "200px" }}
                >
                  Constraint
                </th>

                {otherVersionObjs.map((versionObj, i) => (
                  <th
                    key={`version-${versionObj.version}`}
                    className="text-center px-5 py-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-800 min-w-[300px]"
                  >
                    {versionObj.versionName}
                    {i < otherVersionObjs.length - 1 && (
                      <span className="ml-2 text-slate-400 dark:text-slate-600">→</span>
                    )}
                  </th>
                ))}

                <th className="sticky right-0 z-30 bg-gradient-to-b from-slate-200/90 to-slate-100/70 dark:from-slate-700/70 dark:to-slate-800/50 text-center px-5 py-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider min-w-[400px] border-l-2 border-slate-300 dark:border-slate-600">
                  {latestVersionObj.versionName}
                  <Badge className="ml-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[9px] px-2 py-0.5 font-bold">
                    Current
                  </Badge>
                </th>
              </tr>
            </thead>

            <tbody>
              {displayedRows.map((row) => (
                <tr
                  key={row.constraintTitle}
                  className="border-b border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100/40 dark:hover:bg-slate-900/40 transition-colors bg-white/20 dark:bg-slate-950/10"
                >
                  <td className="sticky left-0 z-20 bg-gradient-to-r from-slate-100/95 to-slate-50/80 dark:from-slate-900/90 dark:to-slate-800/70 backdrop-blur-sm px-5 py-4 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                    <div className="space-y-2">
                      <div className="leading-snug">{row.constraintTitle}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${getStatusChipClass(
                            latestChangeStatus(row)
                          )}`}
                        >
                          Δ {rowChangeScore(row)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {data.versions.map((v, idx) => {
                            const status = row.versions[v.versionName]?.status ?? "not-present";
                            const label =
                              idx === 0
                                ? `${v.versionName}: baseline`
                                : `${v.versionName}: ${formatStatus(status)}`;
                            return (
                              <Tooltip key={`${row.constraintTitle}-timeline-${v.versionName}`}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`h-2.5 w-2.5 rounded-sm ring-1 ring-slate-300/70 dark:ring-slate-700/60 ${getStatusDot(
                                      status
                                    )}`}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-semibold">{label}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </td>

                  {otherVersionObjs.map((versionObj) => {
                    const idx = (versionIndexByName[versionObj.versionName] ?? 0) as number;
                    const cell = row.versions[versionObj.versionName];
                    const status = cell?.status ?? (idx === 0 ? "unchanged" : "not-present");
                    const visibleLines = filterLines(cell?.lines ?? []);
                    return (
                      <td
                        key={`cell-${row.constraintTitle}-${versionObj.version}`}
                        className={`px-5 py-4 text-sm text-slate-700 dark:text-slate-300 align-top border-r border-slate-200 dark:border-slate-800 ${getCellClass(
                          status
                        )}`}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-default space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  {formatStatus(status)}
                                </span>
                                {visibleLines.length > 0 && (
                                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                    {visibleLines.length} line{visibleLines.length === 1 ? "" : "s"}
                                  </span>
                                )}
                              </div>
                              {visibleLines.length ? (
                                <ScrollArea className="h-[160px] pr-2">
                                  <div className="space-y-2">
                                    {visibleLines.map((line, lineIdx) => (
                                      <div key={`${row.constraintTitle}-${versionObj.versionName}-${lineIdx}`} className="flex gap-2 items-start">
                                        <span
                                          className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${getLinePill(
                                            line.tag
                                          )}`}
                                        >
                                          {line.tag === "added" ? "+" : line.tag === "removed" ? "–" : "•"}
                                        </span>
                                        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                                          {line.text}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              ) : (
                                <div className="text-xs text-slate-500 dark:text-slate-400">—</div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{formatStatus(status)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}

                  {(() => {
                    const idx = (versionIndexByName[latestVersionObj.versionName] ?? data.versions.length - 1) as number;
                    const cell = row.versions[latestVersionObj.versionName];
                    const status = cell?.status ?? (idx === 0 ? "unchanged" : "not-present");
                    const visibleLines = filterLines(cell?.lines ?? []);
                    return (
                      <td
                        className={`sticky right-0 z-20 bg-gradient-to-l from-slate-200/95 to-slate-100/80 dark:from-slate-800/90 dark:to-slate-700/70 backdrop-blur-sm px-5 py-4 text-sm text-slate-700 dark:text-slate-300 align-top border-l-2 border-slate-300 dark:border-slate-600 ${getCellClass(
                          status
                        )}`}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-default space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  {formatStatus(status)}
                                </span>
                                {visibleLines.length > 0 && (
                                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                    {visibleLines.length} line{visibleLines.length === 1 ? "" : "s"}
                                  </span>
                                )}
                              </div>
                              {visibleLines.length ? (
                                <ScrollArea className="h-[160px] pr-2">
                                  <div className="space-y-2">
                                    {visibleLines.map((line, lineIdx) => (
                                      <div key={`${row.constraintTitle}-${latestVersionObj.versionName}-${lineIdx}`} className="flex gap-2 items-start">
                                        <span
                                          className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${getLinePill(
                                            line.tag
                                          )}`}
                                        >
                                          {line.tag === "added" ? "+" : line.tag === "removed" ? "–" : "•"}
                                        </span>
                                        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                                          {line.text}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              ) : (
                                <div className="text-xs text-slate-500 dark:text-slate-400">—</div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{formatStatus(status)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      </div>
    </TooltipProvider>
  );
}
