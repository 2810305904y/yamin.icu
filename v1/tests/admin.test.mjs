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
  assert.match(html, /data-preview-section="projects"/);
  assert.match(html, /data-preview-section="todos"/);
  assert.match(html, /data-preview-section="thoughts"/);
  assert.match(html, /data-preview-section="channels"/);
});

test("admin editor supports local draft and data export workflow", async () => {
  const script = await readFile("admin/admin.mjs", "utf8");
  const html = await readFile("admin/index.html", "utf8");

  assert.match(script, /yamin\.siteDataDraft\.v1/);
  assert.match(script, /saveDraft/);
  assert.match(script, /saveOnline/);
  assert.match(script, /\/api\/site-data/);
  assert.match(script, /yamin\.adminToken\.v1/);
  assert.match(script, /downloadDataFile/);
  assert.match(script, /getDefaults/);
  assert.match(script, /moveItem/);
  assert.match(script, /deleteItem/);
  assert.match(script, /renderPreview/);
  assert.match(script, /data-preview-section/);
  assert.match(html, /保存到线上/);
});

test("admin preview follows current editing section and hides thought color editing", async () => {
  const script = await readFile("admin/admin.mjs", "utf8");
  const fieldMarkupStart = script.indexOf("function fieldMarkup");
  const thoughtBlockStart = script.indexOf('if (section === "thoughts")', fieldMarkupStart);
  const channelBlockStart = script.indexOf('return `\n    ${textInput("名称"', thoughtBlockStart);
  const thoughtBlock = script.slice(thoughtBlockStart, channelBlockStart);
  const styles = await readFile("admin/styles.css", "utf8");
  const siteStyles = await readFile("v1/styles.css", "utf8");

  assert.match(script, /section\.style\.order/);
  assert.match(styles, /\.preview-panel\s*{[^}]*position:\s*sticky/s);
  assert.doesNotMatch(thoughtBlock, /selectInput\("颜色", "tone"/);
  assert.match(siteStyles, /\.todo-pink/);
  assert.match(siteStyles, /\.todo-red/);
});

test("admin shell sits above the shared cloud background", async () => {
  const styles = await readFile("admin/styles.css", "utf8");
  const html = await readFile("admin/index.html", "utf8");

  assert.match(styles, /\.admin-page::before\s*{[^}]*opacity:\s*0\.18/s);
  assert.match(styles, /\.admin-shell\s*{[^}]*z-index:\s*1/s);
  assert.match(styles, /\.admin-shell\s*{[^}]*background:\s*rgba\(255, 255, 255, 0\.94\)/s);
  assert.match(styles, /\.editor-panel,[\s\S]*?\.preview-panel\s*{[^}]*background:\s*rgba\(255, 255, 255, 0\.93\)/s);
  assert.match(html, /\/admin\/styles\.css\?v=1\.26-admin-cloud-shield/);
});

test("homepage cloud layer sits below the translucent map frame", async () => {
  const siteStyles = await readFile("v1/styles.css", "utf8");

  assert.match(siteStyles, /body::before/);
  assert.match(siteStyles, /url\("\.\/assets\/cloud-layer\.svg"\)/);
  assert.match(siteStyles, /cloud-image-drift-left/);
  assert.match(siteStyles, /background-size:\s*3200px 900px/);
  assert.match(siteStyles, /background-repeat:\s*repeat-x/);
  assert.match(siteStyles, /\.page\s*{[^}]*z-index:\s*1/s);
  assert.match(siteStyles, /\.map-frame\s*{[^}]*rgba\(244, 250, 255, 0\.(?:1[5-9]|2)\)/s);
  assert.doesNotMatch(siteStyles, /\.map-frame::after/);
  assert.doesNotMatch(siteStyles, /frame-cloud-drift/);
});

test("desktop map frame keeps a balanced wide layout while scaling on short screens", async () => {
  const siteStyles = await readFile("v1/styles.css", "utf8");

  assert.match(siteStyles, /width:\s*min\(2400px,\s*calc\(100vw - 28px\),\s*calc\(\(100vh - 28px\) \* 2\)\)/);
  assert.match(siteStyles, /aspect-ratio:\s*2\s*\/\s*1/);
  assert.doesNotMatch(siteStyles, /height:\s*min\(calc\(100vh - 28px\),\s*calc\(\(100vw - 28px\) \* 0\.5625\)\)/);
});

test("preview server routes root and admin pages", async () => {
  const server = await readFile("v1/server.mjs", "utf8");

  assert.match(server, /join\(root, "index\.html"\)/);
  assert.match(server, /pathname === "\/admin"/);
  assert.match(server, /join\(root, "admin", "index\.html"\)/);
  assert.match(server, /pathname === "\/api\/site-data"/);
});
