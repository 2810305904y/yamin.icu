import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { authorizeAdminRequest, authorizeCronOrAdminRequest } from "./admin-auth.mjs";

const DEFAULT_TABLE = "site_pages";
const DEFAULT_BACKUP_TABLE = "site_page_backups";
const DEFAULT_PAGE_ID = "homepage-v1";
const LOCAL_DATA_PATH = resolve(process.cwd(), "data", "site-data.local.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class RevisionConflictError extends Error {
  constructor(message, currentRevision = null) {
    super(message);
    this.name = "RevisionConflictError";
    this.currentRevision = currentRevision;
  }
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

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

function authHeaders(auth = {}) {
  return auth.setCookie ? { "Set-Cookie": Array.isArray(auth.setCookie) ? auth.setCookie : [auth.setCookie] } : {};
}

function getHeaderValue(headers = {}, name) {
  if (typeof headers.get === "function") return headers.get(name);

  const normalizedName = String(name).toLowerCase();
  const match = Object.entries(headers).find(([key]) => String(key).toLowerCase() === normalizedName);
  return match ? match[1] : "";
}

function normalizeHost(value) {
  return String(value || "")
    .split(",")[0]
    .trim()
    .replace(/:\d+$/, "")
    .toLowerCase();
}

function isTestServiceHost(hostname) {
  const host = normalizeHost(hostname);
  return (
    host === "test.xn--idyr71g.icu" ||
    host === "yamin-icu-test.vercel.app" ||
    (host.startsWith("yamin-icu-test-") && host.endsWith(".vercel.app"))
  );
}

function isOnlineSaveDisabled({ headers = {}, env = {} }) {
  if (String(env.SITE_DISABLE_ONLINE_SAVE || "") === "1") return true;
  const forwardedHost = getHeaderValue(headers, "x-forwarded-host");
  const host = forwardedHost || getHeaderValue(headers, "host");
  return isTestServiceHost(host);
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

export function createSiteDataRevision(data) {
  return createHash("sha256")
    .update(stableSerialize(assertValidSiteData(data)), "utf8")
    .digest("hex");
}

function siteDataResponse(source, data, extra = {}) {
  return jsonResponse(200, {
    source,
    data,
    revision: createSiteDataRevision(data),
    ...extra,
  });
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

async function writeSupabaseDataWithBackups(nextData, { env, fetchFn, expectedRevision }) {
  let previousData;
  try {
    previousData = await readSupabaseData({ env, fetchFn });
  } catch (error) {
    throw new Error(`保存前无法读取线上数据，已停止保存：${error.message}`);
  }

  const currentRevision = previousData ? createSiteDataRevision(previousData) : "";
  if (!expectedRevision) {
    throw new RevisionConflictError("线上内容已经变化或编辑台缺少基准版本，请重新加载当前线上内容后再保存。", currentRevision);
  }
  if (currentRevision !== expectedRevision) {
    throw new RevisionConflictError("线上内容已经变化，当前编辑台基于旧版本，已停止保存以避免覆盖新内容。", currentRevision);
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

  return {
    backup,
    revision: createSiteDataRevision(nextData),
  };
}

function parseRequestPayload(body) {
  if (typeof body === "string") return JSON.parse(body || "{}");
  return body || {};
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
        if (supabaseData) return siteDataResponse("supabase", supabaseData);
      } catch (error) {
        return siteDataResponse("static", assertValidSiteData(fallbackData), {
          databaseError: error.message,
        });
      }
    }

    if (!env.VERCEL) {
      const localData = await readLocalData();
      if (localData) return siteDataResponse("local", localData);
    }

    return siteDataResponse("static", assertValidSiteData(fallbackData));
  }

  if (method === "PUT") {
    if (isOnlineSaveDisabled({ headers, env })) {
      return jsonResponse(403, { error: "测试服已禁用线上保存，不会写入主站或数据库。" });
    }

    const auth = await authorizeAdminRequest({ headers, env, fetchFn });
    if (!auth.ok) {
      return jsonResponse(401, { error: "需要后台保存口令。" }, authHeaders(auth));
    }

    let nextData;
    let expectedRevision = "";
    try {
      const payload = parseRequestPayload(body);
      nextData = assertValidSiteData(payload.data || payload);
      expectedRevision = typeof payload.expectedRevision === "string" ? payload.expectedRevision : "";
    } catch (error) {
      return jsonResponse(400, { error: error.message });
    }

    if (hasSupabaseConfig(env)) {
      try {
        const result = await writeSupabaseDataWithBackups(nextData, { env, fetchFn, expectedRevision });
        return jsonResponse(200, {
          source: "supabase",
          data: nextData,
          revision: result.revision,
          backup: result.backup,
        }, authHeaders(auth));
      } catch (error) {
        if (error instanceof RevisionConflictError) {
          return jsonResponse(409, {
            error: error.message,
            currentRevision: error.currentRevision,
          }, authHeaders(auth));
        }
        return jsonResponse(502, { error: error.message });
      }
    }

    if (env.VERCEL) {
      return jsonResponse(501, { error: "线上还没有配置数据库环境变量。" });
    }

    await writeLocalData(nextData);
    return jsonResponse(200, {
      source: "local",
      data: nextData,
      revision: createSiteDataRevision(nextData),
    }, authHeaders(auth));
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

  const auth = await authorizeCronOrAdminRequest({ headers, env, fetchFn });
  if (!auth.ok) {
    return jsonResponse(401, { error: "需要后台备份口令。" }, authHeaders(auth));
  }

  if (isOnlineSaveDisabled({ headers, env })) {
    return jsonResponse(403, { error: "测试服已禁用线上备份，不会写入主站或数据库。" }, authHeaders(auth));
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
    return jsonResponse(200, { source: "supabase", backup }, authHeaders(auth));
  } catch (error) {
    return jsonResponse(502, { error: error.message });
  }
}
