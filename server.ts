import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import fs from "fs";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { RequestHandler } from "express";
import { ACCOUNT_UUIDS as BAKED_ACCOUNT_UUIDS } from "./src/data/accountUuids";
import {
  runAssignment,
  taskMatchesActionFilter,
  marketingProductFromTask,
  yesterdayYmdInTimeZone,
  calendarYmdInTimeZone,
  getBusinessTimeZone,
  RawTask,
  AccountMeta,
  AssignmentOptions,
} from "./src/data/assignmentEngine";
import { MANAGEMENT_USERS } from "./src/data/authUsers";
import { TEAM_DATA } from "./src/data/teamData";
import type { AuthUser } from "./src/types";
import {
  signSessionUser,
  readSessionCookie,
  buildSetSessionCookie,
  buildClearSessionCookie,
} from "./authSession";

// ── Supabase client (server-side, service role if available, else anon) ──────────
const SUPABASE_URL  = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL  || "";
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const db = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
if (!db) console.warn("[supabase] No credentials — falling back to local JSON files.");

// ── Persistent file-based store helpers (fallback when Supabase unavailable) ────
const DATA_DIR = path.resolve("./data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch { return fallback; }
}
function saveJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ── Generic Supabase key-value store (table: kv_store, cols: key text PK, value jsonb) ─
async function kvGet<T>(key: string, fallback: T): Promise<T> {
  if (!db) return fallback;
  try {
    const { data, error } = await db.from("kv_store").select("value").eq("key", key).single();
    if (error || !data) return fallback;
    return data.value as T;
  } catch { return fallback; }
}
async function kvSet(key: string, value: unknown): Promise<void> {
  if (!db) return;
  try {
    await db.from("kv_store").upsert({ key, value }, { onConflict: "key" });
  } catch (e) { console.error("[supabase] kvSet error:", e); }
}

const ORBIDI_API_BASE =
  (process.env.ORBIDI_API_BASE || "").trim() || "https://eu.api.orbidi.com/prod-line";
const ORBIDI_API_KEY = process.env.ORBIDI_API_KEY || "";
const ORBIDI_AUTH_API_KEY = process.env.ORBIDI_AUTH_API_KEY || "";
const ORBIDI_AUTH_API_BASE =
  (process.env.ORBIDI_AUTH_API_BASE || "").trim() || "https://eu.api.orbidi.com/auth/api";
const ORBIDI_ADMIN_URL =
  (process.env.ORBIDI_ADMIN_URL || "").trim() || "https://eu.api.orbidi.com/auth/admin/";
const ORBIDI_ADMIN_EMAIL    = process.env.ORBIDI_ADMIN_EMAIL    || "";
const ORBIDI_ADMIN_PASSWORD = process.env.ORBIDI_ADMIN_PASSWORD || "";

const UUID_IN_TEXT_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function parseUuidStrings(raw: string): string[] {
  const m = raw.match(UUID_IN_TEXT_RE);
  if (!m?.length) return [];
  return [...new Set(m.map((s) => s.toLowerCase()))];
}

/** Prefer file/env so production account IDs are not tied to the dev snapshot in accountUuids.ts */
function resolveOrbidiAccountUuids(baked: string[]): { uuids: string[]; sourceLabel: string } {
  const explicitPath = (process.env.ORBIDI_ACCOUNT_UUIDS_FILE || "").trim();
  const candidates: { path: string; label: string }[] = [];
  if (explicitPath) {
    const abs = path.isAbsolute(explicitPath) ? explicitPath : path.resolve(process.cwd(), explicitPath);
    candidates.push({ path: abs, label: `ORBIDI_ACCOUNT_UUIDS_FILE → ${abs}` });
  }
  candidates.push({
    path: path.join(DATA_DIR, "orbidi-account-uuids.txt"),
    label: "data/orbidi-account-uuids.txt",
  });

  for (const { path: fp, label } of candidates) {
    try {
      if (!fs.existsSync(fp)) continue;
      const parsed = parseUuidStrings(fs.readFileSync(fp, "utf-8"));
      if (parsed.length) return { uuids: parsed, sourceLabel: label };
    } catch { /* ignore */ }
  }

  const inline = (process.env.ORBIDI_ACCOUNT_UUIDS || "").trim();
  if (inline) {
    const parsed = parseUuidStrings(inline);
    if (parsed.length) return { uuids: parsed, sourceLabel: "ORBIDI_ACCOUNT_UUIDS (env)" };
  }

  return {
    uuids: baked,
    sourceLabel: "src/data/accountUuids.ts (lista histórica; usa data/orbidi-account-uuids.txt o env para PROD)",
  };
}

const _initial = resolveOrbidiAccountUuids(BAKED_ACCOUNT_UUIDS);
/** Mutable at runtime — updated by /api/admin/sync-accounts without server restart. */
let ORBIDI_ACCOUNT_UUID_LIST: string[]  = _initial.uuids;
let ORBIDI_ACCOUNT_UUID_SOURCE: string  = _initial.sourceLabel;

console.log(`[orbidi] prod-line API: ${ORBIDI_API_BASE}`);
console.log(`[orbidi] auth API:       ${ORBIDI_AUTH_API_BASE}`);
console.log(`[orbidi] ${ORBIDI_ACCOUNT_UUID_LIST.length} account UUIDs — ${ORBIDI_ACCOUNT_UUID_SOURCE}`);
if (
  ORBIDI_ACCOUNT_UUID_SOURCE.includes("accountUuids.ts") &&
  !String(ORBIDI_API_BASE).includes("api-dev")
) {
  console.warn(
    "[orbidi] Lista de cuentas embebida con host distinto de api-dev. " +
      "Para ver clientes/tareas de producción, define data/orbidi-account-uuids.txt o ORBIDI_ACCOUNT_UUIDS / ORBIDI_ACCOUNT_UUIDS_FILE.",
  );
}

// Auth: OPSOS_APP_PASSWORD — shared login secret (server-only). Required in production.
//       In development, if unset, a legacy default is used so `npm run dev` works without .env.
//       OPSOS_SESSION_SECRET — HMAC key for the httpOnly session cookie; mandatory in production.
const OPSOS_APP_PASSWORD_ENV = (process.env.OPSOS_APP_PASSWORD || "").trim();
const LEGACY_DEV_PASSWORD = "orqestra2026";
const OPSOS_APP_PASSWORD =
  OPSOS_APP_PASSWORD_ENV ||
  (process.env.NODE_ENV === "production" ? "" : LEGACY_DEV_PASSWORD);
if (!OPSOS_APP_PASSWORD_ENV && process.env.NODE_ENV !== "production") {
  console.warn("[auth] OPSOS_APP_PASSWORD not set — using legacy dev password for local only.");
}
const OPSOS_SESSION_SECRET = (process.env.OPSOS_SESSION_SECRET || "").trim();
if (process.env.NODE_ENV === "production" && !OPSOS_SESSION_SECRET) {
  console.error("FATAL: OPSOS_SESSION_SECRET is required in production.");
  process.exit(1);
}
const SESSION_SIGNING_SECRET = OPSOS_SESSION_SECRET || "dev-only-do-not-use-in-prod";
if (!OPSOS_SESSION_SECRET && process.env.NODE_ENV !== "production") {
  console.warn("[auth] OPSOS_SESSION_SECRET not set — using insecure dev default.");
}

