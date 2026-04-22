/**
 * Colombian working-time utilities.
 *
 * Jornada laboral: 07:30–12:30 y 13:30–17:30 (almuerzo excluido).
 * Excluye sábados, domingos y festivos de Colombia 2025-2026.
 */

/** Colombia public holidays (fixed + moveable "Ley Emiliani") */
const COLOMBIA_HOLIDAYS = new Set([
  // 2025
  "2025-01-01","2025-01-06","2025-03-24","2025-04-17","2025-04-18",
  "2025-05-01","2025-06-02","2025-06-23","2025-06-30","2025-07-20",
  "2025-08-07","2025-08-18","2025-10-13","2025-11-03","2025-11-17",
  "2025-12-08","2025-12-25",
  // 2026
  "2026-01-01","2026-01-12","2026-03-23","2026-04-02","2026-04-03",
  "2026-05-01","2026-05-18","2026-06-08","2026-06-15","2026-06-29",
  "2026-07-20","2026-08-07","2026-08-17","2026-10-12","2026-11-02",
  "2026-11-16","2026-12-08","2026-12-25",
]);

/** Minutes since midnight for schedule boundaries */
const WORK_START  = 7  * 60 + 30; // 07:30
const LUNCH_START = 12 * 60 + 30; // 12:30
const LUNCH_END   = 13 * 60 + 30; // 13:30
const WORK_END    = 17 * 60 + 30; // 17:30

/** Total working minutes in a standard Colombian workday: 300 + 240 = 540 */
export const WORKING_DAY_MINUTES = 540;

/** Local date string YYYY-MM-DD (not UTC) */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/** True if the date is a Colombian working day */
export function isWorkDay(date: Date): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  return !COLOMBIA_HOLIDAYS.has(localDateStr(date));
}

/**
 * Working minutes in window [fromMin, toMin) on a single day,
 * excluding lunch (12:30–13:30) and out-of-hours time.
 */
function workMinutesInWindow(fromMin: number, toMin: number): number {
  const morning   = Math.max(0, Math.min(toMin, LUNCH_START) - Math.max(fromMin, WORK_START));
  const afternoon = Math.max(0, Math.min(toMin, WORK_END)    - Math.max(fromMin, LUNCH_END));
  return morning + afternoon;
}

/**
 * Colombian working minutes between two timestamps.
 * Excludes weekends, public holidays, lunch break, and out-of-hours time.
 */
export function getWorkingMinutesBetween(start: Date, end: Date): number {
  if (end <= start) return 0;

  const startMidnight = new Date(start); startMidnight.setHours(0,0,0,0);
  const endMidnight   = new Date(end);   endMidnight.setHours(0,0,0,0);

  let total = 0;
  const cursor = new Date(startMidnight);

  while (cursor.getTime() <= endMidnight.getTime()) {
    if (isWorkDay(cursor)) {
      const isFirst = cursor.getTime() === startMidnight.getTime();
      const isLast  = cursor.getTime() === endMidnight.getTime();
      const fromMin = isFirst ? start.getHours() * 60 + start.getMinutes() : 0;
      const toMin   = isLast  ? end.getHours()   * 60 + end.getMinutes()   : 24 * 60;
      total += workMinutesInWindow(fromMin, toMin);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

/** Start of the working day (07:30) for a given date */
export function workDayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(7, 30, 0, 0);
  return d;
}

/** Format minutes as "Xh Ym" or "Y min" */
export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}
