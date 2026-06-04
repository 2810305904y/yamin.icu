import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { siteData } from "../content/site-data.mjs";
import {
  applyBackgroundLabMode,
  calculateMapViewport,
  createInitialThoughtActiveFlags,
  createSeededRandom,
  createThoughtToneSequence,
  createThoughtVisibilityRange,
  escapeHtml,
  getVisibleSortedItems,
  loadLiveSiteData,
  renderChannels,
  renderProjects,
  renderThoughts,
  renderTodos,
  resolveThoughtCollision,
  shouldUseCanvasClouds,
  shouldUseThoughtMotion,
  stepThoughtPhysics,
} from "../scripts/render-site.mjs";

test("getVisibleSortedItems hides disabled entries and sorts by order", () => {
  const items = [
    { title: "third", order: 30, visible: true },
    { title: "hidden", order: 5, visible: false },
    { title: "first", order: 10, visible: true },
  ];

  assert.deepEqual(
    getVisibleSortedItems(items).map((item) => item.title),
    ["first", "third"],
  );
});

test("escapeHtml prevents content from becoming markup", () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
  );
});

test("background lab mode is controlled by the bg query parameter", () => {
  global.document = {
    body: {
      classList: {
        value: false,
        toggle(name, enabled) {
          assert.equal(name, "background-lab");
          this.value = enabled;
        },
      },
    },
  };

  applyBackgroundLabMode("?bg=1");
  assert.equal(global.document.body.classList.value, true);

  applyBackgroundLabMode("");
  assert.equal(global.document.body.classList.value, false);

  delete global.document;
});

test("homepage loads API site data when available and falls back to bundled data", async () => {
  const apiData = {
    ...siteData,
    identity: {
      ...siteData.identity,
      title: "接口里的鸦珉.icu",
    },
  };

  const loaded = await loadLiveSiteData(async () => ({
    ok: true,
    json: async () => ({ data: apiData }),
  }));
  const fallback = await loadLiveSiteData(async () => ({ ok: false }));

  assert.equal(loaded.identity.title, "接口里的鸦珉.icu");
  assert.equal(fallback.identity.title, siteData.identity.title);
});

test("site title and signature copy use the current wording", async () => {
  const rootHtml = await readFile("index.html", "utf8");
  const v1Html = await readFile("v1/index.html", "utf8");

  assert.equal(siteData.identity.subtitle, "一张不太正经的项目地图");
  assert.match(rootHtml, /<title>鸦珉\.icu<\/title>/);
  assert.match(v1Html, /<title>鸦珉\.icu<\/title>/);
  assert.doesNotMatch(rootHtml, /<title>[^<]*项目地图[^<]*<\/title>/);
  assert.doesNotMatch(v1Html, /<title>[^<]*项目地图[^<]*<\/title>/);
  assert.doesNotMatch(rootHtml, /项目地图 V1/);
  assert.doesNotMatch(v1Html, /项目地图 V1/);
  assert.doesNotMatch(rootHtml, /稍微不太正经/);
  assert.doesNotMatch(v1Html, /稍微不太正经/);
});

