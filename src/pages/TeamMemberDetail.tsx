import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Mail, Clock, Palmtree, Users,
  CalendarDays, ListChecks, ExternalLink,
  Circle, Loader, CheckCircle2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TEAM_DATA, roleConfig, workConfig } from "@/data/teamData";
import { api } from "@/lib/api";
import { orbidiTaskAdminChangeUrl } from "@/lib/orbidiConsoleUrls";

const AVATAR_COLORS = [
  "bg-[#60259F]", "bg-teal-600", "bg-blue-600", "bg-pink-600",
  "bg-orange-500", "bg-violet-600", "bg-cyan-600", "bg-rose-600",
  "bg-indigo-600", "bg-emerald-600", "bg-amber-600", "bg-sky-600",
  "bg-fuchsia-600", "bg-lime-600",
];

const today = new Date();

function isOnVacation(start: string | null, end: string | null) {
  if (!start || !end) return false;
  return today >= new Date(start) && today <= new Date(end);
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const taskUrl = (taskId: string) => orbidiTaskAdminChangeUrl(taskId);

// ── Category colors ────────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  SEO:  "bg-blue-100 text-blue-700",
  RRSS: "bg-pink-100 text-pink-700",
  WEB:  "bg-teal-100 text-teal-700",
  GMB:  "bg-amber-100 text-amber-700",
};

function CatBadge({ cat }: { cat: string }) {
  return (
    <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded whitespace-nowrap shrink-0", CAT_COLORS[cat] ?? "bg-slate-100 text-slate-600")}>
      {cat}
    </span>
  );
}

