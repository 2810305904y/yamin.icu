import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { siteData } from "../content/site-data.mjs";
import { handleSiteDataRequest } from "../../api/site-data-store.mjs";

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
  assert.equal(body.data.identity.title, "鸦珉.icu");
});

test("site data API rejects production writes without the admin token", async () => {
  const response = await handleSiteDataRequest({
    method: "PUT",
    headers: {},
    body: JSON.stringify(siteData),
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
    body: JSON.stringify(nextData),
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

test("Supabase setup SQL keeps site data behind service-role writes", async () => {
  const sql = await readFile("supabase/site_pages.sql", "utf8");

  assert.match(sql, /create table if not exists public\.site_pages/);
  assert.match(sql, /alter table public\.site_pages enable row level security/);
  assert.match(sql, /revoke all on table public\.site_pages from anon, authenticated/);
  assert.match(sql, /grant select, insert, update on table public\.site_pages to service_role/);
});
