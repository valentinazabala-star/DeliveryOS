import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Zap, AlertCircle, ChevronDown, ChevronRight,
  Clock, ListChecks, Users, CalendarDays, RefreshCw, ExternalLink,
  Sparkles, Check, X, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { roleConfig, workConfig, TEAM_DATA, type TeamRole, type WorkType, type TeamMember } from "@/data/teamData";
import { TASK_STANDARDS } from "@/data/taskStandards";
import { api } from "@/lib/api";
import type { AssignmentResult, PersonSchedule, UnassignedTask } from "@/data/assignmentEngine";

// ── Today helper ──────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// ── Small badge ───────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn("inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide", color)}>
      {label}
    </span>
  );
}

// ── Category colors ────────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  SEO:  "bg-blue-100 text-blue-700",
  RRSS: "bg-pink-100 text-pink-700",
  WEB:  "bg-teal-100 text-teal-700",
  GMB:  "bg-amber-100 text-amber-700",
};

// ── Subtask match: given an assigned task, find its workload standard ──────────
function findSubtask(taskTitle: string) {
  const lower = taskTitle.toLowerCase();
  return TASK_STANDARDS.find(s => {
    const names = s.clickup_task_name.split("·").map(n => n.trim().toLowerCase());
    return names.some(n => lower.includes(n) || n.includes(lower.split(" - ").slice(-1)[0]?.toLowerCase() ?? ""));
  }) ?? null;
}

