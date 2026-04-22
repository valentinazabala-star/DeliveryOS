import crypto from "crypto";
import type { AuthUser } from "./src/types";

const COOKIE_NAME = "opsos_session";
const MAX_AGE_SEC = 7 * 24 * 3600;

export { COOKIE_NAME, MAX_AGE_SEC };

export function signSessionUser(user: AuthUser, secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const inner = JSON.stringify({ exp, user });
  const payloadPart = Buffer.from(inner, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payloadPart).digest("base64url");
  return `${payloadPart}.${sig}`;
}

export function verifySessionToken(token: string, secret: string): AuthUser | null {
  const last = token.lastIndexOf(".");
  if (last <= 0) return null;
  const payloadPart = token.slice(0, last);
  const sig = token.slice(last + 1);
  const expected = crypto.createHmac("sha256", secret).update(payloadPart).digest("base64url");
  const sb = Buffer.from(sig, "utf8");
  const eb = Buffer.from(expected, "utf8");
  if (sb.length !== eb.length || !crypto.timingSafeEqual(sb, eb)) return null;
  let inner: string;
  try {
    inner = Buffer.from(payloadPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
  let data: { exp: number; user: AuthUser };
  try {
    data = JSON.parse(inner);
  } catch {
    return null;
  }
  if (typeof data.exp !== "number" || !data.user) return null;
  if (Math.floor(Date.now() / 1000) > data.exp) return null;
  return data.user;
}

export function readSessionCookie(cookieHeader: string | undefined, secret: string): AuthUser | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (name !== COOKIE_NAME) continue;
    const raw = part.slice(idx + 1).trim();
    let value: string;
    try {
      value = decodeURIComponent(raw);
    } catch {
      value = raw;
    }
    return verifySessionToken(value, secret);
  }
  return null;
}

export function buildSetSessionCookie(token: string): string {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SEC}`,
  ];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return attrs.join("; ");
}

export function buildClearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
