import { siteData } from "../content/site-data.mjs";

const iconMap = {
  coffee: `
    <svg viewBox="0 0 64 64">
      <path d="M18 26h25v10c0 8-6 14-13 14S18 44 18 36V26Z" />
      <path d="M43 30h3.5a6 6 0 0 1 0 12H43" />
      <path d="M15 51h34" />
      <path d="M23 15v5M32 11v6M41 15v5" />
    </svg>
  `,
  leaf: `
    <svg viewBox="0 0 64 64">
      <path d="M34 7c-9 6-15 16-17 29 9-2 19-8 29-17-2 9-8 19-17 29" />
      <path d="M22 21c10 3 17 10 21 21" />
    </svg>
  `,
  video: `
    <svg viewBox="0 0 48 48">
      <path d="M8 13h21l7 7-7 7H8V13Z" />
      <path d="M13 27v8h20" />
      <path d="M34 31 42 39M42 31 34 39" />
    </svg>
  `,
  phone: `
    <svg viewBox="0 0 48 48">
      <rect x="15" y="8" width="18" height="32" rx="4" />
      <path d="M21 35h6" />
    </svg>
  `,
  cube: `
    <svg viewBox="0 0 48 48">
      <path d="m24 6 15 8.5v17L24 40 9 31.5v-17L24 6Z" />
      <path d="M9 14.5 24 23l15-8.5M24 23v17" />
    </svg>
  `,
};

const thoughtSpaceCleanups = new WeakMap();
const THOUGHT_BOUND_PADDING = 40;
const THOUGHT_COMPACT_BOUND_PADDING = 24;
const THOUGHT_MIN_VISIBLE = 7;
const THOUGHT_MAX_VISIBLE = 8;
const THOUGHT_COMPACT_MIN_VISIBLE = 7;
const THOUGHT_COMPACT_MAX_VISIBLE = 7;
const THOUGHT_MIN_TOGGLE_DELAY = 4200;
const THOUGHT_MAX_TOGGLE_DELAY = 6800;
const THOUGHT_SCALE_MIN = 0.96;
const THOUGHT_SCALE_MAX = 1.36;
const THOUGHT_TARGET_SCALE_MIN = 0.98;
const THOUGHT_TARGET_SCALE_MAX = 1.42;
const THOUGHT_COMPACT_SCALE_MIN = 0.88;
const THOUGHT_COMPACT_SCALE_MAX = 1.16;
const THOUGHT_COMPACT_TARGET_SCALE_MIN = 0.9;
const THOUGHT_COMPACT_TARGET_SCALE_MAX = 1.22;
const LIVE_DATA_TIMEOUT = 4000;
const LIVE_DATA_FALLBACK_MESSAGE = "数据没有读取成功，请刷新重试。";
const LOADING_PROGRESS_RUN_TIME = 3000;
const LOADING_STAGE_STEP_DELAY = 1000;
const LOADING_STAGE_TIMELINE_DURATION = 3000;
const LOADING_SUCCESS_READY_DELAY = 500;
const LOADING_FAILURE_MINIMUM_VISIBLE_TIME = 4000;
const LOADING_FAILURE_HOLD_DELAY = 2000;
const LOADING_SUCCESS_HIDE_DELAY = 1500;
const LOADING_FAILURE_HIDE_DELAY = 1100;
const MAP_DESIGN_WIDTH = 2400;
const MAP_DESIGN_HEIGHT = 1200;
const COMPACT_VIEWPORT_WIDTH = 760;
const MAP_VIEWPORT_MARGIN = 44;
const MAP_CONTENT_SCALE_MAX = 1.3;
const MAP_CONTENT_TARGET_SCALE = 1.06;
const thoughtTonePalette = ["green", "orange", "purple", "pink", "red", "yellow", "cyan", "blue"];
const LOADING_STAGE_LABELS = {
  reading: "正在读取项目地图",
  todos: "正在翻找待办任务",
  thoughts: "正在临时想一些怪念头",
  clouds: "正在绘制棉花糖",
  ready: "读取完成",
  failed: "读取失败，显示备用页面",
};
const LOADING_STAGE_PROGRESS = {
  reading: 0.34,
  todos: 0.52,
  thoughts: 0.68,
  clouds: 0.82,
  ready: 1,
  failed: 0.6,
};
const LOADING_PROGRESS_INITIAL = 0.08;
const LOADING_PROGRESS_STAGE_DURATION = 620;
const LOADING_PROGRESS_FALLBACK_TARGET = 0.6;
let loadingProgressTarget = LOADING_PROGRESS_INITIAL;

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getVisibleSortedItems(items) {
  return [...items]
    .filter((item) => item.visible !== false)
    .sort((a, b) => (a.order == null ? 0 : a.order) - (b.order == null ? 0 : b.order));
}

export function createSeededRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(random, min, max) {
  return min + (max - min) * random();
}