// ── Person card ───────────────────────────────────────────────────────────────
function PersonCard({ schedule, overrideRoles, overrideAreas }: {
  schedule: PersonSchedule;
  overrideRoles: TeamRole[];
  overrideAreas: WorkType[];
}) {
  const [open, setOpen] = useState(false);

  // Show overridden roles/areas if configured, else defaults from schedule
  const effectiveRoles = overrideRoles.length > 0 ? overrideRoles : [schedule.role];
  const effectiveAreas = overrideAreas.length > 0 ? overrideAreas : [schedule.work_type];
  const rc = roleConfig[schedule.role];
  const wc = workConfig[schedule.work_type];

  const memberId = schedule.person_id
    || TEAM_DATA.find(m => m.person_name === schedule.person_name)?.id;

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      {/* Header */}
      <div className="w-full text-left px-4 py-3 flex items-center gap-3">
        {memberId ? (
          <Link to={`/team/${memberId}`}
            className="w-9 h-9 rounded-xl bg-[#60259F] flex items-center justify-center text-white text-xs font-black shrink-0 hover:opacity-80 transition-opacity"
            title="Ver perfil">
            {schedule.person_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
          </Link>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-[#60259F] flex items-center justify-center text-white text-xs font-black shrink-0">
            {schedule.person_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {memberId ? (
            <Link to={`/team/${memberId}`}
              className="text-sm font-bold text-foreground truncate hover:text-[#60259F] transition-colors block">
              {schedule.person_name}
            </Link>
          ) : (
            <p className="text-sm font-bold text-foreground truncate">{schedule.person_name}</p>
          )}
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {effectiveRoles.map(r => {
              const r_cfg = roleConfig[r];
              return <Badge key={r} label={r_cfg.label} color={r_cfg.bg + " " + r_cfg.color} />;
            })}
            {effectiveAreas.map(a => {
              const a_cfg = workConfig[a];
              return <Badge key={a} label={a_cfg.label} color={a_cfg.color} />;
            })}
          </div>
        </div>

        <div className="text-right shrink-0 mr-2">
          <p className="text-sm font-black text-foreground">
            {schedule.total_tasks} <span className="text-xs font-normal text-muted-foreground">tasks</span>
          </p>
          <p className="text-[10px] text-muted-foreground">{schedule.clients?.length ?? 0} clientes</p>
        </div>

        <button onClick={() => setOpen(o => !o)} className="p-1 rounded-lg hover:bg-muted/40 transition-colors">
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>

      {/* Load bar */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-[#60259F]" style={{ width: `${Math.min(100, (schedule.total_tasks / 30) * 100)}%` }} />
      </div>

      {/* Days breakdown */}
      {open && (
        <div className="divide-y divide-border">
          {schedule.days.map(day => (
            <div key={day.date} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {new Date(day.date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })}
                </p>
                <span className="text-[10px] font-mono text-muted-foreground">{day.task_count} tasks</span>
              </div>
              <div className="space-y-2">
                {day.tasks.map(t => {
                  const sub = t.is_feedback ? null : findSubtask(t.task_title);
                  return (
                    <div key={t.task_id} className="flex items-start gap-2 text-xs">
                      <span className={cn(
                        "shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full",
                        t.is_feedback ? "bg-purple-400" : "bg-[#60259F]"
                      )} />
                      <div className="flex-1 min-w-0">
                        <span className="truncate text-foreground font-medium block">{t.task_title}</span>
                        {t.client_name && (
                          <span className="text-[10px] text-muted-foreground">{t.client_name}</span>
                        )}
                        {/* Subtask from Workload */}
                        {sub && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", CAT_COLORS[sub.product_category] ?? "bg-slate-100 text-slate-600")}>
                              {sub.product_category}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                              {sub.product_name}
                            </span>
                            <span className="text-[9px] text-[#60259F] font-mono">{sub.time_minutes}m</span>
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-muted-foreground font-mono">
                        {t.is_feedback ? "fb" : `${t.minutes}m`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Unassigned list ────────────────────────────────────────────────────────────
function UnassignedList({ tasks }: { tasks: UnassignedTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-red-200 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">{tasks.length} Sin asignar</p>
      </div>
      <div className="divide-y divide-red-100">
        {tasks.map(t => (
          <div key={t.task_id} className="px-4 py-2.5 flex items-start gap-3">
            <span className={cn("shrink-0 mt-1 w-1.5 h-1.5 rounded-full", t.is_feedback ? "bg-purple-400" : "bg-red-400")} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{t.task_title}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{t.client_name}</p>
            </div>
            <p className="text-[10px] text-red-500 shrink-0 max-w-[160px] text-right">{t.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Unique product names from TASK_STANDARDS ──────────────────────────────────
const ACTION_OPTIONS = [...new Set(TASK_STANDARDS.map(s => s.product_name))].sort();
const PRODUCT_OPTIONS = ["SEO", "RRSS", "WEB", "GMB"];

// ── Main page ─────────────────────────────────────────────────────────────────
export function Assignment() {
  const [targetDate,    setTargetDate]    = useState(todayISO());
  const [deadline,      setDeadline]      = useState("");
  const [daysWindow,    setDaysWindow]    = useState(5);
  const [workMode,      setWorkMode]      = useState<"feedback" | "nuevos" | "recurrentes" | "approved">("nuevos");
  const [filterProduct,  setFilterProduct]  = useState("");
  const [filterAction,   setFilterAction]   = useState("");
  const [filterState,    setFilterState]    = useState("TASK_CREATED");
  const [showPreview,    setShowPreview]    = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [result,         setResult]         = useState<AssignmentResult | null>(null);
  const [filterRole,     setFilterRole]     = useState("all");
  const [filterArea,     setFilterArea]     = useState("all");
  const [recPeople,      setRecPeople]      = useState<string[]>([]);
  const [recDismissed,   setRecDismissed]   = useState(false);
  const [previewTab,     setPreviewTab]     = useState<"available" | "assigned">("available");
  const [syncResult,     setSyncResult]     = useState<{ total?: number; new_from_api?: number; source?: string; error?: string } | null>(null);

  // Auto-set state based on workMode
  useEffect(() => {
    if (workMode === "feedback") setFilterState("TASK_PENDING_TO_APPLY_CHANGES");
    else if (workMode === "approved") setFilterState("TASK_APPROVED");
    else setFilterState("TASK_CREATED");
  }, [workMode]);

  // Team overrides (roles + areas configured by PM)
  const { data: overridesRaw = {} } = useQuery<Record<string, { roles: string[]; workAreas: string[] }>>({
    queryKey: ["team-overrides"],
    queryFn:  () => api.teamOverrides.getAll(),
    retry: false,
    staleTime: Infinity,
  });

  // Helper: get effective roles/areas for a person id
  const getOverride = (personId: string) => {
    const raw = overridesRaw[personId];
    return {
      roles:     (raw?.roles     ?? []) as TeamRole[],
      workAreas: (raw?.workAreas ?? []) as WorkType[],
    };
  };

  // Load last assignment on mount
  const { data: lastResult } = useQuery<AssignmentResult | null>({
    queryKey: ["assignment-last"],
    queryFn:  () => api.assignment.getLast(),
    retry: false,
    staleTime: 0,
    enabled: !result,
  });

  const displayed = result ?? lastResult ?? null;

  // Step 1: poll /api/cache-status until the server has finished at least one accounts snapshot
  // (accounts_cache_ready). Do not require accounts_count > 0 — empty snapshot must unblock the UI.
  const { data: cacheStatus, isPending: cacheStatusPending, isFetching: cacheStatusFetching } = useQuery({
    queryKey: ["cache-status"],
    queryFn:  () => api.cacheStatus.get(),
    enabled:  showPreview,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const d = query.state.data as { accounts_cache_ready?: boolean; accounts_cache_warm?: boolean } | undefined;
      if (d?.accounts_cache_ready === true) return false;
      if (d && typeof d.accounts_cache_ready !== "boolean" && d.accounts_cache_warm) return false;
      return 1000;
    },
  });

  // New API: accounts_cache_ready after first snapshot (even []). Legacy: only accounts_cache_warm.
  const accountsReady =
    cacheStatus?.accounts_cache_ready === true ||
    (cacheStatus != null &&
      typeof (cacheStatus as { accounts_cache_ready?: boolean }).accounts_cache_ready !== "boolean" &&
      cacheStatus.accounts_cache_warm === true);
  const accountsCount = typeof cacheStatus?.accounts_count === "number" ? cacheStatus.accounts_count : 0;
  const accountsWarming = cacheStatus?.warming === true;
  const briefCrossPending = cacheStatusPending || !accountsReady;

  // Step 2: tasks query only after accounts snapshot exists (even if 0 rows)
  const { data: previewData, isPending: previewInitial, isFetching: previewFetching, isError: previewIsError, error: previewQueryError, refetch: refetchPreview } = useQuery({
    queryKey: ["tasks-preview", filterState, filterProduct, filterAction, workMode, accountsCount],
    queryFn: () => api.tasks.listAll({
      state:         filterState   || undefined,
      product:       filterProduct || undefined,
      action_filter: filterAction  || undefined,
      work_area:     workMode !== "feedback" && workMode !== "approved" ? workMode : undefined,
      limit:         10_000,
    }),
    enabled: showPreview && accountsReady,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const previewBriefPending =
    previewData != null && previewData.brief_cache_warm === false;
  const previewTasksPending =
    accountsReady &&
    !previewIsError &&
    (previewInitial || previewFetching || previewBriefPending || !previewData);

  // UUID list info (count + source) — used in the accounts sync bar
  const { data: uuidListInfo, refetch: refetchUuidList } = useQuery({
    queryKey: ["account-uuids-meta"],
    queryFn:  () => api.cacheStatus.getUuidList(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { mutate: syncAccounts, isPending: syncPending } = useMutation({
    mutationFn: () => api.cacheStatus.syncAccounts(),
    onSuccess: (data) => {
      setSyncResult(data);
      refetchUuidList();
    },
    onError: (err: any) => setSyncResult({ error: err.message }),
  });

  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: () =>
      api.assignment.run({
        target_date:    targetDate,
        days_window:    daysWindow,
        work_mode:      workMode,
        deadline:       deadline || undefined,
        person_ids:     selectedPeople.length ? selectedPeople : undefined,
        product_filter: filterProduct || undefined,
        action_filter:  filterAction  || undefined,
      }),
    onSuccess: (data) => setResult(data),
  });

  const selectClass = "h-8 rounded-full border border-border bg-white px-3 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#60259F]/30";

  const filteredSchedules = (displayed?.schedules ?? []).filter(s => {
    if (filterRole !== "all" && s.role !== filterRole) return false;
    if (filterArea !== "all") {
      const ovr = getOverride(s.person_id);
      const areas = ovr.workAreas.length > 0 ? ovr.workAreas : [s.work_type];
      if (!areas.includes(filterArea as WorkType)) return false;
    }
    return true;
  });

  // Recommendation computation from preview data (never while accounts or pool still pending)
  const recommendationData = useMemo(() => {
    if (briefCrossPending || previewTasksPending) return null;
    if (!previewData || previewFetching || previewBriefPending) return null;
    if (previewData.total === 0) return null;
    const DAILY_GOAL = 25;

    // Product distribution (from sampled data; extrapolate proportionally to total)
    const sampleCounts: Record<string, number> = {};
    for (const t of previewData.data) {
      const prefix = ((t.title ?? "").split(" - ")[0]).trim().toUpperCase();
      const cat = ["SEO", "RRSS", "WEB", "GMB"].includes(prefix) ? prefix : "OTRO";
      sampleCounts[cat] = (sampleCounts[cat] ?? 0) + 1;
    }
    // Scale sample to total if paginated
    const scale = previewData.data.length > 0 ? previewData.total / previewData.data.length : 1;
    const productCounts: Record<string, number> = {};
    for (const [cat, n] of Object.entries(sampleCounts)) {
      productCounts[cat] = Math.round(n * scale);
    }

    const totalTasks = previewData.total;
    const recommendedCount = Math.ceil(totalTasks / DAILY_GOAL);

    // Roles needed by product mix
    const roleNeeds = new Set<TeamRole>();
    if (productCounts.RRSS) { roleNeeds.add("Copy"); roleNeeds.add("Designer"); roleNeeds.add("Content_Specialist"); }
    if (productCounts.SEO)  { roleNeeds.add("Analyst_Seo"); roleNeeds.add("Content_Specialist"); }
    if (productCounts.WEB)  { roleNeeds.add("Implementador"); }
    if (productCounts.GMB)  { roleNeeds.add("Content_Specialist"); roleNeeds.add("Copy"); }

    // Filter team by area + role fit
    const candidates = TEAM_DATA.filter(m => {
      const ovr = overridesRaw[m.id];
      const effAreas = (ovr?.workAreas?.length ?? 0) > 0 ? (ovr!.workAreas as WorkType[]) : [m.trabajo_actual];
      const effRoles = (ovr?.roles?.length ?? 0) > 0 ? (ovr!.roles as TeamRole[]) : [m.role];
      const areaOk = workMode === "approved" ? true : effAreas.includes(workMode as WorkType);
      const roleOk = roleNeeds.size === 0 || effRoles.some(r => roleNeeds.has(r));
      return areaOk && roleOk;
    });

    const activePeople = Math.min(recommendedCount, candidates.length);
    const tasksPerPerson = activePeople > 0 ? Math.ceil(totalTasks / activePeople) : totalTasks;
    const suggested = candidates.slice(0, recommendedCount);

    return { totalTasks, recommendedCount, productCounts, suggested, tasksPerPerson, allCandidates: candidates };
  }, [briefCrossPending, previewTasksPending, previewData, previewFetching, previewBriefPending, overridesRaw, workMode]);

  // Sync recPeople whenever recommendation changes (new preview query result)
  useEffect(() => {
    if (recommendationData) {
      setRecPeople(recommendationData.suggested.map(m => m.id));
      setRecDismissed(false);
    }
  }, [recommendationData]);

  // Map task_id → person_name from the current/last assignment result (for pool rule)
  const assignedTaskMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of (displayed?.schedules ?? [])) {
      for (const day of s.days) {
        for (const t of day.tasks) {
          map.set(t.task_id, s.person_name);
        }
      }
    }
    return map;
  }, [displayed]);

  const isLastResult = !result && !!lastResult;

  return (
    <div className="p-8 space-y-6 bg-background min-h-screen">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#60259F] mb-1">Planificación</p>
          <h2 className="text-2xl font-black tracking-tight text-foreground"
              style={{ fontFamily: "'Cal Sans', sans-serif", letterSpacing: "-0.03em" }}>
            Asignación de tareas
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5">
            Asignación automática respetando capacidad, roles y reglas de negocio.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-border rounded-2xl px-5 py-4 space-y-4">
        {/* Row 1: core params */}
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1.5">Fecha de inicio</label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
              className="h-8 rounded-full border border-border bg-white px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#60259F]/30" />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1.5">Tipo de trabajo</label>
            <select value={workMode} onChange={e => setWorkMode(e.target.value as any)} className={selectClass}>
              <option value="nuevos">Nuevos</option>
              <option value="recurrentes">Recurrentes</option>
              <option value="feedback">Feedback</option>
              <option value="approved">Approved</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1.5">Ventana (días)</label>
            <select value={daysWindow} onChange={e => setDaysWindow(Number(e.target.value))} className={selectClass}>
              {[1,2,3,5,7,10].map(n => <option key={n} value={n}>{n} día{n > 1 ? "s" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1.5">Fecha límite</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="h-8 rounded-full border border-border bg-white px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#60259F]/30" />
          </div>
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="h-8 px-5 rounded-full bg-[#60259F] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#4a1a7a] disabled:opacity-50 transition-colors ml-auto"
          >
            {isPending
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Calculando...</>
              : <><Zap className="w-3.5 h-3.5" /> Ejecutar asignación</>
            }
          </button>
        </div>

        {/* Row 2: filters */}
        <div className="flex items-end gap-4 flex-wrap pt-1 border-t border-border/50">
          <div>
            <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1.5">Estado de tarea</label>
            <select value={filterState} onChange={e => setFilterState(e.target.value)} className={selectClass}>
              <option value="">Todos</option>
              <option value="TASK_CREATED">Created</option>
              <option value="TASK_PENDING_TO_APPLY_CHANGES">Apply Changes</option>
              <option value="TASK_APPROVED">Approved</option>
              <option value="TASK_IN_PROGRESS">In Progress</option>
              <option value="TASK_PENDING_TO_REVIEW">Pending Review</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1.5">Producto (Marketing)</label>
            <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className={selectClass}>
              <option value="">Todos los productos</option>
              {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1.5">Acción</label>
            <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className={selectClass}>
              <option value="">Todas las acciones</option>
              {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {filterAction && (
            <div className="flex items-center gap-1.5 bg-[#60259F]/5 border border-[#60259F]/20 rounded-full px-3 py-1">
              <span className="text-[10px] font-semibold text-[#60259F]">
                {TASK_STANDARDS.filter(s => s.product_name === filterAction).length} subtareas · {TASK_STANDARDS.find(s => s.product_name === filterAction)?.time_minutes}m c/u
              </span>
            </div>
          )}
          <button
            onClick={() => { setShowPreview(true); refetchPreview(); }}
            className="h-8 px-4 rounded-full border border-[#60259F]/30 text-[#60259F] text-xs font-semibold hover:bg-[#60259F]/5 transition-colors flex items-center gap-1.5 ml-auto"
          >
            <ListChecks className="w-3.5 h-3.5" />
            Ver tareas
            {!briefCrossPending && !previewTasksPending && previewData && (
              <span className="bg-[#60259F] text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold">{previewData.total}</span>
            )}
          </button>
        </div>

        {/* Row 3: person selector */}
        <div className="pt-1 border-t border-border/50">
          <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold block mb-2">Asignar a (vacío = todo el equipo)</label>
          <div className="flex flex-wrap gap-2">
            {TEAM_DATA.map(m => {
              const ovr = getOverride(m.id);
              const effectiveRoles = ovr.roles.length > 0 ? ovr.roles : [m.role];
              const effectiveAreas = ovr.workAreas.length > 0 ? ovr.workAreas : [m.trabajo_actual];
              const rc = roleConfig[effectiveRoles[0]];
              const selected = selectedPeople.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedPeople(prev =>
                    prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                  )}
                  title={`Roles: ${effectiveRoles.join(", ")} | Áreas: ${effectiveAreas.join(", ")}`}
                  className={cn(
                    "flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[10px] font-semibold transition-all",
                    selected
                      ? "bg-[#60259F] text-white border-[#60259F]"
                      : "bg-white text-muted-foreground border-border hover:border-[#60259F]/40 hover:text-[#60259F]"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", selected ? "bg-white/60" : rc.bg.split(" ")[0])} />
                  {m.person_name.split(" ").slice(0, 2).join(" ")}
                  {ovr.roles.length > 0 && (
                    <span className={cn("text-[8px] font-bold ml-0.5", selected ? "text-white/70" : "text-[#60259F]")}>✎</span>
                  )}
                </button>
              );
            })}
            {selectedPeople.length > 0 && (
              <button onClick={() => setSelectedPeople([])}
                className="h-7 px-2.5 rounded-full border border-red-200 text-red-500 text-[10px] hover:bg-red-50 transition-colors">
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Accounts sync bar */}
      <div className="bg-white rounded-2xl border border-border px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Users className="w-3.5 h-3.5 text-[#60259F]/60 shrink-0" />
          <div className="min-w-0">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mr-2">Cuentas en pool</span>
            <span className="text-sm font-black text-foreground">{uuidListInfo?.count ?? TEAM_DATA.length}</span>
            {uuidListInfo?.source && (
              <span className="text-[9px] text-muted-foreground ml-2 truncate hidden sm:inline">
                · {uuidListInfo.source.split("(")[0].trim()}
              </span>
            )}
          </div>
        </div>

        {syncResult && (
          <div className={cn(
            "text-[10px] px-3 py-1 rounded-full font-semibold",
            syncResult.error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
          )}>
            {syncResult.error
              ? `Error: ${syncResult.error}`
              : `✓ ${syncResult.total?.toLocaleString()} cuentas sincronizadas${syncResult.new_from_api ? ` (${syncResult.new_from_api} nuevas de Orbidi)` : ""}`}
          </div>
        )}

        <button
          onClick={() => { setSyncResult(null); syncAccounts(); }}
          disabled={syncPending}
          className="h-8 px-4 rounded-full border border-[#60259F]/30 text-[#60259F] text-xs font-semibold hover:bg-[#60259F]/5 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
        >
          {syncPending
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sincronizando…</>
            : <><RefreshCw className="w-3.5 h-3.5" /> Sincronizar cuentas</>}
        </button>
      </div>

      {/* Task preview panel */}
      {showPreview && (() => {
        const PROD_COLOR: Record<string, string> = {
          SEO: "bg-blue-50 text-blue-700", RRSS: "bg-pink-50 text-pink-700",
          GMB: "bg-amber-50 text-amber-700", WEB: "bg-teal-50 text-teal-700",
        };
        const fmtDate = (iso: string | null | undefined) =>
          iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : null;

        const previewPanelShell = (children: React.ReactNode) => (
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="w-3.5 h-3.5 text-[#60259F]/60" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Pool de tareas</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
            </div>
            {children}
          </div>
        );

        // ── State 1: accounts snapshot not ready yet (server still fetching Orbidi auth / accounts-with-brief) ──
        if (briefCrossPending) {
          return previewPanelShell(
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
              <div className="w-5 h-5 border-2 border-[#60259F]/30 border-t-[#60259F] rounded-full animate-spin" />
              <p className="text-sm font-semibold text-foreground">Sincronizando cuentas y briefs…</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {accountsWarming || cacheStatusFetching
                  ? "Cargando perfiles en paralelo desde Orbidi Auth. Suele tardar menos de un minuto; si tarda más, revisa red y ORBIDI_AUTH_API_KEY."
                  : "Conectando con el servidor…"}
              </p>
            </div>
          );
        }

        // ── State 2: tasks query in flight OR brief gate not satisfied — no provisional table ──
        if (previewIsError) {
          return previewPanelShell(
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-sm font-semibold text-foreground">No se pudo cargar el pool</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {(previewQueryError as Error)?.message || "Error de red o del servidor."}
              </p>
              <button
                type="button"
                onClick={() => refetchPreview()}
                className="mt-2 h-8 px-4 rounded-full border border-[#60259F]/30 text-[#60259F] text-xs font-semibold hover:bg-[#60259F]/5"
              >
                Reintentar
              </button>
            </div>
          );
        }

        if (previewTasksPending) {
          return previewPanelShell(
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
              <div className="w-5 h-5 border-2 border-[#60259F]/30 border-t-[#60259F] rounded-full animate-spin" />
              <p className="text-sm font-semibold text-foreground">
                {previewBriefPending ? "Validando briefs de cuenta…" : "Cargando tareas filtradas…"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                No se muestran métricas ni filas hasta tener el dataset final coherente con los filtros.
              </p>
            </div>
          );
        }

        if (previewData?.accounts_empty) {
          return previewPanelShell(
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
              <AlertCircle className="w-8 h-8 text-amber-500" />
              <p className="text-sm font-semibold text-foreground">No hay cuentas sincronizadas</p>
              <p className="text-xs text-muted-foreground max-w-md">
                El servidor terminó la carga pero no obtuvo ninguna cuenta con brief desde Orbidi Auth
                (<code className="text-[10px]">accounts-with-brief</code>). Revisa{" "}
                <code className="text-[10px]">ORBIDI_AUTH_API_KEY</code>,{" "}
                <code className="text-[10px]">ORBIDI_API_BASE</code> y que la lista de cuentas sea la de producción:{" "}
                <code className="text-[10px]">data/orbidi-account-uuids.txt</code> o{" "}
                <code className="text-[10px]">ORBIDI_ACCOUNT_UUIDS*</code> (ver{" "}
                <code className="text-[10px]">data/orbidi-account-uuids.example.txt</code>).
              </p>
            </div>
          );
        }

        // Same ordered dataset the API used for total / unique_clients (no extra client-side pool).
        const poolRows = previewData!.data as any[];

        // ── Partition into available / assigned (mismo dataset) ───────────────
        const availableRows = poolRows.filter((t: any) => !assignedTaskMap.has(t.id));
        const assignedRows  = poolRows.filter((t: any) =>  assignedTaskMap.has(t.id));
        const uniqueClients = previewData!.unique_clients;
        const tabRows       = previewTab === "available" ? availableRows : assignedRows;

        // Active filter labels for header
        const filterLabels = [
          workMode && workMode !== "nuevos" && workMode !== "recurrentes" ? null : workMode,
          filterState ? filterState.replace("TASK_", "").replace(/_/g, " ") : null,
          filterProduct || null,
          filterAction   || null,
        ].filter(Boolean);

        return (
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <ListChecks className="w-3.5 h-3.5 text-[#60259F]/60 shrink-0" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Pool de tareas</p>
                {filterLabels.map((label, i) => (
                  <span key={i} className="text-[9px] font-bold uppercase tracking-widest text-[#60259F] bg-[#60259F]/8 px-2 py-0.5 rounded-full">
                    {label}
                  </span>
                ))}
              </div>
              <button onClick={() => setShowPreview(false)} className="text-[10px] text-muted-foreground hover:text-foreground ml-3 shrink-0">✕</button>
            </div>

            {/* Summary stats — all computed on the same final dataset */}
            <div className="px-5 py-2.5 border-b border-border bg-muted/10 flex items-center gap-5 flex-wrap">
              <div>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mr-1.5">Total</span>
                <span className="text-base font-black text-foreground">{previewData!.total.toLocaleString()}</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <div>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mr-1.5">Clientes únicos</span>
                <span className="text-base font-black text-foreground">{uniqueClients.toLocaleString()}</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mr-1">Sin asignar</span>
                <span className="text-base font-black text-emerald-600">{availableRows.length.toLocaleString()}</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#60259F]" />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mr-1">Ya asignadas</span>
                <span className="text-base font-black text-[#60259F]">{assignedRows.length.toLocaleString()}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-border px-5">
              {(["available", "assigned"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPreviewTab(tab)}
                  className={cn(
                    "py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors",
                    previewTab === tab
                      ? "border-[#60259F] text-[#60259F]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "available" ? "Disponibles" : "Ya asignadas"}
                  <span className={cn(
                    "ml-1.5 inline-flex items-center justify-center rounded-full text-[8px] font-black w-4 h-4",
                    previewTab === tab ? "bg-[#60259F] text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {tab === "available" ? availableRows.length : assignedRows.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Task rows */}
            <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
              {tabRows.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2 text-center px-6">
                  <p className="text-sm font-semibold text-foreground">Sin tareas elegibles</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {filterAction
                      ? workMode === "nuevos"
                        ? `No hay tareas de "${filterAction}" en estado ${filterState || "cualquiera"} con último brief completado en el calendario de ayer (America/Bogota).`
                        : workMode === "recurrentes"
                          ? `No hay tareas de "${filterAction}" en estado ${filterState || "cualquiera"} con UUID de cuenta válido (no exige nombre ni fecha de brief).`
                          : `No hay tareas de "${filterAction}" en estado ${filterState || "cualquiera"} con último brief registrado.`
                      : "No hay tareas disponibles con los filtros activos."}
                  </p>
                </div>
              ) : (
                tabRows.map((t: any) => {
                  const product     = (t.title ?? "").split(" - ")[0]?.trim().toUpperCase() || "";
                  const assignedTo  = assignedTaskMap.get(t.id);
                  const briefDate   = fmtDate(t.last_brief_completed_at);
                  const releaseDate = t.release_date
                    ? new Date(t.release_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
                    : null;
                  return (
                    <div key={t.id} className={cn(
                      "px-5 py-2.5 grid gap-x-4 items-center grid-cols-[auto_1fr_auto_auto_auto]",
                      assignedTo && "bg-[#60259F]/[0.02]"
                    )}>
                      {/* Col 1: product badge */}
                      <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0", PROD_COLOR[product] ?? "bg-slate-100 text-slate-500")}>
                        {product || "—"}
                      </span>

                      {/* Col 2: title + client */}
                      <div className="min-w-0">
                        <p className="text-xs text-foreground font-medium truncate leading-tight">{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground flex-wrap">
                          {t.client_name
                            ? <span className="font-semibold text-foreground/70">{t.client_name}</span>
                            : <span className="font-mono">{(t.client_id ?? "").slice(0, 8)}</span>}
                          {releaseDate && <span>· entrega {releaseDate}</span>}
                          <span className="font-mono opacity-30">{(t.id ?? "").slice(0, 10)}</span>
                        </div>
                      </div>

                      {/* Col 3: brief completed date */}
                      <div className="text-right shrink-0">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold leading-none mb-0.5">Brief</p>
                        {briefDate
                          ? <span className="text-[10px] font-mono text-emerald-600 font-semibold">{briefDate}</span>
                          : <span className="text-[10px] text-amber-500 font-semibold">Sin fecha</span>}
                      </div>

                      {/* Col 4: task state */}
                      <div className="shrink-0">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                          {(t.task_state ?? "").replace("TASK_", "").replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Col 5: assignment status */}
                      <span className={cn(
                        "shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
                        assignedTo ? "bg-[#60259F]/10 text-[#60259F]" : "bg-emerald-50 text-emerald-700"
                      )}>
                        {assignedTo
                          ? "✓ " + assignedTo.split(" ").slice(0, 2).join(" ")
                          : "Sin asignar"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination note */}
            {previewData!.total > previewData!.data.length && (
              <div className="px-5 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground text-center">
                Mostrando {previewData!.data.length.toLocaleString()} de {previewData!.total.toLocaleString()} tareas · añade filtros para acotar
              </div>
            )}
          </div>
        );
      })()}

      {/* Recommendation panel */}
      {showPreview && recommendationData && !recDismissed && (
        <div className="bg-white rounded-2xl border border-[#60259F]/25 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-5 py-3 border-b border-[#60259F]/15 bg-[#60259F]/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#60259F]" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#60259F]">Recomendación de asignación</p>
            </div>
            <button onClick={() => setRecDismissed(true)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">✕</button>
          </div>

          <div className="p-5 space-y-5">
            {/* KPI row */}
            <div className="flex items-stretch gap-3 flex-wrap">
              <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3 min-w-[120px]">
                <ListChecks className="w-4 h-4 text-[#60259F]/60 shrink-0" />
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold leading-none mb-1">Tareas</p>
                  <p className="text-2xl font-black text-foreground leading-none" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{recommendationData.totalTasks}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3 min-w-[140px]">
                <Users className="w-4 h-4 text-[#60259F]/60 shrink-0" />
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold leading-none mb-1">Personas rec.</p>
                  <p className="text-2xl font-black text-foreground leading-none" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{recommendationData.recommendedCount}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">≈ {recommendationData.tasksPerPerson} tasks/persona</p>
                </div>
              </div>

              {/* Product distribution chips */}
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                {Object.entries(recommendationData.productCounts)
                  .filter(([, n]) => n > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <div key={cat} className={cn("flex flex-col items-center px-4 py-2.5 rounded-xl min-w-[56px]", CAT_COLORS[cat] ?? "bg-slate-100 text-slate-600")}>
                      <span className="text-[9px] font-bold uppercase leading-none">{cat}</span>
                      <span className="text-lg font-black leading-tight">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Suggested people grid */}
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-2.5">
                Personas sugeridas · {recPeople.length} seleccionadas
                {recPeople.length !== recommendationData.recommendedCount && (
                  <span className="ml-2 text-amber-600 normal-case">
                    (recomendado: {recommendationData.recommendedCount})
                  </span>
                )}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {recommendationData.allCandidates.map(m => {
                  const ovr = overridesRaw[m.id];
                  const effRoles = (ovr?.roles?.length ?? 0) > 0 ? (ovr!.roles as TeamRole[]) : [m.role];
                  const effAreas = (ovr?.workAreas?.length ?? 0) > 0 ? (ovr!.workAreas as WorkType[]) : [m.trabajo_actual];
                  const isSelected = recPeople.includes(m.id);
                  const rc = roleConfig[effRoles[0]];
                  return (
                    <button
                      key={m.id}
                      onClick={() => setRecPeople(prev =>
                        prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                      )}
                      className={cn(
                        "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all",
                        isSelected
                          ? "border-[#60259F] bg-[#60259F]/5 shadow-sm"
                          : "border-border bg-white hover:border-[#60259F]/30 hover:bg-muted/20"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 transition-colors",
                        isSelected ? "bg-[#60259F] text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {m.person_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-foreground truncate leading-tight">
                          {m.person_name.split(" ").slice(0, 2).join(" ")}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide", rc.bg + " " + rc.color)}>
                            {rc.label}
                          </span>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          <Check className="w-3 h-3 text-[#60259F]" />
                          <span className="text-[8px] font-mono text-[#60259F]">{recommendationData.tasksPerPerson}t</span>
                        </div>
                      ) : (
                        <X className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-border/50">
              <button
                onClick={() => {
                  setSelectedPeople(recPeople);
                  setRecDismissed(true);
                }}
                disabled={recPeople.length === 0}
                className="h-8 px-5 rounded-full bg-[#60259F] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#4a1a7a] disabled:opacity-40 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Aplicar selección · {recPeople.length} personas
              </button>
              <button
                onClick={() => setRecDismissed(true)}
                className="h-8 px-4 rounded-full border border-border text-muted-foreground text-xs hover:bg-muted/30 transition-colors"
              >
                Ignorar
              </button>
              {recommendationData.allCandidates.length < recommendationData.recommendedCount && (
                <span className="text-[10px] text-amber-600 flex items-center gap-1 ml-auto">
                  <Info className="w-3 h-3 shrink-0" />
                  Solo {recommendationData.allCandidates.length} persona{recommendationData.allCandidates.length !== 1 ? "s" : ""} disponibles con perfil matching
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {(error as any)?.message || "Error al ejecutar la asignación"}
        </div>
      )}

      {/* Loading */}
      {isPending && (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground text-sm">
          <div className="w-4 h-4 border-2 border-[#60259F]/30 border-t-[#60259F] rounded-full animate-spin" />
          Cargando tareas y calculando asignación...
        </div>
      )}

      {/* Results */}
      {displayed && !isPending && (
        <>
          {isLastResult && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border rounded-xl px-4 py-2.5">
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              Mostrando la última asignación guardada ({new Date(displayed.generated_at).toLocaleString("es-ES", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}).
              Ajusta los parámetros y pulsa <strong className="mx-0.5">Ejecutar</strong> para generar una nueva.
            </div>
          )}

          {/* Summary cards */}
          {displayed.work_mode === "feedback" && displayed.feedback_metrics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: ListChecks, label: "Tareas feedback",   value: displayed.feedback_metrics.total_tasks,    sub: `${displayed.summary.assigned} asignadas` },
                  { icon: Users,      label: "Clientes únicos",   value: displayed.feedback_metrics.unique_clients, sub: "con PENDING_TO_APPLY_CHANGES" },
                  { icon: AlertCircle,label: "Sin asignar",        value: displayed.summary.unassigned,             sub: "requieren atención" },
                  { icon: Clock,      label: "Días ventana",       value: displayed.days_window,                    sub: `inicio ${displayed.target_date}` },
                ].map(({ icon: Icon, label, value, sub }) => (
                  <div key={label} className="bg-white rounded-2xl border border-border px-5 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-3.5 h-3.5 text-[#60259F]/60" />
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
                    </div>
                    <p className="text-2xl font-black text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-border overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-muted/30">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Por categoría</p>
                  </div>
                  <div className="px-5 divide-y divide-border">
                    {Object.entries(displayed.feedback_metrics.by_category).sort((a,b) => b[1]-a[1]).map(([cat, count]) => {
                      const pct = Math.round((count / displayed.feedback_metrics!.total_tasks) * 100);
                      const colors: Record<string,string> = { SEO:"bg-blue-400", RRSS:"bg-pink-400", WEB:"bg-teal-400", GMB:"bg-amber-400", OTRO:"bg-slate-400" };
                      return (
                        <div key={cat} className="py-3 flex items-center gap-3">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", colors[cat] ?? "bg-slate-400")} />
                          <span className="text-xs font-semibold text-foreground flex-1">{cat}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-[#60259F] rounded-full" style={{ width:`${pct}%` }} />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground w-6 text-right">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-border overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-muted/30">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Por tipo de tarea</p>
                  </div>
                  <div className="px-5 divide-y divide-border max-h-64 overflow-y-auto">
                    {Object.entries(displayed.feedback_metrics.by_product).sort((a,b) => b[1]-a[1]).map(([prod, count]) => {
                      const pct = Math.round((count / displayed.feedback_metrics!.total_tasks) * 100);
                      return (
                        <div key={prod} className="py-2.5 flex items-center gap-3">
                          <span className="text-xs font-medium text-foreground flex-1 truncate">{prod}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-[#60259F]/60 rounded-full" style={{ width:`${pct}%` }} />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground w-6 text-right">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: ListChecks,  label: "Total tareas",    value: displayed.summary.total,            sub: `${displayed.summary.assigned} asignadas` },
                { icon: Users,       label: "Producción",      value: displayed.summary.production_tasks, sub: "state: CREATED / APPROVED" },
                { icon: AlertCircle, label: "Sin asignar",     value: displayed.summary.unassigned,       sub: "requieren atención" },
                { icon: Clock,       label: "Minutos totales", value: displayed.summary.total_min,        sub: `≈ ${Math.round(displayed.summary.total_min / 510 * 10)/10} personas-día` },
              ].map(({ icon: Icon, label, value, sub }) => (
                <div key={label} className="bg-white rounded-2xl border border-border px-5 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5 text-[#60259F]/60" />
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
                  </div>
                  <p className="text-2xl font-black text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Role filter */}
          <div className="flex items-center gap-3 flex-wrap">
            {displayed.work_mode !== "feedback" && (
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className={selectClass}>
                <option value="all">Todos los roles</option>
                <option value="Copy">Copy</option>
                <option value="Designer">Designer</option>
                <option value="Content_Specialist">Content Specialist</option>
                <option value="Analyst_Seo">Analyst SEO</option>
                <option value="Implementador">Implementador</option>
              </select>
            )}
            <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className={selectClass}>
              <option value="all">Todas las áreas</option>
              <option value="feedback">Feedback</option>
              <option value="nuevos">Nuevos</option>
              <option value="recurrentes">Recurrentes</option>
              <option value="tickets">Tickets</option>
            </select>
            <span className="ml-auto text-xs text-muted-foreground font-mono">
              {filteredSchedules.length} personas · generado {new Date(displayed.generated_at).toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" })}
            </span>
          </div>

          {/* Person cards grid */}
          {filteredSchedules.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSchedules.map(s => {
                const ovr = getOverride(s.person_id);
                return (
                  <PersonCard
                    key={s.person_id}
                    schedule={s}
                    overrideRoles={ovr.roles}
                    overrideAreas={ovr.workAreas}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-center py-12 text-muted-foreground text-sm">
              No hay personas con tareas para los filtros seleccionados.
            </p>
          )}

          <UnassignedList tasks={displayed.unassigned} />
        </>
      )}

      {/* Empty state */}
      {!displayed && !isPending && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#60259F]/10 flex items-center justify-center mb-4">
            <CalendarDays className="w-5 h-5 text-[#60259F]" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">Configura y ejecuta la asignación</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Selecciona la fecha de inicio y la ventana de días, luego pulsa "Ejecutar asignación".
          </p>
        </div>
      )}
    </div>
  );
}
