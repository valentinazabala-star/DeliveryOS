/**
 * Team-level performance utilities.
 * Reuses individual-level computeDayMetrics from performanceUtils.ts.
 */
import {
  computeDayMetrics, DAILY_GOAL, TaskPerf, DayMetrics, TimeSlot, PerformanceStatus,
} from "./performanceUtils";
import { getWorkingMinutesBetween, WORKING_DAY_MINUTES, workDayStart } from "./timeUtils";
import type { PersonSchedule } from "@/data/assignmentEngine";
import { roleConfig } from "@/data/teamData";
import type { TeamRole } from "@/data/teamData";

// ── Status store (mirrors MyAssignments + Performance) ────────────────────────
type TaskStatus = "pending" | "in_progress" | "done";
interface TaskMeta { status: TaskStatus; closedAt: string | null; updatedAt?: string; }
type StatusStore = Record<string, TaskMeta>;

// ── Fair performance status ───────────────────────────────────────────────────
/**
 * "NO_ACTIVITY"   — no closed tasks AND > 60 elapsed work-minutes
 * "LOW_LOAD"      — fewer than LOW_LOAD_THRESHOLD tasks assigned (not penalised)
 * "AT_RISK"       — projection < 80% of personal adjusted goal
 * "ON_TRACK"      — 80%–99%
 * "OVERPERFORMING"— ≥ 100%
 * "NO_DATA"       — day hasn't started yet (< 30 elapsed min) OR no assignment
 */
export const LOW_LOAD_THRESHOLD = 10;

export type TeamPerfStatus =
  | "OVERPERFORMING"
  | "ON_TRACK"
  | "AT_RISK"
  | "NO_ACTIVITY"
  | "LOW_LOAD"
  | "NO_DATA";

// ── Per-member metrics ────────────────────────────────────────────────────────
export interface MemberMetrics {
  personId:         string;
  personName:       string;
  role:             TeamRole;
  roleLabel:        string;
  // Task counts
  totalAssigned:    number;
  pendingCount:     number;
  inProgressCount:  number;
  completedToday:   number;
  // Goal
  personalGoal:     number;    // min(totalAssigned, DAILY_GOAL)
  completionRate:   number;    // completedToday / personalGoal
  executionRate:    number;    // completedToday / totalAssigned  (fair metric)
  // Projections
  projection:       number;    // projected closes by EOD (based on working rate)
  elapsedWorkMin:   number;
  dayProgress:      number;
  // Timing
  idleWorkMinutes:  number;
  lastClosedAt:     string | null;
  avgLeadTime:      number;
  // Category breakdown
  catBreakdown:     Record<string, number>; // completedToday by category
  // Time-slot breakdown (for heatmap)
  slotCounts:       number[];  // 5 slots, matches SLOT_LABELS
  // Classification
  status:           TeamPerfStatus;
  // Raw DayMetrics (for drill-down)
  dayMetrics:       DayMetrics;
}

export const SLOT_LABELS = [
  "07:30–09:30",
  "09:30–11:30",
  "11:30–12:30",
  "13:30–15:30",
  "15:30–17:30",
] as const;

// ── Team aggregate ────────────────────────────────────────────────────────────
export interface TeamMetrics {
  date:               string;
  members:            MemberMetrics[];
  // Team totals
  totalAssigned:      number;
  totalPending:       number;
  totalInProgress:    number;
  totalCompleted:     number;
  activeMembers:      number;   // members with > 0 tasks assigned today
  membersWithClosure: number;   // members who closed ≥ 1 task
  membersNoActivity:  number;   // NO_ACTIVITY status
  // Goal
  teamGoal:           number;   // DAILY_GOAL × activeMembers
  teamCompletionRate: number;
  teamProjection:     number;
  teamStatus:         PerformanceStatus;
  // Efficiency
  avgLeadTime:        number;
  bestLeadTime:       number | null;
  worstLeadTime:      number | null;
  avgIdleTime:        number;
  // Slot totals (5 slots)
  slotTotals:         number[];
  // Category totals (completed)
  catTotals:          Record<string, number>;
  // Status distribution
  statusDist:         Record<TeamPerfStatus, number>;
  // Insights
  insights:           string[];
}

