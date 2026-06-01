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

  assert.match(script, /yamin\.siteDataDraft\.v1/);
  assert.match(script, /saveDraft/);
  assert.match(script, /downloadDataFile/);
  assert.match(script, /getDefaults/);
  assert.match(script, /moveItem/);
  assert.match(script, /deleteItem/);
  assert.match(script, /renderPreview/);
  assert.match(script, /data-preview-section/);
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

test("homepage cloud layer sits below the translucent map frame", async () => {
  const siteStyles = await readFile("v1/styles.css", "utf8");

  assert.match(siteStyles, /body::before/);
  assert.match(siteStyles, /url\("\.\/assets\/cloud-layer\.svg"\)/);
  assert.match(siteStyles, /cloud-image-drift-left/);
  assert.match(siteStyles, /\.page\s*{[^}]*z-index:\s*1/s);
  assert.match(siteStyles, /\.map-frame\s*{[^}]*rgba\(244, 250, 255, 0\.2\)/s);
  assert.doesNotMatch(siteStyles, /\.map-frame::after/);
  assert.doesNotMatch(siteStyles, /frame-cloud-drift/);
});

test("preview server routes root and admin pages", async () => {
  const server = await readFile("v1/server.mjs", "utf8");

  assert.match(server, /join\(root, "index\.html"\)/);
  assert.match(server, /pathname === "\/admin"/);
  assert.match(server, /join\(root, "admin", "index\.html"\)/);
});
