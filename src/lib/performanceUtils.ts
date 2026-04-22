import { getWorkingMinutesBetween, WORKING_DAY_MINUTES, workDayStart } from "./timeUtils";

export const DAILY_GOAL = 25;

// ── Core task type for performance ───────────────────────────────────────────
export interface TaskPerf {
  task_id:          string;
  task_title:       string;
  product_category: string;
  client_name:      string;
  account_uuid:     string;
  is_feedback:      boolean;
  status:           "pending" | "in_progress" | "done";
  closedAt:         string | null;
  assignedDate:     string; // YYYY-MM-DD
}

// ── Time slot definition ──────────────────────────────────────────────────────
export interface TimeSlot {
  label:     string;
  startHour: number;
  startMin:  number;
  endHour:   number;
  endMin:    number;
  count:     number;
}

export type PerformanceStatus = "AT_RISK" | "ON_TRACK" | "OVERPERFORMING" | "NO_DATA";

// ── Daily metrics ─────────────────────────────────────────────────────────────
export interface DayMetrics {
  dateStr:             string;
  completedToday:      number;
  pendingCount:        number;
  inProgressCount:     number;
  totalTasks:          number;
  completionRate:      number;   // completedToday / DAILY_GOAL
  elapsedWorkMinutes:  number;
  dayProgress:         number;   // 0-1
  realRate:            number;   // tasks / work-minute
  expectedRate:        number;   // DAILY_GOAL / WORKING_DAY_MINUTES
  projection:          number;   // realRate × WORKING_DAY_MINUTES
  idleWorkMinutes:     number;   // work-minutes since last close
  lastClosedAt:        string | null;
  leadTimes:           number[]; // work-minutes between consecutive closes
  avgLeadTime:         number;
  peakSlot:            string | null;
  performanceStatus:   PerformanceStatus;
  timeSlots:           TimeSlot[];
  doneTasks:           TaskPerf[]; // sorted by closedAt asc
  insights:            string[];
}

