import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  computeDayMetrics, computeRangeDays,
  DAILY_GOAL, type TaskPerf, type DayMetrics, type PerformanceStatus,
} from "@/lib/performanceUtils";
import { fmtMinutes, isWorkDay } from "@/lib/timeUtils";
import {
  ChevronLeft, ChevronRight, CalendarDays,
  TrendingUp, TrendingDown, Minus,
  CheckCircle2, Circle, Loader2, Clock,
  Target, Activity, BarChart2, Lightbulb,
  AlertTriangle, Zap, Award,
} from "lucide-react";
import type { PersonSchedule } from "@/data/assignmentEngine";

// ── LocalStorage store (read-only in this page) ───────────────────────────────
type TaskStatus = "pending" | "in_progress" | "done";
interface TaskMeta { status: TaskStatus; closedAt: string | null; updatedAt?: string; }
type StatusStore = Record<string, TaskMeta>;

function loadStore(userId: string): StatusStore {
  try { return JSON.parse(localStorage.getItem(`task_status_${userId}`) ?? "{}"); }
  catch { return {}; }
}

// ── Period type ───────────────────────────────────────────────────────────────
type Period = "day" | "week" | "month";

// ── Date helpers ──────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getMondayOf(d: Date): Date {
  const r = new Date(d);
  const dow = r.getDay() === 0 ? 6 : r.getDay() - 1; // Mon=0
  r.setDate(r.getDate() - dow);
  r.setHours(0,0,0,0);
  return r;
}
function getSundayOf(d: Date): Date {
  const r = getMondayOf(d);
  r.setDate(r.getDate() + 6);
  return r;
}
function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function getMonthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function navLabel(period: Period, anchor: Date): string {
  if (period === "day") {
    const today = toDateStr(new Date());
    if (toDateStr(anchor) === today) return "Hoy";
    return anchor.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  }
  if (period === "week") {
    const mon = getMondayOf(anchor);
    const sun = getSundayOf(anchor);
    return `${mon.toLocaleDateString("es-ES",{day:"2-digit",month:"short"})} – ${sun.toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"})}`;
  }
  return anchor.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function navigate(period: Period, anchor: Date, dir: 1 | -1): Date {
  const d = new Date(anchor);
  if (period === "day")   { d.setDate(d.getDate() + dir); return d; }
  if (period === "week")  { d.setDate(d.getDate() + dir * 7); return d; }
  d.setMonth(d.getMonth() + dir);
  return d;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PerformanceStatus }) {
  const cfg = {
    NO_DATA:        { icon: Minus,         label: "Sin datos",       cls: "bg-slate-100 text-slate-500 border-slate-200" },
    AT_RISK:        { icon: AlertTriangle, label: "En riesgo",       cls: "bg-red-100 text-red-700 border-red-200" },
    ON_TRACK:       { icon: Zap,           label: "En ritmo",        cls: "bg-amber-100 text-amber-700 border-amber-200" },
    OVERPERFORMING: { icon: Award,         label: "Superando meta",  cls: "bg-green-100 text-green-700 border-green-200" },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold", cfg.cls)}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent, faded,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: string; faded?: boolean;
}) {
  return (
    <div className={cn("bg-white rounded-2xl border border-border px-4 py-4", faded && "opacity-60")}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3 text-muted-foreground/50" />
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      </div>
      <p className={cn("text-2xl font-black text-foreground", accent)}
         style={{ fontFamily: "'Cal Sans', sans-serif" }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({
  label, pct, color, sub,
}: { label: string; pct: number; color: string; sub?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-foreground">{Math.round(pct * 100)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)}
             style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Time-slot chart ───────────────────────────────────────────────────────────
function SlotChart({ slots }: { slots: DayMetrics["timeSlots"] }) {
  const maxCount = Math.max(1, ...slots.map(s => s.count));
  return (
    <div className="space-y-2">
      {slots.map(s => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground w-[88px] shrink-0">{s.label}</span>
          <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden">
            {s.count > 0 && (
              <div
                className="h-full bg-[#60259F]/70 rounded transition-all duration-500 flex items-center justify-end pr-1.5"
                style={{ width: `${(s.count / maxCount) * 100}%` }}
              >
                <span className="text-[9px] font-bold text-white">{s.count}</span>
              </div>
            )}
          </div>
          {s.count === 0 && (
            <span className="text-[10px] text-muted-foreground/30 font-mono">0</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Multi-day bar chart ───────────────────────────────────────────────────────
function DayBarChart({ days }: { days: DayMetrics[] }) {
  const maxCount = Math.max(1, ...days.map(d => d.completedToday));
  return (
    <div className="flex items-end gap-1.5 h-24">
      {days.map(d => {
        const pct = d.completedToday / maxCount;
        const isToday = d.dateStr === toDateStr(new Date());
        const date = new Date(d.dateStr + "T12:00:00");
        const label = date.toLocaleDateString("es-ES", { weekday: "narrow" });
        const dayNum = date.getDate();
        const isWork = isWorkDay(date);
        return (
          <div key={d.dateStr} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col justify-end h-16">
              {isWork && d.completedToday > 0 ? (
                <div
                  title={`${d.completedToday} tareas`}
                  className={cn(
                    "w-full rounded-t transition-all",
                    isToday ? "bg-[#60259F]" : "bg-[#60259F]/40"
                  )}
                  style={{ height: `${Math.max(8, pct * 100)}%` }}
                />
              ) : (
                <div className="w-full h-px bg-border" style={{ marginTop: "auto" }} />
              )}
            </div>
            <span className={cn("text-[8px] font-semibold", isToday ? "text-[#60259F]" : "text-muted-foreground/50")}>
              {label}
            </span>
            <span className={cn("text-[8px] font-mono", isToday ? "text-foreground font-bold" : "text-muted-foreground/40")}>
              {dayNum}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function PerformanceSkeleton() {
  return (
    <div className="p-8 space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-7 w-44 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-8 w-48 bg-muted rounded-full animate-pulse" />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        {Array.from({length: 6}).map((_,i) => (
          <div key={i} className="bg-white rounded-2xl border border-border px-4 py-4 animate-pulse">
            <div className="h-2.5 w-12 bg-muted rounded mb-3" />
            <div className="h-7 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function Performance() {
  const { user } = useAuth();
  const [period, setPeriod]         = useState<Period>("day");
  const [anchor, setAnchor]         = useState(() => new Date());

  // ── Queries (same pattern as MyAssignments) ─────────────────────────────
  const { data: lastAssignment, isLoading } = useQuery<any | null>({
    queryKey:             ["assignment-last"],
    queryFn:              () => api.assignment.getLast(),
    retry:                false,
    staleTime:            Infinity,
    refetchOnWindowFocus: false,
    placeholderData:      keepPreviousData,
  });

  const { data: serverStatuses } = useQuery<Record<string, any>>({
    queryKey:             ["task-statuses"],
    queryFn:              () => api.taskStatuses.getAll(),
    retry:                false,
    staleTime:            60_000,
    refetchOnWindowFocus: false,
  });

  // ── Merge local + server statuses ─────────────────────────────────────
  const store = useMemo<StatusStore>(() => {
    if (!user) return {};
    const local = loadStore(user.id);
    if (!serverStatuses) return local;
    const merged = { ...local };
    for (const [taskId, entry] of Object.entries(serverStatuses)) {
      if (entry.userId !== user.id) continue;
      const loc = local[taskId];
      const serverTs = new Date(entry.updatedAt).getTime();
      const localTs  = loc?.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
      if (!loc || serverTs > localTs) {
        merged[taskId] = { status: entry.status, closedAt: entry.closedAt, updatedAt: entry.updatedAt };
      }
    }
    return merged;
  }, [user?.id, serverStatuses]);

  // ── Find user's schedule ───────────────────────────────────────────────
  const mySchedule: PersonSchedule | null = useMemo(() =>
    lastAssignment?.schedules?.find(
      (s: any) => String(s.person_id) === String(user?.id) || s.person_name === user?.name
    ) ?? null,
  [lastAssignment, user?.id, user?.name]);

  // ── Build flat task list with statuses ────────────────────────────────
  const allTasks: TaskPerf[] = useMemo(() => {
    if (!mySchedule) return [];
    const tasks: TaskPerf[] = [];
    for (const day of mySchedule.days) {
      for (const t of day.tasks) {
        const meta = store[t.task_id] ?? { status: "pending" as TaskStatus, closedAt: null };
        tasks.push({
          task_id:          t.task_id,
          task_title:       t.task_title,
          product_category: t.product_category ?? "",
          client_name:      t.client_name,
          account_uuid:     t.account_uuid,
          is_feedback:      t.is_feedback,
          status:           meta.status,
          closedAt:         meta.closedAt,
          assignedDate:     day.date,
        });
      }
    }
    return tasks;
  }, [mySchedule, store]);

  // ── Date range from anchor + period ───────────────────────────────────
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (period === "day")   return { rangeStart: anchor, rangeEnd: anchor };
    if (period === "week")  return { rangeStart: getMondayOf(anchor), rangeEnd: getSundayOf(anchor) };
    return { rangeStart: getMonthStart(anchor), rangeEnd: getMonthEnd(anchor) };
  }, [period, anchor]);

  // ── Compute metrics ────────────────────────────────────────────────────
  const now = new Date();

  const dayMetrics = useMemo(
    () => period === "day" ? computeDayMetrics(allTasks, anchor, now) : null,
    [allTasks, anchor, period, now.getTime() - (now.getTime() % 60_000)]
  );

  const rangeDays = useMemo(
    () => period !== "day" ? computeRangeDays(allTasks, rangeStart, rangeEnd, now) : null,
    [allTasks, rangeStart, rangeEnd, period]
  );

  // ── Range aggregate stats ──────────────────────────────────────────────
  const rangeStats = useMemo(() => {
    if (!rangeDays) return null;
    const worked = rangeDays.filter(d => isWorkDay(new Date(d.dateStr + "T12:00:00")));
    const totalCompleted = rangeDays.reduce((s, d) => s + d.completedToday, 0);
    const avgPerDay = worked.length > 0 ? totalCompleted / worked.length : 0;
    const bestDay = rangeDays.reduce<DayMetrics|null>(
      (best, d) => d.completedToday > (best?.completedToday ?? -1) ? d : best, null
    );
    return { totalCompleted, avgPerDay, bestDay, workedDays: worked.length };
  }, [rangeDays]);

  if (isLoading) return <PerformanceSkeleton />;

  const m = dayMetrics;

  return (
    <div className="p-8 space-y-6 bg-background min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#60259F] mb-1">Producción</p>
          <h2 className="text-2xl font-black tracking-tight text-foreground"
              style={{ fontFamily: "'Cal Sans', sans-serif", letterSpacing: "-0.03em" }}>
            Performance
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Tu rendimiento basado en el cierre de tareas.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex rounded-xl border border-border overflow-hidden text-xs font-semibold">
            {(["day","week","month"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-2 transition-colors",
                  period === p ? "bg-[#60259F] text-white" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {{ day: "Día", week: "Semana", month: "Mes" }[p]}
              </button>
            ))}
          </div>

          {/* Date navigator */}
          <div className="flex items-center gap-1 bg-white border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setAnchor(d => navigate(period, d, -1))}
              className="px-2 py-2 hover:bg-muted/50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="px-3 py-2 text-xs font-semibold text-foreground min-w-[140px] text-center">
              {navLabel(period, anchor)}
            </span>
            <button
              onClick={() => setAnchor(d => navigate(period, d, 1))}
              className="px-2 py-2 hover:bg-muted/50 transition-colors"
              disabled={toDateStr(anchor) >= toDateStr(now)}
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {toDateStr(anchor) !== toDateStr(now) && period === "day" && (
            <button
              onClick={() => setAnchor(new Date())}
              className="text-[10px] font-semibold text-[#60259F] hover:underline"
            >
              Volver a hoy
            </button>
          )}
        </div>
      </div>

      {/* No assignment */}
      {!lastAssignment && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#60259F]/10 flex items-center justify-center mb-4">
            <CalendarDays className="w-5 h-5 text-[#60259F]" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">Sin asignación disponible</p>
          <p className="text-xs text-muted-foreground max-w-xs">El equipo de management aún no ha ejecutado la asignación.</p>
        </div>
      )}

      {/* ── DAY VIEW ─────────────────────────────────────────────────── */}
      {m && lastAssignment && (
        <>
          {/* Status badge + projection headline */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={m.performanceStatus} />
            {m.projection > 0 && (
              <span className="text-sm text-muted-foreground">
                Proyección:
                <span className={cn(
                  "font-bold ml-1",
                  m.performanceStatus === "OVERPERFORMING" ? "text-green-600" :
                  m.performanceStatus === "ON_TRACK"       ? "text-amber-600" : "text-red-600"
                )}>
                  {Math.round(m.projection)} tareas
                </span>
                {" "}(meta: {DAILY_GOAL})
              </span>
            )}
            {m.realRate > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {(m.realRate * 60).toFixed(1)} tareas/h real
                {" · "}
                {(m.expectedRate * 60).toFixed(1)} tareas/h esperado
              </span>
            )}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            <KpiCard label="Completadas"   value={m.completedToday}  sub="tareas hoy"          icon={CheckCircle2} accent="text-green-600" />
            <KpiCard label="Pendientes"    value={m.pendingCount}    sub="en asignación"        icon={Circle} />
            <KpiCard label="En progreso"   value={m.inProgressCount} sub="activas"              icon={Loader2} accent="text-amber-500" />
            <KpiCard
              label="Cumplimiento"
              value={`${Math.round(m.completionRate * 100)}%`}
              sub={`meta ${DAILY_GOAL} tareas`}
              icon={Target}
              accent={m.completionRate >= 1 ? "text-green-600" : m.completionRate >= 0.8 ? "text-amber-600" : "text-red-600"}
            />
            <KpiCard
              label="Proyección"
              value={m.projection > 0 ? Math.round(m.projection) : "—"}
              sub="al cierre del día"
              icon={TrendingUp}
              faded={m.projection === 0}
            />
            <KpiCard
              label="Inactividad"
              value={m.idleWorkMinutes > 0 ? fmtMinutes(m.idleWorkMinutes) : "—"}
              sub="hábiles sin cerrar"
              icon={Clock}
              accent={m.idleWorkMinutes >= 60 ? "text-red-500 text-lg" : m.idleWorkMinutes >= 30 ? "text-amber-500 text-lg" : undefined}
            />
          </div>

          {/* Progress bars */}
          <div className="bg-white rounded-2xl border border-border px-5 py-5 space-y-4">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Progreso</p>
            <ProgressBar
              label="Jornada laboral"
              pct={m.dayProgress}
              color="bg-slate-400"
              sub={`${Math.round(m.elapsedWorkMinutes)} min hábiles transcurridos de ${540}`}
            />
            <ProgressBar
              label="Meta de tareas"
              pct={m.completionRate}
              color={m.completionRate >= 1 ? "bg-green-500" : m.completionRate >= 0.8 ? "bg-amber-500" : "bg-[#60259F]"}
              sub={`${m.completedToday} de ${DAILY_GOAL} tareas`}
            />
          </div>

          {/* Activity chart + insights side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Time-slot chart */}
            <div className="bg-white rounded-2xl border border-border px-5 py-5 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-[#60259F]/60" />
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Actividad por franja</p>
              </div>
              {m.completedToday > 0
                ? <SlotChart slots={m.timeSlots} />
                : <p className="text-xs text-muted-foreground/50 py-4 text-center">Sin cierres registrados hoy</p>
              }
            </div>

            {/* Insights */}
            <div className="bg-white rounded-2xl border border-border px-5 py-5 space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Insights automáticos</p>
              </div>
              {m.insights.length > 0 ? (
                <ul className="space-y-2">
                  {m.insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <span className="w-1 h-1 rounded-full bg-[#60259F] mt-1.5 shrink-0" />
                      {ins}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground/50 py-4 text-center">
                  {m.elapsedWorkMinutes < 30 ? "La jornada acaba de comenzar." : "Sin insights por ahora."}
                </p>
              )}
            </div>
          </div>

          {/* Task table */}
          {m.doneTasks.length > 0 && (
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#60259F]/60" />
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Tareas completadas hoy · {m.completedToday}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="px-5 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Tarea</th>
                      <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[70px]">Tipo</th>
                      <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[80px]">Cierre</th>
                      <th className="px-3 pr-5 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[110px]">Lead time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.doneTasks.map((t, i) => {
                      const lt = i > 0 ? m.leadTimes[i - 1] : null;
                      return (
                        <tr key={t.task_id + i} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-2.5">
                            <p className="text-xs font-semibold text-foreground leading-tight">{t.task_title}</p>
                            <p className="text-[10px] text-muted-foreground">{t.client_name}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            {t.product_category
                              ? <CatBadge cat={t.product_category} />
                              : <span className="text-muted-foreground/30 text-[10px]">—</span>
                            }
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[10px] font-mono text-green-600">
                              {t.closedAt
                                ? new Date(t.closedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
                                : "—"
                              }
                            </span>
                          </td>
                          <td className="px-3 pr-5 py-2.5">
                            {lt !== null
                              ? <span className="text-[10px] font-mono text-muted-foreground">{fmtMinutes(lt)}</span>
                              : <span className="text-[10px] text-muted-foreground/30">primera</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {m.doneTasks.length === 0 && m.totalTasks > 0 && (
            <div className="bg-white rounded-2xl border border-border px-5 py-12 text-center">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">Aún no hay cierres para este día</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tienes {m.totalTasks} tareas asignadas. Marca como completadas desde Mis Asignaciones.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── WEEK / MONTH VIEW ──────────────────────────────────────────── */}
      {rangeDays && rangeStats && lastAssignment && (
        <>
          {/* Aggregate KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard
              label="Total completadas"
              value={rangeStats.totalCompleted}
              sub="en el período"
              icon={CheckCircle2}
              accent="text-green-600"
            />
            <KpiCard
              label="Promedio diario"
              value={rangeStats.avgPerDay.toFixed(1)}
              sub={`meta: ${DAILY_GOAL}/día`}
              icon={TrendingUp}
              accent={rangeStats.avgPerDay >= DAILY_GOAL ? "text-green-600" : "text-muted-foreground"}
            />
            <KpiCard
              label="Mejor día"
              value={rangeStats.bestDay?.completedToday ?? 0}
              sub={rangeStats.bestDay
                ? new Date(rangeStats.bestDay.dateStr + "T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"2-digit",month:"short"})
                : "—"
              }
              icon={Award}
              accent="text-[#60259F]"
            />
            <KpiCard
              label="Días laborados"
              value={rangeStats.workedDays}
              sub="días hábiles en período"
              icon={CalendarDays}
            />
          </div>

          {/* Daily bar chart */}
          <div className="bg-white rounded-2xl border border-border px-5 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-[#60259F]/60" />
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Cierres por día</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>Meta: <strong className="text-foreground">{DAILY_GOAL}/día</strong></span>
              </div>
            </div>
            <DayBarChart days={rangeDays} />
            {/* Goal reference line label */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px border-t border-dashed border-[#60259F]/30" />
              <span className="text-[9px] text-[#60259F]/60 font-mono">meta {DAILY_GOAL}</span>
            </div>
          </div>

          {/* Day-by-day breakdown table */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Desglose diario</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="px-5 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Día</th>
                    <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[80px]">Completadas</th>
                    <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[80px]">Cumplimiento</th>
                    <th className="px-3 pr-5 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[120px]">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeDays.filter(d => isWorkDay(new Date(d.dateStr + "T12:00:00"))).map(d => {
                    const date = new Date(d.dateStr + "T12:00:00");
                    const isToday = d.dateStr === toDateStr(new Date());
                    return (
                      <tr key={d.dateStr} className={cn(
                        "border-b border-border/30 last:border-0 transition-colors",
                        isToday ? "bg-[#60259F]/5" : "hover:bg-muted/20"
                      )}>
                        <td className="px-5 py-2.5">
                          <p className={cn("text-xs font-semibold", isToday ? "text-[#60259F]" : "text-foreground")}>
                            {date.toLocaleDateString("es-ES",{weekday:"long",day:"2-digit",month:"short"})}
                            {isToday && <span className="ml-1.5 text-[9px] bg-[#60259F] text-white px-1.5 py-0.5 rounded-full">Hoy</span>}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn("text-sm font-black", d.completedToday >= DAILY_GOAL ? "text-green-600" : "text-foreground")}
                                style={{ fontFamily: "'Cal Sans', sans-serif" }}>
                            {d.completedToday}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-1">/ {DAILY_GOAL}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            "text-xs font-bold",
                            d.completionRate >= 1 ? "text-green-600" : d.completionRate >= 0.8 ? "text-amber-600" : "text-red-500"
                          )}>
                            {Math.round(d.completionRate * 100)}%
                          </span>
                        </td>
                        <td className="px-3 pr-5 py-2.5">
                          {d.performanceStatus !== "NO_DATA" && <StatusBadge status={d.performanceStatus} />}
                          {d.performanceStatus === "NO_DATA" && (
                            <span className="text-[10px] text-muted-foreground/40">Sin datos</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

// ── Category badge (local copy) ───────────────────────────────────────────────
function CatBadge({ cat }: { cat: string }) {
  const map: Record<string, string> = {
    SEO:  "bg-blue-100 text-blue-700",
    RRSS: "bg-pink-100 text-pink-700",
    WEB:  "bg-teal-100 text-teal-700",
    GMB:  "bg-amber-100 text-amber-700",
  };
  return (
    <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded whitespace-nowrap", map[cat] ?? "bg-slate-100 text-slate-600")}>
      {cat}
    </span>
  );
}