// ── Day bar chart using real assignment data ───────────────────────────────────
function AssignmentBarChart({ days }: { days: any[] }) {
  const maxTasks = Math.max(...days.map(d => d.task_count), 1);
  const todayStr = new Date().toISOString().split("T")[0];
  const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Distribución de tareas</p>
          <p className="text-sm font-bold text-foreground mt-0.5">Tareas por día asignado</p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1 rounded-lg">
          Última asignación
        </span>
      </div>
      <div className="flex items-end gap-2 h-24">
        {days.map((day) => {
          const pct   = (day.task_count / maxTasks) * 100;
          const isDay = day.date === todayStr;
          const label = dayLabels[new Date(day.date + "T12:00:00").getDay()];
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground font-mono">{day.task_count}</span>
              <div className="w-full" style={{ height: `${Math.max(pct, 8)}%`, minHeight: 8 }}>
                <div className={cn("w-full h-full rounded-t-lg", isDay ? "bg-[#BEFF50]" : "bg-[#60259F]/20")} />
              </div>
              <span className={cn("text-[10px] font-semibold", isDay ? "text-[#60259F]" : "text-muted-foreground")}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TeamMemberDetail() {
  const { id } = useParams<{ id: string }>();
  const idx    = TEAM_DATA.findIndex(m => m.id === id);
  const member = TEAM_DATA[idx];

  if (!member) return (
    <div className="p-8">
      <Link to="/team" className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>
      <p className="text-muted-foreground">Colaborador no encontrado.</p>
    </div>
  );

  const rc           = roleConfig[member.role];
  const wc           = workConfig[member.trabajo_actual];
  const onVacation   = isOnVacation(member.vacation_start, member.vacation_end);
  const avatarColor  = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const capacityHours = (member.daily_capacity_min / 60).toFixed(1);

  const { data: lastAssignment } = useQuery<any | null>({
    queryKey: ["assignment-last"],
    queryFn:  () => api.assignment.getLast(),
    retry:    false,
    staleTime: 0,
  });

  const { data: serverStatuses = {} } = useQuery<Record<string, any>>({
    queryKey: ["task-statuses"],
    queryFn:  () => api.taskStatuses.getAll(),
    retry:    false,
    staleTime: 10_000,
    refetchInterval: 30_000, // auto-refresh every 30s so PM sees updates in real time
  });

  // Real schedule for this member
  const mySchedule = lastAssignment?.schedules?.find(
    (s: any) => s.person_id === member.id || s.person_name === member.person_name
  ) ?? null;

  // Flatten all assigned tasks
  const allTasks: any[] = mySchedule?.days.flatMap((d: any) =>
    d.tasks.map((t: any) => ({ ...t, date: d.date }))
  ) ?? [];

  // Category breakdown
  const catCount = (cat: string) =>
    allTasks.filter(t => !t.is_feedback && t.product_category === cat).length;
  const feedbackCount = allTasks.filter(t => t.is_feedback).length;

  // Unique clients
  const uniqueClients = [...new Set(allTasks.map(t => t.client_name))];

  // Peers
  const peers = TEAM_DATA.filter(m => m.role === member.role && m.id !== member.id);

  return (
    <div className="p-6 min-h-screen">
      <Link to="/team" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors mb-5">
        <ArrowLeft className="w-4 h-4" /> Volver al Team
      </Link>

      <div className="flex gap-5 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="w-72 shrink-0 space-y-4">

          {/* Hero card */}
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow", avatarColor)}>
                {getInitials(member.person_name)}
              </div>
              {onVacation && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-600 border border-orange-200">
                  <Palmtree className="w-3 h-3" /> Vacaciones
                </span>
              )}
            </div>
            <h1 className="text-lg font-black text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif" }}>
              {member.person_name}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">{member.person_email}</p>
            <div className="flex flex-wrap gap-2">
              <span className={cn("inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded border", rc.bg, rc.color)}>
                {rc.label}
              </span>
              <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border", wc.color)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", wc.dot)} />{wc.label}
              </span>
            </div>
          </div>

          {/* Info rows */}
          <div className="bg-white rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {[
              {
                icon: Mail,
                label: "Email",
                value: <a href={`mailto:${member.person_email}`} className="text-[#60259F] text-xs hover:underline truncate block">{member.person_email}</a>,
              },
              {
                icon: Clock,
                label: "Capacidad",
                value: <span className="text-xs font-semibold">{member.daily_capacity_min} min ({capacityHours}h/día)</span>,
              },
              {
                icon: CalendarDays,
                label: "Vacaciones",
                value: member.vacation_start
                  ? <span className="text-xs text-orange-600">{member.vacation_start}{member.vacation_end !== member.vacation_start ? ` → ${member.vacation_end}` : ""}</span>
                  : <span className="text-xs text-muted-foreground/50">Sin vacaciones</span>,
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3">
                <Icon className="w-3.5 h-3.5 text-[#60259F]/60 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Peers */}
          {peers.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-4">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Mismo rol ({peers.length})
              </p>
              <div className="space-y-2">
                {peers.map((p) => (
                  <Link key={p.id} to={`/team/${p.id}`}
                        className="flex items-center gap-2.5 hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors group">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0",
                                      AVATAR_COLORS[TEAM_DATA.findIndex(m => m.id === p.id) % AVATAR_COLORS.length])}>
                      {getInitials(p.person_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate group-hover:text-[#60259F]">{p.person_name}</p>
                      <div className={cn("inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border mt-0.5", workConfig[p.trabajo_actual].color)}>
                        <span className={cn("w-1 h-1 rounded-full", workConfig[p.trabajo_actual].dot)} />
                        {workConfig[p.trabajo_actual].label}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* No assignment state */}
          {!mySchedule && (
            <div className="bg-white rounded-2xl border border-border p-8 text-center">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <ListChecks className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Sin asignación activa</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {member.person_name} no aparece en la última asignación ejecutada.
                Puede deberse al modo de trabajo o vacaciones.
              </p>
            </div>
          )}

          {mySchedule && (
            <>
              {/* KPI row — real data */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Tareas asignadas", value: mySchedule.total_tasks,  sub: lastAssignment?.work_mode ?? "—",       color: "text-[#60259F]", bg: "bg-[#60259F]/5" },
                  { label: "Clientes",         value: uniqueClients.length,    sub: "en esta asignación",                   color: "text-blue-600",  bg: "bg-blue-50" },
                  { label: "Feedback",         value: feedbackCount,           sub: "tareas pendientes de revisar",         color: "text-purple-600",bg: "bg-purple-50" },
                  { label: "Días con trabajo", value: mySchedule.days.filter((d: any) => d.task_count > 0).length, sub: `de ${mySchedule.days.length} días planificados`, color: "text-teal-600", bg: "bg-teal-50" },
                ].map(({ label, value, sub, color, bg }) => (
                  <div key={label} className="bg-white rounded-2xl border border-border p-4">
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3", bg)}>
                      <ListChecks className={cn("w-4 h-4", color)} />
                    </div>
                    <p className="text-2xl font-black text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">{label}</p>
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Progress panel — from server statuses */}
              {(() => {
                const taskIds = allTasks.map(t => t.task_id);
                const counts = taskIds.reduce(
                  (acc, id) => { acc[(serverStatuses[id]?.status ?? "pending") as string]++; return acc; },
                  { pending: 0, in_progress: 0, done: 0 } as Record<string, number>
                );
                const total = taskIds.length || 1;
                const lastClosed = taskIds
                  .map(id => serverStatuses[id]?.closedAt as string | undefined)
                  .filter(Boolean)
                  .sort().at(-1) ?? null;
                return (
                  <div className="bg-white rounded-2xl border border-border px-5 py-4 space-y-3">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Progreso de producción
                      <span className="ml-2 normal-case font-normal text-[9px] text-muted-foreground/50">actualizado en tiempo real</span>
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { key: "pending",     icon: Circle,       label: "Pendiente",   cls: "text-slate-400", bg: "bg-slate-50 border-slate-200"  },
                        { key: "in_progress", icon: Loader,       label: "En progreso", cls: "text-amber-500", bg: "bg-amber-50 border-amber-200"  },
                        { key: "done",        icon: CheckCircle2, label: "Completada",  cls: "text-green-500", bg: "bg-green-50 border-green-200"  },
                      ] as const).map(({ key, icon: Icon, label, cls, bg }) => (
                        <div key={key} className={cn("rounded-xl border px-4 py-3 flex items-center gap-3", bg)}>
                          <Icon className={cn("w-5 h-5 shrink-0", cls, key === "in_progress" && "animate-spin")}
                                style={key === "in_progress" ? { animationDuration: "3s" } : {}} />
                          <div>
                            <p className="text-xl font-black text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{counts[key]}</p>
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex rounded-full overflow-hidden h-2 bg-muted gap-px">
                      <div className="bg-green-400 transition-all" style={{ width: `${(counts.done / total) * 100}%` }} />
                      <div className="bg-amber-400 transition-all" style={{ width: `${(counts.in_progress / total) * 100}%` }} />
                    </div>
                    {lastClosed && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Última tarea cerrada: <span className="text-foreground font-semibold">
                          {new Date(lastClosed).toLocaleString("es-ES", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                        </span>
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Bar chart by day */}
              <AssignmentBarChart days={mySchedule.days} />

              {/* Category breakdown */}
              <div className="bg-white rounded-2xl border border-border p-5">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Distribución por categoría</p>
                <div className="grid grid-cols-4 gap-3">
                  {(["RRSS", "SEO", "WEB", "GMB"] as const).map(cat => {
                    const n     = catCount(cat);
                    const total = allTasks.filter(t => !t.is_feedback).length || 1;
                    const pct   = Math.round((n / total) * 100);
                    return (
                      <div key={cat} className={cn("rounded-xl p-3 border", n > 0 ? CAT_COLORS[cat].replace("text-", "border-").replace(/\d+$/, "200") + " " + CAT_COLORS[cat].replace("text-", "bg-").replace(/\d+$/, "50") : "border-border bg-muted/30")}>
                        <p className={cn("text-xl font-black", n > 0 ? CAT_COLORS[cat].split(" ")[1] : "text-muted-foreground/30")}
                           style={{ fontFamily: "'Cal Sans', sans-serif" }}>{n}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{cat}</p>
                        {n > 0 && <p className="text-[9px] text-muted-foreground/60">{pct}% del total</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Assigned tasks full table */}
              <div className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-3.5 h-3.5 text-[#60259F]/60" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Tareas asignadas</p>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {mySchedule.total_tasks} tareas · {lastAssignment?.target_date}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="pl-5 pr-2 py-2 w-5" />
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[36px]">Estado</th>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Tarea</th>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[130px]">Cliente</th>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[110px]">Día</th>
                        <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[65px]">Tipo</th>
                        <th className="px-3 py-2 pr-5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-[60px] text-right">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTasks.map((t) => {
                        const sEntry = serverStatuses[t.task_id];
                        const taskStatus = sEntry?.status ?? "pending";
                        const isDone = taskStatus === "done";
                        const StatusIcon = taskStatus === "done" ? CheckCircle2 : taskStatus === "in_progress" ? Loader : Circle;
                        const statusCls  = taskStatus === "done" ? "text-green-500" : taskStatus === "in_progress" ? "text-amber-500" : "text-muted-foreground/30";
                        return (
                        <tr key={t.task_id + t.date}
                            className={cn("border-b border-border/30 last:border-0 transition-colors", isDone ? "bg-green-50/40" : "hover:bg-muted/20")}>
                          <td className="pl-5 pr-2 py-2.5 w-5">
                            <span className={cn("block w-2 h-2 rounded-full mt-0.5", t.is_feedback ? "bg-purple-400" : "bg-[#60259F]/40")} />
                          </td>
                          <td className="px-3 py-2.5 w-[36px]">
                            <StatusIcon className={cn("w-4 h-4", statusCls, taskStatus === "in_progress" && "animate-spin")}
                                        style={taskStatus === "in_progress" ? { animationDuration: "3s" } : {}} />
                          </td>
                          <td className="px-3 py-2.5">
                            <p className={cn("text-xs font-semibold leading-tight truncate max-w-[240px]", isDone ? "line-through text-muted-foreground" : "text-foreground")}>{t.task_title}</p>
                            {t.product_name && t.product_name !== t.task_title && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{t.product_name}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 w-[130px]">
                            <p className="text-xs text-muted-foreground truncate">{t.client_name}</p>
                          </td>
                          <td className="px-3 py-2.5 w-[110px]">
                            <span className="text-[10px] text-muted-foreground font-mono capitalize">
                              {new Date(t.date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 w-[65px]">
                            {t.is_feedback
                              ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">fb</span>
                              : t.product_category
                                ? <CatBadge cat={t.product_category} />
                                : <span className="text-muted-foreground/30 text-[10px]">—</span>
                            }
                          </td>
                          <td className="px-3 py-2.5 pr-5 w-[60px] text-right">
                            <a href={taskUrl(t.task_id)} target="_blank" rel="noopener noreferrer"
                               title="Abrir en prodline"
                               className="text-muted-foreground/40 hover:text-[#60259F] transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
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
      </div>
    </div>
  );
}
