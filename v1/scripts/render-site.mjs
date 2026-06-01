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
      return `
        <div class="todo-row">
          <span class="todo-dot todo-${escapeHtml(todo.tone || "blue")}"></span>
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

if (typeof document !== "undefined") {
  mountSite(siteData);
}
