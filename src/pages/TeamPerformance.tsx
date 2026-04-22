import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmtMinutes } from "@/lib/timeUtils";
import { DAILY_GOAL } from "@/lib/performanceUtils";
import {
  computeTeamMetrics, SLOT_LABELS, LOW_LOAD_THRESHOLD,
  type MemberMetrics, type TeamMetrics, type TeamPerfStatus, type SortKey,
  sortMembers,
} from "@/lib/teamPerformanceUtils";
import { roleConfig } from "@/data/teamData";
import type { PersonSchedule } from "@/data/assignmentEngine";
import {
  TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, ChevronsUpDown,
  Users, CheckCircle2, Circle, Loader2,
  AlertTriangle, Zap, Award, Target,
  Clock, Activity, BarChart2, Lightbulb,
  CalendarDays, ArrowUpDown,
} from "lucide-react";

// ── Team status badge ─────────────────────────────────────────────────────────
const TEAM_STATUS_CFG: Record<TeamPerfStatus, { label: string; cls: string; icon: React.ElementType }> = {
  OVERPERFORMING: { icon: Award,         label: "Superando meta",  cls: "bg-green-100 text-green-700 border-green-200" },
  ON_TRACK:       { icon: Zap,           label: "En ritmo",        cls: "bg-amber-100 text-amber-700 border-amber-200" },
  AT_RISK:        { icon: AlertTriangle, label: "En riesgo",       cls: "bg-red-100 text-red-700 border-red-200" },
  NO_ACTIVITY:    { icon: Circle,        label: "Sin actividad",   cls: "bg-slate-100 text-slate-500 border-slate-200" },
  LOW_LOAD:       { icon: Minus,         label: "Baja carga",      cls: "bg-sky-100 text-sky-600 border-sky-200" },
  NO_DATA:        { icon: Minus,         label: "Sin datos",       cls: "bg-slate-100 text-slate-400 border-slate-200" },
};

