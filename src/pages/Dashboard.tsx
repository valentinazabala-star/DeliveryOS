import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity, AlertCircle, CheckCircle, Clock, Users,
  Zap, CalendarDays, ListChecks, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TEAM_DATA, roleConfig } from "@/data/teamData";
import type { PersonSchedule } from "@/data/assignmentEngine";

export function Dashboard() {
  const { data: lastAssignment } = useQuery<any | null>({
    queryKey: ["assignment-last"],
    queryFn:  () => api.assignment.getLast(),
    retry: false,
    staleTime: 60_000,
  });

  const { data: serverStatuses = {} } = useQuery<Record<string, any>>({
    queryKey: ["task-statuses"],
    queryFn:  () => api.taskStatuses.getAll(),
    retry:    false,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // ── Stats from last assignment ─────────────────────────────────────────────
  const summary   = lastAssignment?.summary;
  const schedules: PersonSchedule[] = lastAssignment?.schedules ?? [];

  const stats = [
    {
      label: "Tareas asignadas",
      value: summary?.assigned ?? "—",
      icon: CheckCircle,
      color: "text-green-500",
      sub: summary ? `de ${summary.total} totales` : "sin datos",
    },
    {
      label: "Sin asignar",
      value: summary?.unassigned ?? "—",
      icon: AlertCircle,
      color: "text-red-500",
      sub: "requieren atención",
    },
    {
      label: "Personas activas",
      value: schedules.length > 0 ? schedules.filter(s => s.total_tasks > 0).length : "—",
      icon: Users,
      color: "text-blue-500",
      sub: `de ${TEAM_DATA.length} en el equipo`,
    },
    {
      label: "Minutos planificados",
      value: summary?.total_min ?? "—",
      icon: Clock,
      color: "text-zinc-400",
      sub: summary ? `≈ ${(summary.total_min / 510).toFixed(1)} personas-día` : "sin datos",
    },
  ];

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <header className="flex justify-between items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#60259F] mb-1">Operational OS</p>
          <h2 className="text-2xl font-black tracking-tight text-foreground"
              style={{ fontFamily: "'Cal Sans', sans-serif", letterSpacing: "-0.03em" }}>
            Dashboard
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5">
            {lastAssignment
              ? `Última asignación: ${lastAssignment.work_mode} · ${lastAssignment.target_date}`
              : "Sin asignación ejecutada aún."}
          </p>
        </div>
        <Badge variant="outline" className="bg-white border-border text-muted-foreground font-mono text-[10px] shadow-sm">
          {new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </Badge>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-white border-border shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#BEFF50]" />
            <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 pl-5">
              <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                {stat.label}
              </CardTitle>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </CardHeader>
            <CardContent className="pl-5">
              <div className="text-3xl font-black text-foreground"
                   style={{ fontFamily: "'Cal Sans', sans-serif" }}>
                {stat.value}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">

          {/* Team capacity from last assignment */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"
                         style={{ fontFamily: "'Cal Sans', sans-serif" }}>
                <Users className="w-4 h-4 text-[#BEFF50]" /> Carga del equipo
              </CardTitle>
              {lastAssignment && (
                <Link to="/assignment"
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[#60259F] transition-colors">
                  Ver asignación <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {schedules.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-xs text-muted-foreground italic">
                    Ejecuta la primera asignación para ver la carga del equipo.
                  </p>
                  <Link to="/assignment"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs text-[#60259F] hover:underline">
                    <Zap className="w-3.5 h-3.5" /> Ir a Asignación
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {schedules
                    .filter(s => s.total_tasks > 0)
                    .sort((a, b) => b.total_tasks - a.total_tasks)
                    .map((s) => {
                      const taskIds: string[] = s.days.flatMap((d: any) => d.tasks.map((t: any) => t.task_id));
                      const doneCount = taskIds.filter(id => serverStatuses[id]?.status === "done").length;
                      const inProgressCount = taskIds.filter(id => serverStatuses[id]?.status === "in_progress").length;
                      const total = taskIds.length || 1;
                      const donePct = Math.round((doneCount / total) * 100);
                      const inPct  = Math.round((inProgressCount / total) * 100);
                      const rc = roleConfig[s.role];
                      return (
                        <div key={s.person_id}
                             className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
                          <Link to={`/team/${s.person_id}`}
                                className="w-10 h-10 rounded-xl bg-[#60259F] flex items-center justify-center text-white text-xs font-black shrink-0 hover:opacity-80 transition-opacity">
                            {s.person_name.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <Link to={`/team/${s.person_id}`}
                                    className="text-sm font-medium hover:text-[#60259F] transition-colors">
                                {s.person_name}
                              </Link>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {s.total_tasks} tareas · <span className="text-green-600 font-semibold">{doneCount} ✓</span>
                                {inProgressCount > 0 && <span className="text-amber-500 ml-1">{inProgressCount} ↻</span>}
                              </span>
                            </div>
                            <div className="flex rounded-full overflow-hidden h-1.5 bg-muted gap-px">
                              <div className="bg-green-400 transition-all" style={{ width: `${donePct}%` }} />
                              <div className="bg-amber-400 transition-all" style={{ width: `${inPct}%` }} />
                            </div>
                          </div>
                          <span className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded border",
                            rc.bg, rc.color
                          )}>
                            {rc.label}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unassigned tasks */}
          {lastAssignment?.unassigned?.length > 0 && (
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"
                           style={{ fontFamily: "'Cal Sans', sans-serif" }}>
                  <AlertCircle className="w-4 h-4 text-red-500" /> Sin asignar ({lastAssignment.unassigned.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {lastAssignment.unassigned.slice(0, 5).map((t: any) => (
                    <div key={t.task_id} className="p-4 flex items-start gap-3 hover:bg-muted/50">
                      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.task_title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{t.client_name} · {t.reason}</p>
                      </div>
                    </div>
                  ))}
                  {lastAssignment.unassigned.length > 5 && (
                    <Link to="/assignment"
                          className="block p-3 text-center text-[10px] text-muted-foreground hover:text-[#60259F] transition-colors">
                      Ver {lastAssignment.unassigned.length - 5} más en Asignación →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Last assignment info card */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"
                         style={{ fontFamily: "'Cal Sans', sans-serif" }}>
                <CalendarDays className="w-4 h-4 text-[#60259F]" /> Última Asignación
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!lastAssignment ? (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground italic mb-3">Aún no se ha ejecutado ninguna asignación.</p>
                  <Link to="/assignment"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#60259F] hover:underline">
                    <Zap className="w-3.5 h-3.5" /> Ejecutar ahora
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: "Fecha inicio", value: lastAssignment.target_date },
                    { label: "Modo",         value: lastAssignment.work_mode },
                    { label: "Días ventana", value: `${lastAssignment.days_window} días` },
                    { label: "Generado",     value: new Date(lastAssignment.generated_at).toLocaleString("es-ES", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-foreground capitalize">{value}</span>
                    </div>
                  ))}
                  <Link to="/assignment"
                        className="flex items-center justify-center gap-1.5 mt-2 w-full h-8 rounded-xl bg-[#60259F]/10 text-[#60259F] text-xs font-semibold hover:bg-[#60259F]/20 transition-colors">
                    <ListChecks className="w-3.5 h-3.5" /> Ver resultado completo
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Work mode distribution */}
          {schedules.length > 0 && (() => {
            const byRole = schedules.reduce((acc, s) => {
              acc[s.role] = (acc[s.role] || 0) + s.total_tasks;
              return acc;
            }, {} as Record<string, number>);
            const total = Object.values(byRole).reduce((a, b) => a + b, 0);
            return (
              <Card className="bg-card border-border shadow-sm">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"
                             style={{ fontFamily: "'Cal Sans', sans-serif" }}>
                    <Activity className="w-4 h-4 text-[#BEFF50]" /> Por Rol
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {Object.entries(byRole).sort((a,b) => b[1]-a[1]).map(([role, count]) => {
                    const rc = roleConfig[role as keyof typeof roleConfig];
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={role}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className={cn("font-semibold", rc?.color)}>{rc?.label ?? role}</span>
                          <span className="font-mono text-muted-foreground">{count} tareas · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-[#60259F] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