test("renderers output the visible homepage content", () => {
  const projectHtml = renderProjects(siteData.projects);
  const todoHtml = renderTodos(siteData.todos);
  const thoughtHtml = renderThoughts(siteData.thoughts);
  const channelHtml = renderChannels(siteData.channels);
  const largeLinkBlocks = projectHtml.match(/<span class="project-link">[\s\S]*?<\/span>\s*<span class="status/g) || [];

  assert.match(projectHtml, /睡前剩几杯/);
  assert.match(projectHtml, /11点睡觉时，体内还剩几杯咖啡？/);
  assert.match(projectHtml, /coffeesleep\.cn/);
  assert.match(projectHtml, /破茧/);
  assert.match(projectHtml, /每天 3 分钟，看见算法之外的世界。/);
  assert.equal(largeLinkBlocks.length, 2);
  largeLinkBlocks.forEach((linkBlock) => {
    assert.doesNotMatch(linkBlock, /aria-hidden="true">›/);
  });
  assert.match(todoHtml, /视频粗剪工具/);
  assert.match(thoughtHtml, /被选择的成本/);
  assert.match(thoughtHtml, /AI革命/);
  assert.match(channelHtml, /YouTube/);
});

test("thought pills render as motion-ready collision bodies", () => {
  const thoughtHtml = renderThoughts(siteData.thoughts);

  assert.match(thoughtHtml, /data-thought-pill/);
  assert.match(thoughtHtml, /data-thought-index="0"/);
  assert.match(thoughtHtml, /thought-pill pill-/);
});

test("thought colors are automatically balanced instead of following stored tones", () => {
  const thoughtHtml = renderThoughts(
    Array.from({ length: 8 }, (_, index) => ({
      text: `idea ${index}`,
      order: index * 10,
      visible: true,
      tone: "blue",
    })),
  );
  const sequence = createThoughtToneSequence(8, createSeededRandom(17));

  assert.equal(new Set(sequence).size, 8);
  assert.equal(siteData.thoughts.every((thought) => !("tone" in thought)), true);
  assert.match(thoughtHtml, /pill-green/);
  assert.match(thoughtHtml, /pill-orange/);
  assert.match(thoughtHtml, /pill-purple/);
  assert.equal((thoughtHtml.match(/pill-blue/g) || []).length, 1);
});

test("thought space starts with a lively floating visible set", () => {
  const elevenRange = createThoughtVisibilityRange(11);
  const compactElevenRange = createThoughtVisibilityRange(11, { compact: true });
  const eightRange = createThoughtVisibilityRange(8);
  const sixRange = createThoughtVisibilityRange(6);
  const fourRange = createThoughtVisibilityRange(4);
  const initialFlags = createInitialThoughtActiveFlags(11, createSeededRandom(23));
  const initialVisibleCount = initialFlags.filter(Boolean).length;

  assert.deepEqual(elevenRange, { min: 7, max: 8 });
  assert.deepEqual(compactElevenRange, { min: 7, max: 7 });
  assert.deepEqual(eightRange, { min: 7, max: 8 });
  assert.deepEqual(sixRange, { min: 6, max: 6 });
  assert.deepEqual(fourRange, { min: 4, max: 4 });
  assert.ok(initialVisibleCount >= 7);
  assert.ok(initialVisibleCount <= 8);
  assert.equal(initialFlags.length, 11);
  assert.equal(initialFlags.every(Boolean), false);
  assert.ok(siteData.thoughts.length >= 8);
});

test("cloud canvas stays off on mobile-sized or constrained devices", () => {
  assert.equal(shouldUseCanvasClouds({ width: 1366, deviceMemory: 8, saveData: false }), true);
  assert.equal(shouldUseCanvasClouds({ width: 720, deviceMemory: 8, saveData: false }), false);
  assert.equal(shouldUseCanvasClouds({ width: 1366, deviceMemory: 2, saveData: false }), false);
  assert.equal(shouldUseCanvasClouds({ width: 1366, deviceMemory: 8, saveData: true }), false);
});

test("thought physics allows lightweight mobile motion but stays off on constrained devices", () => {
  assert.equal(shouldUseThoughtMotion({ width: 1366, deviceMemory: 8, saveData: false }), true);
  assert.equal(shouldUseThoughtMotion({ width: 560, deviceMemory: 8, saveData: false }), true);
  assert.equal(shouldUseThoughtMotion({ width: 1366, deviceMemory: 2, saveData: false }), false);
  assert.equal(shouldUseThoughtMotion({ width: 1366, deviceMemory: 8, saveData: true }), false);
});

test("thought collision physics separates active labels", () => {
  const first = {
    active: true,
    x: 10,
    y: 10,
    vx: 12,
    vy: 0,
    width: 90,
    height: 32,
    scale: 1,
    rotationSpeed: 4,
  };
  const second = {
    active: true,
    x: 88,
    y: 10,
    vx: -10,
    vy: 0,
    width: 90,
    height: 32,
    scale: 1,
    rotationSpeed: -4,
  };

  assert.equal(resolveThoughtCollision(first, second), true);
  assert.equal(first.vx, -10);
  assert.equal(second.vx, 12);
  assert.ok(first.x < 10);
  assert.ok(second.x > 88);

  second.active = false;
  assert.equal(resolveThoughtCollision(first, second), false);

  first.x = -10;
  first.y = -4;
  first.vx = -20;
  first.vy = -10;
  stepThoughtPhysics([first], { width: 180, height: 120 }, 1);
  assert.equal(first.x, 40);
  assert.equal(first.y, 40);
  assert.ok(first.vx > 0);
  assert.ok(first.vy > 0);
});

test("thought bounds use the unscaled layout box inside the scaled map", async () => {
  const script = await readFile("v1/scripts/render-site.mjs", "utf8");
  const match = script.match(/function readThoughtBounds\(container, options = \{\}\) \{([\s\S]*?)\n\}/);
  assert.ok(match);

  const readThoughtBounds = Function(
    "THOUGHT_BOUND_PADDING",
    "THOUGHT_COMPACT_BOUND_PADDING",
    `return function readThoughtBounds(container, options = {}) {${match[1]}\n};`,
  )(40, 52);
  const bounds = readThoughtBounds({
    offsetWidth: 1120,
    offsetHeight: 250,
    clientWidth: 1080,
    clientHeight: 240,
    getBoundingClientRect: () => ({ width: 430, height: 92 }),
  });

  assert.deepEqual(bounds, {
    width: 1120,
    height: 250,
    padding: 40,
  });
});

test("compact thought bounds use a larger symmetric edge padding", async () => {
  const script = await readFile("v1/scripts/render-site.mjs", "utf8");

  assert.match(script, /const THOUGHT_COMPACT_BOUND_PADDING = 52/);
  assert.match(script, /readThoughtBounds\(container,\s*\{ compact:\s*compactMotion \}\)/);
  assert.match(script, /padding:\s*options\.compact === true \? THOUGHT_COMPACT_BOUND_PADDING : THOUGHT_BOUND_PADDING/);

  const match = script.match(/function thoughtAxisRange\(axisSize, itemSize, padding = THOUGHT_BOUND_PADDING\) \{([\s\S]*?)\n\}/);
  assert.ok(match);

  const thoughtAxisRange = Function(
    "THOUGHT_BOUND_PADDING",
    `return function thoughtAxisRange(axisSize, itemSize, padding = THOUGHT_BOUND_PADDING) {${match[1]}\n};`,
  )(40);

  assert.deepEqual(thoughtAxisRange(430, 120, 52), {
    min: 52,
    max: 258,
  });
});

test("thought bubbles use a larger random scale range after the wider bounds", async () => {
  const script = await readFile("v1/scripts/render-site.mjs", "utf8");

  assert.match(script, /const THOUGHT_SCALE_MIN = 0\.96/);
  assert.match(script, /const THOUGHT_SCALE_MAX = 1\.36/);
  assert.match(script, /const THOUGHT_TARGET_SCALE_MIN = 0\.98/);
  assert.match(script, /const THOUGHT_TARGET_SCALE_MAX = 1\.42/);
  assert.match(script, /const THOUGHT_COMPACT_SCALE_MIN = 0\.88/);
  assert.match(script, /const THOUGHT_COMPACT_SCALE_MAX = 1\.16/);
  assert.match(script, /const THOUGHT_COMPACT_TARGET_SCALE_MIN = 0\.9/);
  assert.match(script, /const THOUGHT_COMPACT_TARGET_SCALE_MAX = 1\.22/);
  assert.match(script, /const scaleMin = compact \? THOUGHT_COMPACT_SCALE_MIN : THOUGHT_SCALE_MIN/);
  assert.match(script, /const targetScaleMin = compact \? THOUGHT_COMPACT_TARGET_SCALE_MIN : THOUGHT_TARGET_SCALE_MIN/);
  assert.match(script, /randomBetween\(random,\s*scaleMin,\s*scaleMax\)/);
  assert.match(script, /randomBetween\(random,\s*targetScaleMin,\s*targetScaleMax\)/);
  assert.doesNotMatch(script, /randomBetween\(random,\s*0\.84,\s*1\.2[24]\)/);
});

test("channels put bilibili first and include its public link", () => {
  const channelHtml = renderChannels(siteData.channels);
  const bilibiliIndex = channelHtml.indexOf("哔哩哔哩");
  const youtubeIndex = channelHtml.indexOf("YouTube");
  const dailyPojianIndex = channelHtml.indexOf("今日破茧");
  const videoChannelIndex = channelHtml.indexOf("视频号");

  assert.ok(bilibiliIndex > -1);
  assert.ok(youtubeIndex > -1);
  assert.ok(dailyPojianIndex > -1);
  assert.equal(videoChannelIndex, -1);
  assert.ok(bilibiliIndex < youtubeIndex);
  assert.ok(youtubeIndex < dailyPojianIndex);
  assert.match(channelHtml, /https:\/\/space\.bilibili\.com\/15068209/);
  assert.match(channelHtml, /https:\/\/www\.youtube\.com\/@yamin-vio1in/);
  assert.match(channelHtml, /https:\/\/space\.bilibili\.com\/3493267880544550/);
});

test("project status chips render after descriptions", () => {
  const projectHtml = renderProjects(siteData.projects);
  const coffeeDescription = projectHtml.indexOf("11点睡觉时，体内还剩几杯咖啡？");
  const coffeeLink = projectHtml.indexOf("<span>coffeesleep.cn</span>");
  const coffeeStatus = projectHtml.indexOf("已上线", coffeeLink);
  const placeholderDescription = projectHtml.indexOf("这里先留给下一个冒出来的东西。");
  const placeholderStatus = projectHtml.indexOf("空位");

  assert.ok(coffeeDescription > -1);
  assert.ok(coffeeLink > -1);
  assert.ok(coffeeStatus > -1);
  assert.ok(coffeeDescription < coffeeLink);
  assert.ok(coffeeLink < coffeeStatus);
  assert.ok(placeholderDescription > -1);
  assert.ok(placeholderStatus > -1);
  assert.ok(placeholderDescription < placeholderStatus);
});

test("project statuses match current public state", () => {
  const statusesById = Object.fromEntries(
    siteData.projects.map((project) => [project.id, project.status]),
  );

  assert.equal(statusesById["coffee-sleep"], "已上线");
  assert.equal(statusesById.pojian, "已上线");
  assert.equal(statusesById["placeholder-03"], "空位");
});

test("planned tools move from project cards into todo list", () => {
  const projectHtml = renderProjects(siteData.projects);
  const todoHtml = renderTodos(siteData.todos);

  assert.doesNotMatch(projectHtml, /视频粗剪工具/);
  assert.doesNotMatch(projectHtml, /社交媒体方向 App/);
  assert.match(todoHtml, /视频粗剪工具/);
  assert.match(todoHtml, /社交媒体方向 App/);
  assert.match(todoHtml, /主页项目区3D轮更新/);
  assert.doesNotMatch(todoHtml, /新的待办/);
  assert.equal((todoHtml.match(/class="todo-row/g) || []).length, 3);
  assert.match(todoHtml, /width: 5%/);
  assert.match(todoHtml, /width: 0%/);
});

test("todo tones support expanded color options", async () => {
  const todoHtml = renderTodos([
    { title: "red item", order: 10, visible: true, tone: "red", progress: 35 },
    { title: "white item", order: 20, visible: true, tone: "white", progress: 55 },
    { title: "black item", order: 30, visible: true, tone: "black", progress: 75 },
  ]);
  const styles = await readFile("v1/styles.css", "utf8");
  const script = await readFile("admin/admin.mjs", "utf8");

  assert.match(todoHtml, /todo-row todo-tone-red/);
  assert.match(todoHtml, /todo-dot todo-white/);
  assert.match(todoHtml, /width: 75%/);
  assert.match(styles, /\.todo-red\s*{[^}]*#ff0000/s);
  assert.match(styles, /\.todo-black/);
  assert.match(styles, /\.todo-white/);
  assert.match(styles, /\.todo-track\s*{[^}]*background:\s*rgba\(147,\s*197,\s*253,\s*0\.25\)/s);
  assert.match(styles, /\.todo-track span\s*{[^}]*background:\s*currentColor/s);
  assert.doesNotMatch(styles, /\.todo-tone-white \.todo-track\s*{/);
  assert.doesNotMatch(styles, /\.todo-tone-white \.todo-track span\s*{/);
  assert.match(script, /"black", "white"/);
});

test("root homepage renders directly and keeps a legacy module fallback", async () => {
  const rootHtml = await readFile("index.html", "utf8");
  const v1Html = await readFile("v1/index.html", "utf8");

  assert.doesNotMatch(rootHtml, /http-equiv="refresh"/i);
  assert.doesNotMatch(rootHtml, /url=\/v1/i);
  assert.match(rootHtml, /href="\/"/);
  assert.match(rootHtml, /href="\/v1\/styles\.css(?:\?[^"]+)?"/);
  assert.match(rootHtml, /src="\/v1\/scripts\/render-site\.mjs(?:\?[^"]+)?"/);
  assert.match(rootHtml, /<script nomodule>/);
  assert.match(rootHtml, /window\.location\.replace\("\/v1\/"\)/);
  assert.match(rootHtml, /data-module-fallback/);
  assert.match(rootHtml, /window\.setTimeout\(function \(\)/);
  assert.match(rootHtml, /data-projects/);
  assert.match(v1Html, /thought-pill pill-green is-visible/);
  assert.match(v1Html, /data-thought-pill/);
  assert.match(v1Html, /AI革命/);
  assert.doesNotMatch(v1Html, /<span class="project-link">[\s\S]*?<span aria-hidden="true">›<\/span>[\s\S]*?<span class="status/s);
});

test("homepage uses a lightweight progress bar while live data and animations settle", async () => {
  const rootHtml = await readFile("index.html", "utf8");
  const v1Html = await readFile("v1/index.html", "utf8");
  const styles = await readFile("v1/styles.css", "utf8");
  const script = await readFile("v1/scripts/render-site.mjs", "utf8");

  assert.match(rootHtml, /data-load-progress/);
  assert.match(v1Html, /data-load-progress/);
  assert.match(styles, /\.load-progress\s*{[^}]*position:\s*fixed/s);
  assert.match(styles, /\.load-progress\[data-load-state="complete"\]/);
  assert.match(script, /function setPageLoadState/);
  assert.match(script, /setPageLoadState\("content"\)/);
  assert.match(script, /setPageLoadState\("complete"\)/);
  assert.match(script, /function scheduleHomepageAnimations/);
  assert.match(script, /initializeThoughts:\s*false/);
  assert.match(script, /requestIdleCallback/);
  assert.match(script, /timeoutMs:\s*1400/);
});

test("site signature can become the first mobile logo without moving the desktop anchor", async () => {
  const rootHtml = await readFile("index.html", "utf8");
  const v1Html = await readFile("v1/index.html", "utf8");
  const styles = await readFile("v1/styles.css", "utf8");

  assert.match(rootHtml, /<section class="map-frame"[\s\S]*?<p class="site-signature">[\s\S]*?<section class="panel panel-projects"/);
  assert.match(v1Html, /<section class="map-frame"[\s\S]*?<p class="site-signature">[\s\S]*?<section class="panel panel-projects"/);
  assert.match(styles, /\.site-signature\s*{[^}]*left:\s*58px/s);
  assert.match(styles, /\.site-signature\s*{[^}]*bottom:\s*38px/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.site-signature\s*{[\s\S]*order:\s*0/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.site-signature\s*{[\s\S]*padding:\s*24px 18px 4px/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.site-signature span\s*{[\s\S]*font-size:\s*36px/s);
});

test("homepage uses a fixed 2:1 design canvas inside a scaled viewport shell", async () => {
  const rootHtml = await readFile("index.html", "utf8");
  const v1Html = await readFile("v1/index.html", "utf8");
  const styles = await readFile("v1/styles.css", "utf8");
  const script = await readFile("v1/scripts/render-site.mjs", "utf8");

  assert.match(rootHtml, /<div class="map-viewport" data-map-viewport>\s*<section class="map-frame"/s);
  assert.match(v1Html, /<div class="map-viewport" data-map-viewport>\s*<section class="map-frame"/s);
  assert.match(styles, /--map-design-width:\s*2400px/);
  assert.match(styles, /--map-design-height:\s*1200px/);
  assert.match(styles, /--map-content-scale:\s*1/);
  assert.match(styles, /\.map-viewport\s*{[^}]*width:\s*var\(--map-viewport-width\)/s);
  assert.match(styles, /\.map-viewport\s*{[^}]*height:\s*var\(--map-viewport-height\)/s);
  assert.match(styles, /\.map-frame\s*{[^}]*width:\s*var\(--map-design-width\)/s);
  assert.match(styles, /\.map-frame\s*{[^}]*height:\s*var\(--map-design-height\)/s);
  assert.match(styles, /\.map-frame\s*{[^}]*transform:\s*scale\(var\(--map-scale\)\)/s);
  assert.match(styles, /\.map-frame\s*{[^}]*transform-origin:\s*top left/s);
  assert.match(styles, /\.section-title\s*{[^}]*font-size:\s*calc\(54px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.project-name\s*{[^}]*font-size:\s*calc\(34px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.card-index\s*{[^}]*height:\s*calc\(34px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.project-card\s*{[^}]*border-radius:\s*24px/s);
  assert.match(styles, /\.project-card-large\s*{[^}]*width:\s*calc\(100% - 12px\)/s);
  assert.match(styles, /\.project-illustration\s*{[^}]*width:\s*calc\(128px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.project-card-large \.project-illustration\s*{[^}]*transform:\s*translateY\(calc\(8px \* var\(--map-content-scale\)\)\)/s);
  assert.match(styles, /\.project-illustration svg\s*{[^}]*width:\s*66%/s);
  assert.match(styles, /\.wide-icon\s*{[^}]*width:\s*calc\(76px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.wide-icon svg\s*{[^}]*width:\s*68%/s);
  assert.match(styles, /\.project-link\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.doesNotMatch(styles, /\.project-link span:last-child/);
  assert.match(styles, /\.project-link\s*{[^}]*width:\s*min\(72%,\s*267px\)/s);
  assert.match(styles, /\.project-link\s*{[^}]*min-height:\s*calc\(50px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.status\s*{[^}]*min-height:\s*calc\(32px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.round-arrow\s*{[^}]*width:\s*calc\(38px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.projects-grid\s*{[^}]*grid-template-columns:\s*minmax\(200px,\s*0\.94fr\)\s*minmax\(200px,\s*0\.94fr\)\s*minmax\(300px,\s*1\.4fr\)/s);
  assert.match(styles, /\.project-card-wide\s*{[^}]*height:\s*calc\(100% - 10px\)/s);
  assert.match(styles, /\.project-card-wide\s*{[^}]*width:\s*calc\(100% - 12px\)/s);
  assert.match(styles, /\.project-card-wide\s*{[^}]*justify-self:\s*center/s);
  assert.match(styles, /\.project-card-wide\s*{[^}]*grid-template-columns:\s*calc\(76px \* var\(--map-content-scale\)\) minmax\(0,\s*1fr\) auto/s);
  assert.match(styles, /\.project-card-wide \.project-name\s*{[^}]*font-size:\s*calc\(24px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.project-card-wide \.project-copy\s*{[^}]*font-size:\s*calc\(16px \* var\(--map-content-scale\)\)/s);
  assert.doesNotMatch(styles, /\.projects-grid\s*{[^}]*width:\s*92%/s);
  assert.doesNotMatch(styles, /\.projects-grid\s*{[^}]*justify-self:\s*start/s);
  assert.match(styles, /\.panel-todos\s*{[^}]*padding:\s*38px 58px 60px/s);
  assert.match(styles, /\.todo-text\s*{[^}]*font-size:\s*calc\(18px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.panel-social\s*{[^}]*padding:\s*34px 58px/s);
  assert.match(styles, /\.social-list\s*{[^}]*gap:\s*calc\(8px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.social-list\s*{[^}]*padding-right:\s*8px/s);
  assert.match(styles, /\.social-list a\s*{[^}]*min-height:\s*calc\(42px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.social-list a\s*{[^}]*padding:\s*calc\(6px \* var\(--map-content-scale\)\)\s*calc\(14px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.social-list a\s*{[^}]*font-size:\s*calc\(18px \* var\(--map-content-scale\)\)/s);
  assert.match(styles, /\.thought-space\s*{[^}]*inset:\s*-20px\s*40px\s*-20px\s*64px/s);
  assert.match(styles, /\.thought-space \.thought-pill\s*{[^}]*width:\s*max-content/s);
  assert.match(styles, /\.thought-space \.thought-pill\s*{[^}]*white-space:\s*nowrap/s);
  assert.match(script, /const MAP_VIEWPORT_MARGIN = 44/);
  assert.match(script, /const MAP_CONTENT_SCALE_MAX = 1\.3/);
  assert.match(script, /const MAP_CONTENT_TARGET_SCALE = 1\.06/);
  assert.doesNotMatch(styles, /\.map-frame\s*{[^}]*width:\s*min\(2400px,\s*calc\(100vw - 28px\)/s);
  assert.doesNotMatch(styles, /@media \(max-width:\s*1100px\)\s*{[^}]*\.map-frame\s*{[^}]*display:\s*block/s);
  assert.match(styles, /\.load-progress\s*{[^}]*position:\s*fixed/s);
  assert.match(styles, /\.load-progress\s*{[^}]*contain:\s*layout paint style/s);
  assert.match(styles, /\.load-progress\s*{[^}]*height:\s*2px/s);
});

test("mobile homepage switches to a vertical V1.5.4 layout without changing the desktop canvas block", async () => {
  const rootHtml = await readFile("index.html", "utf8");
  const v1Html = await readFile("v1/index.html", "utf8");
  const styles = await readFile("v1/styles.css", "utf8");

  assert.match(rootHtml, /v=1\.5\.4-mobile-thought-bounds/);
  assert.match(v1Html, /v=1\.5\.4-mobile-thought-bounds/);
  assert.match(styles, /@media \(max-width:\s*760px\)\s*{/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*body\s*{[\s\S]*overflow-y:\s*auto/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*body::before\s*{[\s\S]*background-image:\s*none/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*body::before\s*{[\s\S]*animation:\s*none/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*body::before\s*{[\s\S]*opacity:\s*0/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.page\s*{[\s\S]*height:\s*auto/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.map-frame\s*{[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.map-frame\s*{[\s\S]*transform:\s*none/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.panel-projects\s*{[\s\S]*order:\s*1/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.panel-todos\s*{[\s\S]*order:\s*2/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.panel-thoughts\s*{[\s\S]*order:\s*3/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.panel-social\s*{[\s\S]*order:\s*4/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.projects-grid\s*{[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-large\s*{[\s\S]*grid-template-areas:\s*"name"[\s\S]*"copy"[\s\S]*"link"/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-large\s*{[\s\S]*min-height:\s*136px/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-large\s*{[\s\S]*gap:\s*5px/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-large\s*{[\s\S]*text-align:\s*left/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-large \.project-illustration\s*{[\s\S]*display:\s*none/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-large \.project-name\s*{[\s\S]*font-size:\s*28px/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-large \.project-copy\s*{[\s\S]*white-space:\s*nowrap/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-large \.status\s*{[\s\S]*position:\s*absolute/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-wide\s*{[\s\S]*min-height:\s*136px/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-wide \.wide-icon,[\s\S]*\.project-card-wide \.round-arrow\s*{[\s\S]*display:\s*none/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-wide \.wide-content\s*{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.project-card-wide \.status\s*{[\s\S]*grid-area:\s*status/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.thought-space\s*{[\s\S]*position:\s*relative/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.thought-space\s*{[\s\S]*height:\s*520px/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.panel-social \.visually-hidden\s*{[\s\S]*position:\s*relative !important/s);
  assert.doesNotMatch(styles, /@media \(max-width:\s*760px\)[\s\S]*\.panel-social \.section-title-small::after\s*{[\s\S]*display:\s*none/s);
});

test("mobile thought motion stays slow while showing seven labels", async () => {
  const script = await readFile("v1/scripts/render-site.mjs", "utf8");

  assert.match(script, /const THOUGHT_COMPACT_MIN_VISIBLE = 7/);
  assert.match(script, /const THOUGHT_COMPACT_MAX_VISIBLE = 7/);
  assert.match(script, /const speedScale = compact \? 0\.36 : 1/);
});

test("map viewport scaling preserves the fixed design ratio", () => {
  assert.deepEqual(calculateMapViewport({ width: 2600, height: 1400 }), {
    contentScale: 1,
    scale: 1,
    width: 2400,
    height: 1200,
  });

  assert.deepEqual(calculateMapViewport({ width: 2000, height: 1000 }), {
    contentScale: 1.3,
    scale: 0.796667,
    width: 1912,
    height: 956,
  });

  assert.deepEqual(calculateMapViewport({ width: 1200, height: 900 }), {
    contentScale: 1.3,
    scale: 0.481667,
    width: 1156,
    height: 578,
  });
});