// ── Build member task list ────────────────────────────────────────────────────
function buildTasksForMember(
  schedule: PersonSchedule,
  serverStatuses: Record<string, any>,
  date: Date,
): TaskPerf[] {
  const dateStr = toDateStr(date);
  const tasks: TaskPerf[] = [];

  for (const day of schedule.days) {
    for (const t of day.tasks) {
      const srv = serverStatuses[t.task_id];
      const status: TaskStatus = (srv?.status as TaskStatus) ?? "pending";
      const closedAt: string | null = srv?.closedAt ?? null;

      // For today's view, only include tasks assigned on/before today
      if (day.date > dateStr) continue;

      tasks.push({
        task_id:          t.task_id,
        task_title:       t.task_title,
        product_category: t.product_category ?? "",
        client_name:      t.client_name,
        account_uuid:     t.account_uuid,
        is_feedback:      t.is_feedback,
        status,
        closedAt,
        assignedDate:     day.date,
      });
    }
  }
  return tasks;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const SLOT_BOUNDARIES = [
  { h: 7,  m: 30 },
  { h: 9,  m: 30 },
  { h: 11, m: 30 },
  { h: 12, m: 30 },
  { h: 13, m: 30 },
  { h: 15, m: 30 },
  { h: 17, m: 30 },
];

function getSlotIndex(closedAt: string, date: Date): number {
  const d = new Date(closedAt);
  const h = d.getHours();
  const m = d.getMinutes();
  const min = h * 60 + m;
  // Slots: [07:30-09:30, 09:30-11:30, 11:30-12:30, 13:30-15:30, 15:30-17:30]
  if (min <  7*60+30) return -1;
  if (min < 9*60+30)  return 0;
  if (min < 11*60+30) return 1;
  if (min < 12*60+30) return 2;
  if (min < 13*60+30) return -1; // lunch
  if (min < 15*60+30) return 3;
  if (min < 17*60+30) return 4;
  return -1;
}

// ── Classify member ───────────────────────────────────────────────────────────
function classifyMember(m: {
  totalAssigned:   number;
  completedToday:  number;
  elapsedWorkMin:  number;
  projection:      number;
  personalGoal:    number;
}): TeamPerfStatus {
  if (m.totalAssigned === 0) return "NO_DATA";
  if (m.elapsedWorkMin < 30) return "NO_DATA";
  if (m.totalAssigned < LOW_LOAD_THRESHOLD) return "LOW_LOAD";
  if (m.completedToday === 0) return "NO_ACTIVITY";
  if (m.projection >= m.personalGoal)            return "OVERPERFORMING";
  if (m.projection >= m.personalGoal * 0.8)      return "ON_TRACK";
  return "AT_RISK";
}

// ── Main computation ──────────────────────────────────────────────────────────
export function computeTeamMetrics(
  schedules:     PersonSchedule[],
  serverStatuses: Record<string, any>,
  date:          Date,
  now:           Date,
): TeamMetrics {
  const dateStr = toDateStr(date);
  const isToday = dateStr === toDateStr(now);

  const members: MemberMetrics[] = [];

  for (const schedule of schedules) {
    const tasks = buildTasksForMember(schedule, serverStatuses, date);
    if (tasks.length === 0) continue;

    const dm = computeDayMetrics(tasks, date, now);

    const totalAssigned    = tasks.length;
    const completedToday   = dm.completedToday;
    const personalGoal     = Math.min(totalAssigned, DAILY_GOAL);
    const completionRate   = personalGoal > 0 ? completedToday / personalGoal : 0;
    const executionRate    = totalAssigned > 0 ? completedToday / totalAssigned : 0;

    // Slot counts
    const slotCounts = [0, 0, 0, 0, 0];
    for (const t of dm.doneTasks) {
      if (!t.closedAt) continue;
      const si = getSlotIndex(t.closedAt, date);
      if (si >= 0) slotCounts[si]++;
    }

    // Category breakdown (completed)
    const catBreakdown: Record<string, number> = {};
    for (const t of dm.doneTasks) {
      if (t.product_category) {
        catBreakdown[t.product_category] = (catBreakdown[t.product_category] ?? 0) + 1;
      }
    }

    const status = classifyMember({
      totalAssigned,
      completedToday,
      elapsedWorkMin: dm.elapsedWorkMinutes,
      projection:     dm.projection,
      personalGoal,
    });

    members.push({
      personId:        schedule.person_id,
      personName:      schedule.person_name,
      role:            schedule.role,
      roleLabel:       roleConfig[schedule.role]?.label ?? schedule.role,
      totalAssigned,
      pendingCount:    dm.pendingCount,
      inProgressCount: dm.inProgressCount,
      completedToday,
      personalGoal,
      completionRate,
      executionRate,
      projection:      dm.projection,
      elapsedWorkMin:  dm.elapsedWorkMinutes,
      dayProgress:     dm.dayProgress,
      idleWorkMinutes: dm.idleWorkMinutes,
      lastClosedAt:    dm.lastClosedAt,
      avgLeadTime:     dm.avgLeadTime,
      catBreakdown,
      slotCounts,
      status,
      dayMetrics:      dm,
    });
  }

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const activeMembers      = members.length;
  const totalAssigned      = members.reduce((s, m) => s + m.totalAssigned, 0);
  const totalPending       = members.reduce((s, m) => s + m.pendingCount, 0);
  const totalInProgress    = members.reduce((s, m) => s + m.inProgressCount, 0);
  const totalCompleted     = members.reduce((s, m) => s + m.completedToday, 0);
  const membersWithClosure = members.filter(m => m.completedToday > 0).length;
  const membersNoActivity  = members.filter(m => m.status === "NO_ACTIVITY").length;

  const teamGoal = DAILY_GOAL * activeMembers;
  const teamCompletionRate = teamGoal > 0 ? totalCompleted / teamGoal : 0;
  const teamProjection = members.reduce((s, m) => s + m.projection, 0);

  let teamStatus: PerformanceStatus;
  if (teamProjection >= teamGoal)             teamStatus = "OVERPERFORMING";
  else if (teamProjection >= teamGoal * 0.8)  teamStatus = "ON_TRACK";
  else if (totalCompleted === 0)              teamStatus = "NO_DATA";
  else                                        teamStatus = "AT_RISK";

  // Lead times
  const leadTimes = members.filter(m => m.avgLeadTime > 0).map(m => m.avgLeadTime);
  const avgLeadTime  = leadTimes.length > 0 ? leadTimes.reduce((a,b) => a+b,0) / leadTimes.length : 0;
  const bestLeadTime = leadTimes.length > 0 ? Math.min(...leadTimes) : null;
  const worstLeadTime= leadTimes.length > 0 ? Math.max(...leadTimes) : null;

  const idleTimes = members.filter(m => m.idleWorkMinutes > 0).map(m => m.idleWorkMinutes);
  const avgIdleTime  = idleTimes.length > 0 ? idleTimes.reduce((a,b) => a+b,0) / idleTimes.length : 0;

  // Slot totals
  const slotTotals = [0, 0, 0, 0, 0];
  for (const m of members) {
    for (let i = 0; i < 5; i++) slotTotals[i] += m.slotCounts[i];
  }

  // Category totals
  const catTotals: Record<string, number> = {};
  for (const m of members) {
    for (const [cat, cnt] of Object.entries(m.catBreakdown)) {
      catTotals[cat] = (catTotals[cat] ?? 0) + cnt;
    }
  }

  // Status distribution
  const statusDist: Record<TeamPerfStatus, number> = {
    OVERPERFORMING: 0, ON_TRACK: 0, AT_RISK: 0,
    NO_ACTIVITY: 0, LOW_LOAD: 0, NO_DATA: 0,
  };
  for (const m of members) statusDist[m.status]++;

  const insights = buildMgmtInsights({
    members, totalCompleted, teamGoal, teamProjection,
    membersNoActivity, slotTotals, catTotals, teamCompletionRate,
  });

  return {
    date: dateStr,
    members,
    totalAssigned, totalPending, totalInProgress, totalCompleted,
    activeMembers, membersWithClosure, membersNoActivity,
    teamGoal, teamCompletionRate, teamProjection, teamStatus,
    avgLeadTime, bestLeadTime, worstLeadTime, avgIdleTime,
    slotTotals, catTotals, statusDist, insights,
  };
}

// ── Management insights ───────────────────────────────────────────────────────
function buildMgmtInsights(p: {
  members:           MemberMetrics[];
  totalCompleted:    number;
  teamGoal:          number;
  teamProjection:    number;
  membersNoActivity: number;
  slotTotals:        number[];
  catTotals:         Record<string, number>;
  teamCompletionRate:number;
}): string[] {
  const out: string[] = [];

  if (p.totalCompleted === 0) {
    out.push("El equipo aún no ha registrado cierres hoy.");
    return out;
  }

  // Cumplimiento
  out.push(`El equipo lleva ${p.totalCompleted} cierres de ${p.teamGoal} esperados (${Math.round(p.teamCompletionRate * 100)}%).`);

  if (p.teamProjection > 0) {
    out.push(`Proyección del equipo al cierre del día: ${Math.round(p.teamProjection)} tareas.`);
  }

  // Top performer
  const top = [...p.members]
    .filter(m => m.completedToday > 0)
    .sort((a,b) => b.completedToday - a.completedToday)[0];
  if (top) {
    out.push(`${top.personName.split(" ")[0]} lidera el equipo con ${top.completedToday} cierres hoy.`);
  }

  // No activity
  if (p.membersNoActivity > 0) {
    const names = p.members
      .filter(m => m.status === "NO_ACTIVITY")
      .map(m => m.personName.split(" ")[0])
      .join(", ");
    out.push(`${p.membersNoActivity} persona${p.membersNoActivity > 1 ? "s" : ""} sin cierres hoy: ${names}.`);
  }

  // AT_RISK
  const atRisk = p.members.filter(m => m.status === "AT_RISK");
  if (atRisk.length > 0) {
    out.push(`${atRisk.length} persona${atRisk.length > 1 ? "s están" : " está"} en riesgo de no cumplir su meta.`);
  }

  // Best slot
  const peakIdx = p.slotTotals.indexOf(Math.max(...p.slotTotals));
  if (p.slotTotals[peakIdx] > 0) {
    out.push(`La productividad del equipo se concentró en la franja ${SLOT_LABELS[peakIdx]}.`);
  }

  // Backlog by category
  const topCat = Object.entries(p.catTotals).sort((a,b) => b[1]-a[1])[0];
  if (topCat) {
    out.push(`El tipo de tarea con más cierres hoy fue ${topCat[0]} (${topCat[1]} tareas).`);
  }

  // High idle
  const highIdle = p.members.filter(m => m.idleWorkMinutes >= 45 && m.status !== "NO_ACTIVITY");
  if (highIdle.length > 0) {
    out.push(`${highIdle.length} persona${highIdle.length > 1 ? "s llevan" : " lleva"} más de 45 min hábiles sin cerrar tareas.`);
  }

  return out;
}

// ── Ranking helpers ───────────────────────────────────────────────────────────
export type SortKey = "completedToday" | "completionRate" | "executionRate" | "projection" | "idleWorkMinutes" | "avgLeadTime" | "pendingCount";

export function sortMembers(members: MemberMetrics[], key: SortKey, dir: "asc" | "desc"): MemberMetrics[] {
  return [...members].sort((a, b) => {
    const va = a[key] as number;
    const vb = b[key] as number;
    return dir === "desc" ? vb - va : va - vb;
  });
}