function randomInteger(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function roundScale(value) {
  return Math.round(value * 1000000) / 1000000;
}

export function calculateMapViewport(viewport, options = {}) {
  const designWidth = Math.max(1, Number(options.designWidth || MAP_DESIGN_WIDTH));
  const designHeight = Math.max(1, Number(options.designHeight || MAP_DESIGN_HEIGHT));
  const margin = Math.max(0, Number(options.margin == null ? MAP_VIEWPORT_MARGIN : options.margin));
  const viewportWidth = Math.max(0, Number(viewport && viewport.width ? viewport.width : 0));
  const viewportHeight = Math.max(0, Number(viewport && viewport.height ? viewport.height : 0));
  const availableWidth = Math.max(1, viewportWidth - margin);
  const availableHeight = Math.max(1, viewportHeight - margin);
  const rawScale = Math.min(1, availableWidth / designWidth, availableHeight / designHeight);
  const scale = roundScale(Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1);

  const contentScale = scale >= 1 ? 1 : Math.min(MAP_CONTENT_SCALE_MAX, MAP_CONTENT_TARGET_SCALE / scale);

  return {
    contentScale: roundScale(contentScale),
    scale,
    width: Math.round(designWidth * scale),
    height: Math.round(designHeight * scale),
  };
}

export function updateMapViewportScale(viewport = window) {
  if (typeof document === "undefined" || !document.documentElement || !viewport) return;

  const size = calculateMapViewport({
    width: viewport.innerWidth,
    height: viewport.innerHeight,
  });

  document.documentElement.style.setProperty("--map-scale", String(size.scale));
  document.documentElement.style.setProperty("--map-content-scale", String(size.contentScale));
  document.documentElement.style.setProperty("--map-viewport-width", `${size.width}px`);
  document.documentElement.style.setProperty("--map-viewport-height", `${size.height}px`);
}

function initMapViewportScale() {
  if (typeof window === "undefined") return;

  updateMapViewportScale(window);
  window.addEventListener("resize", () => updateMapViewportScale(window), { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => updateMapViewportScale(window), { passive: true });
  }
}

export function createThoughtVisibilityRange(count, options = {}) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const minTarget = options.compact === true ? THOUGHT_COMPACT_MIN_VISIBLE : THOUGHT_MIN_VISIBLE;
  const maxTarget = options.compact === true ? THOUGHT_COMPACT_MAX_VISIBLE : THOUGHT_MAX_VISIBLE;

  if (total <= minTarget) {
    return { min: total, max: total };
  }

  return {
    min: Math.min(total, minTarget),
    max: Math.min(total, maxTarget),
  };
}

export function createInitialThoughtActiveFlags(count, random = Math.random, options = {}) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const range = createThoughtVisibilityRange(total, options);
  const targetCount = randomInteger(random, range.min, range.max);
  const flags = new Array(total).fill(false);
  const indexes = Array.from({ length: total }, (_, index) => index);

  while (indexes.length && flags.filter(Boolean).length < targetCount) {
    const indexPosition = Math.floor(random() * indexes.length);
    const itemIndex = indexes.splice(indexPosition, 1)[0];
    flags[itemIndex] = true;
  }

  return flags;
}

export function createThoughtToneSequence(count, random = Math.random) {
  const tones = [];
  while (tones.length < count) {
    const batch = [...thoughtTonePalette];
    for (let index = batch.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [batch[index], batch[swapIndex]] = [batch[swapIndex], batch[index]];
    }
    tones.push(...batch);
  }
  return tones.slice(0, count);
}

function createThoughtTonePicker(random) {
  let tones = [];
  return () => {
    if (!tones.length) {
      tones = createThoughtToneSequence(thoughtTonePalette.length, random);
    }
    return tones.shift();
  };
}

function applyThoughtTone(element, tone) {
  [...element.classList]
    .filter((className) => className.startsWith("pill-"))
    .forEach((className) => element.classList.remove(className));
  element.classList.add(`pill-${tone}`);
  element.dataset.thoughtTone = tone;
}

function thoughtSize(item) {
  const baseWidth = Math.max(1, item.width * item.scale);
  const baseHeight = Math.max(1, item.height * item.scale);
  const rotation = ((item.rotation == null ? 0 : item.rotation) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const width = baseWidth * cos + baseHeight * sin;
  const height = baseWidth * sin + baseHeight * cos;

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
    offsetX: Math.max(0, (width - baseWidth) / 2),
    offsetY: Math.max(0, (height - baseHeight) / 2),
  };
}

function thoughtAxisRange(axisSize, itemSize, padding = THOUGHT_BOUND_PADDING) {
  const edgePadding = Math.min(padding, Math.max(0, (axisSize - itemSize) / 2));
  return {
    min: edgePadding,
    max: Math.max(edgePadding, axisSize - itemSize - edgePadding),
  };
}

function clampThoughtPosition(item, bounds) {
  const size = thoughtSize(item);
  const xRange = thoughtAxisRange(bounds.width, size.width, bounds.padding);
  const yRange = thoughtAxisRange(bounds.height, size.height, bounds.padding);
  item.x = Math.min(Math.max(item.x, xRange.min), xRange.max);
  item.y = Math.min(Math.max(item.y, yRange.min), yRange.max);
}

export function resolveThoughtCollision(first, second) {
  if (!first.active || !second.active) return false;

  const firstSize = thoughtSize(first);
  const secondSize = thoughtSize(second);
  const firstCenterX = first.x + firstSize.width / 2;
  const firstCenterY = first.y + firstSize.height / 2;
  const secondCenterX = second.x + secondSize.width / 2;
  const secondCenterY = second.y + secondSize.height / 2;
  const overlapX = firstSize.width / 2 + secondSize.width / 2 - Math.abs(firstCenterX - secondCenterX);
  const overlapY = firstSize.height / 2 + secondSize.height / 2 - Math.abs(firstCenterY - secondCenterY);

  if (overlapX <= 0 || overlapY <= 0) return false;

  if (overlapX < overlapY) {
    const direction = firstCenterX < secondCenterX ? -1 : 1;
    first.x += (overlapX / 2) * direction;
    second.x -= (overlapX / 2) * direction;
    [first.vx, second.vx] = [second.vx, first.vx];
  } else {
    const direction = firstCenterY < secondCenterY ? -1 : 1;
    first.y += (overlapY / 2) * direction;
    second.y -= (overlapY / 2) * direction;
    [first.vy, second.vy] = [second.vy, first.vy];
  }

  first.rotationSpeed *= -0.82;
  second.rotationSpeed *= -0.82;
  return true;
}

