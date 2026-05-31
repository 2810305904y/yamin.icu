import test from "node:test";
import assert from "node:assert/strict";

import { siteData } from "../content/site-data.mjs";
import {
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

test("renderers output the visible homepage content", () => {
  const projectHtml = renderProjects(siteData.projects);
  const todoHtml = renderTodos(siteData.todos);
  const thoughtHtml = renderThoughts(siteData.thoughts);
  const channelHtml = renderChannels(siteData.channels);

  assert.match(projectHtml, /睡前剩几杯/);
  assert.match(projectHtml, /coffeesleep\.cn/);
  assert.match(projectHtml, /破茧/);
  assert.match(todoHtml, /整理 V1/);
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
