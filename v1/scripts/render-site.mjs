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

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getVisibleSortedItems(items) {
  return [...items]
    .filter((item) => item.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function safeHref(url) {
  const value = String(url ?? "").trim();
  if (value.startsWith("https://") || value.startsWith("http://")) {
    return value;
  }
  return "#";
}

function renderIcon(name, className) {
  return `<span class="${className}" aria-hidden="true">${iconMap[name] ?? iconMap.cube}</span>`;
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
        <span aria-hidden="true">›</span>
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
      const progress = Math.max(0, Math.min(100, Number(todo.progress ?? 0)));
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
    .map((thought) => {
      return `<span class="thought-pill pill-${escapeHtml(thought.tone || "blue")}">${escapeHtml(thought.text)}</span>`;
    })
    .join("");
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

export function mountSite(data = siteData) {
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
  if (targets.thoughts) targets.thoughts.innerHTML = rendered.thoughts;
  if (targets.channels) targets.channels.innerHTML = rendered.channels;
  if (targets.signatureTitle) targets.signatureTitle.textContent = data.identity.title;
  if (targets.signatureSubtitle) targets.signatureSubtitle.textContent = data.identity.subtitle;
}

export async function loadLiveSiteData(fetchFn = fetch) {
  try {
    const response = await fetchFn("/api/site-data", { cache: "no-store" });
    if (!response.ok) return siteData;

    const payload = await response.json();
    return payload?.data || siteData;
  } catch {
    return siteData;
  }
}

export async function mountLiveSite() {
  mountSite(await loadLiveSiteData());
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

  const canvas = document.createElement("canvas");
  canvas.className = "cloud-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const context = canvas.getContext("2d");
  const texture = createCloudTexture();
  const textureWidth = Number(texture.dataset.cssWidth);
  const textureHeight = Number(texture.dataset.cssHeight);
  const motionAllowed = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  initCloudCanvasBackground();
  if (document.querySelector("[data-projects]")) {
    mountLiveSite();
  }
}
