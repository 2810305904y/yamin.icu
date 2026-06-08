import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { siteData } from "../content/site-data.mjs";
import { handleAdminSessionRequest } from "../../api/admin-auth.mjs";
import { createSiteDataRevision, handleSiteDataBackupRequest, handleSiteDataRequest } from "../../api/site-data-store.mjs";

test("site data API reads bundled content when no database or local copy exists", async () => {
  const response = await handleSiteDataRequest({
    method: "GET",
    headers: {},
    env: {},
    fallbackData: siteData,
    readLocalData: async () => null,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.source, "static");
  assert.equal(body.revision, createSiteDataRevision(siteData));
  assert.equal(body.data.identity.title, "鸦珉.icu");
});

test("site data API ignores local preview data on Vercel without database config", async () => {
  const localDraft = {
    ...siteData,
    identity: {
      ...siteData.identity,
      title: "不应该上线的本地草稿",
    },
  };

  const response = await handleSiteDataRequest({
    method: "GET",
    headers: {},
    env: { VERCEL: "1" },
    fallbackData: siteData,
    readLocalData: async () => localDraft,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.source, "static");
  assert.equal(body.data.identity.title, "鸦珉.icu");
});

test("site data API rejects production writes without the admin token", async () => {
  const response = await handleSiteDataRequest({
    method: "PUT",
    headers: {},
    body: JSON.stringify({
      data: siteData,
      expectedRevision: createSiteDataRevision(siteData),
    }),
    env: {
      VERCEL: "1",
      SITE_ADMIN_TOKEN: "secret",
    },
    fallbackData: siteData,
  });

  assert.equal(response.status, 401);
});

test("site data API can save local preview data without database config", async () => {
  const nextData = {
    ...siteData,
    identity: {
      ...siteData.identity,
      title: "本地保存测试",
    },
  };
  let savedData;

  const response = await handleSiteDataRequest({
    method: "PUT",
    headers: {},
    body: JSON.stringify({
      data: nextData,
      expectedRevision: createSiteDataRevision(siteData),
    }),
    env: {},
    fallbackData: siteData,
    writeLocalData: async (value) => {
      savedData = value;
    },
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.source, "local");
  assert.equal(savedData.identity.title, "本地保存测试");
});

test("site data API uses Supabase REST when database config is present", async () => {
  const calls = [];
  const response = await handleSiteDataRequest({
    method: "GET",
    headers: {},
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fallbackData: siteData,
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => [{ data: { ...siteData, identity: { title: "数据库内容", subtitle: "测试" } } }],
      };
    },
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.source, "supabase");
  assert.equal(body.data.identity.title, "数据库内容");
  assert.equal(calls[0].url, "https://example.supabase.co/rest/v1/site_pages?select=data&id=eq.homepage-v1&limit=1");
  assert.equal(calls[0].options.headers.Authorization, "Bearer service-key");
});

test("site data API can read Supabase through read-only config on test service hosts", async () => {
  const calls = [];
  const response = await handleSiteDataRequest({
    method: "GET",
    headers: {
      Host: "test.xn--idyr71g.icu",
    },
    env: {
      VERCEL: "1",
      SITE_DATA_READ_SUPABASE_URL: "https://readonly.supabase.co",
      SITE_DATA_READ_SUPABASE_KEY: "read-public-key",
    },
    fallbackData: siteData,
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => [{ data: { ...siteData, identity: { title: "正式服只读内容", subtitle: "测试" } } }],
      };
    },
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.source, "supabase");
  assert.equal(body.data.identity.title, "正式服只读内容");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].url, "https://readonly.supabase.co/rest/v1/site_pages?select=data&id=eq.homepage-v1&limit=1");
  assert.equal(calls[0].options.headers.Authorization, "Bearer read-public-key");
});

test("site data API does not use read-only Supabase config for writes", async () => {
  const calls = [];
  const response = await handleSiteDataRequest({
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
    },
    body: JSON.stringify({
      data: siteData,
      expectedRevision: createSiteDataRevision(siteData),
    }),
    env: {
      VERCEL: "1",
      SITE_ADMIN_TOKEN: "secret",
      SITE_DATA_READ_SUPABASE_URL: "https://readonly.supabase.co",
      SITE_DATA_READ_SUPABASE_KEY: "read-public-key",
    },
    fallbackData: siteData,
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => [{ data: siteData }],
      };
    },
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 501);
  assert.match(body.error, /可写数据库环境变量/);
  assert.equal(calls.length, 0);
});

