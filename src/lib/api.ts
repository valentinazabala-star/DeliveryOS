import { Task, Client, User } from "../types";

const API_BASE = "/api";

function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, credentials: "include" });
}

export const api = {
  accountUuids: {
    list: async (): Promise<string[]> => {
      const res = await apiFetch(`${API_BASE}/account-uuids`);
      if (!res.ok) return [];
      const j = (await res.json()) as { data?: string[] };
      return Array.isArray(j.data) ? j.data : [];
    },
  },
  tasks: {
    list: async (accountUuids: string): Promise<Task[]> => {
      if (!accountUuids.trim()) return [];
      const res = await apiFetch(`${API_BASE}/tasks?account_uuids=${encodeURIComponent(accountUuids)}`);
      if (!res.ok) return [];
      return res.json();
    },
    listAll: async (params: { state?: string; team?: string; product?: string; action_filter?: string; search?: string; page?: number; limit?: number; work_area?: string } = {}): Promise<{ data: Task[]; total: number; unique_clients: number; brief_cache_warm: boolean; accounts_empty?: boolean; page: number; pages: number }> => {
      const q = new URLSearchParams();
      if (params.state)            q.set("state",         params.state);
      if (params.team)             q.set("team",          params.team);
      if (params.product)          q.set("product",       params.product);
      if (params.action_filter)    q.set("action_filter", params.action_filter);
      if (params.search?.trim())   q.set("search",        params.search.trim());
      if (params.page)             q.set("page",          String(params.page));
      if (params.limit)            q.set("limit",         String(params.limit));
      if (params.work_area)        q.set("work_area",     params.work_area);
      const res = await apiFetch(`${API_BASE}/tasks/all?${q}`);
      if (!res.ok) return { data: [], total: 0, unique_clients: 0, brief_cache_warm: true, page: 1, pages: 1 };
      return res.json();
    },
    getByTaskId: async (taskUuid: string): Promise<Task[]> => {
      const res = await apiFetch(`${API_BASE}/tasks?task_uuid=${taskUuid}`);
      if (!res.ok) return [];
      return res.json();
    },
  },
  briefStatus: {
    get: async (accountUuid: string): Promise<{ has_brief: boolean; filled_fields: number; total_fields: number; has_website: boolean }> => {
      const res = await apiFetch(`${API_BASE}/brief-status?account_uuid=${accountUuid}`);
      if (!res.ok) return { has_brief: false, filled_fields: 0, total_fields: 0, has_website: false };
      return res.json();
    },
  },
  briefFields: {
    get: async (accountUuid: string): Promise<Record<string, any> | null> => {
      const res = await apiFetch(`${API_BASE}/brief-fields?account_uuid=${accountUuid}`);
      if (!res.ok) return null;
      return res.json();
    },
  },
  accountsReal: {
    list: async (params: {
      page?: number; limit?: number; search?: string;
      active?: string; brief?: string; freq?: string;
      forceRefresh?: boolean;
    } = {}): Promise<{ data: any[]; total: number; page: number; pages: number; loading?: boolean }> => {
      const q = new URLSearchParams();
      if (params.forceRefresh)        q.set("refresh", "1");
      if (params.page)                q.set("page",    String(params.page));
      if (params.limit)               q.set("limit",   String(params.limit));
      if (params.search?.trim())      q.set("search",  params.search.trim());
      if (params.active && params.active !== "all") q.set("active", params.active);
      if (params.brief  && params.brief  !== "all") q.set("brief",  params.brief);
      if (params.freq   && params.freq   !== "all") q.set("freq",   params.freq);
      const res = await apiFetch(`${API_BASE}/accounts-real?${q}`);
      if (!res.ok) return { data: [], total: 0, page: 1, pages: 1 };
      const json = await res.json();
      return {
        data:    json.data    ?? [],
        total:   json.total   ?? 0,
        page:    json.page    ?? 1,
        pages:   json.pages   ?? 1,
        loading: json.loading ?? false,
      };
    },
  },
  accountProfile: {
    get: async (accountUuid: string): Promise<Record<string, any> | null> => {
      const res = await apiFetch(`${API_BASE}/account-profile/${accountUuid}`);
      if (!res.ok) return null;
      return res.json();
    },
  },
  taskStatuses: {
    getAll: async (): Promise<Record<string, { status: string; closedAt: string | null; userId: string; updatedAt: string }>> => {
      const res = await apiFetch(`${API_BASE}/task-statuses`);
      if (!res.ok) return {};
      return res.json();
    },
    set: async (userId: string, taskId: string, status: string, closedAt: string | null): Promise<void> => {
      await apiFetch(`${API_BASE}/task-statuses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, taskId, status, closedAt }),
      });
    },
  },
  assignment: {
    run: async (params: {
      target_date: string; days_window?: number; work_mode?: string; deadline?: string;
      person_ids?: string[]; product_filter?: string; action_filter?: string;
    }): Promise<any> => {
      const res = await apiFetch(`${API_BASE}/assignment/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    getLast: async (): Promise<any | null> => {
      const res = await apiFetch(`${API_BASE}/assignment/last`);
      if (!res.ok) return null;
      return res.json();
    },
  },
  teamOverrides: {
    getAll: async (): Promise<Record<string, { roles: string[]; workAreas: string[] }>> => {
      const res = await apiFetch(`${API_BASE}/team-overrides`);
      if (!res.ok) return {};
      return res.json();
    },
    set: async (personId: string, roles: string[], workAreas: string[]): Promise<void> => {
      await apiFetch(`${API_BASE}/team-overrides/${personId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles, workAreas }),
      });
    },
  },
  cacheStatus: {
    get: async (): Promise<{
      accounts_cache_ready: boolean;
      accounts_cache_warm: boolean;
      accounts_count: number;
      warming: boolean;
      account_uuid_source?: string;
      orbidi_api_base?: string;
    }> => {
      const res = await apiFetch(`${API_BASE}/cache-status`);
      if (!res.ok) {
        return { accounts_cache_ready: false, accounts_cache_warm: false, accounts_count: 0, warming: false };
      }
      return res.json();
    },
    syncAccounts: async (): Promise<{ ok: boolean; total?: number; new_from_api?: number; source?: string; error?: string }> => {
      const res = await apiFetch(`${API_BASE}/admin/sync-accounts`, { method: "POST" });
      if (!res.ok) return { ok: false, error: await res.text() };
      return res.json();
    },
    getUuidList: async (): Promise<{ count: number; source: string }> => {
      const res = await apiFetch(`${API_BASE}/account-uuids`);
      if (!res.ok) return { count: 0, source: "" };
      return res.json();
    },
  },
  clients: {
    list: async (): Promise<Client[]> => {
      const res = await apiFetch(`${API_BASE}/clients`);
      if (!res.ok) return [];
      return res.json();
    },
  },
  users: {
    list: async (): Promise<User[]> => {
      const res = await apiFetch(`${API_BASE}/users`);
      if (!res.ok) return [];
      return res.json();
    },
  },
};
