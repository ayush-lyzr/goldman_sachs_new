"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CUSTOMERS, getCatalogForVersion } from "@/lib/customers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

type ProjectStatus = "Compliant" | "Under Review" | "Issues Found";

type SelectedCompany = {
  companyId: string;
  companyName: string;
  fidessa_catalog: Record<string, string>;
  fidessa_catalog_v1?: Record<string, string>;
  fidessa_catalog_v2?: Record<string, string>;
  rulesVersion?: "v1" | "v2";
};

type Project = {
  id: string;
  customerId?: string;
  selectedCompany?: SelectedCompany;
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
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(CUSTOMERS[0]?.id || "");
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

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

      // Get the selected customer data
      const selectedCustomer = CUSTOMERS.find((c) => c.id === selectedCustomerId);
      if (!selectedCustomer) {
        setError("Please select a customer");
        return;
      }

      setCreating(true);
      setError(null);
      try {
        // Generate customerId on the client and send with the request
        const customerId = crypto.randomUUID();
        
        // Store both catalog versions for all clients; version choice happens at upload time
        const selectedCompanyPayload: SelectedCompany = {
          companyId: selectedCustomer.id,
          companyName: selectedCustomer.name,
          fidessa_catalog: getCatalogForVersion(selectedCustomer, "v1") as unknown as Record<string, string>,
          fidessa_catalog_v1: selectedCustomer.fidessa_catalog_v1 as unknown as Record<string, string>,
          fidessa_catalog_v2: selectedCustomer.fidessa_catalog_v2 as unknown as Record<string, string>,
          rulesVersion: "v1",
        };
        
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ 
            name: trimmed, 
            customerId,
            selectedCompany: selectedCompanyPayload,
          }),
        });

        const data = (await res.json()) as { id?: string; customerId?: string; selectedCompany?: SelectedCompany; error?: string };
        if (!res.ok) {
          throw new Error(data?.error ?? `Create failed (${res.status})`);
        }

        // Store the customerId, projectId, and selected company in sessionStorage/localStorage
        if (typeof window !== "undefined") {
          sessionStorage.setItem("currentCustomerId", customerId);
          sessionStorage.setItem("currentProjectId", data.id || customerId);
          
          // Store the selected company data in localStorage for this project
          localStorage.setItem(
            `project_${data.id}_company`,
            JSON.stringify(selectedCompanyPayload)
          );
          // Also store in sessionStorage for immediate access
          sessionStorage.setItem("currentSelectedCompany", JSON.stringify(selectedCompanyPayload));
          sessionStorage.setItem("currentRulesVersion", "v1");
          
          // Clear any previously extracted rules to ensure fresh state
          sessionStorage.removeItem("extractedRules");
          sessionStorage.removeItem("extractedPDF");
          sessionStorage.removeItem("mappedRules");
          sessionStorage.removeItem("gapAnalysis");
        }

        setName("");
        setSelectedCustomerId(CUSTOMERS[0]?.id || "");
        setShowModal(false);
        // Navigate to upload page instead of just reloading
        window.location.href = "/upload";
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create project");
      } finally {
        setCreating(false);
      }
    },
    [creating, load, name, selectedCustomerId],
  );

  const onEdit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!projectToEdit || updating) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const selectedCustomer = CUSTOMERS.find((c) => c.id === selectedCustomerId);
      if (!selectedCustomer) {
        setError("Please select a customer");
        return;
      }
      setUpdating(true);
      setError(null);
      try {
        const selectedCompanyPayload: SelectedCompany = {
          companyId: selectedCustomer.id,
          companyName: selectedCustomer.name,
          fidessa_catalog: getCatalogForVersion(selectedCustomer, "v1") as unknown as Record<string, string>,
          fidessa_catalog_v1: selectedCustomer.fidessa_catalog_v1 as unknown as Record<string, string>,
          fidessa_catalog_v2: selectedCustomer.fidessa_catalog_v2 as unknown as Record<string, string>,
          rulesVersion: "v1",
        };
        const res = await fetch(`/api/projects/${projectToEdit.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: trimmed, selectedCompany: selectedCompanyPayload }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data?.error ?? `Update failed (${res.status})`);
        setProjectToEdit(null);
        setName("");
        setSelectedCustomerId(CUSTOMERS[0]?.id || "");
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update project");
      } finally {
        setUpdating(false);
      }
    },
    [projectToEdit, selectedCustomerId, name, updating, load],
  );

  const onDelete = useCallback(
    async (project: Project) => {
      if (!project || deleting) return;
      setDeleting(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data?.error ?? `Delete failed (${res.status})`);
        setProjectToDelete(null);
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete project");
      } finally {
        setDeleting(false);
      }
    },
    [deleting, load],
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
      {/* Header - Goldman Sachs Branded */}
      <header className="flex items-center justify-between px-4 lg:px-6 py-2 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          {/* Goldman Sachs Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <Image 
                src="/Goldman-logo.svg" 
                alt="Goldman Sachs" 
                width={80} 
                height={80}
                className="w-20 h-20"
              />
            </div>
          </div>
          
          {/* Project Info */}
          <div className="flex items-center gap-3 border-l border-slate-200 pl-6 ml-2">
            <h2 className="font-semibold text-slate-900 text-sm">
              Client Projects
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => void load()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#64A8F0] border border-[#64A8F0] rounded-lg hover:bg-[#5594d9] transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
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
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#64A8F0] rounded-lg hover:bg-[#5594d9] transition-colors shadow-sm"
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
                  onClick={() => {
                    if (project.customerId && typeof window !== "undefined") {
                      sessionStorage.setItem("currentCustomerId", project.customerId);
                      sessionStorage.setItem("currentProjectId", project.id);
                      
                      if (project.selectedCompany) {
                        sessionStorage.setItem("currentSelectedCompany", JSON.stringify(project.selectedCompany));
                        const rv = (project.selectedCompany as SelectedCompany).rulesVersion ?? "v1";
                        sessionStorage.setItem("currentRulesVersion", rv);
                      } else {
                        const storedCompany = localStorage.getItem(`project_${project.id}_company`);
                        if (storedCompany) {
                          sessionStorage.setItem("currentSelectedCompany", storedCompany);
                          sessionStorage.setItem("currentRulesVersion", "v1");
                        }
                      }
                      
                      sessionStorage.removeItem("extractedRules");
                      sessionStorage.removeItem("extractedPDF");
                      sessionStorage.removeItem("mappedRules");
                      sessionStorage.removeItem("gapAnalysis");
                    }
                    window.location.href = "/upload";
                  }}
                  className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors animate-fade-in-up cursor-pointer"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{project.name}</h4>
                      <p className="text-sm text-slate-500">{project.type}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          aria-label="Project options"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToEdit(project);
                            setName(project.name);
                            setSelectedCustomerId((project.selectedCompany as SelectedCompany)?.companyId ?? CUSTOMERS[0]?.id ?? "");
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(project);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Verified {formatDate(project.createdAt)}</span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <span>{project.rulesCount} rules</span>
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
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add New Project</h2>
                <p className="text-xs text-slate-500 mt-0.5">Create a new investment guidelines project</p>
              </div>
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
              <label className="block mb-4">
                <span className="text-sm font-medium text-slate-700 mb-2 block">Project Name</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Blackstone Family Office"
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#64A8F0]/20 focus:border-[#64A8F0] transition-all placeholder:text-slate-400"
                  maxLength={120}
                />
              </label>

              <label className="block mb-5">
                <span className="text-sm font-medium text-slate-700 mb-2 block">Customer</span>
                <div className="relative">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#64A8F0]/20 focus:border-[#64A8F0] transition-all appearance-none bg-white cursor-pointer"
                  >
                    {CUSTOMERS.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">Select the customer. Both V1 and V2 rules are stored; choose version when uploading.</p>
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
                  disabled={!name.trim() || !selectedCustomerId || creating}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#64A8F0] rounded-xl hover:bg-[#5594d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {creating ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit project modal */}
      {projectToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              setProjectToEdit(null);
              setName("");
              setSelectedCustomerId(CUSTOMERS[0]?.id || "");
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit Project</h2>
                <p className="text-xs text-slate-500 mt-0.5">Update project name and customer</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProjectToEdit(null);
                  setName("");
                  setSelectedCustomerId(CUSTOMERS[0]?.id || "");
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={onEdit}>
              <label className="block mb-4">
                <span className="text-sm font-medium text-slate-700 mb-2 block">Project Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Blackstone Family Office"
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#64A8F0]/20 focus:border-[#64A8F0] transition-all placeholder:text-slate-400"
                  maxLength={120}
                />
              </label>
              <label className="block mb-5">
                <span className="text-sm font-medium text-slate-700 mb-2 block">Customer</span>
                <div className="relative">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#64A8F0]/20 focus:border-[#64A8F0] transition-all appearance-none bg-white cursor-pointer"
                  >
                    {CUSTOMERS.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setProjectToEdit(null);
                    setName("");
                    setSelectedCustomerId(CUSTOMERS[0]?.id || "");
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || !selectedCustomerId || updating}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#64A8F0] rounded-xl hover:bg-[#5594d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {updating ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setProjectToDelete(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-slate-900">Delete project?</h3>
            <p className="text-sm text-slate-500 mt-2">
              &ldquo;{projectToDelete.name}&rdquo; will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onDelete(projectToDelete)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