export function stepThoughtPhysics(items, bounds, dt) {
  items.forEach((item) => {
    if (!item.active) return;

    const size = thoughtSize(item);
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.rotation = (item.rotation == null ? 0 : item.rotation) + item.rotationSpeed * dt;

    const xRange = thoughtAxisRange(bounds.width, size.width, bounds.padding);
    const yRange = thoughtAxisRange(bounds.height, size.height, bounds.padding);

    if (item.x <= xRange.min) {
      item.x = xRange.min;
      item.vx = Math.abs(item.vx);
    } else if (item.x >= xRange.max) {
      item.x = xRange.max;
      item.vx = -Math.abs(item.vx);
    }

    if (item.y <= yRange.min) {
      item.y = yRange.min;
      item.vy = Math.abs(item.vy);
    } else if (item.y >= yRange.max) {
      item.y = yRange.max;
      item.vy = -Math.abs(item.vy);
    }
  });

  for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < items.length; secondIndex += 1) {
      resolveThoughtCollision(items[firstIndex], items[secondIndex]);
    }
  }

  items.forEach((item) => {
    if (item.active) clampThoughtPosition(item, bounds);
  });
}

function safeHref(url) {
  const value = String(url == null ? "" : url).trim();
  if (value.startsWith("https://") || value.startsWith("http://")) {
    return value;
  }
  return "#";
}

function renderIcon(name, className) {
  return `<span class="${className}" aria-hidden="true">${iconMap[name] || iconMap.cube}</span>`;
}

function renderStatus(item) {
  return `<span class="status status-${escapeHtml(item.statusTone || "quiet")}">${escapeHtml(item.status)}</span>`;
}

function renderLargeProject(project, index) {
  const href = safeHref(project.url);
  const targetAttrs = href === "#" ? "" : ' target="_blank" rel="noreferrer"';
  return `
    <a class="project-card project-card-large" href="${escapeHtml(href)}"${targetAttrs}>
      <span class="card-index">${String(index).padStart(2, "0")}</span>
      ${renderIcon(project.icon, "project-illustration")}
      <span class="project-name">${escapeHtml(project.title)}</span>
      <span class="project-copy">${escapeHtml(project.description)}</span>
      <span class="project-link">
        <span>${escapeHtml(project.urlLabel || "暂时没有门牌号")}</span>
      </span>
      ${renderStatus(project)}
    </a>
  `;
}

function renderWideProject(project, index) {
  const href = safeHref(project.url);
  const targetAttrs = href === "#" ? "" : ' target="_blank" rel="noreferrer"';
  return `
    <a class="project-card project-card-wide" href="${escapeHtml(href)}"${targetAttrs}>
      <span class="card-index">${String(index).padStart(2, "0")}</span>
      ${renderIcon(project.icon, "wide-icon")}
      <span class="wide-content">
        <span class="project-name">${escapeHtml(project.title)}</span>
        <span class="project-copy">${escapeHtml(project.description)}</span>
        ${renderStatus(project)}
      </span>
      <span class="round-arrow" aria-hidden="true">›</span>
    </a>
  `;
}

export function renderProjects(projects) {
  return getVisibleSortedItems(projects)
    .map((project, index) =>
      project.variant === "large"
        ? renderLargeProject(project, index + 1)
        : renderWideProject(project, index + 1),
    )
    .join("");
}

export function renderTodos(todos) {
  return getVisibleSortedItems(todos)
    .map((todo) => {
      const progress = Math.max(0, Math.min(100, Number(todo.progress == null ? 0 : todo.progress)));
      const tone = escapeHtml(todo.tone || "blue");
      return `
        <div class="todo-row todo-tone-${tone}">
          <span class="todo-dot todo-${tone}"></span>
          <span class="todo-text">${escapeHtml(todo.title)}</span>
          <span class="todo-track"><span style="width: ${progress}%"></span></span>
        </div>
      `;
    })
    .join("");
}

export function renderThoughts(thoughts) {
  return getVisibleSortedItems(thoughts)
    .map((thought, index) => {
      const tone = escapeHtml(thoughtTonePalette[index % thoughtTonePalette.length]);
      return `<span class="thought-pill pill-${tone}" data-thought-pill data-thought-index="${index}">${escapeHtml(thought.text)}</span>`;
    })
    .join("");
}

function readThoughtBounds(container, options = {}) {
  const rect =
    typeof container.getBoundingClientRect === "function" ? container.getBoundingClientRect() : { width: 0, height: 0 };
  const layoutWidth = container.offsetWidth || container.clientWidth || rect.width;
  const layoutHeight = container.offsetHeight || container.clientHeight || rect.height;

  return {
    width: Math.max(1, layoutWidth),
    height: Math.max(1, layoutHeight),
    padding: options.compact === true ? THOUGHT_COMPACT_BOUND_PADDING : THOUGHT_BOUND_PADDING,
  };
}

function measureThoughtItem(item) {
  item.width = Math.max(1, item.element.offsetWidth);
  item.height = Math.max(1, item.element.offsetHeight);
}

function applyThoughtStyle(item) {
  const size = thoughtSize(item);
  item.element.classList.toggle("is-visible", item.active);
  item.element.classList.toggle("is-hidden", !item.active);
  item.element.setAttribute("aria-hidden", item.active ? "false" : "true");
  item.element.style.left = `${item.x + size.offsetX}px`;
  item.element.style.top = `${item.y + size.offsetY}px`;
  item.element.style.transform = `rotate(${item.rotation}deg) scale(${item.scale})`;
}