function StatusPill({ status }: { status: TeamPerfStatus }) {
  const { icon: Icon, label, cls } = TEAM_STATUS_CFG[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap", cls)}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent, highlight,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: string; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "bg-white rounded-2xl border px-4 py-4",
      highlight ? "border-[#60259F]/30 bg-[#60259F]/5" : "border-border"
    )}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn("w-3 h-3", highlight ? "text-[#60259F]/60" : "text-muted-foreground/50")} />
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      </div>
      <p className={cn("text-2xl font-black text-foreground leading-none", accent)}
         style={{ fontFamily: "'Cal Sans', sans-serif" }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ label, pct, color, sub }: { label: string; pct: number; color: string; sub?: string }) {
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

// ── Slot bar chart ────────────────────────────────────────────────────────────
function SlotChart({ totals }: { totals: number[] }) {
  const max = Math.max(1, ...totals);
  return (
    <div className="space-y-2">
      {SLOT_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground w-[88px] shrink-0">{label}</span>
          <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden">
            {totals[i] > 0 && (
              <div
                className="h-full bg-[#60259F]/70 rounded transition-all duration-500 flex items-center justify-end pr-1.5"
                style={{ width: `${(totals[i] / max) * 100}%` }}
              >
                <span className="text-[9px] font-bold text-white">{totals[i]}</span>
              </div>
            )}
          </div>
          {totals[i] === 0 && <span className="text-[10px] text-muted-foreground/30 font-mono">0</span>}
        </div>
      ))}
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function Heatmap({ members }: { members: MemberMetrics[] }) {
  const allCounts = members.flatMap(m => m.slotCounts);
  const max = Math.max(1, ...allCounts);

  function heatColor(n: number) {
    if (n === 0) return "bg-muted/30 text-transparent";
    const pct = n / max;
    if (pct < 0.25) return "bg-[#60259F]/15 text-[#60259F]/60";
    if (pct < 0.5)  return "bg-[#60259F]/30 text-[#60259F]";
    if (pct < 0.75) return "bg-[#60259F]/55 text-white";
    return "bg-[#60259F] text-white";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[10px]">
        <thead>
          <tr>
            <th className="pr-3 py-1 font-semibold text-muted-foreground w-[140px]">Persona</th>
            {SLOT_LABELS.map(l => (
              <th key={l} className="px-1 py-1 font-semibold text-muted-foreground text-center w-[72px]">{l.split("–")[0]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.personId}>
              <td className="pr-3 py-1 text-foreground font-semibold truncate max-w-[140px]">
                {m.personName.split(" ").slice(0,2).join(" ")}
              </td>
              {m.slotCounts.map((n, i) => (
                <td key={i} className="px-1 py-1 text-center">
                  <span className={cn(
                    "inline-flex items-center justify-center w-9 h-6 rounded text-[10px] font-bold",
                    heatColor(n)
                  )}>
                    {n > 0 ? n : "·"}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Status distribution ───────────────────────────────────────────────────────
function StatusDist({ dist, total }: { dist: Record<TeamPerfStatus, number>; total: number }) {
  const order: TeamPerfStatus[] = ["OVERPERFORMING","ON_TRACK","AT_RISK","NO_ACTIVITY","LOW_LOAD","NO_DATA"];
  return (
    <div className="flex flex-wrap gap-2">
      {order.map(s => {
        const { label, cls } = TEAM_STATUS_CFG[s];
        const n = dist[s];
        if (n === 0) return null;
        return (
          <div key={s} className={cn("rounded-xl border px-3 py-2 flex items-center gap-2", cls)}>
            <span className="text-lg font-black" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{n}</span>
            <span className="text-[10px] font-semibold">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Sort header ───────────────────────────────────────────────────────────────
function SortTh({
  label, field, current, dir, onSort,
}: {
  label: string; field: SortKey;
  current: SortKey; dir: "asc" | "desc";
  onSort: (f: SortKey) => void;
}) {
  const active = current === field;
  const Icon = active ? (dir === "desc" ? ChevronDown : ChevronUp) : ChevronsUpDown;
  return (
    <th
      className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap select-none"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        <Icon className={cn("w-3 h-3", active ? "text-[#60259F]" : "text-muted-foreground/40")} />
      </span>
    </th>
  );
}

// ── Inline mini-bar ───────────────────────────────────────────────────────────
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, pct*100)}%` }} />
    </div>
  );
}

// ── Main ranking table ────────────────────────────────────────────────────────
function RankingTable({ members }: { members: MemberMetrics[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("completedToday");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [filterStatus, setFilterStatus] = useState<TeamPerfStatus | "ALL">("ALL");

  function handleSort(field: SortKey) {
    if (field === sortKey) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(field); setSortDir("desc"); }
  }

  const filtered = filterStatus === "ALL" ? members : members.filter(m => m.status === filterStatus);
  const sorted = sortMembers(filtered, sortKey, sortDir);

  return (
    <div className="space-y-3">
      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Filtrar:</span>
        {(["ALL","OVERPERFORMING","ON_TRACK","AT_RISK","NO_ACTIVITY","LOW_LOAD"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors",
              filterStatus === s
                ? "bg-[#60259F] text-white border-[#60259F]"
                : "text-muted-foreground border-border hover:bg-muted/50"
            )}
          >
            {s === "ALL" ? "Todos" : TEAM_STATUS_CFG[s].label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full text-left">
          <thead className="border-b border-border/60 bg-muted/20">
            <tr>
              <th className="pl-5 pr-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[180px]">Persona</th>
              <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[110px]">Rol</th>
              <SortTh label="Asignadas"  field="pendingCount"    current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Pendientes" field="pendingCount"    current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Completadas"field="completedToday"  current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Cumplim."   field="completionRate"  current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Ejecución"  field="executionRate"   current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Proyección" field="projection"      current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Inactividad"field="idleWorkMinutes" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Lead time"  field="avgLeadTime"     current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-3 pr-5 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[130px]">Estado</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, idx) => {
              const rc = roleConfig[m.role];
              const isDone = m.completedToday >= m.personalGoal;
              return (
                <tr
                  key={m.personId}
                  className={cn(
                    "border-b border-border/30 last:border-0 transition-colors",
                    m.status === "AT_RISK"     ? "bg-red-50/30" :
                    m.status === "NO_ACTIVITY" ? "bg-orange-50/30" :
                    isDone                     ? "bg-green-50/30" :
                    "hover:bg-muted/20"
                  )}
                >
                  {/* Person */}
                  <td className="pl-5 pr-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground/40 w-4 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-[#60259F] flex items-center justify-center text-[9px] font-black text-white shrink-0">
                        {m.personName.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{m.personName.split(" ").slice(0,2).join(" ")}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{m.personId}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-3 py-3">
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", rc?.bg, rc?.color)}>
                      {m.roleLabel}
                    </span>
                  </td>

                  {/* Total assigned */}
                  <td className="px-3 py-3">
                    <span className="text-xs font-semibold text-foreground">{m.totalAssigned}</span>
                    <span className="text-[9px] text-muted-foreground ml-1">/ {m.personalGoal}</span>
                  </td>

                  {/* Pending */}
                  <td className="px-3 py-3">
                    <span className={cn("text-xs font-semibold", m.pendingCount > 10 ? "text-red-500" : "text-foreground")}>
                      {m.pendingCount}
                    </span>
                  </td>

                  {/* Completed */}
                  <td className="px-3 py-3">
                    <span className={cn("text-sm font-black", isDone ? "text-green-600" : "text-foreground")}
                          style={{ fontFamily: "'Cal Sans', sans-serif" }}>
                      {m.completedToday}
                    </span>
                  </td>

                  {/* Completion rate */}
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <span className={cn(
                        "text-xs font-bold",
                        m.completionRate >= 1 ? "text-green-600" :
                        m.completionRate >= 0.8 ? "text-amber-600" : "text-red-500"
                      )}>
                        {Math.round(m.completionRate * 100)}%
                      </span>
                      <MiniBar
                        pct={m.completionRate}
                        color={m.completionRate >= 1 ? "bg-green-500" : m.completionRate >= 0.8 ? "bg-amber-500" : "bg-red-400"}
                      />
                    </div>
                  </td>

                  {/* Execution rate (completadas/asignadas — fair metric) */}
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-foreground">
                        {Math.round(m.executionRate * 100)}%
                      </span>
                      <MiniBar pct={m.executionRate} color="bg-[#60259F]/60" />
                    </div>
                  </td>

                  {/* Projection */}
                  <td className="px-3 py-3">
                    <span className={cn(
                      "text-xs font-semibold",
                      m.projection >= m.personalGoal ? "text-green-600" :
                      m.projection >= m.personalGoal * 0.8 ? "text-amber-600" : "text-red-500"
                    )}>
                      {m.projection > 0 ? Math.round(m.projection) : "—"}
                    </span>
                  </td>

                  {/* Idle time */}
                  <td className="px-3 py-3">
                    <span className={cn(
                      "text-xs font-semibold",
                      m.idleWorkMinutes >= 60 ? "text-red-500" :
                      m.idleWorkMinutes >= 30 ? "text-amber-500" : "text-muted-foreground"
                    )}>
                      {m.idleWorkMinutes > 0 ? fmtMinutes(m.idleWorkMinutes) : "—"}
                    </span>
                  </td>

                  {/* Lead time */}
                  <td className="px-3 py-3">
                    <span className="text-xs font-mono text-muted-foreground">
                      {m.avgLeadTime > 0 ? `${Math.round(m.avgLeadTime)} min` : "—"}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-3 pr-5 py-3">
                    <StatusPill status={m.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No hay personas con ese estado actualmente.
          </div>
        )}
      </div>

      {/* Fair-metric footnote */}
      <p className="text-[10px] text-muted-foreground/60 px-1">
        <strong>Ejecución</strong> = completadas ÷ asignadas (métrica justa: no penaliza personas con menor carga).{" "}
        <strong>Baja carga</strong> = menos de {LOW_LOAD_THRESHOLD} tareas asignadas (excluidas del ranking de riesgo).
      </p>
    </div>
  );
}

// ── Top / Bottom performers cards ─────────────────────────────────────────────
function TopBottomCards({ members }: { members: MemberMetrics[] }) {
  const measurable = members.filter(m => m.status !== "NO_DATA" && m.status !== "LOW_LOAD" && m.totalAssigned >= 1);

  const topByCompleted = [...measurable].sort((a,b) => b.completedToday - a.completedToday).slice(0,3);
  const bottomByRisk   = [...measurable]
    .filter(m => m.status === "AT_RISK" || m.status === "NO_ACTIVITY")
    .sort((a,b) => a.completedToday - b.completedToday)
    .slice(0,3);

  function PersonRow({ m, rank, dim }: { m: MemberMetrics; rank: number; dim?: boolean }) {
    return (
      <div className={cn("flex items-center gap-3 py-2 border-b border-border/30 last:border-0", dim && "opacity-60")}>
        <span className="text-[10px] font-mono text-muted-foreground/40 w-4 shrink-0">{rank}</span>
        <div className="w-7 h-7 rounded-lg bg-[#60259F] flex items-center justify-center text-[9px] font-black text-white shrink-0">
          {m.personName.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{m.personName.split(" ").slice(0,2).join(" ")}</p>
          <p className="text-[9px] text-muted-foreground">{m.roleLabel}</p>
        </div>
        <div className="text-right">
          <p className={cn("text-sm font-black", m.completedToday >= m.personalGoal ? "text-green-600" : "text-foreground")}
             style={{ fontFamily: "'Cal Sans', sans-serif" }}>{m.completedToday}</p>
          <p className="text-[9px] text-muted-foreground">{Math.round(m.completionRate*100)}%</p>
        </div>
        <StatusPill status={m.status} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top */}
      <div className="bg-white rounded-2xl border border-green-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-green-50 border-b border-green-200 flex items-center gap-2">
          <Award className="w-4 h-4 text-green-600" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-green-700">Top performers</p>
        </div>
        <div className="px-5 py-2">
          {topByCompleted.length > 0
            ? topByCompleted.map((m, i) => <PersonRow key={m.personId} m={m} rank={i+1} />)
            : <p className="text-xs text-muted-foreground py-4 text-center">Sin datos aún.</p>
          }
        </div>
      </div>

      {/* Bottom / at risk */}
      <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-red-50 border-b border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">Requieren seguimiento</p>
        </div>
        <div className="px-5 py-2">
          {bottomByRisk.length > 0
            ? bottomByRisk.map((m, i) => <PersonRow key={m.personId} m={m} rank={i+1} dim />)
            : <p className="text-xs text-muted-foreground/50 py-4 text-center">Nadie en riesgo. ✓</p>
          }
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="p-8 space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-7 w-56 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {Array.from({length:8}).map((_,i) => (
          <div key={i} className="bg-white rounded-2xl border border-border px-4 py-4 animate-pulse">
            <div className="h-2.5 w-14 bg-muted rounded mb-3" />
            <div className="h-7 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="h-64 bg-muted rounded-2xl animate-pulse" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function TeamPerformance() {
  const { user } = useAuth();

  // ── Queries ────────────────────────────────────────────────────────────────
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
    staleTime:            30_000,       // refresh every 30s for PM real-time view
    refetchOnWindowFocus: true,
    refetchInterval:      60_000,       // auto-poll every 60s
    placeholderData:      keepPreviousData,
  });

  // ── Schedules ──────────────────────────────────────────────────────────────
  const schedules: PersonSchedule[] = useMemo(
    () => lastAssignment?.schedules ?? [],
    [lastAssignment]
  );

  // ── Compute team metrics ───────────────────────────────────────────────────
  const now = new Date();
  const today = now;

  const teamMetrics: TeamMetrics | null = useMemo(() => {
    if (!schedules.length || !serverStatuses) return null;
    return computeTeamMetrics(schedules, serverStatuses, today, now);
  }, [schedules, serverStatuses]);

  // ── Refresh timestamp ──────────────────────────────────────────────────────
  const [lastRefresh] = useState(new Date());

  if (isLoading) return <Skeleton />;

  if (!lastAssignment) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-screen text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#60259F]/10 flex items-center justify-center mb-4">
          <CalendarDays className="w-5 h-5 text-[#60259F]" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">Sin asignación disponible</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Ejecuta una asignación desde la sección Assignment para ver el performance del equipo.
        </p>
      </div>
    );
  }

  const m = teamMetrics;

  const teamStatusColor =
    m?.teamStatus === "OVERPERFORMING" ? "text-green-600" :
    m?.teamStatus === "ON_TRACK"       ? "text-amber-600" : "text-red-600";

  return (
    <div className="p-8 space-y-6 bg-background min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#60259F] mb-1">Management</p>
          <h2 className="text-2xl font-black tracking-tight text-foreground"
              style={{ fontFamily: "'Cal Sans', sans-serif", letterSpacing: "-0.03em" }}>
            Team Performance
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Rendimiento del equipo en tiempo real ·{" "}
            <span className="font-semibold text-foreground">
              {now.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" })}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {m && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1 rounded-full">
              Asignación: {lastAssignment.work_mode} · {lastAssignment.target_date}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            Auto-actualiza cada 60s
          </span>
        </div>
      </div>

      {!m && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-700">
          Calculando métricas del equipo…
        </div>
      )}

      {m && (
        <>
          {/* Team status + headline */}
          <div className="bg-white rounded-2xl border border-border px-5 py-4 flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                {(["OVERPERFORMING","ON_TRACK","AT_RISK","NO_DATA"] as const).map(s => {
                  const cfg = { OVERPERFORMING: { icon: Award, cls: "text-green-600", label: "Superando meta" }, ON_TRACK: { icon: Zap, cls: "text-amber-600", label: "En ritmo" }, AT_RISK: { icon: AlertTriangle, cls: "text-red-600", label: "En riesgo" }, NO_DATA: { icon: Minus, cls: "text-slate-400", label: "Sin datos" } }[s];
                  if (m.teamStatus !== s) return null;
                  const Icon = cfg.icon;
                  return (
                    <span key={s} className={cn("inline-flex items-center gap-1.5 text-sm font-bold", cfg.cls)}>
                      <Icon className="w-4 h-4" /> {cfg.label}
                    </span>
                  );
                })}
                <span className="text-muted-foreground text-sm">
                  Equipo:
                  <span className={cn("font-bold ml-1", teamStatusColor)}>{m.totalCompleted}</span>
                  <span className="text-muted-foreground"> / {m.teamGoal} tareas</span>
                  <span className={cn("font-bold ml-2", teamStatusColor)}>({Math.round(m.teamCompletionRate * 100)}%)</span>
                </span>
                {m.teamProjection > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
                    Proyección: {Math.round(m.teamProjection)} tareas
                  </span>
                )}
              </div>
              <ProgressBar
                label="Cumplimiento del equipo"
                pct={m.teamCompletionRate}
                color={m.teamCompletionRate >= 1 ? "bg-green-500" : m.teamCompletionRate >= 0.8 ? "bg-amber-500" : "bg-[#60259F]"}
              />
            </div>
          </div>

          {/* KPI strip — 8 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
            <KpiCard label="Completadas"    value={m.totalCompleted}        sub="equipo hoy"            icon={CheckCircle2}  accent="text-green-600" highlight />
            <KpiCard label="Meta equipo"    value={m.teamGoal}              sub={`${m.activeMembers}×${DAILY_GOAL}`} icon={Target} />
            <KpiCard label="Pendientes"     value={m.totalPending}          sub="sin cerrar"            icon={Circle} />
            <KpiCard label="En progreso"    value={m.totalInProgress}       sub="activas"               icon={Loader2}       accent="text-amber-500" />
            <KpiCard label="Personas activas" value={m.activeMembers}       sub="con asignación"        icon={Users} />
            <KpiCard label="Con cierres"    value={m.membersWithClosure}    sub="al menos 1 hoy"        icon={Activity}      accent="text-green-600" />
            <KpiCard label="Sin actividad"  value={m.membersNoActivity}     sub="ningún cierre hoy"     icon={AlertTriangle} accent={m.membersNoActivity > 0 ? "text-red-500" : undefined} />
            <KpiCard
              label="Lead time promedio"
              value={m.avgLeadTime > 0 ? `${Math.round(m.avgLeadTime)} min` : "—"}
              sub="entre cierres del equipo"
              icon={Clock}
            />
          </div>

          {/* Insights */}
          {m.insights.length > 0 && (
            <div className="bg-white rounded-2xl border border-border px-5 py-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Insights del equipo</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {m.insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-2 bg-muted/30 rounded-xl px-3 py-2">
                    <span className="w-1 h-1 rounded-full bg-[#60259F] mt-1.5 shrink-0" />
                    <p className="text-xs text-foreground">{ins}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status distribution */}
          <div className="bg-white rounded-2xl border border-border px-5 py-4 space-y-3">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Distribución de estados</p>
            <StatusDist dist={m.statusDist} total={m.activeMembers} />
          </div>

          {/* Top / Bottom */}
          <TopBottomCards members={m.members} />

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Slot chart */}
            <div className="bg-white rounded-2xl border border-border px-5 py-5 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-[#60259F]/60" />
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Cierres por franja horaria</p>
              </div>
              {m.totalCompleted > 0
                ? <SlotChart totals={m.slotTotals} />
                : <p className="text-xs text-muted-foreground/50 py-4 text-center">Sin cierres registrados hoy</p>
              }
            </div>

            {/* Category breakdown */}
            <div className="bg-white rounded-2xl border border-border px-5 py-5 space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#60259F]/60" />
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Cierres por tipo de tarea</p>
              </div>
              {Object.keys(m.catTotals).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(m.catTotals)
                    .sort((a,b) => b[1]-a[1])
                    .map(([cat, cnt]) => {
                      const catMax = Math.max(...Object.values(m.catTotals));
                      const catColors: Record<string, string> = {
                        SEO:  "bg-blue-500", RRSS: "bg-pink-500",
                        WEB:  "bg-teal-500", GMB:  "bg-amber-500",
                      };
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-muted-foreground w-10 shrink-0">{cat}</span>
                          <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden">
                            <div
                              className={cn("h-full rounded transition-all duration-500 flex items-center justify-end pr-1.5", catColors[cat] ?? "bg-slate-400")}
                              style={{ width: `${(cnt / catMax) * 100}%` }}
                            >
                              <span className="text-[9px] font-bold text-white">{cnt}</span>
                            </div>
                          </div>
                        </div>
                      );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 py-4 text-center">Sin cierres hoy</p>
              )}
            </div>
          </div>

          {/* Heatmap */}
          {m.totalCompleted > 0 && (
            <div className="bg-white rounded-2xl border border-border px-5 py-5 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-[#60259F]/60" />
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Heatmap · cierres por persona y franja
                </p>
              </div>
              <Heatmap members={m.members} />
            </div>
          )}

          {/* Full ranking table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#60259F]/60" />
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Ranking completo del equipo · {m.members.length} personas
              </p>
            </div>
            <RankingTable members={m.members} />
          </div>
        </>
      )}
    </div>
  );
}
