import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  CalendarDays, ListChecks, Users, AlertCircle,
  ChevronDown, ChevronRight, RefreshCw, Copy, Check,
  ExternalLink, FileText, Circle, Loader, CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef, useDeferredValue } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { roleConfig, workConfig } from "@/data/teamData";
import type { PersonSchedule, AssignedTask } from "@/data/assignmentEngine";
import { orbidiAccountBriefUrl, orbidiTaskAdminChangeUrl } from "@/lib/orbidiConsoleUrls";
import { Onboarding, useOnboarding } from "@/components/Onboarding";
import { ChatAssistant } from "@/components/ChatAssistant";
import { DayNotifications } from "@/components/DayNotifications";

// ── URL builders ──────────────────────────────────────────────────────────────
const briefUrl = (accountUuid: string) => orbidiAccountBriefUrl(accountUuid);

const taskUrl = (taskId: string) => orbidiTaskAdminChangeUrl(taskId);

// ── Task status types ─────────────────────────────────────────────────────────
type TaskStatus = "pending" | "in_progress" | "done";

interface TaskMeta {
  status:    TaskStatus;
  closedAt:  string | null; // ISO string when marked done
  /** Last change time — used so server polling does not overwrite newer local state */
  updatedAt?: string;
}

type StatusStore = Record<string, TaskMeta>; // key: task_id

const NEXT: Record<TaskStatus, TaskStatus> = {
  pending:     "in_progress",
  in_progress: "done",
  done:        "pending",
};

// ── Persist status store per user ─────────────────────────────────────────────
function loadStore(userId: string): StatusStore {
  try {
    const raw = JSON.parse(localStorage.getItem(`task_status_${userId}`) ?? "{}") as StatusStore;
    const boot = new Date().toISOString();
    const out: StatusStore = { ...raw };
    for (const k of Object.keys(out)) {
      const m = out[k];
      if (m && !m.updatedAt && m.status !== "pending") {
        out[k] = { ...m, updatedAt: boot };
      }
    }
    return out;
  } catch { return {}; }
}
function saveStore(userId: string, store: StatusStore) {
  localStorage.setItem(`task_status_${userId}`, JSON.stringify(store));
}

// ── Status icon button ────────────────────────────────────────────────────────
function StatusBtn({
  taskId, store, onToggle,
}: { taskId: string; store: StatusStore; onToggle: (id: string) => void }) {
  const meta   = store[taskId] ?? { status: "pending", closedAt: null };
  const status = meta.status;

  const cfg = {
    pending:     { icon: Circle,       cls: "text-muted-foreground/40 hover:text-slate-500", title: "Pendiente — click para iniciar" },
    in_progress: { icon: Loader,       cls: "text-amber-500 hover:text-amber-600",           title: "En progreso — click para completar" },
    done:        { icon: CheckCircle2, cls: "text-green-500 hover:text-green-600",           title: "Completado — click para reabrir" },
  }[status];

  return (
    <button
      onClick={() => onToggle(taskId)}
      title={cfg.title}
      className={cn("transition-colors shrink-0", cfg.cls)}
    >
      <cfg.icon className={cn("w-4 h-4", status === "in_progress" && "animate-spin")} style={status === "in_progress" ? { animationDuration: "3s" } : {}} />
    </button>
  );
}