// ── Fetch with timeout ─────────────────────────────────────────────────────────
const FETCH_TIMEOUT_MS = 15_000; // 15 s per individual request
/** Auth “accounts-with-brief” is small JSON — shorter timeout fails fast under load. */
const ACCOUNT_BRIEF_FETCH_TIMEOUT_MS = Math.min(
  FETCH_TIMEOUT_MS,
  Math.max(5_000, Number(process.env.ORBIDI_ACCOUNT_BRIEF_TIMEOUT_MS) || 10_000),
);
/** Parallel Orbidi Auth requests per wave (default 40 ≈ 8 waves for 288 UUIDs vs 15×20 sequential). */
const ACCOUNTS_FETCH_CONCURRENCY = Math.min(
  96,
  Math.max(8, Number(process.env.ORBIDI_ACCOUNTS_CONCURRENCY) || 40),
);

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

const orbidiHeaders = {
  "x-api-key": ORBIDI_API_KEY,
  "Content-Type": "application/json",
};

function mapTaskState(state: string, isBlocked: boolean): string {
  if (isBlocked) return "blocked";
  const map: Record<string, string> = {
    TASK_CREATED: "por_asignar",
    TASK_PENDING_TO_START: "ready",
    TASK_IN_PROGRESS: "in_progress",
    TASK_PENDING_TO_REVIEW: "review",
    TASK_PENDING_TO_APPLY_CHANGES: "review",
    TASK_IN_REVIEW: "review",
    TASK_APPROVED: "done",
    TASK_PENDING_TO_DEPLOY: "in_progress",
    TASK_DEPLOYED: "done",
    TASK_DONE: "done",
    TASK_DISCARDED: "done",
    TASK_WAITING_FOR_DEPENDENCIES: "blocked",
    TASK_DEPLOY_FAILED: "blocked",
  };
  return map[state] || "por_asignar";
}

/** Client label shown in Assignment pool — empty or placeholder rows are ineligible. */
function isValidPoolClientLabel(name: unknown): boolean {
  if (name == null) return false;
  const s = String(name).trim();
  if (!s) return false;
  if (s === "-" || s === "—" || s === "--") return false;
  return true;
}

function isLikelyAccountUuid(id: unknown): boolean {
  const s = String(id ?? "").trim();
  if (/^[0-9a-f-]{36}$/i.test(s)) return true;
  if (/^[0-9a-f]{32}$/i.test(s)) return true;
  return false;
}

/** Recurrentes: muchas cuentas sin business_name en Auth; a veces no hay fila en acctMap pero sí client_id en tarea. */
function isRecurrentPoolClientOk(t: { client_id?: string; client_name?: string | null }): boolean {
  if (isValidPoolClientLabel(t.client_name)) return true;
  return isLikelyAccountUuid(t.client_id);
}

function hasBriefCompletedTimestamp(lastBrief: unknown): boolean {
  if (lastBrief == null) return false;
  const s = String(lastBrief).trim();
  return s.length > 0;
}

function mapOrbidiTask(t: any, accountUuid: string) {
  return {
    id: t.uuid,
    client_id: accountUuid,
    title: t.friendly_id,
    status: mapTaskState(t.task_state, t.is_blocked),
    priority: "medium",
    complexity: 1,
    assigned_to: t.responsible_uuid || null,
    task_state: t.task_state,
    assigned_team: t.assigned_team,
    clickup_id: t.clickup_id,
    render_url: t.render_url,
    release_date: t.release_date,
    created_at: t.created_at,
    is_blocked: t.is_blocked,
    deliverables: t.deliverables || [],
    task_group: t.friendly_id?.split(" - ").slice(2).join(" - ") || null,
  };
}

// --- Server-side daily cache for all accounts ---
const CACHE_FILE = path.join(DATA_DIR, "cache-snapshot.json");
const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours — serve disk cache if fresher than this

async function saveCacheSnapshot(accounts: any[], tasks: any[], fetchedAt: number) {
  // Save to local file
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ accounts, tasks, fetchedAt }), "utf-8");
    console.log(`[cache] Snapshot saved locally: ${accounts.length} accounts, ${tasks.length} tasks.`);
  } catch (e: any) {
    console.warn("[cache] Could not save local snapshot:", e.message);
  }
  // Also save to Supabase Storage for cross-deployment persistence
  if (db) {
    try {
      const payload = JSON.stringify({ accounts, tasks, fetchedAt });
      const blob = new Blob([payload], { type: "application/json" });
      const { error } = await db.storage
        .from("cache")
        .upload("cache-snapshot.json", blob, { upsert: true, contentType: "application/json" });
      if (error) console.warn("[cache] Supabase storage save failed:", error.message);
      else console.log("[cache] Snapshot saved to Supabase Storage.");
    } catch (e: any) {
      console.warn("[cache] Supabase storage upload error:", e.message);
    }
  }
}

async function loadCacheSnapshot(): Promise<{ accounts: any[]; tasks: any[]; fetchedAt: number } | null> {
  // Try Supabase Storage first (survives Railway redeploys)
  if (db) {
    try {
      const { data, error } = await db.storage.from("cache").download("cache-snapshot.json");
      if (!error && data) {
        const text = await data.text();
        const raw = JSON.parse(text);
        if (raw?.accounts && raw?.tasks && raw?.fetchedAt) {
          const ageMin = Math.round((Date.now() - raw.fetchedAt) / 60000);
          console.log(`[cache] Restored from Supabase Storage: ${raw.accounts.length} accounts, ${raw.tasks.length} tasks (${ageMin}min old).`);
          // Also write locally for fast subsequent reads
          try { fs.writeFileSync(CACHE_FILE, text, "utf-8"); } catch {}
          return raw;
        }
      }
    } catch (e: any) {
      console.warn("[cache] Supabase storage load failed:", e.message);
    }
  }
  // Fallback to local file
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    if (!raw?.accounts || !raw?.tasks || !raw?.fetchedAt) return null;
    if (Date.now() - raw.fetchedAt > CACHE_MAX_AGE_MS) {
      console.log(`[cache] Local snapshot too old (${Math.round((Date.now() - raw.fetchedAt) / 60000)}min), will refresh.`);
      return raw;
    }
    return raw;
  } catch { return null; }
}

let accountsCache: { data: any[]; fetchedAt: number } | null = null;
/** In-flight initial load when accountsCache is still null (single-flight). */
let accountsInitialLoad: Promise<void> | null = null;
/** Optional background refresh when TTL elapsed; does not block reads. */
let accountsBgRefresh: Promise<void> | null = null;

function startAccountsInitialLoad(): void {
  if (accountsCache !== null || accountsInitialLoad) return;
  accountsInitialLoad = (async () => {
    try {
      // Two-phase: tasks first, then brief data only for accounts with tasks
      const { tasks, accounts } = await fetchAllTasksAndAccounts();
      accountsCache = { data: accounts, fetchedAt: Date.now() };
      tasksAllCache = { data: tasks, fetchedAt: Date.now() };
      await saveCacheSnapshot(accounts, tasks, Date.now());
      console.log(`[accounts] Initial load done: ${accounts.length} accounts, ${tasks.length} tasks.`);
      // After first full load, start fast refresh cadence
      startFastRefreshSchedule();
    } catch (e: any) {
      console.error("[accounts] Initial load failed:", e?.message);
      accountsCache = { data: [], fetchedAt: Date.now() };
    } finally {
      accountsInitialLoad = null;
    }
  })();
}

function startAccountsBackgroundRefresh(): void {
  if (!accountsCache || accountsBgRefresh) return;
  accountsBgRefresh = (async () => {
    try {
      const { tasks, accounts } = await fetchAllTasksAndAccounts();
      accountsCache = { data: accounts, fetchedAt: Date.now() };
      tasksAllCache = { data: tasks, fetchedAt: Date.now() };
      await saveCacheSnapshot(accounts, tasks, Date.now());
      console.log(`[accounts] Background refresh done: ${accounts.length} accounts, ${tasks.length} tasks.`);
    } catch (e: any) {
      console.error("[accounts] Background refresh failed:", e?.message);
    } finally {
      accountsBgRefresh = null;
    }
  })();
}