function resetThoughtMotion(item, random, bounds, options = {}) {
  const compact = options.compact === true;
  const scaleMin = compact ? THOUGHT_COMPACT_SCALE_MIN : THOUGHT_SCALE_MIN;
  const scaleMax = compact ? THOUGHT_COMPACT_SCALE_MAX : THOUGHT_SCALE_MAX;
  const targetScaleMin = compact ? THOUGHT_COMPACT_TARGET_SCALE_MIN : THOUGHT_TARGET_SCALE_MIN;
  const targetScaleMax = compact ? THOUGHT_COMPACT_TARGET_SCALE_MAX : THOUGHT_TARGET_SCALE_MAX;
  const speedScale = compact ? 0.36 : 1;

  measureThoughtItem(item);
  item.scale = randomBetween(random, scaleMin, scaleMax);
  item.targetScale = randomBetween(random, targetScaleMin, targetScaleMax);
  item.rotation = randomBetween(random, -7, 7);
  item.rotationSpeed = randomBetween(random, -8, 8);

  const size = thoughtSize(item);
  const xRange = thoughtAxisRange(bounds.width, size.width, bounds.padding);
  const yRange = thoughtAxisRange(bounds.height, size.height, bounds.padding);
  item.x = randomBetween(random, xRange.min, xRange.max);
  item.y = randomBetween(random, yRange.min, yRange.max);
  item.vx = randomBetween(random, 18, 46) * speedScale * (random() > 0.5 ? 1 : -1);
  item.vy = randomBetween(random, 12, 38) * speedScale * (random() > 0.5 ? 1 : -1);
}

function setThoughtActive(item, active, random, bounds, pickThoughtTone, options = {}) {
  item.active = active;
  if (active) {
    applyThoughtTone(item.element, pickThoughtTone());
    resetThoughtMotion(item, random, bounds, options);
  }
  applyThoughtStyle(item);
}

function pickRandomItem(random, items) {
  return items[Math.floor(random() * items.length)];
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function toggleThoughtVisibility(items, random, bounds, minVisible, maxVisible, pickThoughtTone, options = {}) {
  const activeItems = items.filter((item) => item.active);
  const inactiveItems = items.filter((item) => !item.active);

  if (inactiveItems.length && (activeItems.length < minVisible || (activeItems.length < maxVisible && random() > 0.48))) {
    setThoughtActive(pickRandomItem(random, inactiveItems), true, random, bounds, pickThoughtTone, options);
    return;
  }

  if (activeItems.length > minVisible) {
    setThoughtActive(pickRandomItem(random, activeItems), false, random, bounds, pickThoughtTone, options);
  }
}

export function initThoughtSpace(container) {
  if (!container || typeof window === "undefined") return () => {};

  const previousCleanup = thoughtSpaceCleanups.get(container);
  if (previousCleanup) previousCleanup();

  const elements = [...container.querySelectorAll("[data-thought-pill]")];
  if (!elements.length) return () => {};

  container.classList.add("thought-space");

  const seed = elements.reduce((total, element, index) => {
    return total + (index + 1) * String(element.textContent || "").length * 97;
  }, 131 + Math.floor(Math.random() * 1000003));
  const random = createSeededRandom(seed);
  const pickThoughtTone = createThoughtTonePicker(random);
  const runtimeOptions = readCloudRuntimeOptions();
  const compactMotion = runtimeOptions.width > 0 && runtimeOptions.width <= COMPACT_VIEWPORT_WIDTH;
  const compactOptions = { compact: compactMotion };
  const motionAllowed = !prefersReducedMotion() && shouldUseThoughtMotion(runtimeOptions);
  const visibilityRange = createThoughtVisibilityRange(elements.length, compactOptions);
  const minVisible = visibilityRange.min;
  const maxVisible = visibilityRange.max;
  const initialActiveFlags = createInitialThoughtActiveFlags(elements.length, random, compactOptions);
  let bounds = readThoughtBounds(container, { compact: compactMotion });
  let frameId = 0;
  let lastTime = 0;
  let visibilityTimer = 0;

  const items = elements.map((element, index) => ({
    element,
    active: initialActiveFlags[index] === true,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    width: 1,
    height: 1,
    scale: 1,
    targetScale: 1,
    rotation: 0,
    rotationSpeed: 0,
    nextScaleAt: 0,
  }));

  items.forEach((item) => applyThoughtTone(item.element, pickThoughtTone()));
  items.forEach((item) => resetThoughtMotion(item, random, bounds, compactOptions));
  items.forEach(applyThoughtStyle);

  function scheduleVisibilityToggle() {
    if (!motionAllowed || items.length < 2) return;
    visibilityTimer = window.setTimeout(() => {
      bounds = readThoughtBounds(container, { compact: compactMotion });
      toggleThoughtVisibility(items, random, bounds, minVisible, maxVisible, pickThoughtTone, compactOptions);
      scheduleVisibilityToggle();
    }, randomBetween(random, THOUGHT_MIN_TOGGLE_DELAY, THOUGHT_MAX_TOGGLE_DELAY));
  }

  function draw(time = 0) {
    bounds = readThoughtBounds(container, { compact: compactMotion });
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.04) : 0;
    lastTime = time;

    if (motionAllowed) {
      items.forEach((item) => {
        if (!item.active) return;

        if (time >= item.nextScaleAt) {
          item.targetScale = randomBetween(
            random,
            compactMotion ? THOUGHT_COMPACT_TARGET_SCALE_MIN : THOUGHT_TARGET_SCALE_MIN,
            compactMotion ? THOUGHT_COMPACT_TARGET_SCALE_MAX : THOUGHT_TARGET_SCALE_MAX,
          );
          item.nextScaleAt = time + randomBetween(random, 2600, 6200);
        }
        item.scale += (item.targetScale - item.scale) * Math.min(1, dt * 1.2);
      });
      stepThoughtPhysics(items, bounds, dt);
    }

    items.forEach(applyThoughtStyle);

    if (motionAllowed) {
      frameId = window.requestAnimationFrame(draw);
    }
  }

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          bounds = readThoughtBounds(container, { compact: compactMotion });
          items.forEach((item) => {
            measureThoughtItem(item);
            clampThoughtPosition(item, bounds);
            applyThoughtStyle(item);
          });
        });

  if (resizeObserver) resizeObserver.observe(container);
  draw();
  scheduleVisibilityToggle();

  const cleanup = () => {
    if (frameId) window.cancelAnimationFrame(frameId);
    if (visibilityTimer) window.clearTimeout(visibilityTimer);
    if (resizeObserver) resizeObserver.disconnect();
  };
  thoughtSpaceCleanups.set(container, cleanup);
  return cleanup;
}