// ── Heat alert: last closed task ─────────────────────────────────────────────
function HeatAlert({ lastClosedAt }: { lastClosedAt: string | null }) {
  if (!lastClosedAt) return null;

  const diffMs  = Date.now() - new Date(lastClosedAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH   = Math.floor(diffMin / 60);

  let label: string;
  let cls: string;

  if (diffMin < 60) {
    label = `Última tarea cerrada hace ${diffMin < 1 ? "menos de 1" : diffMin} min`;
    cls   = "bg-green-50 border-green-200 text-green-700";
  } else if (diffH < 4) {
    label = `Última tarea cerrada hace ${diffH}h ${diffMin % 60}min`;
    cls   = "bg-lime-50 border-lime-200 text-lime-700";
  } else if (diffH < 8) {
    label = `Última tarea cerrada hace ${diffH}h`;
    cls   = "bg-yellow-50 border-yellow-200 text-yellow-700";
  } else if (diffH < 24) {
    label = `Última tarea cerrada hace ${diffH}h — recuerda actualizar tu progreso`;
    cls   = "bg-orange-50 border-orange-200 text-orange-700";
  } else {
    const days = Math.floor(diffH / 24);
    label = `Sin tareas cerradas en ${days} día${days > 1 ? "s" : ""} — ¿todo bien?`;
    cls   = "bg-red-50 border-red-200 text-red-700";
  }

  return (
    <div className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold", cls)}>
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      {label}
      <span className="ml-auto font-mono font-normal text-[10px] opacity-60">
        {new Date(lastClosedAt).toLocaleString("es-ES", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
      </span>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  return (
    <button
      onClick={handle}
      title="Copiar UUID completo"
      className="p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Category badge ────────────────────────────────────────────────────────────
function CatBadge({ cat }: { cat: string }) {
  const map: Record<string, string> = {
    SEO:  "bg-blue-100 text-blue-700",
    RRSS: "bg-pink-100 text-pink-700",
    WEB:  "bg-teal-100 text-teal-700",
    GMB:  "bg-amber-100 text-amber-700",
  };
  return (
    <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded whitespace-nowrap shrink-0", map[cat] ?? "bg-slate-100 text-slate-600")}>
      {cat}
    </span>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden animate-pulse">
      <div className="px-5 py-4 bg-muted/20 border-b border-border flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-muted rounded w-40" />
          <div className="h-2.5 bg-muted/60 rounded w-24" />
        </div>
        <div className="h-7 w-16 bg-muted rounded-full" />
      </div>
      <div className="divide-y divide-border/30">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-5 py-3 flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-muted shrink-0" />
            <div className="w-4 h-4 rounded-full bg-muted shrink-0" />
            <div className="flex-1 h-3 bg-muted rounded" />
            <div className="w-20 h-2.5 bg-muted/60 rounded" />
            <div className="w-14 h-2.5 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentSkeleton() {
  return (
    <div className="p-8 space-y-6 bg-background min-h-screen">
      {/* Header skeleton */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-7 w-48 bg-muted rounded animate-pulse" />
          <div className="h-3 w-64 bg-muted/60 rounded animate-pulse" />
        </div>
      </div>
      {/* KPI skeleton */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-border px-4 py-4 animate-pulse">
            <div className="h-2.5 w-12 bg-muted rounded mb-3" />
            <div className="h-7 w-10 bg-muted rounded mb-1" />
            <div className="h-2 w-8 bg-muted/60 rounded" />
          </div>
        ))}
      </div>
      {/* Card skeletons */}
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface TaskWithDate extends AssignedTask { date: string; }
interface ClientGroup { account_uuid: string; client_name: string; tasks: TaskWithDate[]; }

// ── Client group card ─────────────────────────────────────────────────────────
function ClientCard({
  group, store, onToggle,
}: { group: ClientGroup; store: StatusStore; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(true);

  const feedbackCount   = group.tasks.filter(t => t.is_feedback).length;
  const productionCount = group.tasks.filter(t => !t.is_feedback).length;

  return (
    <div className="rounded-2xl border border-border bg-white overflow-hidden">

      {/* Client header */}
      <div className="px-5 py-4 bg-muted/20 border-b border-border flex items-start gap-4">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-9 h-9 rounded-xl bg-[#60259F]/10 flex items-center justify-center shrink-0 hover:bg-[#60259F]/20 transition-colors mt-0.5"
        >
          {open
            ? <ChevronDown className="w-4 h-4 text-[#60259F]" />
            : <ChevronRight className="w-4 h-4 text-[#60259F]" />
          }
        </button>

        <div className="flex-1 min-w-0">
          <Link
            to={`/clients/${group.account_uuid}`}
            className="text-sm font-black text-foreground hover:text-[#60259F] transition-colors inline-flex items-center gap-1.5 group/name"
          >
            {group.client_name}
            <ExternalLink className="w-3 h-3 opacity-0 group-hover/name:opacity-50 transition-opacity" />
          </Link>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {productionCount > 0 && <span className="text-[10px] text-muted-foreground font-mono">{productionCount} producción</span>}
            {feedbackCount   > 0 && <span className="text-[10px] text-purple-600 font-mono">{feedbackCount} feedback</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={briefUrl(group.account_uuid)}
            target="_blank" rel="noopener noreferrer"
            title="Abrir brief"
            className="flex items-center gap-1.5 h-7 px-3 rounded-full border border-border text-[10px] font-semibold text-muted-foreground hover:text-[#60259F] hover:border-[#60259F]/40 transition-all"
          >
            <FileText className="w-3 h-3" /> Brief
          </a>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground/60 bg-muted px-2 py-1 rounded-lg">
            <span title={group.account_uuid}>{group.account_uuid.slice(0, 8)}…</span>
            <CopyBtn value={group.account_uuid} />
          </span>
        </div>
      </div>

      {/* Task table */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border/60">
                <th className="pl-5 pr-2 py-2 w-5" />
                <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[36px]">Estado</th>
                <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Tarea</th>
                <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[130px]">Día asignado</th>
                <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[110px]">Task UUID</th>
                <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[70px]">Tipo</th>
                <th className="px-3 py-2 pr-5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[150px]">Fecha cierre</th>
              </tr>
            </thead>
            <tbody>
              {group.tasks.map((t) => {
                const meta     = store[t.task_id] ?? { status: "pending", closedAt: null };
                const isDone   = meta.status === "done";
                return (
                  <tr
                    key={t.task_id + t.date}
                    className={cn(
                      "border-b border-border/30 last:border-0 transition-colors",
                      isDone ? "bg-green-50/40" : "hover:bg-muted/20"
                    )}
                  >
                    {/* dot */}
                    <td className="pl-5 pr-2 py-2.5 w-5">
                      <span className={cn("block w-2 h-2 rounded-full mt-0.5", t.is_feedback ? "bg-purple-400" : "bg-[#60259F]/40")} />
                    </td>

                    {/* Status icon */}
                    <td className="px-3 py-2.5 w-[36px]">
                      <StatusBtn taskId={t.task_id} store={store} onToggle={onToggle} />
                    </td>

                    {/* Task name */}
                    <td className="px-3 py-2.5">
                      <p className={cn("text-xs font-semibold leading-tight", isDone ? "line-through text-muted-foreground" : "text-foreground")}>
                        {t.task_title}
                      </p>
                      {t.product_name && t.product_name !== t.task_title && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{t.product_name}</p>
                      )}
                    </td>

                    {/* Day */}
                    <td className="px-3 py-2.5 w-[130px]">
                      <span className="text-[10px] text-muted-foreground font-mono capitalize">
                        {new Date(t.date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })}
                      </span>
                    </td>

                    {/* Task UUID */}
                    <td className="px-3 py-2.5 w-[110px]">
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                        <a href={taskUrl(t.task_id)} target="_blank" rel="noopener noreferrer"
                           className="hover:text-[#60259F] hover:underline underline-offset-2 transition-colors"
                           title={t.task_id}>
                          {t.task_id.slice(0, 8)}…
                        </a>
                        <CopyBtn value={t.task_id} />
                        <a href={taskUrl(t.task_id)} target="_blank" rel="noopener noreferrer" title="Abrir en prodline">
                          <ExternalLink className="w-3 h-3 text-muted-foreground/40 hover:text-[#60259F] transition-colors" />
                        </a>
                      </span>
                    </td>

                    {/* Category */}
                    <td className="px-3 py-2.5 w-[70px]">
                      {t.product_category
                        ? <CatBadge cat={t.product_category} />
                        : <span className="text-muted-foreground/30 text-[10px]">—</span>
                      }
                    </td>

                    {/* Closed at */}
                    <td className="px-3 py-2.5 pr-5 w-[150px]">
                      {meta.closedAt ? (
                        <span className="text-[10px] font-mono text-green-600">
                          {new Date(meta.closedAt).toLocaleString("es-ES", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/30">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function MyAssignments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: lastAssignment, isLoading, refetch } = useQuery<any | null>({
    queryKey:             ["assignment-last"],
    queryFn:              () => api.assignment.getLast(),
    retry:                false,
    staleTime:            Infinity,        // data only changes via manual assignment run
    refetchOnWindowFocus: false,
    placeholderData:      keepPreviousData, // never clear data on refetch/error → no re-spinner
  });

  // Fetch server-side statuses and sync into local store
  const { data: serverStatuses } = useQuery<Record<string, any>>({
    queryKey: ["task-statuses"],
    queryFn:  () => api.taskStatuses.getAll(),
    retry:    false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // ── Status store (persisted per user) ─────────────────────────────────────
  const [store, setStore] = useState<StatusStore>(() =>
    user ? loadStore(user.id) : {}
  );

  // Merge server statuses into local store when they arrive
  useEffect(() => {
    if (!serverStatuses || !user) return;
    setStore(prev => {
      const merged = { ...prev };
      for (const [taskId, entry] of Object.entries(serverStatuses)) {
        if (entry.userId !== user.id) continue; // only own tasks
        const local = prev[taskId];
        const serverTs = new Date(entry.updatedAt).getTime();
        const localTs  = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;
        if (!local || serverTs > localTs) {
          merged[taskId] = {
            status: entry.status as TaskStatus,
            closedAt: entry.closedAt,
            updatedAt: entry.updatedAt,
          };
        }
      }
      saveStore(user.id, merged);
      return merged;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverStatuses, user?.id]);

  // person_id in the assignment JSON may be a number (e.g. 4) while user.id is always
  // a string (e.g. "4") — use String() coercion so both match; fall back to name match
  // in case the assignment was generated before ids were standardized.
  const mySchedule: PersonSchedule | null =
    lastAssignment?.schedules?.find(
      (s: any) =>
        String(s.person_id) === String(user?.id) ||
        s.person_name === user?.name
    ) ?? null;

  // Boot sync: push existing localStorage statuses to server once on mount
  // so the PM can see them even after a server restart.
  // useRef prevents double-execution in React 19 StrictMode.
  const bootSyncRan = useRef(false);
  useEffect(() => {
    if (!user || bootSyncRan.current) return;
    bootSyncRan.current = true;
    let cancelled = false;
    const localStore = loadStore(user.id);
    const toSync = Object.entries(localStore).filter(([, meta]) => meta.status !== "pending");
    if (toSync.length === 0) return;
    Promise.all(
      toSync.map(([taskId, meta]) =>
        api.taskStatuses.set(user.id, taskId, meta.status, meta.closedAt).catch(() => {})
      )
    ).then(() => {
      if (!cancelled) queryClient.invalidateQueries({ queryKey: ["task-statuses"] });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleToggle = useCallback((taskId: string) => {
    if (!user) return;
    setStore(prev => {
      const current  = prev[taskId] ?? { status: "pending" as TaskStatus, closedAt: null };
      const next     = NEXT[current.status];
      const closedAt = next === "done" ? new Date().toISOString() : null;
      const updatedAt = new Date().toISOString();
      const updated: StatusStore = {
        ...prev,
        [taskId]: { status: next, closedAt, updatedAt },
      };
      saveStore(user.id, updated);
      // Sync to server so PM can see it, then invalidate cache
      api.taskStatuses.set(user.id, taskId, next, closedAt)
        .then(() => queryClient.invalidateQueries({ queryKey: ["task-statuses"] }))
        .catch(() => {
          // Local state already updated; server sync failed — will retry on next boot sync
          console.warn("[MyAssignments] Server sync failed for task", taskId);
        });
      return updated;
    });
  }, [user, queryClient]);

  const teamMember = user?.teamMember;
  const rc         = teamMember ? roleConfig[teamMember.role]           : null;
  const wc         = teamMember ? workConfig[teamMember.trabajo_actual] : null;

  // ── Onboarding ─────────────────────────────────────────────────────────────
  const { open: onboardingOpen, openOnboarding, closeOnboarding } = useOnboarding(user?.id);

  // Defer heavy task-list rendering so KPIs and header appear immediately
  const deferredSchedule = useDeferredValue(mySchedule);
  const isRenderingTasks = mySchedule !== deferredSchedule;

  // ── Group all tasks by client ─────────────────────────────────────────────
  const clientGroups: ClientGroup[] = (() => {
    if (!deferredSchedule) return [];
    const map = new Map<string, ClientGroup>();
    for (const day of deferredSchedule.days) {
      for (const t of day.tasks) {
        if (!map.has(t.account_uuid)) {
          map.set(t.account_uuid, { account_uuid: t.account_uuid, client_name: t.client_name, tasks: [] });
        }
        map.get(t.account_uuid)!.tasks.push({ ...t, date: day.date });
      }
    }
    return [...map.values()].sort((a, b) => a.client_name.localeCompare(b.client_name));
  })();

  // ── Status counts across all tasks ────────────────────────────────────────
  const allTaskIds = clientGroups.flatMap(g => g.tasks.map(t => t.task_id));
  const counts = allTaskIds.reduce(
    (acc, id) => {
      const s = (store[id]?.status ?? "pending") as TaskStatus;
      acc[s]++;
      return acc;
    },
    { pending: 0, in_progress: 0, done: 0 } as Record<TaskStatus, number>
  );

  // ── Last closed timestamp ─────────────────────────────────────────────────
  const lastClosedAt = Object.values(store)
    .map(m => m.closedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  const totalTasks = mySchedule?.total_tasks ?? 0;

  // Count tasks per product category (SEO/RRSS/WEB/GMB)
  const allTasks = clientGroups.flatMap(g => g.tasks);
  const catCount = (cat: string) =>
    allTasks.filter(t => t.product_category === cat).length;

  const categoryCards = [
    { label: "RRSS", count: catCount("RRSS"), color: "text-pink-600",  bg: "bg-pink-50",  dot: "bg-pink-400" },
    { label: "SEO",  count: catCount("SEO"),  color: "text-blue-600",  bg: "bg-blue-50",  dot: "bg-blue-400" },
    { label: "WEB",  count: catCount("WEB"),  color: "text-teal-600",  bg: "bg-teal-50",  dot: "bg-teal-400" },
    { label: "GMB",  count: catCount("GMB"),  color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-400" },
  ];

  // Show full-page skeleton only on the very first load (no data at all yet)
  if (isLoading) return <AssignmentSkeleton />;

  return (
    <div className="p-8 space-y-6 bg-background min-h-screen">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#60259F] mb-1">Producción</p>
          <h2 className="text-2xl font-black tracking-tight text-foreground"
              style={{ fontFamily: "'Cal Sans', sans-serif", letterSpacing: "-0.03em" }}>
            Mis Asignaciones
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5">
            Tus tareas del período asignado por el equipo de management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastAssignment && (
            <>
              <span className="text-[10px] font-mono text-muted-foreground">
                Generado {new Date(lastAssignment.generated_at).toLocaleString("es-ES", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
              </span>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </button>
            </>
          )}
          <button
            onClick={openOnboarding}
            title="Ver tutorial del sistema"
            className="w-8 h-8 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* No assignment */}
      {!lastAssignment && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#60259F]/10 flex items-center justify-center mb-4">
            <CalendarDays className="w-5 h-5 text-[#60259F]" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">Sin asignación disponible</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            El equipo de management aún no ha ejecutado la asignación. Consulta con tu PM.
          </p>
        </div>
      )}

      {/* Assignment exists but user not in it */}
      {lastAssignment && !mySchedule && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No apareces en esta asignación</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Puede ser que tu rol no corresponda al modo de trabajo
            (<span className="font-semibold">{lastAssignment.work_mode}</span>) o estés en vacaciones. Habla con tu PM.
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-3 font-mono">
            Último run: {lastAssignment.work_mode} · {lastAssignment.target_date}
          </p>
        </div>
      )}

      {/* Has schedule */}
      {mySchedule && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {/* Total + Clientes */}
            {[
              { icon: ListChecks, label: "Total",    value: totalTasks,          sub: "tareas" },
              { icon: Users,      label: "Clientes", value: clientGroups.length, sub: "distintos" },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="bg-white rounded-2xl border border-border px-4 py-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3 h-3 text-[#60259F]/60" />
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
                </div>
                <p className="text-2xl font-black text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
            {/* Category cards */}
            {categoryCards.map(({ label, count, color, bg, dot }) => (
              <div key={label} className={cn("rounded-2xl border border-border px-4 py-4", count > 0 ? bg : "bg-white")}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", count > 0 ? dot : "bg-muted-foreground/20")} />
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
                </div>
                <p className={cn("text-2xl font-black", count > 0 ? color : "text-muted-foreground/30")}
                   style={{ fontFamily: "'Cal Sans', sans-serif" }}>{count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">tareas</p>
              </div>
            ))}
          </div>

          {/* Progress panel */}
          <div className="bg-white rounded-2xl border border-border px-5 py-4 space-y-3">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Progreso de tareas</p>

            {/* Counts row */}
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: "pending"    as TaskStatus, icon: Circle,       label: "Pendiente",   cls: "text-slate-400", bg: "bg-slate-50  border-slate-200" },
                { key: "in_progress"as TaskStatus, icon: Loader,       label: "En progreso", cls: "text-amber-500", bg: "bg-amber-50  border-amber-200" },
                { key: "done"       as TaskStatus, icon: CheckCircle2, label: "Completada",  cls: "text-green-500", bg: "bg-green-50  border-green-200" },
              ] as const).map(({ key, icon: Icon, label, cls, bg }) => (
                <div key={key} className={cn("rounded-xl border px-4 py-3 flex items-center gap-3", bg)}>
                  <Icon className={cn("w-5 h-5 shrink-0", cls)} />
                  <div>
                    <p className="text-xl font-black text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{counts[key]}</p>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {totalTasks > 0 && (
              <div className="flex rounded-full overflow-hidden h-2 bg-muted gap-px">
                <div className="bg-green-400 transition-all" style={{ width: `${(counts.done / totalTasks) * 100}%` }} />
                <div className="bg-amber-400 transition-all" style={{ width: `${(counts.in_progress / totalTasks) * 100}%` }} />
              </div>
            )}

            {/* Heat alert */}
            <HeatAlert lastClosedAt={lastClosedAt} />
          </div>

          {/* Profile strip */}
          {teamMember && rc && wc && (
            <div className="bg-white rounded-2xl border border-border px-5 py-3.5 flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-[#60259F] flex items-center justify-center text-white text-sm font-black shrink-0">
                {user!.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{user!.name}</p>
                <p className="text-[10px] text-muted-foreground">{user!.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded border", rc.bg, rc.color)}>{rc.label}</span>
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border", wc.color)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", wc.dot)} />{wc.label}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {teamMember.daily_capacity_min} min/día
                </span>
              </div>
            </div>
          )}

          {/* Period label */}
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Período:{" "}
              {new Date(lastAssignment.target_date + "T12:00:00").toLocaleDateString("es-ES", { day:"2-digit", month:"long" })}
              {" — "}
              {new Date(mySchedule.days[mySchedule.days.length - 1]?.date + "T12:00:00").toLocaleDateString("es-ES", { day:"2-digit", month:"long", year:"numeric" })}
            </p>
            <div className="flex-1 h-px bg-border" />
            <p className="text-[10px] font-mono text-muted-foreground">
              Modo: <span className="text-foreground font-semibold">{lastAssignment.work_mode}</span>
              {" · "}<span className="text-foreground font-semibold">{clientGroups.length}</span> clientes
            </p>
          </div>

          {/* Client groups — deferred so KPIs render first, then tasks appear */}
          <div className={cn("space-y-4 transition-opacity duration-300", isRenderingTasks && "opacity-50")}>
            {isRenderingTasks
              ? <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              : clientGroups.map(group => (
                  <ClientCard key={group.account_uuid} group={group} store={store} onToggle={handleToggle} />
                ))
            }
          </div>
        </>
      )}

      {/* ── Global overlays (only for production users) ──────────────────────── */}
      {user && (
        <>
          {/* Onboarding tour */}
          <Onboarding
            userId={user.id}
            userName={user.name}
            open={onboardingOpen}
            onClose={closeOnboarding}
          />

          {/* Chat assistant */}
          <ChatAssistant userName={user.name} />

          {/* Day notifications */}
          <DayNotifications
            taskCount={totalTasks}
            pendingCount={counts.pending + counts.in_progress}
          />
        </>
      )}
    </div>
  );
}
