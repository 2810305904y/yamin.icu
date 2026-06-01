import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { siteData } from "../content/site-data.mjs";
import {
  applyBackgroundLabMode,
  escapeHtml,
  getVisibleSortedItems,
  renderChannels,
  renderProjects,
  renderThoughts,
  renderTodos,
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

test("root homepage renders directly without redirecting to v1", async () => {
  const rootHtml = await readFile("index.html", "utf8");

  assert.doesNotMatch(rootHtml, /http-equiv="refresh"/i);
  assert.doesNotMatch(rootHtml, /window\.location/);
  assert.doesNotMatch(rootHtml, /url=\/v1/i);
  assert.match(rootHtml, /href="\/"/);
  assert.match(rootHtml, /href="\/v1\/styles\.css"/);
  assert.match(rootHtml, /src="\/v1\/scripts\/render-site\.mjs"/);
  assert.match(rootHtml, /data-projects/);
});