export function renderChannels(channels) {
  return getVisibleSortedItems(channels)
    .map((channel) => {
      const href = safeHref(channel.url);
      const targetAttrs = href === "#" ? "" : ' target="_blank" rel="noreferrer"';
      return `
        <a href="${escapeHtml(href)}"${targetAttrs}>
          <span class="social-mark social-${escapeHtml(channel.tone || "blue")}"></span>
          <span>${escapeHtml(channel.title)}</span>
          <span aria-hidden="true">›</span>
        </a>
      `;
    })
    .join("");
}

export function renderSiteSections(data) {
  return {
    projects: renderProjects(data.projects),
    todos: renderTodos(data.todos),
    thoughts: renderThoughts(data.thoughts),
    channels: renderChannels(data.channels),
    signatureTitle: escapeHtml(data.identity.title),
    signatureSubtitle: escapeHtml(data.identity.subtitle),
  };
}

function setPageLoadState(state) {
  if (typeof document === "undefined") return;

  const progress = document.querySelector("[data-load-progress]");
  if (!progress) return;

  progress.dataset.loadState = state;
  if (state === "complete" && typeof window !== "undefined") {
    window.setTimeout(() => {
      progress.hidden = true;
    }, 680);
  }
}

function waitForBrowserDelay(delay) {
  if (typeof window === "undefined" || delay <= 0) return Promise.resolve();

  return new Promise((resolveDelay) => {
    window.setTimeout(resolveDelay, delay);
  });
}

function setLoadingProgressTarget(progress, options = {}) {
  if (typeof document === "undefined") return;

  const fill = document.querySelector("[data-loading-screen] .loading-progress-fill");
  const rawProgress = Number(progress);
  if (!Number.isFinite(rawProgress)) return;

  const target = Math.min(1, Math.max(LOADING_PROGRESS_INITIAL, rawProgress));
  loadingProgressTarget = options.allowBackwards === true ? target : Math.max(loadingProgressTarget, target);

  if (!fill) return;

  const duration = Math.max(0, Number(options.durationMs || LOADING_PROGRESS_STAGE_DURATION));
  fill.style.animation = "none";
  fill.style.transition = `transform ${duration}ms ease`;
  fill.style.transform = `scaleX(${loadingProgressTarget})`;
}

function startLoadingProgressBaseline() {
  setLoadingProgressTarget(LOADING_PROGRESS_FALLBACK_TARGET, {
    durationMs: LOADING_PROGRESS_RUN_TIME,
  });
}

function playLoadingStageTimeline() {
  setLoadingStage("reading");
  if (typeof window === "undefined") return Promise.resolve();

  return new Promise((resolveTimeline) => {
    window.setTimeout(() => setLoadingStage("todos"), LOADING_STAGE_STEP_DELAY);
    window.setTimeout(() => setLoadingStage("thoughts"), LOADING_STAGE_STEP_DELAY * 2);
    window.setTimeout(resolveTimeline, LOADING_STAGE_TIMELINE_DURATION);
  });
}

function setLoadingStage(stage, options = {}) {
  if (typeof document === "undefined") return false;

  const screen = document.querySelector("[data-loading-screen]");
  if (!screen) return false;

  screen.hidden = false;
  screen.dataset.loadingStage = stage;

  const label = screen.querySelector("[data-loading-label]");
  const labelText = LOADING_STAGE_LABELS[stage];
  if (label && labelText) {
    label.textContent = labelText;
  }

  if (LOADING_STAGE_PROGRESS[stage] != null) {
    setLoadingProgressTarget(LOADING_STAGE_PROGRESS[stage], options);
  }

  return true;
}

function setLoadingScreenState(state) {
  if (typeof document === "undefined") return;

  const screen = document.querySelector("[data-loading-screen]");
  if (!screen) return;

  if (state !== "done") {
    screen.hidden = false;
  }

  screen.dataset.loadingState = state;

  if (state === "ready") {
    setLoadingStage("ready", { durationMs: 420 });
  } else if (state === "failed") {
    setLoadingStage("failed", {
      durationMs: 260,
      allowBackwards: true,
    });
  } else if (state !== "done" && state !== "exiting" && !screen.dataset.loadingStage) {
    setLoadingStage("reading");
  }
}

function finishLoadingProgressToEnd() {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const fill = document.querySelector("[data-loading-screen] .loading-progress-fill");
  if (!fill || typeof window.getComputedStyle !== "function") return;

  const currentTransform = window.getComputedStyle(fill).transform;
  fill.style.animation = "none";
  fill.style.transition = "none";
  fill.style.transform = currentTransform && currentTransform !== "none" ? currentTransform : "scaleX(0.08)";
  fill.getBoundingClientRect();

  window.requestAnimationFrame(() => {
    fill.style.transition = "transform 420ms ease";
    fill.style.transform = "scaleX(1)";
  });
}