/**
 * Fast refresh: re-scan ONLY accounts already known to have tasks.
 * Used on 30-60 min cadence. Full rescan (all 44k UUIDs) runs nightly.
 * ~5 min vs ~80 min for a full scan.
 */
async function fetchKnownAccountsOnly(): Promise<{ tasks: any[]; accounts: any[] }> {
  // Use existing accountsCache to know which UUIDs had tasks
  const knownUuids = accountsCache
    ? accountsCache.data.map((a: any) => a.account_uuid as string)
    : [];
  if (knownUuids.length === 0) return fetchAllTasksAndAccounts();

  const TASK_CONCURRENCY = 150;
  const t0 = Date.now();
  const accountsWithTasks = new Set<string>();
  const allTasks: any[] = [];

  for (let i = 0; i < knownUuids.length; i += TASK_CONCURRENCY) {
    const batch = knownUuids.slice(i, i + TASK_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (uuid) => {
        try {
          const r = await fetchWithTimeout(
            `${ORBIDI_API_BASE}/task-management/accounts/${uuid}/tasks-full`,
            { headers: orbidiHeaders },
          );
          if (!r.ok) return [];
          const data = await r.json();
          const mapped = (data as any[]).map((t) => mapOrbidiTask(t, uuid));
          if (mapped.length > 0) accountsWithTasks.add(uuid);
          return mapped;
        } catch { return []; }
      })
    );
    allTasks.push(...batchResults.flat());
  }

  const briefUuids = [...accountsWithTasks];
  const accountResults: any[] = [];
  for (let i = 0; i < briefUuids.length; i += ACCOUNTS_FETCH_CONCURRENCY) {
    const wave = briefUuids.slice(i, i + ACCOUNTS_FETCH_CONCURRENCY);
    const waveResults = await Promise.all(wave.map((uuid) => fetchOneAccountWithBrief(uuid)));
    accountResults.push(...waveResults.filter(Boolean));
  }
  console.log(`[fast-refresh] Done in ${Math.round((Date.now()-t0)/1000)}s: ${accountResults.length} accounts, ${allTasks.length} tasks.`);
  return { tasks: allTasks, accounts: accountResults };
}

let fastRefreshInterval: ReturnType<typeof setInterval> | null = null;

function startFastRefreshSchedule(): void {
  if (fastRefreshInterval) return;
  const FAST_REFRESH_MS = 45 * 60 * 1000; // every 45 min
  fastRefreshInterval = setInterval(async () => {
    if (accountsBgRefresh || accountsInitialLoad) return; // full refresh already running
    if (!accountsCache) return;
    console.log("[fast-refresh] Starting known-accounts refresh…");
    try {
      const { tasks, accounts } = await fetchKnownAccountsOnly();
      accountsCache = { data: accounts, fetchedAt: Date.now() };
      tasksAllCache = { data: tasks, fetchedAt: Date.now() };
      await saveCacheSnapshot(accounts, tasks, Date.now());
    } catch (e: any) {
      console.error("[fast-refresh] Failed:", e?.message);
    }
  }, FAST_REFRESH_MS);
  console.log("[fast-refresh] Scheduled every 45 min.");
}
let tasksAllCache: { data: any[]; fetchedAt: number } | null = null;
let tasksRefreshing = false; // stampede guard
const ONE_DAY_MS   = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS  =      60 * 60 * 1000;
const TASKS_TTL_MS = 30  * 60 * 1000; // 30 min

/**
 * Two-phase load:
 *  Phase 1 — fetch tasks for all known UUIDs (most return [] quickly).
 *  Phase 2 — fetch accounts-with-brief ONLY for UUIDs that had at least one task.
 * This avoids making 20 000+ auth API calls when most accounts have no tasks.
 */
async function fetchAllTasksAndAccounts(): Promise<{ tasks: any[]; accounts: any[] }> {
  // Use higher concurrency for task scanning — most accounts return [] immediately
  const TASK_CONCURRENCY = Math.min(150, Math.max(60, ACCOUNTS_FETCH_CONCURRENCY * 3));
  const uuids = ORBIDI_ACCOUNT_UUID_LIST;
  const t0 = Date.now();

  // Phase 1: tasks — high-concurrency scan across all known UUIDs
  const accountsWithTasks = new Set<string>();
  const allTasks: any[] = [];
  let wavesDone = 0;
  for (let i = 0; i < uuids.length; i += TASK_CONCURRENCY) {
    const batch = uuids.slice(i, i + TASK_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (uuid) => {
        try {
          const r = await fetchWithTimeout(
            `${ORBIDI_API_BASE}/task-management/accounts/${uuid}/tasks-full`,
            { headers: orbidiHeaders },
          );
          if (!r.ok) return [];
          const data = await r.json();
          const mapped = (data as any[]).map((t) => mapOrbidiTask(t, uuid));
          if (mapped.length > 0) accountsWithTasks.add(uuid);
          return mapped;
        } catch { return []; }
      })
    );
    allTasks.push(...batchResults.flat());
    wavesDone++;
    // Log progress every 10 waves
    if (wavesDone % 10 === 0) {
      const pct = Math.round((i + TASK_CONCURRENCY) / uuids.length * 100);
      console.log(`[fetch] P1 ${pct}% — ${allTasks.length} tasks, ${accountsWithTasks.size} accounts with tasks (${Math.round((Date.now()-t0)/1000)}s)`);
    }
  }
  console.log(`[fetch] Phase 1 done in ${Math.round((Date.now()-t0)/1000)}s: ${allTasks.length} tasks from ${accountsWithTasks.size} accounts.`);

  // Phase 2: brief data only for accounts that have tasks
  const briefUuids = [...accountsWithTasks];
  const accountResults: any[] = [];
  for (let i = 0; i < briefUuids.length; i += ACCOUNTS_FETCH_CONCURRENCY) {
    const wave = briefUuids.slice(i, i + ACCOUNTS_FETCH_CONCURRENCY);
    const waveResults = await Promise.all(wave.map((uuid) => fetchOneAccountWithBrief(uuid)));
    accountResults.push(...waveResults.filter(Boolean));
  }
  console.log(`[fetch] Phase 2 done in ${Math.round((Date.now()-t0)/1000)}s total: ${accountResults.length} accounts with brief data.`);

  return { tasks: allTasks, accounts: accountResults };
}

/** @deprecated use fetchAllTasksAndAccounts instead */
async function fetchAllTasks(): Promise<any[]> {
  const { tasks } = await fetchAllTasksAndAccounts();
  return tasks;
}

// --- Per-account profile cache (1h TTL) ---
const profileCache = new Map<string, { data: any; fetchedAt: number }>();

async function fetchOneAccountWithBrief(uuid: string): Promise<any | null> {
  try {
    const r = await fetchWithTimeout(
      `${ORBIDI_AUTH_API_BASE}/v1/accounts/accounts-with-brief/${uuid}`,
      { headers: { "X-API-KEY": ORBIDI_AUTH_API_KEY, "Content-Type": "application/json" } },
      ACCOUNT_BRIEF_FETCH_TIMEOUT_MS,
    );
    if (!r.ok) return null;
    const json = await r.json();
    const d = json.data;
    if (!d) return null;
    return {
      account_uuid:            d.uuid,
      company_id:              d.hubspot_client_id || "",
      account_name:            d.profile?.business_name || "",
      active:                  d.active,
      preferred_frequency:     d.preferred_frequency || "",
      preferred_currency:      d.preferred_currency || "",
      created_at:              d.created_at || "",
      category:                d.profile?.category || "",
      website_url:             d.profile?.website_url || "",
      brief_completed:         d.brief?.is_completed === true,
      brief_started_at:        d.brief?.brief_started_at || null,
      // Production API may not return last_brief_completed_at; fall back to brief.updated_at
      // which represents the last time the brief was modified (i.e., when it was completed).
      last_brief_completed_at: d.brief?.last_brief_completed_at
                            || d.brief?.brief_completed_at
                            || (d.brief?.is_completed ? (d.brief?.updated_at || null) : null),
    };
  } catch {
    return null;
  }
}

