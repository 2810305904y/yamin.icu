import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_TABLE = "site_pages";
const DEFAULT_BACKUP_TABLE = "site_page_backups";
const DEFAULT_PAGE_ID = "homepage-v1";
const LOCAL_DATA_PATH = resolve(process.cwd(), "data", "site-data.local.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonResponse(status, body) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
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

function getAdminToken(headers) {
  const bearer = getHeader(headers, "Authorization");
  if (bearer.startsWith("Bearer ")) return bearer.slice(7).trim();
  return getHeader(headers, "X-Admin-Token").trim();
}

function hasSupabaseConfig(env = {}) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseSettings(env = {}) {
  return {
    url: String(env.SUPABASE_URL || "").replace(/\/$/, ""),
    key: String(env.SUPABASE_SERVICE_ROLE_KEY || ""),
    table: String(env.SITE_DATA_TABLE || DEFAULT_TABLE),
    backupTable: String(env.SITE_DATA_BACKUP_TABLE || DEFAULT_BACKUP_TABLE),
    pageId: String(env.SITE_DATA_ID || DEFAULT_PAGE_ID),
  };
}

function assertValidSiteData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("站点数据必须是对象。");
  }
  if (!data.identity || typeof data.identity.title !== "string" || typeof data.identity.subtitle !== "string") {
    throw new Error("站点签名数据不完整。");
  }

  ["projects", "todos", "thoughts", "channels"].forEach((section) => {
    if (!Array.isArray(data[section])) {
      throw new Error(`${section} 必须是列表。`);
    }
  });

  return clone(data);
}