async function finishLoadingScreen(wasSuccessful = true, loadingStartedAt = Date.now()) {
  if (!wasSuccessful) {
    const elapsedLoadingTime = Math.max(0, Date.now() - loadingStartedAt);
    await waitForBrowserDelay(Math.max(0, Math.max(LOADING_PROGRESS_RUN_TIME, LOADING_FAILURE_MINIMUM_VISIBLE_TIME) - elapsedLoadingTime));
    setLoadingScreenState("failed");
    await waitForBrowserDelay(LOADING_FAILURE_HOLD_DELAY);
    const failedScreen = typeof document === "undefined" ? null : document.querySelector("[data-loading-screen]");
    if (failedScreen) failedScreen.dataset.loadingResult = "failure";
    setLoadingScreenState("exiting");
    await waitForBrowserDelay(LOADING_FAILURE_HIDE_DELAY);
    setLoadingScreenState("done");

    if (typeof document === "undefined") return;

    const screen = document.querySelector("[data-loading-screen]");
    if (screen && screen.dataset.loadingState === "done") {
      screen.hidden = true;
    }
    return;
  }

  finishLoadingProgressToEnd();
  setLoadingScreenState("ready");
  await waitForBrowserDelay(LOADING_SUCCESS_READY_DELAY);
  const readyScreen = typeof document === "undefined" ? null : document.querySelector("[data-loading-screen]");
  if (readyScreen) readyScreen.dataset.loadingResult = "success";
  setLoadingScreenState("exiting");
  await waitForBrowserDelay(LOADING_SUCCESS_HIDE_DELAY);
  setLoadingScreenState("done");

  if (typeof document === "undefined") return;

  const screen = document.querySelector("[data-loading-screen]");
  if (screen && screen.dataset.loadingState === "done") {
    screen.hidden = true;
  }
}

function setLiveDataMessage(message = "") {
  if (typeof document === "undefined") return;

  const messageElement = document.querySelector("[data-load-message]");
  if (!messageElement) return;

  if (message) {
    messageElement.textContent = message;
    messageElement.hidden = false;
    return;
  }

  messageElement.hidden = true;
}

function setLiveDataFallbackState(enabled) {
  if (typeof document === "undefined" || !document.body) return;

  document.body.classList.toggle("live-data-fallback", enabled === true);
  if (enabled === true) {
    const cloudCanvas = document.querySelector(".cloud-canvas");
    if (cloudCanvas) cloudCanvas.remove();
    document.body.classList.remove("canvas-clouds-ready");
  }
}

function scheduleHomepageCanvasBackground(options = {}) {
  if (typeof document === "undefined") return Promise.resolve(false);

  const delayMs = Math.max(0, Number(options.delayMs || 0));
  const shouldStart = typeof options.shouldStart === "function" ? options.shouldStart : () => true;
  const beforeStart = typeof options.beforeStart === "function" ? options.beforeStart : null;
  const waitForCanvasStartPaint = () => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      return waitForBrowserDelay(0);
    }

    return new Promise((resolvePaint) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolvePaint, 0);
      });
    });
  };
  const startCanvas = async () => {
    if (!shouldStart()) return false;
    if (beforeStart) beforeStart();
    await waitForCanvasStartPaint();
    if (!shouldStart()) return false;

    try {
      initCloudCanvasBackground();
      return true;
    } catch (error) {
      if (document.body) {
        document.body.classList.remove("canvas-clouds-ready");
      }
      return false;
    }
  };

  return new Promise((resolveCanvas) => {
    const scheduleStart = () => {
      if (!shouldStart()) {
        resolveCanvas(false);
        return;
      }

      if (typeof window === "undefined") {
        resolveCanvas(startCanvas());
        return;
      }

      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => resolveCanvas(startCanvas()), { timeout: 600 });
        return;
      }

      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => resolveCanvas(startCanvas()));
        return;
      }

      window.setTimeout(() => resolveCanvas(startCanvas()), 0);
    };

    if (typeof window === "undefined" || delayMs <= 0) {
      scheduleStart();
      return;
    }

    window.setTimeout(scheduleStart, delayMs);
  });
}

function prepareHomepageThoughts() {
  if (typeof document === "undefined" || !document.body) return;

  const thoughts = document.querySelector("[data-thoughts]");
  if (thoughts && document.body.contains(thoughts)) {
    initThoughtSpace(thoughts);
  }
}

export function mountSite(data = siteData, options = {}) {
  const shouldInitializeThoughts = options.initializeThoughts !== false;
  const rendered = renderSiteSections(data);
  const targets = {
    projects: document.querySelector("[data-projects]"),
    todos: document.querySelector("[data-todos]"),
    thoughts: document.querySelector("[data-thoughts]"),
    channels: document.querySelector("[data-channels]"),
    signatureTitle: document.querySelector("[data-signature-title]"),
    signatureSubtitle: document.querySelector("[data-signature-subtitle]"),
  };

  if (targets.projects) targets.projects.innerHTML = rendered.projects;
  if (targets.todos) targets.todos.innerHTML = rendered.todos;
  if (targets.thoughts) {
    targets.thoughts.innerHTML = rendered.thoughts;
    if (shouldInitializeThoughts) {
      initThoughtSpace(targets.thoughts);
    }
  }
  if (targets.channels) targets.channels.innerHTML = rendered.channels;
  if (targets.signatureTitle) targets.signatureTitle.textContent = data.identity.title;
  if (targets.signatureSubtitle) targets.signatureSubtitle.textContent = data.identity.subtitle;
}

function isTestServiceHost(hostname = "") {
  return (
    hostname === "test.xn--idyr71g.icu" ||
    hostname === "test.鸦珉.icu" ||
    hostname === "yamin-icu-test.vercel.app" ||
    hostname.indexOf("yamin-icu-test-") === 0
  );
}

function shouldForceLiveDataFailure(currentLocation = typeof window === "undefined" ? null : window.location) {
  if (!currentLocation) return false;

  const hostname = currentLocation.hostname || "";
  const pathname = (currentLocation.pathname || "").replace(/\/+$/, "") || "/";
  return isTestServiceHost(hostname) && pathname === "/fail";
}