/** Fetches accounts-with-brief for a given UUID list (used after sync to populate cache). */
async function fetchAccountsForUuids(uuids: string[]): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < uuids.length; i += ACCOUNTS_FETCH_CONCURRENCY) {
    const wave = uuids.slice(i, i + ACCOUNTS_FETCH_CONCURRENCY);
    const waveResults = await Promise.all(wave.map((uuid) => fetchOneAccountWithBrief(uuid)));
    results.push(...waveResults.filter(Boolean));
  }
  return results;
}

/** All accounts-with-brief for all known UUIDs (slow for large lists — use fetchAllTasksAndAccounts instead). */
async function fetchAllAccounts(): Promise<any[]> {
  return fetchAccountsForUuids(ORBIDI_ACCOUNT_UUID_LIST);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  // --- Auth: password validated only on server; session in httpOnly cookie ---
  app.post("/api/auth/login", (req, res) => {
    if (!OPSOS_APP_PASSWORD) {
      return res.status(503).json({ error: "Login no configurado (defina OPSOS_APP_PASSWORD)" });
    }
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Correo y contraseña requeridos" });
    }
    if (password !== OPSOS_APP_PASSWORD) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }
    const emailLower = email.toLowerCase().trim();
    const mgmt = MANAGEMENT_USERS.find((u) => u.email.toLowerCase() === emailLower);
    let user: AuthUser | null = null;
    if (mgmt) {
      user = {
        id: mgmt.id,
        name: mgmt.name,
        email: mgmt.email,
        role: "management",
        title: mgmt.title,
      };
    } else {
      const member = TEAM_DATA.find((m) => m.person_email.toLowerCase() === emailLower);
      if (member) {
        user = {
          id: member.id,
          name: member.person_name,
          email: member.person_email,
          role: "production",
          teamMember: member,
        };
      }
    }
    if (!user) return res.status(401).json({ error: "Usuario no autorizado" });
    const token = signSessionUser(user, SESSION_SIGNING_SECRET);
    res.setHeader("Set-Cookie", buildSetSessionCookie(token));
    return res.json({ user });
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.setHeader("Set-Cookie", buildClearSessionCookie());
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", (req, res) => {
    const user = readSessionCookie(req.headers.cookie, SESSION_SIGNING_SECRET);
    if (!user) return res.status(401).json({ error: "Sin sesión" });
    return res.json({ user });
  });

  const requireApiSession: RequestHandler = (req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    const user = readSessionCookie(req.headers.cookie, SESSION_SIGNING_SECRET);
    if (!user) return res.status(401).json({ error: "No autorizado" });
    next();
  };

  app.use(requireApiSession);

  // --- All tasks (cached 30 min) with server-side filters + pagination ---
  app.get("/api/tasks/all", async (req, res) => {
    const stateFilter    = (req.query.state         as string) || "";
    const teamFilter     = (req.query.team          as string) || "";
    const productFilter  = (req.query.product       as string) || "";
    const actionFilter   = ((req.query.action_filter as string) || "").trim();
    const searchFilter   = ((req.query.search       as string) || "").toLowerCase().trim();
    const workAreaFilter = (req.query.work_area     as string) || "";
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(10_000, Math.max(1, Number(req.query.limit) || 20));

    try {
      // Tasks + accounts are loaded together in startAccountsInitialLoad (two-phase).
      // Both caches are populated simultaneously — no need to fetch tasks independently here.
      if (tasksAllCache && !accountsCache) {
        // Edge case: tasks loaded but accounts not yet (shouldn't happen in two-phase, but guard it)
        startAccountsInitialLoad();
      }

      // Stale tasks: trigger background FAST refresh (known accounts only — schedule handles nightly full scan)
      if (tasksAllCache && accountsCache && (Date.now() - tasksAllCache.fetchedAt) >= TASKS_TTL_MS && !tasksRefreshing) {
        tasksRefreshing = true;
        fetchKnownAccountsOnly().then(async ({ tasks, accounts }) => {
          tasksAllCache = { data: tasks, fetchedAt: Date.now() };
          accountsCache = { data: accounts, fetchedAt: Date.now() };
          await saveCacheSnapshot(accounts, tasks, Date.now());
          console.log(`[tasks/all] Cache refreshed: ${tasks.length} tasks, ${accounts.length} accounts.`);
        }).catch(e => {
          console.error("[tasks/all] Background refresh failed:", e.message);
        }).finally(() => { tasksRefreshing = false; });
      }

      const businessTz   = getBusinessTimeZone();
      const yesterdayYmd = yesterdayYmdInTimeZone(businessTz);

      // Accounts snapshot not loaded yet — client should keep polling cache-status.
      if (!accountsCache) {
        return res.json({
          data: [], total: 0, unique_clients: 0,
          brief_cache_warm: false, page: 1, pages: 1, limit,
          fetched_at: tasksAllCache ? new Date(tasksAllCache.fetchedAt).toISOString() : null,
        });
      }

      // Snapshot loaded but no accounts (API misconfig / all failures) — stop infinite "eligibility" spin.
      if (accountsCache.data.length === 0) {
        return res.json({
          data: [], total: 0, unique_clients: 0,
          brief_cache_warm: true,
          accounts_empty: true,
          page: 1, pages: 1, limit,
          fetched_at: tasksAllCache ? new Date(tasksAllCache.fetchedAt).toISOString() : null,
        });
      }

      const acctMap = new Map<string, any>();
      for (const a of accountsCache.data) acctMap.set(a.account_uuid, a);

      // 1) Task-level filters (Orbidi fields only)
      let data: any[] = (tasksAllCache.data as any[]).slice();
      if (stateFilter) {
        const sf = stateFilter.toUpperCase();
        data = data.filter((t: any) => String(t.task_state ?? "").toUpperCase() === sf);
      }
      if (teamFilter)    data = data.filter((t: any) => t.assigned_team === teamFilter);
      if (productFilter) {
        const pf = productFilter.toUpperCase();
        data = data.filter((t: any) => {
          const cat = marketingProductFromTask(String(t.title ?? ""), String(t.assigned_team ?? ""));
          return cat === pf;
        });
      }
      if (actionFilter) {
        data = data.filter((t: any) => taskMatchesActionFilter((t.title as string) || "", actionFilter));
      }
      if (searchFilter) {
        data = data.filter((t: any) =>
          (t.title as string)?.toLowerCase().includes(searchFilter) ||
          (t.id as string)?.toLowerCase().includes(searchFilter) ||
          (t.clickup_id as string)?.toLowerCase().includes(searchFilter)
        );
      }

      // 2) Cross accounts, 3) brief + client validation (solo Nuevos exige last_brief_completed_at / ayer)
      data = data
        .map((t: any) => {
          const a = acctMap.get(t.client_id);
          return {
            ...t,
            client_name:             a?.account_name            ?? null,
            brief_completed:         a?.brief_completed         === true,
            last_brief_completed_at: a?.last_brief_completed_at ?? null,
          };
        })
        .filter((t: any) => {
          if (workAreaFilter === "nuevos") {
            if (!isValidPoolClientLabel(t.client_name)) return false;
            if (!hasBriefCompletedTimestamp(t.last_brief_completed_at)) return false;
            const completedYmd = calendarYmdInTimeZone(String(t.last_brief_completed_at), businessTz);
            if (!completedYmd || completedYmd !== yesterdayYmd) return false;
            return true;
          }
          if (workAreaFilter === "recurrentes") {
            // Recurrentes: brief must be completed; client label or valid UUID
            if (!t.brief_completed) return false;
            return isRecurrentPoolClientOk(t);
          }
          // Sin work_area (feedback/approved): brief completado es suficiente, sin exigir fecha
          if (!t.brief_completed) return false;
          if (!isValidPoolClientLabel(t.client_name)) return false;
          return true;
        });

      const total         = data.length;
      const uniqueClients = new Set((data as any[]).map((t: any) => t.client_id).filter(Boolean)).size;
      const pages         = Math.ceil(total / limit) || 1;
      const start         = (page - 1) * limit;

      res.json({
        data:             data.slice(start, start + limit),
        total,
        unique_clients:   uniqueClients,
        brief_cache_warm: true,
        page,
        pages,
        limit,
        fetched_at: new Date(tasksAllCache.fetchedAt).toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Proxy: Fetch a single task by its UUID ---
  app.get("/api/task/:uuid", async (req, res) => {
    const { uuid } = req.params;
    try {
      const response = await fetchWithTimeout(
        `${ORBIDI_API_BASE}/task-management/tasks/${uuid}`,
        { headers: orbidiHeaders }
      );
      if (!response.ok) return res.status(404).json({ error: "Task not found" });
      const data = await response.json();
      // The task may not have a client_id in this endpoint; use empty string as fallback
      const clientId = data.account_uuid || data.account_id || "";
      res.json([mapOrbidiTask(data, clientId)]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Proxy: Tasks for one or many accounts (comma-separated), or by task UUID ---
  app.get("/api/tasks", async (req, res) => {
    // Support task_uuid param: search across all known accounts in parallel, stop when found
    const taskUuid = req.query.task_uuid as string | undefined;
    if (taskUuid) {
      try {
        const controller = new AbortController();
        let found: any = null;

        await Promise.all(
          ORBIDI_ACCOUNT_UUID_LIST.map(async (uuid) => {
            if (found) return;
            try {
              const response = await fetchWithTimeout(
                `${ORBIDI_API_BASE}/task-management/accounts/${uuid}/tasks-full`,
                { headers: orbidiHeaders, signal: controller.signal }
              );
              if (!response.ok) return;
              const data = await response.json();
              const match = (data as any[]).find((t) => t.uuid === taskUuid);
              if (match && !found) {
                found = mapOrbidiTask(match, uuid);
                controller.abort();
              }
            } catch { /* aborted or failed — ignore */ }
          })
        );

        return res.json(found ? [found] : []);
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }

    const raw = req.query.account_uuids as string | undefined;
    if (!raw) return res.json([]);

    const uuids = raw.split(",").map(u => u.trim()).filter(Boolean);
    if (!uuids.length) return res.json([]);

    try {
      const results = await Promise.all(
        uuids.map(async (uuid) => {
          const response = await fetchWithTimeout(
            `${ORBIDI_API_BASE}/task-management/accounts/${uuid}/tasks-full`,
            { headers: orbidiHeaders }
          );
          if (!response.ok) return [];
          const data = await response.json();
          return (data as any[]).map((t) => mapOrbidiTask(t, uuid));
        })
      );
      res.json(results.flat());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Proxy: All accounts summary (approved-tasks) ---
  app.get("/api/approved-tasks", async (req, res) => {
    const accountIds = req.query.account_ids as string;
    if (!accountIds) {
      return res.status(400).json({ error: "account_ids query param is required" });
    }
    try {
      const response = await fetchWithTimeout(
        `${ORBIDI_API_BASE}/task-management/accounts/approved-tasks?account_ids=${accountIds}`,
        { headers: orbidiHeaders }
      );
      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: text });
      }
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Proxy: Brief status for an account ---
  app.get("/api/brief-status", async (req, res) => {
    const accountUuid = req.query.account_uuid as string;
    if (!accountUuid) {
      return res.status(400).json({ error: "account_uuid query param is required" });
    }
    try {
      const response = await fetchWithTimeout(
        `${ORBIDI_API_BASE}/space-management/accounts/${accountUuid}/brief`,
        { headers: orbidiHeaders }
      );
      if (!response.ok) {
        return res.json({ has_brief: false, filled_fields: 0, total_fields: 0 });
      }
      const html = await response.text();
      // Extract .field divs and count those with non-empty <p> content (strip HTML tags)
      const fieldMatches = [...html.matchAll(/<div class="field">([\s\S]*?)<\/div>\s*(?=\s*<!--|<div|<\/section)/g)];
      const totalFields = fieldMatches.length;
      let filledFields = 0;
      for (const m of fieldMatches) {
        const inner = m[1];
        const pMatch = inner.match(/<p>([\s\S]*?)<\/p>/);
        if (pMatch) {
          const text = pMatch[1].replace(/<[^>]+>/g, '').trim();
          if (text.length > 0) filledFields++;
        }
      }
      const has_brief = filledFields >= 5;
      // Check FIELD_HAS_WEBSITE: checkbox is checked if it contains 'checked' attribute
      const hasWebsiteMatch = html.match(/id="FIELD_HAS_WEBSITE"([^>]*)/);
      const has_website = hasWebsiteMatch ? hasWebsiteMatch[1].includes("checked") : false;
      res.json({ has_brief, filled_fields: filledFields, total_fields: totalFields, has_website });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Cache status probe (lightweight — no body, just checks if accounts cache is warm) ---
  // If cold, starts a single-flight initial load (high parallelism inside fetchAllAccounts).
  app.get("/api/cache-status", (_req, res) => {
    if (accountsCache === null) startAccountsInitialLoad();

    const ready = accountsCache != null;
    const count = ready ? accountsCache!.data.length : 0;
    const warm = count > 0;
    const warming = accountsCache === null && accountsInitialLoad !== null;

    res.json({
      accounts_cache_ready: ready,
      accounts_cache_warm: warm,
      accounts_count: count,
      /** @deprecated use accounts_cache_ready + accounts_count */
      warming,
      account_uuid_source: ORBIDI_ACCOUNT_UUID_SOURCE,
      orbidi_api_base: ORBIDI_API_BASE,
    });
  });

  app.get("/api/account-uuids", (_req, res) => {
    res.json({ data: ORBIDI_ACCOUNT_UUID_LIST, source: ORBIDI_ACCOUNT_UUID_SOURCE, count: ORBIDI_ACCOUNT_UUID_LIST.length });
  });

  // --- Admin: discover all production accounts from Orbidi Django admin and hot-reload UUID list ---
  let syncInProgress = false;
  app.post("/api/admin/sync-accounts", async (_req, res) => {
    if (syncInProgress) return res.json({ ok: false, error: "Sync ya en progreso" });
    if (!ORBIDI_ADMIN_EMAIL || !ORBIDI_ADMIN_PASSWORD) {
      return res.json({ ok: false, error: "ORBIDI_ADMIN_EMAIL / ORBIDI_ADMIN_PASSWORD no configurados en .env" });
    }
    syncInProgress = true;

    const discovered = new Set<string>(ORBIDI_ACCOUNT_UUID_LIST);
    const prevCount = discovered.size;

    try {
      // Login to Django admin to get session cookie
      const adminLoginUrl = `${ORBIDI_ADMIN_URL}login/`;
      const loginPageRes = await fetchWithTimeout(adminLoginUrl, {
        headers: { "User-Agent": "DeliveryOS-Sync/1.0" },
        redirect: "follow",
      }, 15_000);
      const loginHtml = await loginPageRes.text();
      const csrfMatch = loginHtml.match(/name=["']csrfmiddlewaretoken["'] value=["']([^"'>]+)/);
      if (!csrfMatch) throw new Error("No se pudo obtener CSRF token del admin de Orbidi");
      const csrf = csrfMatch[1];

      // Extract Set-Cookie from login page
      const rawCookies = loginPageRes.headers.getSetCookie?.() ?? [];
      const cookieStr = rawCookies.map((c: string) => c.split(";")[0]).join("; ");

      // POST login
      const loginBody = new URLSearchParams({
        username: ORBIDI_ADMIN_EMAIL,
        password: ORBIDI_ADMIN_PASSWORD,
        csrfmiddlewaretoken: csrf,
        next: "/auth/admin/api/account/",
      });
      const loginRes = await fetchWithTimeout(adminLoginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": adminLoginUrl,
          "User-Agent": "DeliveryOS-Sync/1.0",
          "Cookie": cookieStr,
        },
        body: loginBody.toString(),
        redirect: "manual",
      }, 15_000);

      // Collect session cookie
      const loginSetCookies = loginRes.headers.getSetCookie?.() ?? [];
      const sessionCookies = [...rawCookies, ...loginSetCookies]
        .map((c: string) => c.split(";")[0])
        .join("; ");

      if (!sessionCookies.includes("sessionid")) {
        throw new Error("Login fallido — sessionid no recibido. Verifica ORBIDI_ADMIN_EMAIL y ORBIDI_ADMIN_PASSWORD.");
      }

      // Paginate through admin account list
      const UUID_RE = /\/auth\/admin\/api\/account\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/change\//gi;
      let page = 1;
      let pagesWithNoNew = 0;

      while (page <= 500) {
        try {
          const pageRes = await fetchWithTimeout(
            `${ORBIDI_ADMIN_URL}api/account/?p=${page}`,
            { headers: { "Cookie": sessionCookies, "User-Agent": "DeliveryOS-Sync/1.0" }, redirect: "follow" },
            15_000
          );
          if (!pageRes.ok) break;
          const html = await pageRes.text();
          const uuids = [...html.matchAll(UUID_RE)].map((m) => m[1].toLowerCase());
          if (uuids.length === 0) break;
          const before = discovered.size;
          uuids.forEach((u) => discovered.add(u));
          if (discovered.size === before) pagesWithNoNew++;
          if (pagesWithNoNew > 3) break; // safety: stop if no new UUIDs across multiple pages
          if (uuids.length < 100) break; // last page
          page++;
          await new Promise((r) => setTimeout(r, 120)); // light rate-limit
        } catch { break; }
      }

      const newList = [...discovered].sort();
      const newFromApi = newList.length - prevCount;
      const filePath = path.join(DATA_DIR, "orbidi-account-uuids.txt");
      fs.writeFileSync(filePath, newList.join("\n"), "utf-8");

      ORBIDI_ACCOUNT_UUID_LIST = newList;
      ORBIDI_ACCOUNT_UUID_SOURCE = `data/orbidi-account-uuids.txt (synced ${new Date().toISOString()}, ${newList.length} cuentas)`;
      accountsCache = null;
      tasksAllCache = null;
      console.log(`[sync-accounts] ${newList.length} UUIDs total (${newFromApi} nuevos vs lista anterior). Caches cleared.`);

      // Kick off background reload with new list
      startAccountsInitialLoad();

      return res.json({
        ok: true,
        total: newList.length,
        new_from_api: newFromApi,
        pages_scraped: page,
        source: ORBIDI_ACCOUNT_UUID_SOURCE,
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    } finally {
      syncInProgress = false;
    }
  });

  // --- Auth API: All accounts (server-side daily cache) ---
  // Warm cache on server start (non-blocking); same single-flight as /api/cache-status.
  // On startup: try to restore from disk snapshot first (avoids 30-min cold start after restart)
  const snapshot = await loadCacheSnapshot();
  const now = Date.now();
  if (snapshot) {
    accountsCache = { data: snapshot.accounts, fetchedAt: snapshot.fetchedAt };
    tasksAllCache = { data: snapshot.tasks,    fetchedAt: snapshot.fetchedAt };
    const ageMin = Math.round((now - snapshot.fetchedAt) / 60000);
    console.log(`[accounts-real] Restored from disk snapshot: ${snapshot.accounts.length} accounts, ${snapshot.tasks.length} tasks (${ageMin}min old).`);
    if (now - snapshot.fetchedAt > CACHE_MAX_AGE_MS) {
      console.log("[accounts-real] Snapshot stale — background refresh scheduled.");
      startAccountsBackgroundRefresh();
    }
    // Start fast 45-min refresh cadence (known accounts only)
    startFastRefreshSchedule();
  } else {
    console.log("[accounts-real] No snapshot — scheduling initial accounts load…");
    startAccountsInitialLoad();
  }

  // Nightly full rescan at 3:00 AM Colombia time (updates list of known accounts)
  {
    const scheduleNightlyRescan = () => {
      const tz = "America/Bogota";
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "numeric", minute: "numeric", second: "numeric", hour12: false });
      const [h, m, s] = fmt.format(now).split(":").map(Number);
      // seconds until 3:00 AM Bogota
      const secondsUntil3am = ((3 - h + 24) % 24) * 3600 + (60 - m - 1) * 60 + (60 - s);
      setTimeout(async () => {
        console.log("[nightly-rescan] Starting full rescan (3am)…");
        try {
          const { tasks, accounts } = await fetchAllTasksAndAccounts();
          accountsCache = { data: accounts, fetchedAt: Date.now() };
          tasksAllCache = { data: tasks, fetchedAt: Date.now() };
          await saveCacheSnapshot(accounts, tasks, Date.now());
          console.log(`[nightly-rescan] Done: ${accounts.length} accounts, ${tasks.length} tasks.`);
        } catch (e: any) {
          console.error("[nightly-rescan] Failed:", e?.message);
        }
        // Schedule next night
        scheduleNightlyRescan();
      }, secondsUntil3am * 1000);
      console.log(`[nightly-rescan] Scheduled in ${Math.round(secondsUntil3am/60)}min.`);
    };
    scheduleNightlyRescan();
  }

  app.get("/api/accounts-real", async (req, res) => {
    const forceRefresh = req.query.refresh === "1";

    // Pagination + filter params
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = ((req.query.search as string) || "").toLowerCase().trim();
    const active = req.query.active as string | undefined;
    const brief  = req.query.brief  as string | undefined;
    const freq   = req.query.freq   as string | undefined;

    try {
      const ts = Date.now();

      // Cold cache: return loading unless client forces an immediate fetch
      if (!accountsCache) {
        if (!forceRefresh) {
          return res.json({
            data: [], total: 0, page: 1, pages: 1, limit, loading: true, fetched_at: null,
          });
        }
        console.log("[accounts-real] Cold cache — fetch triggered by refresh=1");
        const fresh = await fetchAllAccounts();
        accountsCache = { data: fresh, fetchedAt: Date.now() };
        console.log(`[accounts-real] Cold load complete. ${fresh.length} accounts.`);
      } else if (forceRefresh) {
        console.log("[accounts-real] Force-refreshing cache...");
        const fresh = await fetchAllAccounts();
        accountsCache = { data: fresh, fetchedAt: ts };
        console.log(`[accounts-real] Cache refreshed. ${fresh.length} accounts.`);
      }

      // Filter
      let data: any[] = accountsCache.data;
      if (search) data = data.filter(a =>
        a.account_uuid?.toLowerCase().includes(search) ||
        a.account_name?.toLowerCase().includes(search) ||
        a.company_id?.toLowerCase().includes(search)
      );
      if (active && active !== "all") data = data.filter(a => String(a.active) === active);
      if (brief  && brief  !== "all") data = data.filter(a => String(a.brief_completed) === brief);
      if (freq   && freq   !== "all") data = data.filter(a => a.preferred_frequency === freq);

      // Paginate
      const total = data.length;
      const pages = Math.ceil(total / limit) || 1;
      const start = (page - 1) * limit;

      res.json({
        data: data.slice(start, start + limit),
        total,
        page,
        pages,
        limit,
        cached: true,
        fetched_at: new Date(accountsCache.fetchedAt).toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Auth API: Full account profile + brief (per-account cache, 1h TTL) ---
  app.get("/api/account-profile/:uuid", async (req, res) => {
    const { uuid } = req.params;
    const cached = profileCache.get(uuid);
    if (cached && (Date.now() - cached.fetchedAt) < ONE_HOUR_MS) {
      return res.json(cached.data);
    }
    try {
      const response = await fetchWithTimeout(
        `${ORBIDI_AUTH_API_BASE}/v1/accounts/accounts-with-brief/${uuid}`,
        { headers: { "X-API-KEY": ORBIDI_AUTH_API_KEY, "Content-Type": "application/json" } }
      );
      if (!response.ok) return res.status(response.status).json({ error: "Account not found" });
      const data = await response.json();
      profileCache.set(uuid, { data, fetchedAt: Date.now() });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/brief-fields", async (req, res) => {
    const accountUuid = req.query.account_uuid as string;
    if (!accountUuid) return res.status(400).json({ error: "account_uuid required" });
    try {
      const response = await fetchWithTimeout(
        `${ORBIDI_API_BASE}/space-management/accounts/${accountUuid}/brief`,
        { headers: orbidiHeaders }
      );
      if (!response.ok) return res.json(null);
      const html = await response.text();

      function extractFieldValue(fieldId: string): string | null {
        // Try to get value from the comment JSON for this field
        const commentRe = new RegExp(`'id': '${fieldId}'[^}]*?'value': ([^}]+?)(?:, '|\\})`);
        const cm = html.match(commentRe);
        if (cm) {
          const raw = cm[1].trim();
          if (raw === 'True') return 'true';
          if (raw === 'False') return 'false';
          if (raw === 'None' || raw === "''") return null;
          return raw.replace(/^'|'$/g, '').replace(/\\'/g, "'").trim() || null;
        }
        return null;
      }

      function extractCheckbox(fieldId: string): boolean {
        const m = html.match(new RegExp(`id="${fieldId}"([^>]*)`));
        return m ? m[1].includes("checked") : false;
      }

      const fields: Record<string, any> = {
        company_name:       extractFieldValue('FIELD_COMPANY_NAME'),
        country:            extractFieldValue('FIELD_COUNTRY'),
        address:            extractFieldValue('FIELD_BILLING_ADDRESS'),
        phone:              extractFieldValue('FIELD_BUSINESS_PHONE'),
        email:              extractFieldValue('FIELD_BUSINESS_EMAIL'),
        category:           extractFieldValue('FIELD_COMPANY_CATEGORY'),
        subcategory:        extractFieldValue('FIELD_COMPANY_SUBCATEGORY'),
        has_website:        extractCheckbox('FIELD_HAS_WEBSITE'),
        website_url:        extractFieldValue('FIELD_WEBSITE_URL'),
        has_social_networks: extractCheckbox('FIELD_HAS_SOCIAL_NETWORKS'),
        instagram_url:      extractFieldValue('FIELD_INSTAGRAM_URL'),
        facebook_url:       extractFieldValue('FIELD_FACEBOOK_URL'),
        relevant_dates:     extractFieldValue('FIELD_RELEVANT_DATES_ANSWER'),
        description:        extractFieldValue('FIELD_BUSINESS_DESCRIPTION') || extractFieldValue('FIELD_DESCRIPTION'),
        target_audience:    extractFieldValue('FIELD_TARGET_AUDIENCE') || extractFieldValue('FIELD_AUDIENCE'),
        is_physical_store:  extractCheckbox('FIELD_IS_PHYSICAL_STORE'),
      };

      // Remove nulls
      Object.keys(fields).forEach(k => { if (fields[k] === null || fields[k] === undefined) delete fields[k]; });

      res.json(fields);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Task status store (production worker progress, persisted to Supabase) ---
  type TaskStatusEntry = { status: "pending" | "in_progress" | "done"; closedAt: string | null; userId: string; updatedAt: string; };
  const TASK_STATUS_FILE = path.join(DATA_DIR, "task-statuses.json");
  const taskStatusStore: Record<string, TaskStatusEntry> = await kvGet("task-statuses", loadJson(TASK_STATUS_FILE, {}));

  async function saveTaskStatuses() {
    await kvSet("task-statuses", taskStatusStore);
    saveJson(TASK_STATUS_FILE, taskStatusStore); // local backup
  }

  app.get("/api/task-statuses", (_req, res) => {
    res.json(taskStatusStore);
  });

  app.post("/api/task-statuses", async (req, res) => {
    const { userId, taskId, status, closedAt } = req.body as {
      userId: string; taskId: string; status: string; closedAt: string | null;
    };
    if (!userId || !taskId || !status) {
      return res.status(400).json({ error: "userId, taskId, status required" });
    }
    taskStatusStore[taskId] = {
      status: status as "pending" | "in_progress" | "done",
      closedAt: closedAt ?? null,
      userId,
      updatedAt: new Date().toISOString(),
    };
    await saveTaskStatuses();
    res.json({ ok: true });
  });

  // --- Assignment store (persisted to Supabase + local backup) ---
  const ASSIGNMENT_FILE = path.join(DATA_DIR, "last-assignment.json");
  const ASSIGNMENT_HISTORY_DIR = path.join(DATA_DIR, "assignment-history");
  if (!fs.existsSync(ASSIGNMENT_HISTORY_DIR)) fs.mkdirSync(ASSIGNMENT_HISTORY_DIR, { recursive: true });

  // --- Feedback history: task_id → last assignee (survives across runs/days) ---
  const FEEDBACK_HISTORY_FILE = path.join(DATA_DIR, "feedback-history.json");
  type FeedbackEntry = { person_id: string; person_name: string; assigned_at: string };
  const feedbackHistoryStore: Record<string, FeedbackEntry> =
    await kvGet("feedback-history", loadJson(FEEDBACK_HISTORY_FILE, {}));

  async function saveFeedbackHistory() {
    await kvSet("feedback-history", feedbackHistoryStore);
    saveJson(FEEDBACK_HISTORY_FILE, feedbackHistoryStore);
  }

  let lastAssignmentResult: any = await kvGet("last-assignment", loadJson(ASSIGNMENT_FILE, null));

  app.get("/api/assignment/last", (_req, res) => {
    if (!lastAssignmentResult) return res.status(404).json({ error: "No assignment run yet" });
    res.json(lastAssignmentResult);
  });

  /** Returns list of available historical assignment dates */
  app.get("/api/assignment/history", (_req, res) => {
    try {
      const files = fs.readdirSync(ASSIGNMENT_HISTORY_DIR)
        .filter(f => f.endsWith(".json"))
        .sort()
        .reverse()
        .slice(0, 30); // last 30 files
      res.json({ dates: files.map(f => f.replace(".json", "")) });
    } catch { res.json({ dates: [] }); }
  });

  /** Returns a specific historical assignment by date+mode key (e.g. 2026-04-22_feedback) */
  app.get("/api/assignment/history/:key", (req, res) => {
    const { key } = req.params;
    if (!/^[\w-]+$/.test(key)) return res.status(400).json({ error: "Invalid key" });
    const file = path.join(ASSIGNMENT_HISTORY_DIR, `${key}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "Not found" });
    res.json(loadJson(file, null));
  });

  // --- Assignment engine ---
  app.post("/api/assignment/run", async (req, res) => {
    try {
      const { target_date, days_window = 5, work_mode = "nuevos", deadline, person_ids, product_filter, action_filter } = req.body as {
        target_date: string; days_window?: number; work_mode?: string; deadline?: string;
        person_ids?: string[]; product_filter?: string; action_filter?: string;
      };
      if (!target_date) return res.status(400).json({ error: "target_date required (YYYY-MM-DD)" });

      // Fetch accounts list (use server cache)
      const accounts: AccountMeta[] = (accountsCache?.data ?? []).map((a: any) => ({
        account_uuid:            a.account_uuid,
        account_name:            a.account_name,
        brief_started_at:        a.brief_started_at        ?? null,
        brief_completed:         a.brief_completed         === true,
        last_brief_completed_at: a.last_brief_completed_at ?? null,
      }));

      const RELEVANT_STATES = new Set(["TASK_CREATED", "TASK_PENDING_TO_APPLY_CHANGES", "TASK_APPROVED"]);
      let rawTasks: RawTask[] = [];

      if (tasksAllCache) {
        // Always use cached data — background refresh (fast/nightly) keeps it current
        rawTasks = tasksAllCache.data
          .filter((t: any) => RELEVANT_STATES.has(t.task_state) && !t.is_blocked)
          .map((t: any): RawTask => ({
            id:            t.id,
            account_uuid:  t.client_id,   // mapOrbidiTask stores account UUID in client_id
            title:         t.title,
            task_state:    t.task_state,
            task_group:    t.task_group,
            assigned_team: t.assigned_team || "",
            is_blocked:    !!t.is_blocked,
            deliverables:  t.deliverables || [],
          }));
        const cacheAgeMin = Math.round((Date.now() - tasksAllCache.fetchedAt) / 60000);
        console.log(`[assignment/run] Using cache (${cacheAgeMin}min old): ${rawTasks.length} relevant tasks.`);
      } else {
        // No cache at all — do a one-time fast fetch of known accounts
        console.log(`[assignment/run] No cache — fast fetch of known accounts.`);
        const knownUuids = accountsCache?.data?.map((a: any) => a.account_uuid as string) ?? ORBIDI_ACCOUNT_UUID_LIST.slice(0, 2000);
        const BATCH = 50;
        for (let i = 0; i < knownUuids.length; i += BATCH) {
          const batch = knownUuids.slice(i, i + BATCH);
          const batchResults = await Promise.all(
            batch.map(async (uuid: string) => {
              try {
                const r = await fetchWithTimeout(
                  `${ORBIDI_API_BASE}/task-management/accounts/${uuid}/tasks-full`,
                  { headers: orbidiHeaders }
                );
                if (!r.ok) return [];
                const data: any[] = await r.json();
                return data
                  .filter((t: any) => RELEVANT_STATES.has(t.task_state) && !t.is_blocked)
                  .map((t: any): RawTask => ({
                    id:            t.uuid,
                    account_uuid:  uuid,
                    title:         t.friendly_id || t.title || "",
                    task_state:    t.task_state,
                    task_group:    t.friendly_id?.split(" - ").slice(2).join(" - ") || null,
                    assigned_team: t.assigned_team || "",
                    is_blocked:    !!t.is_blocked,
                    deliverables:  t.deliverables || [],
                  }));
              } catch { return []; }
            })
          );
          rawTasks.push(...batchResults.flat());
        }
        console.log(`[assignment/run] No-cache fetch done: ${rawTasks.length} relevant tasks.`);
      }

      const options: AssignmentOptions = {};
      if (person_ids?.length)  options.personIds    = person_ids;
      if (product_filter)      options.productFilter = product_filter;
      if (action_filter)       options.actionFilter  = action_filter;

      // Apply PM team overrides
      options.teamOverrides = { ...teamOverridesStore } as Record<string, { roles: any[]; workAreas: any[] }>;

      // Exclude tasks already marked done by workers
      const doneIds = new Set<string>(
        Object.entries(taskStatusStore)
          .filter(([, v]) => v.status === "done")
          .map(([id]) => id)
      );
      if (doneIds.size > 0) options.doneTaskIds = doneIds;

      // Pass feedback history for continuity (prior assignee priority)
      if (work_mode === "feedback") {
        options.feedbackHistory = feedbackHistoryStore;
      }

      const result = runAssignment(accounts, rawTasks, target_date, days_window, work_mode as any, options);
      const enriched = { ...result, deadline: deadline ?? null };
      lastAssignmentResult = enriched;
      await kvSet("last-assignment", enriched);
      saveJson(ASSIGNMENT_FILE, enriched);

      // Save to daily history (keyed by date + work_mode)
      const historyKey = `${target_date}_${work_mode}`;
      await kvSet(`assignment-history:${historyKey}`, enriched);
      saveJson(path.join(ASSIGNMENT_HISTORY_DIR, `${historyKey}.json`), enriched);

      // Update feedback history: record who was assigned each feedback task this run
      if (work_mode === "feedback") {
        const now = new Date().toISOString();
        for (const sched of result.schedules) {
          for (const day of sched.days) {
            for (const t of day.tasks) {
              if (t.is_feedback) {
                feedbackHistoryStore[t.task_id] = {
                  person_id:   sched.person_id,
                  person_name: sched.person_name,
                  assigned_at: now,
                };
              }
            }
          }
        }
        await saveFeedbackHistory();
      }

      res.json(enriched);
    } catch (err: any) {
      console.error("[assignment/run] error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  /** Expose feedback history so the UI can show "Trabajada previamente por: X" */
  app.get("/api/feedback-history", (_req, res) => {
    res.json(feedbackHistoryStore);
  });

  // --- Team member overrides (roles + work areas editable by PM, persisted to Supabase) ---
  const TEAM_OVERRIDES_FILE = path.join(DATA_DIR, "team-overrides.json");
  const teamOverridesStore: Record<string, { roles: string[]; workAreas: string[] }> =
    await kvGet("team-overrides", loadJson(TEAM_OVERRIDES_FILE, {}));

  async function saveTeamOverrides() {
    await kvSet("team-overrides", teamOverridesStore);
    saveJson(TEAM_OVERRIDES_FILE, teamOverridesStore);
  }

  app.get("/api/team-overrides", (_req, res) => {
    res.json(teamOverridesStore);
  });

  app.post("/api/team-overrides/:personId", async (req, res) => {
    const { personId } = req.params;
    const { roles, workAreas } = req.body as { roles?: string[]; workAreas?: string[] };
    if (!personId) return res.status(400).json({ error: "personId required" });
    teamOverridesStore[personId] = {
      roles:     Array.isArray(roles)     ? roles     : [],
      workAreas: Array.isArray(workAreas) ? workAreas : [],
    };
    await saveTeamOverrides();
    return res.json({ ok: true, data: teamOverridesStore[personId] });
  });

  // --- Mock: Clients (no Orbidi endpoint yet) ---
  app.get("/api/clients", (_req, res) => {
    res.json([]);
  });

  // --- Mock: Users ---
  app.get("/api/users", (_req, res) => {
    res.json([]);
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OpsOS Server running on http://localhost:${PORT}`);
  });
}

startServer();