async function defaultReadLocalData() {
  try {
    const raw = await readFile(LOCAL_DATA_PATH, "utf8");
    return assertValidSiteData(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function defaultWriteLocalData(data) {
  await mkdir(dirname(LOCAL_DATA_PATH), { recursive: true });
  await writeFile(LOCAL_DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readSupabaseData({ env, fetchFn }) {
  const settings = getSupabaseSettings(env);
  const url = `${settings.url}/rest/v1/${settings.table}?select=data&id=eq.${encodeURIComponent(settings.pageId)}&limit=1`;
  const response = await fetchFn(url, {
    method: "GET",
    headers: {
      apikey: settings.key,
      Authorization: `Bearer ${settings.key}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed: ${response.status}`);
  }

  const rows = await response.json();
  const data = rows?.[0]?.data;
  return data ? assertValidSiteData(data) : null;
}

async function writeSupabaseData(data, { env, fetchFn }) {
  const settings = getSupabaseSettings(env);
  const url = `${settings.url}/rest/v1/${settings.table}`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      apikey: settings.key,
      Authorization: `Bearer ${settings.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      id: settings.pageId,
      data,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed: ${response.status}`);
  }
}

function countThoughts(data) {
  return Array.isArray(data.thoughts) ? data.thoughts.length : 0;
}

function makeBackupRecord(data, settings, reason) {
  return {
    id: `${settings.pageId}-${Date.now()}-${randomUUID()}`,
    page_id: settings.pageId,
    reason,
    data,
    thought_count: countThoughts(data),
    created_at: new Date().toISOString(),
  };
}

async function writeSupabaseBackup(data, reason, { env, fetchFn }) {
  const settings = getSupabaseSettings(env);
  const record = makeBackupRecord(data, settings, reason);
  const url = `${settings.url}/rest/v1/${settings.backupTable}`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      apikey: settings.key,
      Authorization: `Bearer ${settings.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    throw new Error(`Supabase backup failed: ${response.status}`);
  }

  return {
    id: record.id,
    pageId: record.page_id,
    reason: record.reason,
    thoughtCount: record.thought_count,
    createdAt: record.created_at,
  };
}

async function writeSupabaseDataWithBackups(nextData, { env, fetchFn }) {
  let previousData;
  try {
    previousData = await readSupabaseData({ env, fetchFn });
  } catch (error) {
    throw new Error(`保存前无法读取线上数据，已停止保存：${error.message}`);
  }

  const backup = {};
  if (previousData) {
    backup.before = await writeSupabaseBackup(previousData, "before-save", { env, fetchFn });
  }

  await writeSupabaseData(nextData, { env, fetchFn });

  try {
    backup.after = await writeSupabaseBackup(nextData, "after-save", { env, fetchFn });
  } catch (error) {
    backup.warning = `数据已保存，但保存后备份失败：${error.message}`;
  }

  return backup;
}

async function parseRequestData(body) {
  const payload = typeof body === "string" ? JSON.parse(body || "{}") : body || {};
  return assertValidSiteData(payload.data || payload);
}

function parseRequestPayload(body) {
  if (typeof body === "string") return JSON.parse(body || "{}");
  return body || {};
}

function canWrite(headers, env = {}) {
  const expected = env.SITE_ADMIN_TOKEN;
  if (!expected) return !env.VERCEL;
  return getAdminToken(headers) === expected;
}

function canRunBackup(headers, env = {}) {
  const cronSecret = env.CRON_SECRET;
  if (cronSecret && getAdminToken(headers) === cronSecret) return true;
  return canWrite(headers, env);
}

export async function handleSiteDataRequest({
  method,
  headers,
  body,
  env = process.env,
  fallbackData,
  fetchFn = fetch,
  readLocalData = defaultReadLocalData,
  writeLocalData = defaultWriteLocalData,
}) {
  if (method === "OPTIONS") {
    return jsonResponse(204, {});
  }

  if (method === "GET") {
    if (hasSupabaseConfig(env)) {
      try {
        const supabaseData = await readSupabaseData({ env, fetchFn });
        if (supabaseData) return jsonResponse(200, { source: "supabase", data: supabaseData });
      } catch (error) {
        return jsonResponse(200, {
          source: "static",
          data: assertValidSiteData(fallbackData),
          databaseError: error.message,
        });
      }
    }

    const localData = await readLocalData();
    if (localData) return jsonResponse(200, { source: "local", data: localData });

    return jsonResponse(200, { source: "static", data: assertValidSiteData(fallbackData) });
  }

  if (method === "PUT") {
    if (!canWrite(headers, env)) {
      return jsonResponse(401, { error: "需要后台保存口令。" });
    }

    let nextData;
    try {
      nextData = await parseRequestData(body);
    } catch (error) {
      return jsonResponse(400, { error: error.message });
    }

    if (hasSupabaseConfig(env)) {
      try {
        const backup = await writeSupabaseDataWithBackups(nextData, { env, fetchFn });
        return jsonResponse(200, { source: "supabase", data: nextData, backup });
      } catch (error) {
        return jsonResponse(502, { error: error.message });
      }
    }

    if (env.VERCEL) {
      return jsonResponse(501, { error: "线上还没有配置数据库环境变量。" });
    }

    await writeLocalData(nextData);
    return jsonResponse(200, { source: "local", data: nextData });
  }

  return jsonResponse(405, { error: "不支持这个请求方式。" });
}

export async function handleSiteDataBackupRequest({
  method,
  headers,
  body,
  env = process.env,
  fetchFn = fetch,
}) {
  if (method === "OPTIONS") {
    return jsonResponse(204, {});
  }

  if (method !== "GET" && method !== "POST") {
    return jsonResponse(405, { error: "不支持这个请求方式。" });
  }

  if (!canRunBackup(headers, env)) {
    return jsonResponse(401, { error: "需要后台备份口令。" });
  }

  if (!hasSupabaseConfig(env)) {
    return jsonResponse(501, { error: "备份需要先配置 Supabase 数据库。" });
  }

  let reason = "manual-backup";
  if (method === "POST") {
    try {
      const payload = parseRequestPayload(body);
      if (payload.reason) reason = String(payload.reason);
    } catch {
      return jsonResponse(400, { error: "备份请求格式不正确。" });
    }
  }

  try {
    const currentData = await readSupabaseData({ env, fetchFn });
    if (!currentData) return jsonResponse(404, { error: "没有找到可备份的线上数据。" });

    const backup = await writeSupabaseBackup(currentData, reason, { env, fetchFn });
    return jsonResponse(200, { source: "supabase", backup });
  } catch (error) {
    return jsonResponse(502, { error: error.message });
  }
}
