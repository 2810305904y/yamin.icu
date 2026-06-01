import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin editor is available as a static page", async () => {
  const html = await readFile("admin/index.html", "utf8");

  assert.match(html, /内容编辑台/);
  assert.match(html, /\/admin\/admin\.mjs/);
  assert.match(html, /\/admin\/styles\.css/);
  assert.match(html, /data-preview-projects/);
  assert.match(html, /data-editor-list/);
});

test("admin editor supports local draft and data export workflow", async () => {
  const script = await readFile("admin/admin.mjs", "utf8");

  assert.match(script, /yamin\.siteDataDraft\.v1/);
  assert.match(script, /saveDraft/);
  assert.match(script, /downloadDataFile/);
  assert.match(script, /getDefaults/);
  assert.match(script, /moveItem/);
  assert.match(script, /deleteItem/);
  assert.match(script, /renderPreview/);
});

test("preview server routes root and admin pages", async () => {
  const server = await readFile("v1/server.mjs", "utf8");

  assert.match(server, /join\(root, "index\.html"\)/);
  assert.match(server, /pathname === "\/admin"/);
  assert.match(server, /join\(root, "admin", "index\.html"\)/);
});