export async function loadLiveSitePayload(fetchFn = fetch, options = {}) {
  const timeoutMs = Math.max(0, Number(options.timeoutMs == null ? LIVE_DATA_TIMEOUT : options.timeoutMs));
  const requestOptions = { cache: "no-store" };
  let abortController = null;
  let timeoutId = 0;

  try {
    if (options.forceFailure === true) {
      return { source: "static", data: siteData, apiError: "测试服强制读取失败。" };
    }

    if (timeoutMs && typeof AbortController !== "undefined") {
      abortController = new AbortController();
      requestOptions.signal = abortController.signal;
      timeoutId = globalThis.setTimeout(() => abortController.abort(), timeoutMs);
    }

    const response = await fetchFn("/api/site-data", requestOptions);
    if (!response.ok) {
      return { source: "static", data: siteData, apiError: `HTTP ${response.status}` };
    }

    const payload = await response.json();
    if (payload && payload.data) return payload;
    return { source: "static", data: siteData, apiError: "接口没有返回站点数据。" };
  } catch (error) {
    return { source: "static", data: siteData, apiError: error.message || "读取线上数据失败。" };
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  }
}

export async function loadLiveSiteData(fetchFn = fetch, options = {}) {
  const payload = await loadLiveSitePayload(fetchFn, options);
  return payload.data || siteData;
}

export async function mountLiveSite() {
  setLiveDataFallbackState(false);
  const loadingStartedAt = Date.now();
  loadingProgressTarget = LOADING_PROGRESS_INITIAL;
  setLoadingScreenState("loading");
  const stageTimelineReady = playLoadingStageTimeline();
  startLoadingProgressBaseline();
  setPageLoadState("content");
  const payload = await loadLiveSitePayload(fetch, {
    timeoutMs: LIVE_DATA_TIMEOUT,
    forceFailure: shouldForceLiveDataFailure(),
  });
  const shouldWarn = payload && (payload.source === "static" || payload.apiError || payload.databaseError);
  setLiveDataMessage(shouldWarn ? LIVE_DATA_FALLBACK_MESSAGE : "");
  setLiveDataFallbackState(shouldWarn);
  mountSite(payload && payload.data ? payload.data : siteData, { initializeThoughts: false });
  prepareHomepageThoughts();
  setPageLoadState("complete");
  if (!shouldWarn) {
    await stageTimelineReady;
    const canvasReady = scheduleHomepageCanvasBackground({
      delayMs: 0,
      beforeStart: () => setLoadingStage("clouds"),
      shouldStart: () => document.body && !document.body.classList.contains("live-data-fallback"),
    });
    await canvasReady;
  }
  await finishLoadingScreen(!shouldWarn, loadingStartedAt);
}

function readCloudRuntimeOptions() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
  return {
    width: window.innerWidth,
    deviceMemory: navigator.deviceMemory,
    saveData: connection.saveData === true,
  };
}

export function shouldUseCanvasClouds(options = {}) {
  const width = Math.max(0, Number(options.width || 0));
  const memory = options.deviceMemory == null ? null : Number(options.deviceMemory);

  if (options.saveData === true) return false;
  if (width && width <= 1100) return false;
  if (memory && memory < 4) return false;

  return true;
}

export function shouldUseThoughtMotion(options = {}) {
  const memory = options.deviceMemory == null ? null : Number(options.deviceMemory);

  if (options.saveData === true) return false;
  if (memory && memory < 4) return false;

  return true;
}

export function applyBackgroundLabMode(search = window.location.search) {
  const params = new URLSearchParams(search);
  document.body.classList.toggle("background-lab", params.has("bg"));
}

