"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProjectStatus = "Compliant" | "Under Review" | "Issues Found";

type Project = {
  id: string;
  customerId?: string;
  name: string;
  type?: string;
  createdAt?: string;
  status?: ProjectStatus;
  rulesCount?: number;
  updatedAt?: string;
  rulesetsCount?: number;
  latestRuleset?: {
    version: number;
    versionName: string;
    createdAt: Date | string;
  } | null;
};

type ProjectsResponse = { projects: Project[] };

const projectTypes = ["Family Office", "Corporate", "UHNI", "Institutional"];

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProjectsClient() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
      const data = (await res.json()) as ProjectsResponse;
      const projectsWithMeta = (Array.isArray(data.projects) ? data.projects : []).map((p, i) => ({
        ...p,
        status: (p.status || "Compliant") as ProjectStatus,
        type: p.type || projectTypes[i % projectTypes.length],
        rulesCount: p.rulesCount || Math.floor(15 + Math.random() * 20),
        updatedAt: p.updatedAt || p.createdAt,
      }));
      setProjects(projectsWithMeta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || creating) return;

      setCreating(true);
      setError(null);
      try {
        // Generate customerId on the client and send with the request
        const customerId = crypto.randomUUID();
        
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: trimmed, customerId }),
        });

        const data = (await res.json()) as { id?: string; customerId?: string; error?: string };
        if (!res.ok) {
          throw new Error(data?.error ?? `Create failed (${res.status})`);
        }

        // Store the customerId in sessionStorage
        if (typeof window !== "undefined") {
          sessionStorage.setItem("currentCustomerId", customerId);
        }

        setName("");
        setShowModal(false);
        // Navigate to upload page instead of just reloading
        window.location.href = "/upload";
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create project");
      } finally {
        setCreating(false);
      }
    },
    [creating, load, name],
  );

  // Stats calculations
  const stats = useMemo(() => {
    if (!projects) return { total: 0, compliant: 0, underReview: 0, issues: 0 };
    return {
      total: projects.length,
      compliant: projects.filter(p => p.status === "Compliant").length,
      underReview: projects.filter(p => p.status === "Under Review").length,
      issues: projects.filter(p => p.status === "Issues Found").length,
    };
  }, [projects]);

  const StatusBadge = ({ status }: { status: ProjectStatus }) => {
    const styles: Record<ProjectStatus, string> = {
      "Compliant": "bg-emerald-500 text-white",
      "Under Review": "bg-amber-500 text-white",
      "Issues Found": "bg-red-500 text-white",
    };
    return (
      <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Goldman Sachs</h1>
                <p className="text-sm text-slate-500">Client Projects</p>
              </div>
              {!loading && stats.total > 0 && (
                <StatusBadge status="Compliant" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => void load()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Update Projects
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Dashboard Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500 mt-1">Monitor compliance status and upload new guidelines</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 stagger-children">
          {/* Client Portfolios */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {loading ? "—" : stats.total}
                </div>
                <div className="text-sm text-slate-500 mt-0.5">Client Portfolios</div>
              </div>
            </div>
          </div>

          {/* Compliant */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {loading ? "—" : stats.compliant}
                </div>
                <div className="text-sm text-slate-500 mt-0.5">Compliant</div>
              </div>
            </div>
          </div>

          {/* Under Review */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {loading ? "—" : stats.underReview}
                </div>
                <div className="text-sm text-slate-500 mt-0.5">Under Review</div>
              </div>
            </div>
          </div>

          {/* Issues Found */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {loading ? "—" : stats.issues}
                </div>
                <div className="text-sm text-slate-500 mt-0.5">Issues Found</div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Client Portfolios Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Client Projects</h3>
            <button
              onClick={() => {
                setShowModal(true);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Project
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-5 animate-pulse">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="h-5 bg-slate-200 rounded w-40 mb-2" />
                      <div className="h-4 bg-slate-100 rounded w-24" />
                    </div>
                    <div className="h-6 bg-slate-200 rounded-full w-20" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded w-48 mb-4" />
                  <div className="flex gap-2">
                    <div className="h-10 bg-slate-100 rounded-lg flex-1" />
                    <div className="h-10 bg-slate-100 rounded-lg w-10" />
                  </div>
                </div>
              ))}
            </div>
          ) : projects && projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">No portfolios yet. Add your first client portfolio!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects?.map((project, idx) => (
                <div 
                  key={project.id} 
                  className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors animate-fade-in-up"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{project.name}</h4>
                      <p className="text-sm text-slate-500">{project.type}</p>
                    </div>
                    <StatusBadge status={project.status || "Compliant"} />
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Verified {formatDate(project.createdAt)}</span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <span>{project.rulesCount} rules</span>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (project.customerId && typeof window !== "undefined") {
                          sessionStorage.setItem("currentCustomerId", project.customerId);
                        }
                        window.location.href = "/upload";
                      }}
                      className="flex-1 inline-flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                      <span>View Guidelines</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => void load()}
                      className="p-2.5 text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Add New Portfolio</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={onCreate}>
              <label className="block mb-5">
                <span className="text-sm font-medium text-slate-700 mb-2 block">Portfolio Name</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Blackstone Family Office"
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-400"
                  maxLength={120}
                />
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || creating}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Creating..." : "Add Portfolio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
