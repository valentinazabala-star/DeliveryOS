import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Clock, Activity, Search, Lock, FileText, ChevronUp, ChevronDown, ChevronsUpDown, X, Circle, Loader, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Task, TaskStatus } from "@/types";
import { ACCOUNT_UUIDS } from "@/data/accountUuids";

/** Fallback until GET /api/account-uuids returns (aligned with server Orbidi list). */
const BAKED_ACCOUNT_UUID_SET = new Set(ACCOUNT_UUIDS.map((u) => u.toLowerCase()));

const statusConfig: Record<TaskStatus, { label: string, color: string, icon: any }> = {
  por_asignar: { label: "Por Asignar", color: "bg-muted text-muted-foreground border-border", icon: Clock },
  ready:       { label: "Ready",       color: "bg-[#60259F]/10 text-[#60259F] border-[#60259F]/20", icon: CheckCircle },
  in_progress: { label: "In Progress", color: "bg-[#60259F]/10 text-[#60259F] border-[#60259F]/30", icon: Activity },
  review:      { label: "Review",      color: "bg-purple-100 text-purple-700 border-purple-200", icon: Activity },
  blocked:     { label: "Blocked",     color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  done:        { label: "Done",        color: "bg-[#BEFF50] text-black border-[#BEFF50]", icon: CheckCircle },
};

const taskStateConfig: Record<string, { label: string; color: string }> = {
  TASK_CREATED:                  { label: "Created",        color: "bg-slate-100 text-slate-600 border-slate-200" },
  TASK_PENDING_TO_START:         { label: "Pending Start",  color: "bg-blue-50 text-blue-600 border-blue-200" },
  TASK_IN_PROGRESS:              { label: "In Progress",    color: "bg-violet-50 text-violet-600 border-violet-200" },
  TASK_PENDING_TO_REVIEW:        { label: "Pending Review", color: "bg-amber-50 text-amber-600 border-amber-200" },
  TASK_PENDING_TO_APPLY_CHANGES: { label: "Apply Changes",  color: "bg-orange-50 text-orange-600 border-orange-200" },
  TASK_IN_REVIEW:                { label: "In Review",      color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  TASK_APPROVED:                 { label: "Approved",       color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  TASK_PENDING_TO_DEPLOY:        { label: "Pending Deploy", color: "bg-cyan-50 text-cyan-600 border-cyan-200" },
  TASK_DEPLOYED:                 { label: "Deployed",       color: "bg-teal-50 text-teal-600 border-teal-200" },
  TASK_DONE:                     { label: "Done",           color: "bg-[#60259F]/10 text-[#60259F] border-[#60259F]/20" },
  TASK_DISCARDED:                { label: "Discarded",      color: "bg-zinc-100 text-zinc-400 border-zinc-200" },
  TASK_WAITING_FOR_DEPENDENCIES: { label: "Waiting Deps",   color: "bg-red-50 text-red-500 border-red-200" },
  TASK_DEPLOY_FAILED:            { label: "Deploy Failed",  color: "bg-red-100 text-red-600 border-red-300" },
};

const productColors: Record<string, string> = {
  SEO:  "bg-blue-50 text-blue-700 border-blue-200",
  RRSS: "bg-pink-50 text-pink-700 border-pink-200",
  GMB:  "bg-amber-50 text-amber-700 border-amber-200",
  WEB:  "bg-teal-50 text-teal-700 border-teal-200",
};

const teamColors: Record<string, string> = {
  production:      "bg-violet-50 text-violet-700 border-violet-200",
  content_factory: "bg-orange-50 text-orange-700 border-orange-200",
  service_delivery:"bg-cyan-50 text-cyan-700 border-cyan-200",
};

type SortKey = "id" | "product" | "title" | "task_state" | "status" | "assigned_team" | "release_date" | "is_blocked" | "task_group" | "created_at";
type SortDir = "asc" | "desc" | null;
type TabId = "all" | "assignable" | "blocked";

const DEFAULT_WIDTHS = [120, 90, 90, 220, 160, 110, 130, 130, 120, 120, 100, 90, 140, 90];
const COL_KEYS: SortKey[] = ["id", "id", "product", "title", "task_group", "task_state", "status", "assigned_team", "release_date", "created_at", "id", "id", "id", "id"];
const COL_LABELS = ["Account UUID", "Task UUID", "Product", "Title", "Task Group", "State", "Status", "Team", "Release Date", "Created At", "Blocks", "Asignable", "Asignado a", "Progreso"];
const SORTABLE = [false, true, true, true, true, true, true, true, true, true, false, false, false, false];
const MIN_WIDTH = 60;

function ResizableHeader({
  label, width, onResize, isLast, sortDir, onSort, sortable,
}: {
  label: string; width: number; onResize: (d: number) => void;
  isLast: boolean; sortDir: SortDir; onSort: () => void; sortable: boolean;
}) {
  const startX = useRef<number | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    const onMove = (ev: MouseEvent) => {
      if (startX.current === null) return;
      onResize(ev.clientX - startX.current);
      startX.current = ev.clientX;
    };
    const onUp = () => {
      startX.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onResize]);

  return (
    <th
      style={{ width, minWidth: MIN_WIDTH }}
      className="relative select-none text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-4 py-3 text-left font-medium border-b border-border"
    >
      <div className="flex items-center gap-1">
        <span className="truncate">{label}</span>
        {sortable && (
          <button onClick={onSort} className="shrink-0 flex flex-col opacity-40 hover:opacity-100 transition-opacity">
            {sortDir === "asc"  ? <ChevronUp className="w-3 h-3 text-[#60259F]" /> :
             sortDir === "desc" ? <ChevronDown className="w-3 h-3 text-[#60259F]" /> :
             <ChevronsUpDown className="w-3 h-3" />}
          </button>
        )}
      </div>
      {!isLast && (
        <div onMouseDown={onMouseDown} className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center group z-10">
          <div className="w-px h-4 bg-border group-hover:bg-[#60259F]/40 transition-colors" />
        </div>
      )}
    </th>
  );
}

function getTaskProduct(title: string) {
  return title?.split(" - ")[0]?.trim().toUpperCase() || "";
}

export function Tasks() {
  const [searchParams] = useSearchParams();
  const [accountUuids, setAccountUuids] = useState(() => searchParams.get("uuid") ?? "");
  const [inputValue, setInputValue] = useState(() => searchParams.get("uuid") ?? "");
  const [loadAll, setLoadAll] = useState(false);
  const [allPage, setAllPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_WIDTHS);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Filters
  const [filterText, setFilterText] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterTeam, setFilterTeam] = useState("");

  const trimmed = accountUuids.trim();

  const { data: serverAccountUuids } = useQuery({
    queryKey: ["orbidi-account-uuids"],
    queryFn: () => api.accountUuids.list(),
    staleTime: Infinity,
    retry: 2,
  });

  const accountUuidSet = useMemo(() => {
    if (serverAccountUuids != null && serverAccountUuids.length > 0) {
      return new Set(serverAccountUuids.map((u) => u.toLowerCase()));
    }
    return BAKED_ACCOUNT_UUID_SET;
  }, [serverAccountUuids]);

  const isTaskUuid = !!trimmed && !trimmed.includes(",") && !accountUuidSet.has(trimmed.toLowerCase());

  const { data: lastAssignment } = useQuery<any | null>({
    queryKey: ["assignment-last"],
    queryFn: () => api.assignment.getLast(),
    retry: false,
    staleTime: 0,
  });

  const { data: serverStatuses = {} } = useQuery<Record<string, any>>({
    queryKey: ["task-statuses"],
    queryFn: () => api.taskStatuses.getAll(),
    retry: false,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // Build a map of task_id → person_name from last assignment
  const assignedMap = useMemo<Record<string, string>>(() => {
    if (!lastAssignment?.schedules) return {};
    const map: Record<string, string> = {};
    for (const sched of lastAssignment.schedules) {
      for (const day of sched.days ?? []) {
        for (const t of day.tasks ?? []) {
          map[t.task_id] = sched.person_name;
        }
      }
    }
    return map;
  }, [lastAssignment]);

  // Reset page when any filter changes in loadAll mode
  useEffect(() => { if (loadAll) setAllPage(1); }, [loadAll, filterState, filterTeam, filterProduct, filterText]);

  // All-tasks paginated query (loadAll mode)
  const { data: allTasksData, isLoading: allLoading, isError: allError } = useQuery({
    queryKey: ["tasks-all", filterState, filterTeam, filterProduct, filterText, allPage],
    queryFn: () => api.tasks.listAll({
      state:   filterState   || undefined,
      team:    filterTeam    || undefined,
      product: filterProduct || undefined,
      search:  filterText    || undefined,
      page:    allPage,
      limit:   20,
    }),
    enabled: loadAll,
    staleTime: 60_000,
  });

  // Per-account query (normal mode)
  const { data: accountTasks = [], isLoading: accountLoading, isError: accountError } = useQuery<Task[]>({
    queryKey: ["tasks", accountUuids, isTaskUuid],
    queryFn: () => isTaskUuid ? api.tasks.getByTaskId(trimmed) : api.tasks.list(accountUuids),
    enabled: !loadAll && !!accountUuids,
  });

  const tasks      = loadAll ? (allTasksData?.data ?? []) : accountTasks;
  const isLoading  = loadAll ? allLoading  : accountLoading;
  const isError    = loadAll ? allError    : accountError;
  const totalPages = loadAll ? (allTasksData?.pages ?? 1) : 1;
  const totalCount = loadAll ? (allTasksData?.total ?? 0) : accountTasks.length;

  // Brief status — solo cuando hay exactamente una cuenta (no task uuid)
  const singleUuid = (!isTaskUuid && !accountUuids.includes(",")) ? trimmed : "";
  const { data: briefStatus } = useQuery({
    queryKey: ["brief-status", singleUuid],
    queryFn: () => api.briefStatus.get(singleUuid),
    enabled: !!singleUuid,
  });

  const handleSearch = () => { setLoadAll(false); setAccountUuids(inputValue.trim()); };
  const handleLoadAll = () => { setInputValue(""); setAccountUuids(""); setLoadAll(true); };

  const handleResize = useCallback((index: number, delta: number) => {
    setColWidths((prev) => {
      const next = [...prev];
      next[index] = Math.max(MIN_WIDTH, next[index] + delta);
      return next;
    });
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortKey(null); setSortDir(null); }
  };

  const products = ["SEO", "RRSS", "GMB", "WEB"];

  // Enrich each task with computed flags once
  const enrichedTasks = useMemo(() => tasks.map(task => {
    const product = getTaskProduct(task.title);
    const isSeoTask = product === "SEO";
    const briefOkForWeb = singleUuid ? (briefStatus?.has_brief ?? false) : false;
    const hasWebsite = singleUuid ? (briefStatus?.has_website ?? true) : true;
    const isSinWeb = isSeoTask && briefOkForWeb && !hasWebsite;
    const briefOk = singleUuid ? (briefStatus?.has_brief ?? false) : true;
    const isAssignable = briefOk && !task.is_blocked && !isSinWeb && task.task_state === "TASK_CREATED";
    const hasBlock = isSinWeb || task.is_blocked;
    return { ...task, _product: product, _isSinWeb: isSinWeb, _isAssignable: isAssignable, _hasBlock: hasBlock };
  }), [tasks, singleUuid, briefStatus]);

  const processedTasks = useMemo(() => {
    let result = [...enrichedTasks];

    // In loadAll mode all filters (including text) are applied server-side
    if (!loadAll) {
      if (filterText) {
        const q = filterText.toLowerCase();
        result = result.filter(t => t.title?.toLowerCase().includes(q) || t.id?.toLowerCase().includes(q) || t.clickup_id?.toLowerCase().includes(q));
      }
      if (filterProduct) result = result.filter(t => t._product === filterProduct);
      if (filterState)   result = result.filter(t => t.task_state === filterState);
      if (filterTeam)    result = result.filter(t => t.assigned_team === filterTeam);
    }

    // Tab filter
    if (activeTab === "assignable") result = result.filter(t => t._isAssignable);
    if (activeTab === "blocked")    result = result.filter(t => t._hasBlock);

    if (sortKey && sortDir) {
      result.sort((a, b) => {
        let av: any, bv: any;
        if (sortKey === "product") { av = a._product; bv = b._product; }
        else if (sortKey === "release_date") { av = a.release_date || ""; bv = b.release_date || ""; }
        else if (sortKey === "is_blocked") { av = a.is_blocked ? 1 : 0; bv = b.is_blocked ? 1 : 0; }
        else { av = (a as any)[sortKey] || ""; bv = (b as any)[sortKey] || ""; }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [enrichedTasks, filterText, filterProduct, filterState, filterTeam, activeTab, sortKey, sortDir]);

  const tabCounts = useMemo(() => ({
    all:        enrichedTasks.length,
    assignable: enrichedTasks.filter(t => t._isAssignable).length,
    blocked:    enrichedTasks.filter(t => t._hasBlock).length,
  }), [enrichedTasks]);

  const hasFilters = filterText || filterProduct || filterState || filterTeam;

  return (
    <div className="p-8 space-y-6 bg-background min-h-screen text-foreground">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#60259F] mb-1">Gestión de tareas</p>
        <h2 className="text-2xl font-black tracking-tight text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif", letterSpacing: "-0.03em" }}>Tasks & Deliverables</h2>
        <p className="text-muted-foreground text-sm mt-1.5">Manage operational flow and output.</p>
      </header>

      {/* Search UUID */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleSearch()}
            placeholder="Account UUID o Task UUID..."
            className="w-full bg-white border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#60259F]/40"
          />
        </div>
        <Button onClick={handleSearch} className="bg-[#BEFF50] hover:bg-[#BEFF50]/90 text-black font-bold gap-2">
          <Search className="w-4 h-4" /> Load Tasks
        </Button>
        <Button onClick={handleLoadAll} variant="outline" className="font-semibold gap-2 text-muted-foreground">
          Load all tasks
        </Button>
      </div>


      {/* Brief banner — solo cuenta única */}
      {singleUuid && briefStatus && (
        <div className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border text-sm",
          briefStatus.has_brief ? "bg-[#60259F]/5 border-[#60259F]/20 text-[#60259F]" : "bg-red-50 border-red-200 text-red-600"
        )}>
          {briefStatus.has_brief ? <FileText className="w-4 h-4 shrink-0" /> : <Lock className="w-4 h-4 shrink-0" />}
          {briefStatus.has_brief
            ? <>Brief diligenciado — tareas asignables <span className="font-mono text-xs opacity-50 ml-1">({briefStatus.filled_fields}/{briefStatus.total_fields} campos)</span></>
            : <>Brief sin diligenciar — las tareas <strong>no son asignables</strong> <span className="font-mono text-xs opacity-50 ml-1">({briefStatus.filled_fields}/{briefStatus.total_fields} campos)</span></>
          }
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-border rounded-xl p-1 w-fit">
        {([
          { id: "all" as TabId,        label: "Todas",          color: "" },
          { id: "assignable" as TabId, label: "Asignables",     color: "text-[#60259F]" },
          { id: "blocked" as TabId,    label: "Con bloqueos",   color: "text-amber-600" },
        ]).map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              activeTab === id
                ? "bg-[#0d0d0d] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            {label}
            <span className={cn(
              "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
              activeTab === id ? "bg-white/20 text-white" : cn("bg-muted", color || "text-muted-foreground")
            )}>
              {tasks.length > 0 ? tabCounts[id] : "—"}
            </span>
          </button>
        ))}
      </div>

      {/* Filters — always visible */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Buscar..."
            className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#60259F]/40 w-44"
          />
        </div>

        <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
          className="px-3 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#60259F]/40 text-muted-foreground">
          <option value="">Todos los productos</option>
          {products.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={filterState} onChange={e => setFilterState(e.target.value)}
          className="px-3 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#60259F]/40 text-muted-foreground">
          <option value="">Todos los estados</option>
          {Object.entries(taskStateConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
          className="px-3 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#60259F]/40 text-muted-foreground">
          <option value="">Todos los equipos</option>
          <option value="production">Production</option>
          <option value="content_factory">Content Factory</option>
          <option value="service_delivery">Service Delivery</option>
        </select>

        {hasFilters && (
          <button onClick={() => { setFilterText(""); setFilterProduct(""); setFilterState(""); setFilterTeam(""); }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
        {(tasks.length > 0 || totalCount > 0) && (
          <span className="text-xs text-muted-foreground ml-auto font-mono">
            {loadAll
              ? `${totalCount} tareas · pág. ${allPage}/${totalPages}`
              : `${processedTasks.length} / ${tasks.length} tareas`}
          </span>
        )}
      </div>

      {!loadAll && !accountUuids && <div className="text-center py-20 text-muted-foreground text-sm">Ingresa un Account UUID o haz clic en <strong>Load all tasks</strong> para ver todas las tareas.</div>}
      {isLoading && <div className="text-center py-20 text-muted-foreground text-sm font-mono animate-pulse">Loading tasks...</div>}
      {isError && <div className="text-center py-20 text-red-500 text-sm">Error fetching tasks. Check the account UUID or API key.</div>}

      {(accountUuids || loadAll) && !isLoading && !isError && (
        <>
          {/* Table */}
          <div className="border border-border rounded-lg bg-white shadow-sm overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead className="bg-muted/40">
                <tr>
                  {COL_LABELS.map((label, i) => (
                    <ResizableHeader
                      key={label}
                      label={label}
                      width={colWidths[i]}
                      onResize={(delta) => handleResize(i, delta)}
                      isLast={i === COL_LABELS.length - 1}
                      sortable={SORTABLE[i]}
                      sortDir={sortKey === COL_KEYS[i] && SORTABLE[i] ? sortDir : null}
                      onSort={() => SORTABLE[i] && handleSort(COL_KEYS[i])}
                    />
                  ))}
                </tr>
              </thead>
              <TableBody>
                {processedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-muted-foreground text-sm">
                      No hay tareas que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  processedTasks.map((task) => {
                    const status = statusConfig[task.status] || statusConfig.por_asignar;
                    const stateConfig = task.task_state ? (taskStateConfig[task.task_state] ?? { label: task.task_state, color: "bg-slate-100 text-slate-600 border-slate-200" }) : null;
                    const product = task._product;
                    const productColor = productColors[product] ?? "bg-slate-100 text-slate-500 border-slate-200";
                    const releaseDate = task.release_date
                      ? new Date(task.release_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
                      : "-";
                    const isSinWeb = task._isSinWeb;
                    const isAssignable = task._isAssignable;

                    return (
                      <TableRow key={task.id} className="border-border hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-[10px] overflow-hidden">
                          <Link to={`/clients/${task.client_id}`} className="block truncate text-[#60259F] hover:underline transition-colors" title={task.client_id}>{task.client_id}</Link>
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground overflow-hidden">
                          <span className="block truncate" title={task.id}>{task.id}</span>
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <Badge className={cn("text-[10px] font-mono uppercase border", productColor)}>
                            {product || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm overflow-hidden">
                          <span title={task.title} className="block truncate">{task.title}</span>
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <span className="block truncate text-xs text-foreground" title={task.task_group || ""}>{task.task_group || "—"}</span>
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          {stateConfig ? (
                            <Badge className={cn("text-[10px] font-mono uppercase border", stateConfig.color)}>
                              {stateConfig.label}
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <Badge className={cn("text-[10px] font-mono uppercase gap-1.5", status.color)}>
                            <status.icon className="w-3 h-3 shrink-0" />
                            <span className="truncate">{status.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          {task.assigned_team ? (
                            <Badge className={cn("text-[10px] font-mono uppercase border", teamColors[task.assigned_team] ?? "bg-slate-100 text-slate-500 border-slate-200")}>
                              {task.assigned_team.replace(/_/g, " ")}
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <span className="block truncate text-xs font-mono text-muted-foreground">{releaseDate}</span>
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <span className="block truncate text-xs font-mono text-muted-foreground">
                            {task.created_at ? new Date(task.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          {isSinWeb
                            ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Sin web</span>
                            : <span className="text-xs text-muted-foreground">—</span>
                          }
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          {isAssignable ? <CheckCircle className="w-4 h-4 text-[#60259F]" /> : <Lock className="w-4 h-4 text-muted-foreground/30" />}
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          {assignedMap[task.id]
                            ? <span className="block truncate text-xs font-medium text-[#60259F]">{assignedMap[task.id]}</span>
                            : <span className="text-xs text-muted-foreground/40">—</span>
                          }
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          {(() => {
                            const s = serverStatuses[task.id]?.status;
                            if (!s || s === "pending") return <Circle className="w-3.5 h-3.5 text-muted-foreground/30" />;
                            if (s === "in_progress") return <Loader className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: "3s" }} />;
                            return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
                          })()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </table>
          </div>

          {/* Pagination — only in loadAll mode */}
          {loadAll && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button
                disabled={allPage <= 1}
                onClick={() => setAllPage(p => p - 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border bg-white hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >← Anterior</button>

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = totalPages <= 7 ? i + 1
                  : allPage <= 4 ? i + 1
                  : allPage >= totalPages - 3 ? totalPages - 6 + i
                  : allPage - 3 + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setAllPage(pg)}
                    className={cn(
                      "w-8 h-8 text-xs rounded-lg border transition-colors",
                      pg === allPage
                        ? "bg-[#60259F] text-white border-[#60259F]"
                        : "bg-white border-border hover:bg-muted/50 text-muted-foreground"
                    )}
                  >{pg}</button>
                );
              })}

              <button
                disabled={allPage >= totalPages}
                onClick={() => setAllPage(p => p + 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border bg-white hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >Siguiente →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