test("site data API creates Supabase backups around online writes", async () => {
  const calls = [];
  const nextData = {
    ...siteData,
    thoughts: [
      ...siteData.thoughts,
      {
        id: "thought-backup-test",
        order: 999,
        visible: true,
        text: "备份测试念头",
      },
    ],
  };

  const response = await handleSiteDataRequest({
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
    },
    body: JSON.stringify({
      data: nextData,
      expectedRevision: createSiteDataRevision(siteData),
    }),
    env: {
      SITE_ADMIN_TOKEN: "secret",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fallbackData: siteData,
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "GET") {
        return {
          ok: true,
          json: async () => [{ data: siteData }],
        };
      }
      return {
        ok: true,
        json: async () => [],
      };
    },
  });
  const body = JSON.parse(response.body);
  const backupCalls = calls.filter((call) => call.url.includes("/rest/v1/site_page_backups"));
  const pageWriteCalls = calls.filter((call) => call.url === "https://example.supabase.co/rest/v1/site_pages" && call.options.method === "POST");
  const backupBodies = backupCalls.map((call) => JSON.parse(call.options.body));

  assert.equal(response.status, 200);
  assert.equal(body.source, "supabase");
  assert.equal(body.revision, createSiteDataRevision(nextData));
  assert.equal(backupCalls.length, 2);
  assert.equal(pageWriteCalls.length, 1);
  assert.equal(backupBodies[0].reason, "before-save");
  assert.equal(backupBodies[0].thought_count, siteData.thoughts.length);
  assert.equal(backupBodies[1].reason, "after-save");
  assert.equal(backupBodies[1].thought_count, nextData.thoughts.length);
});

test("site data API disables online writes on test service hosts", async () => {
  const calls = [];
  const nextData = {
    ...siteData,
    identity: {
      ...siteData.identity,
      subtitle: "测试服不应保存到主站",
    },
  };

  const response = await handleSiteDataRequest({
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
      Host: "test.xn--idyr71g.icu",
    },
    body: JSON.stringify({
      data: nextData,
      expectedRevision: createSiteDataRevision(siteData),
    }),
    env: {
      VERCEL: "1",
      SITE_ADMIN_TOKEN: "secret",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      SITE_DATA_ID: "homepage-v1",
    },
    fallbackData: siteData,
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => [{ data: siteData }],
      };
    },
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 403);
  assert.match(body.error, /测试服已禁用线上保存/);
  assert.equal(calls.length, 0);
});

test("site data API rejects online writes from a stale editing revision", async () => {
  const calls = [];
  const nextData = {
    ...siteData,
    identity: {
      ...siteData.identity,
      subtitle: "旧编辑台误保存测试",
    },
  };

  const response = await handleSiteDataRequest({
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
    },
    body: JSON.stringify({
      data: nextData,
      expectedRevision: "stale-revision",
    }),
    env: {
      SITE_ADMIN_TOKEN: "secret",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fallbackData: siteData,
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "GET") {
        return {
          ok: true,
          json: async () => [{ data: siteData }],
        };
      }
      return {
        ok: true,
        json: async () => [],
      };
    },
  });
  const body = JSON.parse(response.body);
  const pageWriteCalls = calls.filter((call) => call.url === "https://example.supabase.co/rest/v1/site_pages" && call.options.method === "POST");

  assert.equal(response.status, 409);
  assert.match(body.error, /线上内容已经变化/);
  assert.equal(pageWriteCalls.length, 0);
});

test("admin session login stores only a token hash and sets an HttpOnly cookie", async () => {
  const calls = [];
  const response = await handleAdminSessionRequest({
    method: "POST",
    headers: {
      "User-Agent": "test-browser",
    },
    body: JSON.stringify({ password: "secret", trustDevice: true }),
    env: {
      VERCEL: "1",
      SITE_ADMIN_TOKEN: "secret",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => [],
      };
    },
  });
  const body = JSON.parse(response.body);
  const sessionRecord = JSON.parse(calls[0].options.body);
  const setCookie = response.headers["Set-Cookie"][0];

  assert.equal(response.status, 200);
  assert.equal(body.authenticated, true);
  assert.equal(body.trusted, true);
  assert.equal(calls[0].url, "https://example.supabase.co/rest/v1/admin_sessions");
  assert.equal(sessionRecord.token_hash.length, 64);
  assert.notEqual(sessionRecord.token_hash, "secret");
  assert.equal(sessionRecord.trusted, true);
  assert.match(setCookie, /yamin_admin_session=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Max-Age=15552000/);
});

