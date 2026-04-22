/** Trim trailing slashes for safe concatenation. */
function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * Prod-line API/console path prefix (brief, gallery, task admin).
 * Override with VITE_ORBIDI_PROD_LINE_BASE (e.g. https://eu.api.orbidi.com/prod-line).
 */
export const ORBIDI_PROD_LINE_BASE = stripTrailingSlash(
  (import.meta.env.VITE_ORBIDI_PROD_LINE_BASE as string | undefined)?.trim() ||
    "https://eu.api.orbidi.com/prod-line"
);

/**
 * Console origin for Auth admin links (/auth/admin/...).
 * Override with VITE_ORBIDI_CONSOLE_ORIGIN (e.g. https://eu.api.orbidi.com).
 */
export const ORBIDI_CONSOLE_ORIGIN = stripTrailingSlash(
  (import.meta.env.VITE_ORBIDI_CONSOLE_ORIGIN as string | undefined)?.trim() ||
    "https://eu.api.orbidi.com"
);

export function orbidiAccountBriefUrl(accountUuid: string): string {
  return `${ORBIDI_PROD_LINE_BASE}/space-management/accounts/${accountUuid}/brief`;
}

export function orbidiAccountGalleryUrl(accountUuid: string): string {
  return `${ORBIDI_PROD_LINE_BASE}/space-management/accounts/${accountUuid}/gallery/attachments`;
}

export function orbidiTaskAdminChangeUrl(taskId: string): string {
  return `${ORBIDI_PROD_LINE_BASE}/admin/api/task/${taskId}/change/`;
}

export function orbidiAccountAdminChangeUrl(accountUuid: string): string {
  return `${ORBIDI_CONSOLE_ORIGIN}/auth/admin/api/account/${accountUuid}/change/`;
}
