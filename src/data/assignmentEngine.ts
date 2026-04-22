import { TEAM_DATA, TeamMember, TeamRole, WorkType } from "./teamData";
import { TASK_STANDARDS, TaskStandard, ProductCategory } from "./taskStandards";

// ── Colombia public holidays 2026 ─────────────────────────────────────────────
const CO_HOLIDAYS = new Set([
  "2026-01-01","2026-01-12","2026-03-23","2026-04-02","2026-04-03",
  "2026-05-01","2026-05-25","2026-06-15","2026-06-22","2026-06-29",
  "2026-07-20","2026-08-07","2026-08-17","2026-10-12","2026-11-02",
  "2026-11-16","2026-12-08","2026-12-25",
]);

/** Default TZ for “ayer” / brief completion calendar day (Orbidi ops). Override with OPSOS_BUSINESS_TZ. */
export const DEFAULT_BUSINESS_TZ = "America/Bogota";

export function getBusinessTimeZone(): string {
  try {
    const z = typeof process !== "undefined" ? process.env?.OPSOS_BUSINESS_TZ?.trim() : "";
    if (z) return z;
  } catch {
    /* ignore */
  }
  return DEFAULT_BUSINESS_TZ;
}

/** YYYY-MM-DD of an instant in a specific IANA time zone (not UTC date parts). */
export function calendarYmdInTimeZone(isoOrDate: string | null | undefined, timeZone: string): string | null {
  if (isoOrDate == null || String(isoOrDate).trim() === "") return null;
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Previous calendar day in `timeZone` (hour-step avoids DST edge bugs vs UTC math). */
export function yesterdayYmdInTimeZone(timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  let t = Date.now();
  const todayStr = fmt.format(new Date(t));
  for (let i = 0; i < 50; i++) {
    t -= 3600000;
    if (fmt.format(new Date(t)) !== todayStr) return fmt.format(new Date(t));
  }
  return fmt.format(new Date(t));
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RawTask {
  id: string;
  account_uuid: string;
  title: string;
  task_state: string;
  task_group: string | null;
  assigned_team: string;
  is_blocked: boolean;
  deliverables?: any[];
}

export interface AccountMeta {
  account_uuid:           string;
  account_name:           string;
  brief_started_at:       string | null;
  brief_completed?:       boolean;
  last_brief_completed_at?: string | null;
}

export interface AssignedTask {
  task_id:          string;
  account_uuid:     string;
  client_name:      string;
  task_title:       string;
  product_name:     string;
  is_feedback:      boolean;
  product_category: string;
  role:             TeamRole;
  minutes:          number;
  date:             string;
  /** Feedback continuity: who worked this task in a prior cycle (if any). */
  prior_assignee?:  { person_id: string; person_name: string } | null;
}

export interface PersonDay {
  date:       string;
  used_min:   number;
  task_count: number;
  tasks:      AssignedTask[];
}

export interface PersonSchedule {
  person_id:    string;
  person_name:  string;
  role:         TeamRole;
  work_type:    WorkType;
  capacity_min: number;
  days:         PersonDay[];
  total_min:    number;
  total_tasks:  number;
  clients:      string[];
}

export interface UnassignedTask {
  task_id:      string;
  account_uuid: string;
  client_name:  string;
  task_title:   string;
  is_feedback:  boolean;
  reason:       string;
}

export interface FeedbackMetrics {
  total_tasks:     number;
  unique_clients:  number;
  by_category:     Record<string, number>;
  by_product:      Record<string, number>;
}

export interface AssignmentResult {
  target_date:      string;
  days_window:      number;
  work_mode:        string;
  schedules:        PersonSchedule[];
  unassigned:       UnassignedTask[];
  feedback_metrics: FeedbackMetrics | null;
  summary: {
    total:            number;
    assigned:         number;
    unassigned:       number;
    total_min:        number;
    feedback_tasks:   number;
    production_tasks: number;
  };
  generated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function isWorkingDay(date: string, member: TeamMember): boolean {
  const d = new Date(date + "T12:00:00");
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (CO_HOLIDAYS.has(date)) return false;
  if (member.vacation_start && member.vacation_end) {
    if (date >= member.vacation_start && date <= member.vacation_end) return false;
  }
  return true;
}

function addWorkingDays(startDate: string, n: number): string[] {
  const dates: string[] = [];
  const d = new Date(startDate + "T12:00:00");
  let added = 0;
  while (added < n) {
    const iso = d.toISOString().split("T")[0];
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !CO_HOLIDAYS.has(iso)) {
      dates.push(iso);
      added++;
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function detectCategory(task: RawTask): ProductCategory | null {
  const team = (task.assigned_team || "").toUpperCase();
  const title = (task.title || "").toUpperCase();
  if (team === "SEO"  || /^SEO\s*[-–]/.test(title))  return "SEO";
  if (team === "RRSS" || /^RRSS\s*[-–]/.test(title)) return "RRSS";
  if (team === "WEB"  || /^WEB\s*[-–]/.test(title))  return "WEB";
  if (team === "GMB"  || /^GMB\s*[-–]/.test(title))  return "GMB";
  return null;
}

/** Filtro “Producto” del pool: equipo + prefijo en título; fallback si Orbidi no manda `assigned_team`. */
export function marketingProductFromTask(title: string, assignedTeam: string): ProductCategory | null {
  const raw: RawTask = {
    id: "",
    account_uuid: "",
    title: title || "",
    task_state: "",
    task_group: null,
    assigned_team: String(assignedTeam ?? "").trim(),
    is_blocked: false,
  };
  const cat = detectCategory(raw);
  if (cat) return cat;
  const t = (title || "").trim();
  if (!t) return null;
  const u = t.toUpperCase();
  // Sin assigned_team: inferir RRSS por prefijos típicos de producción social + reel/stories/carrusel/tiktok
  if (!String(assignedTeam || "").trim()) {
    if (/^(CONTENT|COPY|DIS)\s*[-–·]/.test(u) && /\bREEL(S)?\b|STORIES|CARRUSEL|CAROUSEL|TIKTOK|INSTAGRAM|FACEBOOK/i.test(u)) {
      return "RRSS";
    }
    if (/^RRSS\s*[-–·]/.test(u)) return "RRSS";
  }
  return null;
}

// ── Canonical product name mapping ───────────────────────────────────────────
// IMPORTANT: names here must exactly match TASK_STANDARDS.product_name so that
// the action_filter exact-match in /api/tasks/all works correctly.
const PRODUCT_CANONICAL: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /creaci[oó]n\s+(de\s+)?(un\s+)?reels?\b/i, name: "Reel de Instagram" }, // p. ej. CONTENT – Creación Reel
  { pattern: /\breel(s)?\b/i,                   name: "Reel de Instagram" },       // TASK_STANDARDS: "Reel de Instagram"
  { pattern: /carrusel|carousel/i,              name: "Carrusel de Instagram" },
  { pattern: /stories|historia/i,               name: "Instagram Stories" },
  { pattern: /tiktok/i,                         name: "TikTok" },
  { pattern: /post.*facebook|facebook.*post/i,  name: "Post de Facebook" },
  // GMB / noticias before any generic "post" so IMP-Implementar Post on GMB is not "Post de Instagram"
  { pattern: /^GMB\s*[-–]|\bgmb\b|google\s*business|post\s*de\s*noticias/i, name: "Post de Noticias" },
  { pattern: /post\s*(de\s*)?instagram|instagram\s*[-–]?\s*post|\bpost\s+ig\b/i, name: "Post de Instagram" },
  { pattern: /^RRSS\s*[-–].*\bpost\b/i,        name: "Post de Instagram" },
  { pattern: /on[\s-]?page|on_page/i,           name: "Acciones SEO On-Page" },   // TASK_STANDARDS: "Acciones SEO On-Page"
  { pattern: /off[\s-]?page|off_page/i,         name: "Artículos SEO Off Page" },
  { pattern: /link[\s-]?building/i,             name: "Link Building" },
  { pattern: /auditoria|audit/i,                name: "Auditoría SEO" },
  { pattern: /diagn[oó]stico/i,                 name: "Diagnóstico SEO" },
  { pattern: /dominio|domain/i,                 name: "Configuración Web" },
  { pattern: /landing/i,                        name: "Landing Page" },
  { pattern: /setup|configuraci[oó]n/i,         name: "SETUP" },                   // TASK_STANDARDS: "SETUP"
  { pattern: /blog/i,                           name: "SEO en blog" },             // TASK_STANDARDS: "SEO en blog"
];

/** Match between TASK_STANDARDS action picker and title (canonical + sinónimos para títulos Orbidi). */
export function taskMatchesActionFilter(title: string, actionFilter: string): boolean {
  const af = actionFilter.trim().toLowerCase();
  if (!af) return true;
  const rawTitle = title || "";
  const canonical = extractProductName(rawTitle).trim().toLowerCase();
  if (canonical === af) return true;
  // "Reel de Instagram": muchos friendly_id solo dicen "Creación Reel", "Video Reel", "Reel", etc.
  if (af === "reel de instagram") {
    const tl = rawTitle.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (/\bmeta\s+reel\b|\bril\b|\bspf\s*reel\b/i.test(tl)) return true;
    if (/\breels?\b/.test(tl) && /(instagram|insta\b|\big\b|meta\b|vertical|short|publicaci|pieza|formato)/.test(tl)) return true;
    if (/\breels?\b/.test(tl) && /(creaci[oó]n|edicion|edici[oó]n|grabaci[oó]n|guion|dise[oñ]o|montaje|content|copy|producci)/.test(tl)) return true;
  }
  return false;
}

export function extractProductName(title: string): string {
  for (const { pattern, name } of PRODUCT_CANONICAL) {
    if (pattern.test(title)) return name;
  }
  const parts = title.split(/\s*[-–:]\s*/);
  const skip = /^(SEO|RRSS|WEB|GMB|COPY|EST|IMP|DIS|CONTENT|AN)$/i;
  const segment = parts.find((p, i) => i > 0 && !skip.test(p.trim()) && p.trim().length > 3);
  if (segment) {
    return segment.replace(/\s+\d+$/, "").replace(/\s+(mes|año|semana).*/i, "").trim();
  }
  return title.trim();
}

// ── Role detection — checks title+taskGroup for known prefixes ────────────────
function detectRole(title: string, taskGroup: string | null): TeamRole | null {
  const t = (title + " " + (taskGroup || "")).toUpperCase();

  // Explicit role prefix keywords
  if (/\bCOPY\b/.test(t))                                                    return "Copy";
  if (/\bIMP\b/.test(t)  || /\bIMPLEMENT/.test(t))                           return "Implementador";
  if (/\bCONTENT\b/.test(t) || /CREACI[ÓO]N\s+(DE\s+)?REEL/.test(t))        return "Content_Specialist";
  if (/\bEST\b/.test(t)  || /DIAGN[ÓO]STICO/.test(t) || /\bAN\b.*SEO/.test(t)) return "Analyst_Seo";
  if (/\bDIS\b/.test(t)  || /DISE[ÑN]/.test(t))                              return "Designer";

  // Fallback: infer role from product/category when prefix is absent
  const cat = t.split(/\s*[-–]\s*/)[0].trim();
  if (cat === "RRSS") {
    // RRSS production tasks without role prefix → Content_Specialist by default
    if (/REEL|STORIES|HISTORIA/.test(t)) return "Content_Specialist";
    if (/POST|CARRUSEL|CAROUSEL/.test(t)) return "Copy";
  }
  if (cat === "SEO") {
    if (/BLOG|ARTICULO|ART[IÍ]CULO|ON[\s-]?PAGE|OFF[\s-]?PAGE/.test(t)) return "Content_Specialist";
    if (/T[EÉ]CNICO|DIAGN[OÓ]STICO|AUDITORIA|AUDIT/.test(t)) return "Analyst_Seo";
  }
  if (cat === "GMB") return "Implementador";
  if (cat === "WEB") return "Implementador";

  return null;
}

// ── Standard matching — gates which tasks are auto-assignable ─────────────────
const ROLE_FIELD: Partial<Record<TeamRole, keyof TaskStandard>> = {
  Content_Specialist: "content_specialist",
  Analyst_Seo:        "analyst_seo",
  Implementador:      "implementador",
};

// Default time (min) when role is detected but not in TASK_STANDARDS catalog
const DEFAULT_TIME_BY_ROLE: Partial<Record<TeamRole, number>> = {
  Copy:               30,
  Designer:           60,
  Content_Specialist: 30,
  Analyst_Seo:        30,
  Implementador:      15,
};

function matchStandard(taskTitle: string, role: TeamRole): { standard: TaskStandard | null; minutes: number } {
  const field = ROLE_FIELD[role];
  if (field) {
    const title = taskTitle.toLowerCase();
    for (const s of TASK_STANDARDS) {
      if (s[field] !== true) continue;
      const names = s.clickup_task_name.split("·").map(n => n.trim().toLowerCase());
      const matched = names.some(n => {
        if (title.includes(n)) return true;
        // Only use reverse inclusion for longer segments to avoid false positives
        const lastSeg = title.split(/\s*[-–]\s*/).slice(-1)[0].trim();
        if (lastSeg.length >= 4 && n.includes(lastSeg)) return true;
        return false;
      });
      if (matched) return { standard: s, minutes: s.time_minutes };
    }
  }
  // Not in catalog — use default time for the role
  const defaultMin = DEFAULT_TIME_BY_ROLE[role];
  if (defaultMin) return { standard: null, minutes: defaultMin };
  return { standard: null, minutes: 0 };
}

const FEEDBACK_DAILY_TASK_LIMIT = 25;

export interface FeedbackHistoryEntry {
  person_id:   string;
  person_name: string;
  assigned_at: string; // ISO
}

export interface AssignmentOptions {
  personIds?:     string[];
  productFilter?: string;
  actionFilter?:  string;
  /** PM overrides: { [personId]: { roles: TeamRole[], workAreas: WorkType[] } } */
  teamOverrides?: Record<string, { roles: TeamRole[]; workAreas: WorkType[] }>;
  /**
   * Task IDs already completed by workers. Excluded from NON-feedback modes only.
   * Feedback tasks re-enter TASK_PENDING_TO_APPLY_CHANGES per cycle, so they must
   * always be eligible regardless of prior completion.
   */
  doneTaskIds?:   Set<string>;
  /**
   * Feedback history: task_id → last assignee.
   * Used to prioritize continuity (same person works the same task across cycles).
   */
  feedbackHistory?: Record<string, FeedbackHistoryEntry>;
}

// ── Main engine ───────────────────────────────────────────────────────────────
export function runAssignment(
  accounts: AccountMeta[],
  rawTasksInput: RawTask[],
  targetDate: string,
  daysWindow = 5,
  workMode: string = "nuevos",
  options: AssignmentOptions = {},
): AssignmentResult {

  // ── Brief eligibility pre-filter (global + mode-specific) ────────────────────
  // Nuevos: cuenta en Auth + nombre + last_brief ayer. Recurrentes: no acotamos por caché Auth (muchas tareas sin fila accounts-with-brief).
  const tz = getBusinessTimeZone();
  const yesterdayYmd = yesterdayYmdInTimeZone(tz);
  let rawTasks = rawTasksInput;
  if (workMode !== "recurrentes") {
    const eligibleUuids = new Set<string>();
    for (const a of accounts) {
      const nm = (a.account_name || "").trim();
      if (nm === "-" || nm === "—") continue;
      if (workMode === "nuevos") {
        if (!nm) continue;
        const lb = a.last_brief_completed_at;
        if (lb == null || String(lb).trim() === "") continue;
        const completedYmd = calendarYmdInTimeZone(String(lb), tz);
        if (!completedYmd || completedYmd !== yesterdayYmd) continue;
        eligibleUuids.add(a.account_uuid);
      } else if (workMode === "approved") {
        eligibleUuids.add(a.account_uuid);
      } else {
        if (!nm) continue;
        eligibleUuids.add(a.account_uuid);
      }
    }
    rawTasks = rawTasks.filter(t => eligibleUuids.has(t.account_uuid));
  }

  // Pre-filters
  if (options.productFilter) {
    const pf = options.productFilter.toUpperCase();
    rawTasks = rawTasks.filter(t => (detectCategory(t) ?? "") === pf);
  }
  if (options.actionFilter) {
    rawTasks = rawTasks.filter(t => taskMatchesActionFilter(t.title, options.actionFilter!));
  }
  // Exclude tasks already marked done by workers — NOT in feedback mode.
  // Feedback tasks cycle back to TASK_PENDING_TO_APPLY_CHANGES each round;
  // excluding them by prior completion would wrongly block legitimate re-entry.
  if (options.doneTaskIds?.size && workMode !== "feedback") {
    rawTasks = rawTasks.filter(t => !options.doneTaskIds!.has(t.id));
  }

  // Apply PM team overrides (roles + work areas) on top of base TEAM_DATA
  const baseTeam: TeamMember[] = TEAM_DATA.map(m => {
    const ov = options.teamOverrides?.[m.id];
    if (!ov) return m;
    return {
      ...m,
      role:          (ov.roles?.length === 1 ? ov.roles[0] : m.role) as TeamRole,
      trabajo_actual: (ov.workAreas?.length === 1 ? ov.workAreas[0] : m.trabajo_actual) as WorkType,
    };
  });

  const activeTeam = options.personIds?.length
    ? baseTeam.filter(m => options.personIds!.includes(m.id))
    : baseTeam;

  const workingDays = addWorkingDays(targetDate, daysWindow);

  // ── Capacity tracking ──────────────────────────────────────────────────────
  const personDays: Record<string, Record<string, { usedMin: number; taskCount: number; tasks: AssignedTask[] }>> = {};
  for (const m of activeTeam) {
    personDays[m.id] = {};
    for (const d of workingDays) {
      if (isWorkingDay(d, m)) {
        personDays[m.id][d] = { usedMin: 0, taskCount: 0, tasks: [] };
      }
    }
  }

  // ── Account index ──────────────────────────────────────────────────────────
  const accountIndex = new Map<string, AccountMeta>();
  for (const a of accounts) accountIndex.set(a.account_uuid, a);

  // ── Classify tasks ─────────────────────────────────────────────────────────
  const productionTasks: RawTask[] = [];
  const feedbackTasks:   RawTask[] = [];
  const approvedTasks:   RawTask[] = [];
  for (const t of rawTasks) {
    if (t.is_blocked) continue;
    if (t.task_state === "TASK_CREATED")                       productionTasks.push(t);
    else if (t.task_state === "TASK_PENDING_TO_APPLY_CHANGES") feedbackTasks.push(t);
    else if (t.task_state === "TASK_APPROVED")                 approvedTasks.push(t);
  }

  const assigned:   AssignedTask[]   = [];
  const unassigned: UnassignedTask[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // FEEDBACK MODE
  // ─────────────────────────────────────────────────────────────────────────
  let feedbackMetrics: FeedbackMetrics | null = null;

  if (workMode === "feedback") {
    const byCategory: Record<string, number> = {};
    const byProduct:  Record<string, number> = {};
    const uniqueClients = new Set<string>();

    for (const t of feedbackTasks) {
      uniqueClients.add(t.account_uuid);
      const cat = detectCategory(t) ?? "OTRO";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      const prod = extractProductName(t.title);
      byProduct[prod] = (byProduct[prod] ?? 0) + 1;
    }

    feedbackMetrics = {
      total_tasks:    feedbackTasks.length,
      unique_clients: uniqueClients.size,
      by_category:    byCategory,
      by_product:     byProduct,
    };

    // Eligible: Content_Specialists with trabajo_actual === "feedback" in active team
    const specialists = activeTeam.filter(
      m => m.role === "Content_Specialist" && m.trabajo_actual === "feedback"
    );

    if (specialists.length === 0) {
      for (const t of feedbackTasks) {
        const clientName = accountIndex.get(t.account_uuid)?.account_name || t.account_uuid;
        unassigned.push({ task_id: t.id, account_uuid: t.account_uuid, client_name: clientName, task_title: t.title, is_feedback: true, reason: "Sin Content Specialists disponibles para feedback en el equipo seleccionado" });
      }
    } else {
      // Group tasks by client, sort biggest clients first
      const clientGroups = new Map<string, RawTask[]>();
      for (const t of feedbackTasks) {
        const g = clientGroups.get(t.account_uuid) ?? [];
        g.push(t);
        clientGroups.set(t.account_uuid, g);
      }
      const sortedClients = [...clientGroups.entries()].sort((a, b) => b[1].length - a[1].length);

      // Track total assigned tasks per specialist (for load balancing)
      const specialistLoad: Record<string, number> = {};
      for (const s of specialists) specialistLoad[s.id] = 0;

      // Consistency: one client → one specialist (within this run)
      const clientSpecialist = new Map<string, string>();

      /** Try to place a task on a specific specialist. Returns true if placed. */
      const tryPlaceOnSpecialist = (
        specialistId: string,
        t: RawTask,
        accountUuid: string,
        clientName: string,
        priorAssignee: { person_id: string; person_name: string } | null,
      ): boolean => {
        const specialist = activeTeam.find(m => m.id === specialistId);
        if (!specialist) return false;
        for (let di = 0; di < workingDays.length; di++) {
          const d = workingDays[di];
          if (!isWorkingDay(d, specialist) || !personDays[specialistId]?.[d]) continue;
          if (personDays[specialistId][d].taskCount < FEEDBACK_DAILY_TASK_LIMIT) {
            const at: AssignedTask = {
              task_id: t.id, account_uuid: accountUuid, client_name: clientName,
              task_title: t.title, product_name: extractProductName(t.title),
              is_feedback: true, product_category: detectCategory(t) ?? "OTRO",
              role: "Content_Specialist", minutes: 0, date: d,
              prior_assignee: priorAssignee,
            };
            personDays[specialistId][d].tasks.push(at);
            personDays[specialistId][d].taskCount++;
            assigned.push(at);
            specialistLoad[specialistId] = (specialistLoad[specialistId] ?? 0) + 1;
            return true;
          }
        }
        return false;
      };

      for (const [accountUuid, tasks] of sortedClients) {
        const clientName = accountIndex.get(accountUuid)?.account_name || accountUuid;

        for (const t of tasks) {
          // Determine prior assignee from feedback history (cross-cycle continuity)
          const histEntry = options.feedbackHistory?.[t.id] ?? null;
          const priorAssignee = histEntry
            ? { person_id: histEntry.person_id, person_name: histEntry.person_name }
            : null;

          // Step 1: prefer prior assignee (continuity across cycles)
          if (priorAssignee) {
            const priorSpec = specialists.find(s => s.id === priorAssignee.person_id);
            if (priorSpec) {
              const placed = tryPlaceOnSpecialist(priorSpec.id, t, accountUuid, clientName, priorAssignee);
              if (placed) {
                clientSpecialist.set(accountUuid, priorSpec.id);
                continue;
              }
            }
          }

          // Step 2: same specialist already assigned to this client this run (within-run consistency)
          const existingId = clientSpecialist.get(accountUuid);
          if (existingId) {
            const placed = tryPlaceOnSpecialist(existingId, t, accountUuid, clientName, priorAssignee);
            if (placed) continue;
            // Existing specialist full — fall through to load-balance
          }

          // Step 3: load-balanced pick (least loaded specialist with capacity)
          const available = specialists
            .filter(s => workingDays.some(d => isWorkingDay(d, s)))
            .sort((a, b) => (specialistLoad[a.id] ?? 0) - (specialistLoad[b.id] ?? 0));

          let placed = false;
          for (const s of available) {
            if (tryPlaceOnSpecialist(s.id, t, accountUuid, clientName, priorAssignee)) {
              if (!clientSpecialist.has(accountUuid)) clientSpecialist.set(accountUuid, s.id);
              placed = true;
              break;
            }
          }
          if (!placed) {
            unassigned.push({
              task_id: t.id, account_uuid: accountUuid, client_name: clientName,
              task_title: t.title, is_feedback: true,
              reason: "Capacidad agotada en todos los especialistas de feedback",
            });
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCTION MODE (nuevos / recurrentes / approved)
  // ─────────────────────────────────────────────────────────────────────────
  if (workMode === "nuevos" || workMode === "recurrentes" || workMode === "approved") {
    const tasksToProcess = workMode === "approved"
      ? approvedTasks
      : productionTasks;

    // Sort oldest accounts first
    tasksToProcess.sort((a, b) => {
      const da = accountIndex.get(a.account_uuid)?.brief_started_at || "9999";
      const db = accountIndex.get(b.account_uuid)?.brief_started_at || "9999";
      return da.localeCompare(db);
    });

    const consistencyMap = new Map<string, string>();   // `${uuid}::${role}` → personId
    const clientPeople   = new Map<string, Set<string>>(); // uuid → set of personIds assigned

    // ── Loop exclusion: round-robin guard per day ──────────────────────────
    // Tracks who has already received a task on each day in the current round.
    // Once all eligible people for a day have been used once, the round resets
    // so they can receive a second task — ensuring even distribution.
    const dayRoundUsed = new Map<string, Set<string>>(); // day → Set<personId>

    function tryAssignProduction(task: RawTask, role: TeamRole, minutes: number, category: string): boolean {
      const meta = accountIndex.get(task.account_uuid);
      const clientName = meta?.account_name || task.account_uuid;
      const consistKey = `${task.account_uuid}::${role}`;
      const existingPersonId = consistencyMap.get(consistKey);

      // Determine eligible people for this role
      const eligibleRole: TeamRole = workMode === "approved" ? "Implementador" : role;
      const eligible = activeTeam.filter(m =>
        m.role === eligibleRole &&
        (workMode === "approved" ? true : m.trabajo_actual === workMode)
      );

      // If we already have a designated person for this client+role, try them first (all days)
      if (existingPersonId) {
        const person = activeTeam.find(m => m.id === existingPersonId);
        if (person) {
          for (const day of workingDays) {
            if (!isWorkingDay(day, person)) continue;
            const load = personDays[person.id]?.[day];
            if (!load) continue;
            if (load.usedMin + minutes <= person.daily_capacity_min) {
              const at: AssignedTask = {
                task_id: task.id, account_uuid: task.account_uuid, client_name: clientName,
                task_title: task.title, product_name: extractProductName(task.title),
                is_feedback: false, product_category: category, role, minutes, date: day,
              };
              load.tasks.push(at); load.usedMin += minutes; load.taskCount++;
              assigned.push(at);
              return true;
            }
          }
          // Existing person has no capacity across window → fall through to find someone else
        }
      }

      // Client-level people limit
      const clientPeopleSet = clientPeople.get(task.account_uuid) ?? new Set<string>();

      // Find best day+person combination (least loaded person on earliest available day)
      for (const day of workingDays) {
        const available = eligible
          .filter(m => isWorkingDay(day, m))
          .filter(m => {
            const l = personDays[m.id]?.[day];
            return l && l.usedMin + minutes <= m.daily_capacity_min;
          })
          .filter(m => clientPeopleSet.has(m.id) || clientPeopleSet.size < 4)
          .sort((a, b) => (personDays[a.id]?.[day]?.usedMin ?? 0) - (personDays[b.id]?.[day]?.usedMin ?? 0));

        if (available.length > 0) {
          // Round-robin: sort so people NOT yet used on this day come first.
          // This prevents the same person from receiving consecutive tasks
          // when others still have capacity on the same day.
          const usedToday = dayRoundUsed.get(day) ?? new Set<string>();
          available.sort((a, b) => {
            const aUsed = usedToday.has(a.id) ? 1 : 0;
            const bUsed = usedToday.has(b.id) ? 1 : 0;
            if (aUsed !== bUsed) return aUsed - bUsed; // prefer unused first
            // Secondary: least loaded
            return (personDays[a.id]?.[day]?.usedMin ?? 0) - (personDays[b.id]?.[day]?.usedMin ?? 0);
          });

          const chosen = available[0];
          const load = personDays[chosen.id][day];
          const at: AssignedTask = {
            task_id: task.id, account_uuid: task.account_uuid, client_name: clientName,
            task_title: task.title, product_name: extractProductName(task.title),
            is_feedback: false, product_category: category, role, minutes, date: day,
          };
          load.tasks.push(at); load.usedMin += minutes; load.taskCount++;
          assigned.push(at);
          consistencyMap.set(consistKey, chosen.id);
          clientPeopleSet.add(chosen.id);
          clientPeople.set(task.account_uuid, clientPeopleSet);

          // Mark this person as used for this day's current round
          if (!dayRoundUsed.has(day)) dayRoundUsed.set(day, new Set());
          dayRoundUsed.get(day)!.add(chosen.id);
          // Reset round when all eligible people for this day have been used once
          const eligibleForDay = eligible.filter(m => isWorkingDay(day, m));
          if (eligibleForDay.length > 0 && eligibleForDay.every(m => dayRoundUsed.get(day)?.has(m.id))) {
            dayRoundUsed.set(day, new Set());
          }

          return true;
        }
      }
      return false;
    }

    for (const task of tasksToProcess) {
      const category = detectCategory(task) ?? "RRSS";
      const role = detectRole(task.title, task.task_group);
      const clientName = accountIndex.get(task.account_uuid)?.account_name || task.account_uuid;

      if (!role) {
        unassigned.push({ task_id: task.id, account_uuid: task.account_uuid, client_name: clientName, task_title: task.title, is_feedback: false, reason: "No se pudo determinar el rol (falta prefijo COPY/EST/IMP/DIS/CONTENT en el título)" });
        continue;
      }

      const { minutes, standard } = matchStandard(task.title, role);
      if (minutes === 0) {
        unassigned.push({ task_id: task.id, account_uuid: task.account_uuid, client_name: clientName, task_title: task.title, is_feedback: false, reason: `Rol ${role} no tiene tiempo estimado definido` });
        continue;
      }

      // Check if any eligible person exists for this role+workMode
      const eligibleRole: TeamRole = workMode === "approved" ? "Implementador" : role;
      const hasEligible = activeTeam.some(m =>
        m.role === eligibleRole && (workMode === "approved" ? true : m.trabajo_actual === workMode)
      );
      if (!hasEligible) {
        unassigned.push({ task_id: task.id, account_uuid: task.account_uuid, client_name: clientName, task_title: task.title, is_feedback: false, reason: `Sin personas con rol ${eligibleRole} en modo ${workMode}` });
        continue;
      }

      const ok = tryAssignProduction(task, role, minutes, category);
      if (!ok) {
        unassigned.push({ task_id: task.id, account_uuid: task.account_uuid, client_name: clientName, task_title: task.title, is_feedback: false, reason: `Sin capacidad disponible en ${daysWindow} días (${role} / ${workMode})` });
      }
    }
  }

  // ── Build PersonSchedule output ───────────────────────────────────────────
  const schedules: PersonSchedule[] = activeTeam
    .filter(m => {
      if (workMode === "feedback")   return m.role === "Content_Specialist" && m.trabajo_actual === "feedback";
      if (workMode === "approved")   return m.role === "Implementador";
      return m.trabajo_actual === workMode;
    })
    .map(m => {
      const days: PersonDay[] = workingDays
        .filter(d => isWorkingDay(d, m))
        .map(d => {
          const load = personDays[m.id]?.[d] ?? { usedMin: 0, taskCount: 0, tasks: [] };
          return { date: d, used_min: load.usedMin, task_count: load.taskCount, tasks: load.tasks };
        });
      const total_min   = days.reduce((s, d) => s + d.used_min, 0);
      const total_tasks = days.reduce((s, d) => s + d.task_count, 0);
      const clients     = [...new Set(days.flatMap(d => d.tasks.map(t => t.client_name)))];
      return { person_id: m.id, person_name: m.person_name, role: m.role, work_type: m.trabajo_actual, capacity_min: m.daily_capacity_min, days, total_min, total_tasks, clients };
    })
    .filter(s => s.total_tasks > 0);

  const totalMin = assigned.filter(t => !t.is_feedback).reduce((s, t) => s + t.minutes, 0);
  const fbLen    = feedbackTasks.length;
  const prodLen  = workMode === "approved" ? approvedTasks.length : productionTasks.length;

  return {
    target_date: targetDate,
    days_window: daysWindow,
    work_mode:   workMode,
    schedules,
    unassigned,
    feedback_metrics: feedbackMetrics,
    summary: {
      total:            fbLen + prodLen,
      assigned:         assigned.length,
      unassigned:       unassigned.length,
      total_min:        totalMin,
      feedback_tasks:   fbLen,
      production_tasks: prodLen,
    },
    generated_at: new Date().toISOString(),
  };
}