test("site data API accepts a trusted admin session cookie and renews it", async () => {
  const loginCalls = [];
  const loginResponse = await handleAdminSessionRequest({
    method: "POST",
    headers: {},
    body: JSON.stringify({ password: "secret", trustDevice: true }),
    env: {
      VERCEL: "1",
      SITE_ADMIN_TOKEN: "secret",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fetchFn: async (url, options) => {
      loginCalls.push({ url, options });
      return {
        ok: true,
        json: async () => [],
      };
    },
  });
  const cookie = loginResponse.headers["Set-Cookie"][0].split(";")[0];
  const sessionRecord = JSON.parse(loginCalls[0].options.body);
  const calls = [];

  const response = await handleSiteDataRequest({
    method: "PUT",
    headers: {
      Cookie: cookie,
    },
    body: JSON.stringify({
      data: siteData,
      expectedRevision: createSiteDataRevision(siteData),
    }),
    env: {
      VERCEL: "1",
      SITE_ADMIN_TOKEN: "secret",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fallbackData: siteData,
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("/rest/v1/admin_sessions") && options.method === "GET") {
        return {
          ok: true,
          json: async () => [{
            id: sessionRecord.id,
            token_hash: sessionRecord.token_hash,
            trusted: true,
            expires_at: sessionRecord.expires_at,
            revoked_at: null,
          }],
        };
      }
      if (options.method === "GET") {
        return {
          ok: true,
          json: async () => [{ data: siteData }],
        };
      }
      return {
        ok: true,
        json: async () => [],
      };
    },
  });
  const sessionPatch = calls.find((call) => call.url.includes("/rest/v1/admin_sessions") && call.options.method === "PATCH");

  assert.equal(response.status, 200);
  assert.match(response.headers["Set-Cookie"][0], /yamin_admin_session=/);
  assert.ok(sessionPatch);
  assert.ok(JSON.parse(sessionPatch.options.body).expires_at);
});

test("site data API stops online writes when the current Supabase data cannot be read", async () => {
  const calls = [];
  const response = await handleSiteDataRequest({
    method: "PUT",
    headers: {
      Authorization: "Bearer secret",
    },
    body: JSON.stringify(siteData),
    env: {
      SITE_ADMIN_TOKEN: "secret",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fallbackData: siteData,
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: false,
        status: 503,
        json: async () => [],
      };
    },
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 502);
  assert.match(body.error, /保存前无法读取线上数据/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
});

test("site data backup endpoint snapshots current Supabase content", async () => {
  const calls = [];
  const response = await handleSiteDataBackupRequest({
    method: "POST",
    headers: {
      Authorization: "Bearer cron-secret",
    },
    body: JSON.stringify({ reason: "weekly-backup" }),
    env: {
      CRON_SECRET: "cron-secret",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "GET") {
        return {
          ok: true,
          json: async () => [{ data: siteData }],
        };
      }
      return {
        ok: true,
        json: async () => [],
      };
    },
  });
  const body = JSON.parse(response.body);
  const backupBody = JSON.parse(calls[1].options.body);

  assert.equal(response.status, 200);
  assert.equal(body.source, "supabase");
  assert.equal(body.backup.reason, "weekly-backup");
  assert.equal(backupBody.reason, "weekly-backup");
  assert.equal(backupBody.thought_count, siteData.thoughts.length);
});

test("Supabase setup SQL keeps site data behind service-role writes", async () => {
  const sql = await readFile("supabase/site_pages.sql", "utf8");

  assert.match(sql, /create table if not exists public\.site_pages/);
  assert.match(sql, /create table if not exists public\.site_page_backups/);
  assert.match(sql, /create table if not exists public\.admin_sessions/);
  assert.match(sql, /site_page_backups_page_created_idx/);
  assert.match(sql, /admin_sessions_token_hash_idx/);
  assert.match(sql, /alter table public\.site_pages enable row level security/);
  assert.match(sql, /alter table public\.site_page_backups enable row level security/);
  assert.match(sql, /alter table public\.admin_sessions enable row level security/);
  assert.match(sql, /revoke all on table public\.site_pages from anon, authenticated/);
  assert.match(sql, /grant select on table public\.site_pages to anon/);
  assert.match(sql, /create policy "Public homepage can be read"/);
  assert.match(sql, /on public\.site_pages/);
  assert.match(sql, /for select/);
  assert.match(sql, /to anon/);
  assert.match(sql, /using \(id = 'homepage-v1'\)/);
  assert.match(sql, /revoke all on table public\.site_page_backups from anon, authenticated/);
  assert.match(sql, /revoke all on table public\.admin_sessions from anon, authenticated/);
  assert.match(sql, /grant select, insert, update on table public\.site_pages to service_role/);
  assert.match(sql, /grant select, insert on table public\.site_page_backups to service_role/);
  assert.match(sql, /grant select, insert, update on table public\.admin_sessions to service_role/);
});
