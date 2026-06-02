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
  const script = (await readFile("admin/admin.mjs", "utf8")).replaceAll("\r\n", "\n");
  const fieldMarkupStart = script.indexOf("function fieldMarkup");
  const defaultsStart = script.indexOf('if (section === "thoughts")');
  const defaultsEnd = script.indexOf('return {\n    id: makeId("channel")', defaultsStart);
  const defaultsBlock = script.slice(defaultsStart, defaultsEnd);
  const thoughtBlockStart = script.indexOf('if (section === "thoughts")', fieldMarkupStart);
  const channelBlockStart = script.indexOf('return `\n    ${textInput("名称"', thoughtBlockStart);
  const thoughtBlock = script.slice(thoughtBlockStart, channelBlockStart);
  const renderEditorStart = script.indexOf("function renderEditor");
  const renderEditorEnd = script.indexOf("function renderPreview", renderEditorStart);
  const renderEditorBlock = script.slice(renderEditorStart, renderEditorEnd);
  const styles = await readFile("admin/styles.css", "utf8");
  const siteStyles = await readFile("v1/styles.css", "utf8");

  assert.match(script, /section\.style\.order/);
  assert.match(styles, /\.preview-panel\s*{[^}]*position:\s*sticky/s);
  assert.match(renderEditorBlock, /activeSection === "thoughts"\s*\?\s*""/);
  assert.match(styles, /\.thought-editor-card\s*{[^}]*border-radius:\s*999px/s);
  assert.doesNotMatch(thoughtBlock, /selectInput\("颜色", "tone"/);
  assert.doesNotMatch(defaultsBlock, /tone:\s*"blue"/);
  assert.match(script, /function prepareSiteDataForSave/);
  assert.match(script, /data\.thoughts = \(data\.thoughts \|\| \[\]\)\.map\(\(\{ tone, \.\.\.thought \}\) => thought\)/);
  assert.match(script, /JSON\.stringify\(prepareSiteDataForSave\(state\)\)/);
  assert.match(siteStyles, /\.todo-pink/);
  assert.match(siteStyles, /\.todo-red/);
});

test("admin reorders items by writing fresh order values", async () => {
  const script = await readFile("admin/admin.mjs", "utf8");
  const moveStart = script.indexOf("function moveItem");
  const moveEnd = script.indexOf("function fieldMarkup", moveStart);
  const moveBlock = script.slice(moveStart, moveEnd);

  assert.match(moveBlock, /\[items\[index\], items\[nextIndex\]\]/);
  assert.match(moveBlock, /state\[section\]\s*=\s*items\.map/);
  assert.match(moveBlock, /order:\s*\(itemIndex \+ 1\) \* 10/);
  assert.doesNotMatch(moveBlock, /normalizeOrder\(section\)/);
});

test("admin shell sits above the shared cloud background", async () => {
  const styles = await readFile("admin/styles.css", "utf8");
  const html = await readFile("admin/index.html", "utf8");

  assert.match(styles, /\.admin-page::before\s*{[^}]*opacity:\s*0\.18/s);
  assert.match(styles, /\.admin-shell\s*{[^}]*z-index:\s*1/s);
  assert.match(styles, /\.admin-shell\s*{[^}]*background:\s*rgba\(255, 255, 255, 0\.94\)/s);
  assert.match(styles, /\.editor-panel,[\s\S]*?\.preview-panel\s*{[^}]*background:\s*rgba\(255, 255, 255, 0\.93\)/s);
  assert.match(html, /\/admin\/styles\.css\?v=1\.27-admin-editor-controls/);
  assert.match(html, /\/admin\/admin\.mjs\?v=1\.27-admin-editor-controls/);
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

test("project cards keep a slightly slimmer desktop footprint", async () => {
  const siteStyles = await readFile("v1/styles.css", "utf8");
  const rootHtml = await readFile("index.html", "utf8");
  const v1Html = await readFile("v1/index.html", "utf8");

  assert.match(siteStyles, /grid-template-columns:\s*minmax\(200px,\s*0\.94fr\)\s*minmax\(200px,\s*0\.94fr\)\s*minmax\(300px,\s*1\.4fr\)/);
  assert.doesNotMatch(siteStyles, /grid-template-columns:\s*minmax\(210px,\s*1fr\)\s*minmax\(210px,\s*1fr\)\s*minmax\(280px,\s*1\.28fr\)/);
  assert.match(rootHtml, /\/v1\/styles\.css\?v=1\.35-thought-edge-buffer/);
  assert.match(rootHtml, /\/v1\/scripts\/render-site\.mjs\?v=1\.35-thought-edge-buffer/);
  assert.match(v1Html, /\.\/styles\.css\?v=1\.35-thought-edge-buffer/);
  assert.match(v1Html, /\.\/scripts\/render-site\.mjs\?v=1\.35-thought-edge-buffer/);
});

test("todo panel keeps extra items inside its own scroll area", async () => {
  const siteStyles = await readFile("v1/styles.css", "utf8");

  assert.match(siteStyles, /\.panel-todos\s*{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\)/s);
  assert.match(siteStyles, /\.panel-todos\s*{[^}]*overflow:\s*hidden/s);
  assert.match(siteStyles, /\.panel-todos \.todo-list\s*{[^}]*overflow-y:\s*auto/s);
  assert.match(siteStyles, /\.todo-row\s*{[^}]*min-height:\s*clamp\(48px,\s*5vh,\s*66px\)/s);
});

test("thought area is prepared as a bounded motion space", async () => {
  const siteStyles = await readFile("v1/styles.css", "utf8");
  const script = await readFile("v1/scripts/render-site.mjs", "utf8");
  const rootHtml = await readFile("index.html", "utf8");

  assert.match(siteStyles, /\.thought-space\s*{[^}]*position:\s*absolute/s);
  assert.match(siteStyles, /\.thought-space\s*{[^}]*overflow:\s*hidden/s);
  assert.match(siteStyles, /\.thought-space\s*{[^}]*inset:\s*clamp\(42px,\s*5\.4vh,\s*64px\)[^}]*clamp\(18px,\s*2\.4vh,\s*34px\)[^}]*clamp\(245px,\s*20vw,\s*390px\)/s);
  assert.match(siteStyles, /\.thought-space \.thought-pill\s*{[^}]*will-change:\s*transform,\s*opacity/s);
  assert.match(script, /function toggleThoughtVisibility/);
  assert.match(script, /THOUGHT_BOUND_PADDING\s*=\s*40/);
  assert.match(script, /Math\.min\(THOUGHT_BOUND_PADDING,\s*Math\.max\(0,\s*\(axisSize - itemSize\) \/ 2\)\)/);
  assert.match(script, /window\.setTimeout/);
  assert.match(script, /stepThoughtPhysics\(items,\s*bounds,\s*dt\)/);
  assert.match(rootHtml, /class="thought-space" data-thoughts/);
});

test("preview server routes root and admin pages", async () => {
  const server = await readFile("v1/server.mjs", "utf8");

  assert.match(server, /join\(root, "index\.html"\)/);
  assert.match(server, /pathname === "\/admin"/);
  assert.match(server, /join\(root, "admin", "index\.html"\)/);
  assert.match(server, /pathname === "\/api\/site-data"/);
});