function createCloudTexture() {
  const texture = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = 5600;
  const height = 900;
  texture.width = Math.round(width * dpr);
  texture.height = Math.round(height * dpr);

  const context = texture.getContext("2d");
  context.scale(dpr, dpr);
  context.clearRect(0, 0, width, height);

  function cloudGradient(x, y, radius, stops) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    return gradient;
  }

  function drawLobe(x, y, rx, ry, fill, alpha = 1) {
    context.save();
    context.globalAlpha = alpha;
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
    context.restore();
  }

  function createRandom(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomBetween(random, min, max) {
    return min + (max - min) * random();
  }

  function pickLobe(random, lobes) {
    return lobes[Math.floor(random() * lobes.length)];
  }

  function drawCloud(cx, cy, scale, alpha, lobes) {
    const random = createRandom(Math.floor(cx * 13 + cy * 17 + scale * 1000));

    context.save();
    context.globalAlpha = alpha;

    context.filter = `blur(${6.5 * scale}px)`;
    const sortedLobes = [...lobes].sort((a, b) => a[0] - b[0]);
    sortedLobes.slice(0, -1).forEach((lobe, index) => {
      const next = sortedLobes[index + 1];
      const x = (lobe[0] + next[0]) / 2;
      const y = (lobe[1] + next[1]) / 2;
      const distance = Math.abs(next[0] - lobe[0]);
      const rx = Math.max(distance * 0.72, (lobe[2] + next[2]) * 0.38);
      const ry = Math.max(lobe[3], next[3]) * 0.72;
      drawLobe(
        cx + x * scale,
        cy + y * scale,
        rx * scale,
        ry * scale,
        cloudGradient(cx + x * scale, cy + (y - ry * 0.28) * scale, Math.max(rx, ry) * scale * 1.25, [
          [0, "rgba(255, 255, 255, 0.94)"],
          [0.48, "rgba(246, 251, 255, 0.78)"],
          [0.78, "rgba(204, 222, 234, 0.16)"],
          [1, "rgba(255, 255, 255, 0)"],
        ]),
        0.66,
      );
    });

    context.filter = `blur(${3.5 * scale}px)`;
    lobes.forEach(([x, y, rx, ry]) => {
      drawLobe(
        cx + x * scale,
        cy + y * scale,
        rx * scale * 1.05,
        ry * scale * 1.04,
        cloudGradient(cx + x * scale, cy + (y - ry * 0.42) * scale, Math.max(rx, ry) * scale * 1.12, [
          [0, "rgba(255, 255, 255, 0.98)"],
          [0.5, "rgba(255, 255, 255, 0.8)"],
          [0.82, "rgba(221, 234, 243, 0.13)"],
          [1, "rgba(255, 255, 255, 0)"],
        ]),
        0.72,
      );
    });

    context.filter = `blur(${2.1 * scale}px)`;
    for (let i = 0; i < lobes.length * 5; i += 1) {
      const [x, y, rx, ry] = pickLobe(random, lobes);
      const angle = randomBetween(random, -Math.PI * 0.96, -Math.PI * 0.06);
      const edgeX = Math.cos(angle) * rx * randomBetween(random, 0.72, 1.1);
      const edgeY = Math.sin(angle) * ry * randomBetween(random, 0.68, 1.12);
      const px = cx + (x + edgeX + randomBetween(random, -18, 18)) * scale;
      const py = cy + (y + edgeY + randomBetween(random, -12, 12)) * scale;
      const radius = randomBetween(random, 7, 28) * scale;
      drawLobe(
        px,
        py,
        radius * randomBetween(random, 0.9, 2.4),
        radius * randomBetween(random, 0.34, 0.86),
        cloudGradient(px, py, radius * 1.4, [
          [0, "rgba(255, 255, 255, 0.58)"],
          [0.5, "rgba(241, 248, 255, 0.28)"],
          [1, "rgba(255, 255, 255, 0)"],
        ]),
        randomBetween(random, 0.18, 0.4),
      );
    }

    context.filter = "none";
    context.restore();
  }

  const lowBroadCloud = [
    [-396, 28, 114, 34],
    [-292, -4, 150, 50],
    [-154, -30, 190, 66],
    [20, -42, 220, 72],
    [214, -28, 190, 62],
    [386, 10, 128, 38],
    [-80, -58, 126, 40],
    [118, -58, 130, 38],
    [10, 16, 318, 46],
    [-320, 54, 148, 28],
    [-126, 62, 218, 30],
    [112, 62, 236, 30],
    [336, 54, 172, 26],
  ];

  [
    [260, 515, 0.5, 0.2],
    [560, 270, 0.34, 0.15],
    [780, 385, 0.28, 0.12],
    [910, 565, 0.34, 0.15],
    [1120, 690, 0.4, 0.16],
    [1220, 420, 0.74, 0.3],
    [1430, 250, 0.5, 0.2],
    [1540, 535, 0.3, 0.13],
    [1650, 665, 0.42, 0.17],
    [1810, 315, 0.38, 0.17],
    [1960, 210, 0.32, 0.13],
    [2140, 470, 0.58, 0.25],
    [2440, 570, 0.31, 0.13],
    [2700, 320, 0.34, 0.15],
    [2820, 220, 0.46, 0.19],
    [3000, 440, 0.5, 0.22],
    [3290, 555, 0.35, 0.15],
    [3340, 690, 0.5, 0.19],
    [3560, 315, 0.32, 0.14],
    [3720, 235, 0.38, 0.16],
    [3860, 500, 0.68, 0.27],
    [4140, 380, 0.32, 0.14],
    [4420, 565, 0.38, 0.16],
    [4540, 685, 0.48, 0.18],
    [4710, 330, 0.35, 0.15],
    [4880, 245, 0.42, 0.17],
    [5050, 480, 0.52, 0.22],
    [5380, 350, 0.3, 0.13],
    [5480, 650, 0.42, 0.16],
  ].forEach(([cx, cy, scale, alpha]) => drawCloud(cx, cy, scale, alpha, lowBroadCloud));

  texture.dataset.cssWidth = String(width);
  texture.dataset.cssHeight = String(height);
  return texture;
}

export function initCloudCanvasBackground() {
  if (!document.body || document.querySelector(".cloud-canvas")) return;
  if (document.body.classList.contains("live-data-fallback")) return;
  if (!shouldUseCanvasClouds(readCloudRuntimeOptions())) return;

  const canvas = document.createElement("canvas");
  canvas.className = "cloud-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const context = canvas.getContext("2d");
  const texture = createCloudTexture();
  const textureWidth = Number(texture.dataset.cssWidth);
  const textureHeight = Number(texture.dataset.cssHeight);
  const motionAllowed = !prefersReducedMotion();
  let frameId = 0;

  function draw(time = 0) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = height / textureHeight;
    const tileWidth = textureWidth * scale;
    const speed = motionAllowed ? 0.02 : 0;
    const offset = -((time * speed + 420) % tileWidth);

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    for (let x = offset - tileWidth; x < width + tileWidth; x += tileWidth) {
      context.drawImage(texture, x, 0, tileWidth, height);
    }

    if (motionAllowed) {
      frameId = window.requestAnimationFrame(draw);
    }
  }

  document.body.classList.add("canvas-clouds-ready");
  draw();

  window.addEventListener("resize", () => draw(), { passive: true });
  if (motionAllowed) {
    frameId = window.requestAnimationFrame(draw);
  }

  return () => {
    if (frameId) window.cancelAnimationFrame(frameId);
    canvas.remove();
    document.body.classList.remove("canvas-clouds-ready");
  };
}

if (typeof document !== "undefined") {
  applyBackgroundLabMode();
  initMapViewportScale();
  if (document.querySelector("[data-projects]")) {
    void mountLiveSite();
  }
}
