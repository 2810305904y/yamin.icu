import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { siteData } from "../content/site-data.mjs";
import {
  applyBackgroundLabMode,
  createSeededRandom,
  createThoughtToneSequence,
  escapeHtml,
  getVisibleSortedItems,
  loadLiveSiteData,
  renderChannels,
  renderProjects,
  renderThoughts,
  renderTodos,
  resolveThoughtCollision,
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
  assert.match(rootHtml, /<title>鸦珉\.icu - 项目地图<\/title>/);
  assert.match(v1Html, /<title>鸦珉\.icu - 项目地图<\/title>/);
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

  assert.match(projectHtml, /睡前剩几杯/);
  assert.match(projectHtml, /11点睡觉时，体内还剩几杯咖啡？/);
  assert.match(projectHtml, /coffeesleep\.cn/);
  assert.match(projectHtml, /破茧/);
  assert.match(projectHtml, /每天 3 分钟，看见算法之外的世界。/);
  assert.match(todoHtml, /视频粗剪工具/);
  assert.match(thoughtHtml, /不是公司官网/);
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
  stepThoughtPhysics([first], { width: 180, height: 80 }, 1);
  assert.equal(first.x, 8);
  assert.equal(first.y, 8);
  assert.ok(first.vx > 0);
  assert.ok(first.vy > 0);
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
  const coffeeStatus = projectHtml.indexOf("已上线");
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

test("root homepage renders directly without redirecting to v1", async () => {
  const rootHtml = await readFile("index.html", "utf8");

  assert.doesNotMatch(rootHtml, /http-equiv="refresh"/i);
  assert.doesNotMatch(rootHtml, /window\.location/);
  assert.doesNotMatch(rootHtml, /url=\/v1/i);
  assert.match(rootHtml, /href="\/"/);
  assert.match(rootHtml, /href="\/v1\/styles\.css(?:\?[^"]+)?"/);
  assert.match(rootHtml, /src="\/v1\/scripts\/render-site\.mjs(?:\?[^"]+)?"/);
  assert.match(rootHtml, /data-projects/);
});