const SLOT_DEFS: Omit<TimeSlot, "count">[] = [
  { label: "07:30–09:30", startHour: 7,  startMin: 30, endHour: 9,  endMin: 30 },
  { label: "09:30–11:30", startHour: 9,  startMin: 30, endHour: 11, endMin: 30 },
  { label: "11:30–12:30", startHour: 11, startMin: 30, endHour: 12, endMin: 30 },
  { label: "13:30–15:30", startHour: 13, startMin: 30, endHour: 15, endMin: 30 },
  { label: "15:30–17:30", startHour: 15, startMin: 30, endHour: 17, endMin: 30 },
];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── computeDayMetrics ─────────────────────────────────────────────────────────
export function computeDayMetrics(
  allTasks: TaskPerf[],
  date:     Date,
  now:      Date,
): DayMetrics {
  const dateStr    = toDateStr(date);
  const startOfDay = new Date(date); startOfDay.setHours(0,0,0,0);
  const endOfDay   = new Date(date); endOfDay.setHours(23,59,59,999);
  const isToday    = dateStr === toDateStr(now);
  const effectiveNow = isToday ? now : endOfDay;

  // Done tasks on this date
  const doneTasks = allTasks
    .filter(t => t.status === "done" && t.closedAt)
    .filter(t => { const d = new Date(t.closedAt!); return d >= startOfDay && d <= endOfDay; })
    .sort((a,b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());

  const completedToday  = doneTasks.length;
  const pendingCount    = allTasks.filter(t => t.status === "pending").length;
  const inProgressCount = allTasks.filter(t => t.status === "in_progress").length;
  const totalTasks      = allTasks.length;

  // Elapsed work time since 07:30
  const wStart             = workDayStart(date);
  const elapsedWorkMinutes = Math.max(0, getWorkingMinutesBetween(wStart, effectiveNow));
  const dayProgress        = Math.min(1, elapsedWorkMinutes / WORKING_DAY_MINUTES);

  // Rates & projection
  const completionRate = completedToday / DAILY_GOAL;
  const realRate       = elapsedWorkMinutes > 0 ? completedToday / elapsedWorkMinutes : 0;
  const expectedRate   = DAILY_GOAL / WORKING_DAY_MINUTES;
  const projection     = realRate > 0 ? realRate * WORKING_DAY_MINUTES : 0;

  // Idle time
  const lastClosedAt    = doneTasks.at(-1)?.closedAt ?? null;
  const idleWorkMinutes = lastClosedAt
    ? Math.max(0, getWorkingMinutesBetween(new Date(lastClosedAt), effectiveNow))
    : elapsedWorkMinutes;

  // Lead times between consecutive closes
  const leadTimes: number[] = [];
  for (let i = 1; i < doneTasks.length; i++) {
    leadTimes.push(
      getWorkingMinutesBetween(new Date(doneTasks[i-1].closedAt!), new Date(doneTasks[i].closedAt!))
    );
  }
  const avgLeadTime = leadTimes.length > 0
    ? leadTimes.reduce((a,b) => a+b, 0) / leadTimes.length
    : 0;

  // Time slots
  const timeSlots: TimeSlot[] = SLOT_DEFS.map(s => {
    const ss = new Date(date); ss.setHours(s.startHour, s.startMin, 0, 0);
    const se = new Date(date); se.setHours(s.endHour,   s.endMin,   0, 0);
    const count = doneTasks.filter(t => {
      const d = new Date(t.closedAt!);
      return d >= ss && d < se;
    }).length;
    return { ...s, count };
  });

  const peakSlotObj = timeSlots.reduce<TimeSlot|null>(
    (best, s) => s.count > (best?.count ?? -1) ? s : best, null
  );
  const peakSlot = peakSlotObj && peakSlotObj.count > 0 ? peakSlotObj.label : null;

  // Status
  let performanceStatus: PerformanceStatus;
  if (completedToday === 0 && elapsedWorkMinutes < 30) {
    performanceStatus = "NO_DATA";
  } else if (projection >= DAILY_GOAL) {
    performanceStatus = "OVERPERFORMING";
  } else if (projection >= DAILY_GOAL * 0.8) {
    performanceStatus = "ON_TRACK";
  } else {
    performanceStatus = "AT_RISK";
  }

  const insights = buildInsights({
    completedToday,
    remaining:         Math.max(0, DAILY_GOAL - completedToday),
    projection,
    elapsedWorkMinutes,
    idleWorkMinutes,
    peakSlot,
    avgLeadTime,
    performanceStatus,
    dayProgress,
  });

  return {
    dateStr, completedToday, pendingCount, inProgressCount, totalTasks,
    completionRate, elapsedWorkMinutes, dayProgress, realRate, expectedRate,
    projection, idleWorkMinutes, lastClosedAt, leadTimes, avgLeadTime,
    peakSlot, performanceStatus, timeSlots, doneTasks, insights,
  };
}

// ── Multi-day aggregation ─────────────────────────────────────────────────────
export function computeRangeDays(
  allTasks: TaskPerf[],
  from:     Date,
  to:       Date,
  now:      Date,
): DayMetrics[] {
  const result: DayMetrics[] = [];
  const cursor = new Date(from); cursor.setHours(12,0,0,0);
  const end    = new Date(to);   end.setHours(12,0,0,0);
  while (cursor <= end) {
    result.push(computeDayMetrics(allTasks, cursor, now));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

// ── Insight generator ─────────────────────────────────────────────────────────
function buildInsights(p: {
  completedToday:      number;
  remaining:           number;
  projection:          number;
  elapsedWorkMinutes:  number;
  idleWorkMinutes:     number;
  peakSlot:            string | null;
  avgLeadTime:         number;
  performanceStatus:   PerformanceStatus;
  dayProgress:         number;
}): string[] {
  const out: string[] = [];

  if (p.completedToday === 0) {
    if (p.elapsedWorkMinutes > 45) {
      out.push("Aún no has cerrado ninguna tarea hoy. ¡Empieza a registrar tu progreso!");
    }
    return out;
  }

  if (p.remaining > 0) {
    out.push(`Te ${p.remaining === 1 ? "falta" : "faltan"} ${p.remaining} tarea${p.remaining === 1 ? "" : "s"} para cumplir la meta del día.`);
  } else {
    out.push("¡Meta del día completada! Seguís sumando.");
  }

  if (p.performanceStatus === "AT_RISK" && p.dayProgress > 0.25) {
    out.push("Vas por debajo del ritmo esperado — considera acelerar el cierre de tareas.");
  } else if (p.performanceStatus === "ON_TRACK") {
    out.push("Estás en ritmo para llegar a la meta. Mantén el paso.");
  } else if (p.performanceStatus === "OVERPERFORMING") {
    out.push("¡Ritmo excelente! Estás proyectando superar la meta del día.");
  }

  if (p.peakSlot) {
    out.push(`Tu mejor franja del día fue ${p.peakSlot}.`);
  }

  if (p.idleWorkMinutes >= 20) {
    const h = Math.floor(p.idleWorkMinutes / 60);
    const m = Math.round(p.idleWorkMinutes % 60);
    out.push(`Llevas ${h > 0 ? `${h}h ${m}min` : `${m} min`} hábiles sin cerrar tareas.`);
  }

  if (p.avgLeadTime > 0) {
    out.push(`Tiempo promedio entre cierres: ${Math.round(p.avgLeadTime)} min hábiles.`);
  }

  if (p.projection > 0 && p.dayProgress < 0.9) {
    out.push(`Proyección del día: ${Math.round(p.projection)} tareas (meta: ${DAILY_GOAL}).`);
  }

  return out;
}
