import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const DEFAULT_SESSION_TABLE = "admin_sessions";
const SESSION_COOKIE_NAME = "yamin_admin_session";
const SHORT_SESSION_SECONDS = 3 * 60 * 60;
const TRUSTED_SESSION_SECONDS = 180 * 24 * 60 * 60;

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function getHeader(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";

  const lowerName = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName);
  const value = entry?.[1];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function getBearerToken(headers) {
  const bearer = getHeader(headers, "Authorization");
  if (bearer.startsWith("Bearer ")) return bearer.slice(7).trim();
  return getHeader(headers, "X-Admin-Token").trim();
}

function getCookie(headers, name) {
  const cookieHeader = getHeader(headers, "Cookie");
  const cookies = cookieHeader.split(";").map((part) => part.trim()).filter(Boolean);
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

function safeEquals(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && timingSafeEqual(left, right);
}

function hasSupabaseConfig(env = {}) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseSettings(env = {}) {
  return {
    url: String(env.SUPABASE_URL || "").replace(/\/$/, ""),
    key: String(env.SUPABASE_SERVICE_ROLE_KEY || ""),
    sessionTable: String(env.ADMIN_SESSION_TABLE || DEFAULT_SESSION_TABLE),
  };
}

function makeSupabaseHeaders(settings) {
  return {
    apikey: settings.key,
    Authorization: `Bearer ${settings.key}`,
    "Content-Type": "application/json",
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function makeSessionCookie(token, maxAge, env = {}) {
  const secure = env.VERCEL || env.ADMIN_COOKIE_SECURE === "1";
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

function makeClearCookie(env = {}) {
  const secure = env.VERCEL || env.ADMIN_COOKIE_SECURE === "1";
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

function cookieHeaders(setCookie) {
  return setCookie ? { "Set-Cookie": Array.isArray(setCookie) ? setCookie : [setCookie] } : {};
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

function sessionDuration(trusted) {
  return trusted ? TRUSTED_SESSION_SECONDS : SHORT_SESSION_SECONDS;
}

function isValidAdminSecret(value, env = {}) {
  const expected = env.SITE_ADMIN_TOKEN;
  if (!expected) return !env.VERCEL;
  return safeEquals(value, expected);
}

export function isCronSecret(headers, env = {}) {
  const expected = env.CRON_SECRET;
  return Boolean(expected && safeEquals(getBearerToken(headers), expected));
}

async function insertSession(record, { env, fetchFn }) {
  const settings = getSupabaseSettings(env);
  const url = `${settings.url}/rest/v1/${settings.sessionTable}`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      ...makeSupabaseHeaders(settings),
      Prefer: "return=representation",
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    throw new Error(`Supabase session insert failed: ${response.status}`);
  }
}

async function readSessionByToken(token, { env, fetchFn }) {
  const settings = getSupabaseSettings(env);
  const tokenHash = hashToken(token);
  const url = `${settings.url}/rest/v1/${settings.sessionTable}?select=id,token_hash,trusted,expires_at,revoked_at&token_hash=eq.${tokenHash}&limit=1`;
  const response = await fetchFn(url, {
    method: "GET",
    headers: makeSupabaseHeaders(settings),
  });

  if (!response.ok) {
    throw new Error(`Supabase session read failed: ${response.status}`);
  }

  const rows = await response.json();
  return rows?.[0] || null;
}

async function patchSession(id, changes, { env, fetchFn }) {
  const settings = getSupabaseSettings(env);
  const url = `${settings.url}/rest/v1/${settings.sessionTable}?id=eq.${encodeURIComponent(id)}`;
  const response = await fetchFn(url, {
    method: "PATCH",
    headers: makeSupabaseHeaders(settings),
    body: JSON.stringify(changes),
  });

  if (!response.ok) {
    throw new Error(`Supabase session update failed: ${response.status}`);
  }
}

export async function createAdminSession({
  password,
  trustDevice = false,
  headers = {},
  env = process.env,
  fetchFn = fetch,
}) {
  if (!isValidAdminSecret(password, env)) {
    return { ok: false, status: 401, body: { error: "后台口令不正确。" } };
  }

  if (!hasSupabaseConfig(env)) {
    if (env.VERCEL) {
      return { ok: false, status: 501, body: { error: "线上还没有配置数据库环境变量。" } };
    }
    return {
      ok: true,
      status: 200,
      body: { authenticated: true, source: "local" },
      setCookie: null,
    };
  }

  const trusted = trustDevice === true;
  const now = new Date();
  const maxAge = sessionDuration(trusted);
  const expiresAt = addSeconds(now, maxAge).toISOString();
  const token = randomBytes(32).toString("base64url");
  const record = {
    id: randomUUID(),
    token_hash: hashToken(token),
    trusted,
    user_agent: getHeader(headers, "User-Agent").slice(0, 500),
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    expires_at: expiresAt,
    revoked_at: null,
  };

  await insertSession(record, { env, fetchFn });

  return {
    ok: true,
    status: 200,
    body: {
      authenticated: true,
      trusted,
      expiresAt,
    },
    setCookie: makeSessionCookie(token, maxAge, env),
  };
}

export async function readAdminSession({
  headers = {},
  env = process.env,
  fetchFn = fetch,
  renewTrusted = false,
}) {
  const token = getCookie(headers, SESSION_COOKIE_NAME);
  if (!token) return { ok: false };

  if (!hasSupabaseConfig(env)) {
    return { ok: !env.VERCEL, source: "local" };
  }

  let row;
  try {
    row = await readSessionByToken(token, { env, fetchFn });
  } catch (error) {
    return { ok: false, error: error.message };
  }

  if (!row || row.revoked_at) {
    return { ok: false, setCookie: makeClearCookie(env) };
  }

  const now = new Date();
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    return { ok: false, setCookie: makeClearCookie(env) };
  }

  let expiresAt = row.expires_at;
  let setCookie = null;
  if (renewTrusted && row.trusted === true) {
    const maxAge = sessionDuration(true);
    expiresAt = addSeconds(now, maxAge).toISOString();
    setCookie = makeSessionCookie(token, maxAge, env);
    try {
      await patchSession(row.id, {
        last_seen_at: now.toISOString(),
        expires_at: expiresAt,
      }, { env, fetchFn });
    } catch {
      setCookie = null;
      expiresAt = row.expires_at;
    }
  }

  return {
    ok: true,
    trusted: row.trusted === true,
    expiresAt,
    setCookie,
  };
}

export async function revokeAdminSession({
  headers = {},
  env = process.env,
  fetchFn = fetch,
}) {
  const token = getCookie(headers, SESSION_COOKIE_NAME);
  if (token && hasSupabaseConfig(env)) {
    try {
      const row = await readSessionByToken(token, { env, fetchFn });
      if (row) {
        await patchSession(row.id, { revoked_at: new Date().toISOString() }, { env, fetchFn });
      }
    } catch {
      // Clearing the browser cookie is still useful even if the database update fails.
    }
  }

  return {
    ok: true,
    status: 200,
    body: { authenticated: false },
    setCookie: makeClearCookie(env),
  };
}

export async function authorizeAdminRequest({
  headers = {},
  env = process.env,
  fetchFn = fetch,
}) {
  const bearer = getBearerToken(headers);
  if (isValidAdminSecret(bearer, env)) return { ok: true };
  if (!env.VERCEL && !env.SITE_ADMIN_TOKEN) return { ok: true };

  return readAdminSession({ headers, env, fetchFn, renewTrusted: true });
}

export async function authorizeCronOrAdminRequest({
  headers = {},
  env = process.env,
  fetchFn = fetch,
}) {
  if (isCronSecret(headers, env)) return { ok: true };
  return authorizeAdminRequest({ headers, env, fetchFn });
}

export async function handleAdminSessionRequest({
  method,
  headers,
  body,
  env = process.env,
  fetchFn = fetch,
}) {
  if (method === "OPTIONS") {
    return jsonResponse(204, {});
  }

  if (method === "GET") {
    const session = await readAdminSession({ headers, env, fetchFn, renewTrusted: true });
    if (!session.ok) {
      return jsonResponse(401, { authenticated: false }, cookieHeaders(session.setCookie));
    }
    return jsonResponse(200, {
      authenticated: true,
      trusted: session.trusted === true,
      expiresAt: session.expiresAt,
    }, cookieHeaders(session.setCookie));
  }

  if (method === "POST") {
    let payload;
    try {
      payload = typeof body === "string" ? JSON.parse(body || "{}") : body || {};
    } catch {
      return jsonResponse(400, { error: "授权请求格式不正确。" });
    }

    try {
      const session = await createAdminSession({
        password: String(payload.password || ""),
        trustDevice: payload.trustDevice === true,
        headers,
        env,
        fetchFn,
      });
      return jsonResponse(session.status, session.body, cookieHeaders(session.setCookie));
    } catch (error) {
      return jsonResponse(502, { error: error.message });
    }
  }

  if (method === "DELETE") {
    const session = await revokeAdminSession({ headers, env, fetchFn });
    return jsonResponse(session.status, session.body, cookieHeaders(session.setCookie));
  }

  return jsonResponse(405, { error: "不支持这个请求方式。" });
}
