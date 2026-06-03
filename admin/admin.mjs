import { siteData } from "/v1/content/site-data.mjs";
import {
  loadLiveSitePayload,
  renderChannels,
  renderProjects,
  renderThoughts,
  renderTodos,
} from "/v1/scripts/render-site.mjs";

const STORAGE_KEY = "yamin.siteDataDraft.v1";
const LEGACY_ADMIN_TOKEN_KEY = "yamin.adminToken.v1";
const ADMIN_LOAD_TIMEOUT = 30000;

const sectionMeta = {
  projects: { label: "项目卡片", itemName: "项目" },
  todos: { label: "待办横条", itemName: "待办" },
  thoughts: { label: "奇怪念头", itemName: "念头" },
  channels: { label: "视频账号", itemName: "频道" },
};

const iconOptions = ["coffee", "leaf", "video", "phone", "cube"];
const toneOptions = ["blue", "green", "orange", "purple", "pink", "red", "yellow", "cyan", "black", "white"];
const statusToneOptions = ["live", "building", "plan", "quiet"];
const variantOptions = ["large", "wide"];

let activeSection = "projects";
let state = clone(siteData);
let loadedContentSource = "static";
let loadedContentRevision = null;
let onlineRevisionConflict = false;
let pendingAuthResolve = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function prepareSiteDataForSave(value) {
  const data = clone(value);
  data.thoughts = (data.thoughts || []).map(({ tone, ...thought }) => thought);
  return data;
}

function makeDraftPayload() {
  return {
    data: prepareSiteDataForSave(state),
    source: loadedContentSource,
    revision: loadedContentRevision,
    savedAt: new Date().toISOString(),
  };
}

function persistDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(makeDraftPayload()));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) return null;
    if (parsed.data && parsed.data.identity) {
      return {
        data: parsed.data,
        source: parsed.source || "draft",
        revision: parsed.revision || null,
      };
    }
    if (parsed.identity) {
      return {
        data: parsed,
        source: "draft",
        revision: null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function saveDraft() {
  persistDraft();
  setStatus("草稿已保存在当前浏览器。");
}

function clearLegacyAdminToken() {
  try {
    localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
  } catch {
    // Legacy cleanup is best effort only.
  }
}

async function loadCurrentContent() {
  const draft = loadDraft();
  if (draft) {
    state = clone(draft.data);
    loadedContentSource = draft.source || "draft";
    loadedContentRevision = draft.revision || null;
    onlineRevisionConflict = false;
    render();
    setStatus("已载入当前浏览器里的草稿。");
    return;
  }

  const payload = await loadLiveSitePayload(fetch, { timeoutMs: ADMIN_LOAD_TIMEOUT });
  state = clone(payload.data || siteData);
  loadedContentSource = payload.source || "static";
  loadedContentRevision = payload.revision || null;
  onlineRevisionConflict = false;
  render();
  if (loadedContentSource === "static") {
    setStatus("没有读到线上数据库，只载入了静态旧数据；为避免覆盖，已禁止直接保存。");
  } else if (loadedContentSource === "local") {
    setStatus("已载入本地预览数据。");
  } else {
    setStatus("已载入当前线上内容。");
  }
}

function setStatus(message) {
  const target = document.querySelector("[data-status]");
  if (target) target.textContent = message;
}

function sortItems(items) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function normalizeOrder(section) {
  state[section] = sortItems(state[section]).map((item, index) => ({
    ...item,
    order: (index + 1) * 10,
  }));
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}`;
}

function getDefaults(section) {
  if (section === "projects") {
    return {
      id: makeId("project"),
      order: nextOrder(section),
      visible: true,
      variant: "wide",
      icon: "cube",
      title: "新的实验位",
      status: "待命",
      statusTone: "quiet",
      description: "先占一个位置，之后再决定它要长成什么。",
      url: "",
      urlLabel: "",
    };
  }

  if (section === "todos") {
    return {
      id: makeId("todo"),
      order: nextOrder(section),
      visible: true,
      title: "新的待办",
      tone: "blue",
      progress: 0,
    };
  }

  if (section === "thoughts") {
    return {
      id: makeId("thought"),
      order: nextOrder(section),
      visible: true,
      text: "一个还没想清楚的念头",
    };
  }

  return {
    id: makeId("channel"),
    order: nextOrder(section),
    visible: true,
    title: "新的频道",
    tone: "blue",
    url: "",
  };
}

function nextOrder(section) {
  const orders = state[section].map((item) => Number(item.order || 0));
  return (Math.max(0, ...orders) || 0) + 10;
}

function updateItem(section, id, field, value) {
  state[section] = state[section].map((item) =>
    item.id === id ? { ...item, [field]: value } : item,
  );
  renderPreview();
  setStatus("草稿有未保存改动。");
}

function deleteItem(section, id) {
  state[section] = state[section].filter((item) => item.id !== id);
  normalizeOrder(section);
  render();
  setStatus("已删除一条草稿内容。");
}

function moveItem(section, id, direction) {
  const items = sortItems(state[section]);
  const index = items.findIndex((item) => item.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;

  [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
  state[section] = items.map((item, itemIndex) => ({
    ...item,
    order: (itemIndex + 1) * 10,
  }));
  render();
  setStatus("排序已更新，记得保存到线上。");
}

function fieldMarkup(item, section) {
  if (section === "projects") {
    return `
      ${textInput("标题", "title", item.title)}
      ${textareaInput("说明", "description", item.description)}
      <div class="field-grid">
        ${selectInput("卡片尺寸", "variant", item.variant, variantOptions)}
        ${selectInput("图标", "icon", item.icon, iconOptions)}
      </div>
      <div class="field-grid">
        ${textInput("状态", "status", item.status)}
        ${selectInput("状态颜色", "statusTone", item.statusTone, statusToneOptions)}
      </div>
      <div class="field-grid">
        ${textInput("链接", "url", item.url)}
        ${textInput("链接文字", "urlLabel", item.urlLabel)}
      </div>
    `;
  }

  if (section === "todos") {
    return `
      ${textInput("标题", "title", item.title)}
      <div class="field-grid">
        ${numberInput("进度", "progress", item.progress)}
        ${selectInput("颜色", "tone", item.tone, toneOptions)}
      </div>
    `;
  }

  if (section === "thoughts") {
    return `
      ${textInput("念头", "text", item.text)}
    `;
  }

  return `
    ${textInput("名称", "title", item.title)}
    <div class="field-grid">
      ${textInput("链接", "url", item.url)}
      ${selectInput("颜色", "tone", item.tone, toneOptions)}
    </div>
  `;
}

function textInput(label, field, value = "") {
  return `
    <label class="field">
      <span>${label}</span>
      <input type="text" value="${escapeAttr(value)}" data-field="${field}" />
    </label>
  `;
}

function textareaInput(label, field, value = "") {
  return `
    <label class="field">
      <span>${label}</span>
      <textarea rows="3" data-field="${field}">${escapeText(value)}</textarea>
    </label>
  `;
}

function numberInput(label, field, value = 0) {
  return `
    <label class="field">
      <span>${label}</span>
      <input type="number" min="0" max="100" value="${Number(value || 0)}" data-field="${field}" />
    </label>
  `;
}

function selectInput(label, field, value, options) {
  const optionHtml = options
    .map((option) => {
      const selected = option === value ? " selected" : "";
      return `<option value="${escapeAttr(option)}"${selected}>${escapeText(option)}</option>`;
    })
    .join("");

  return `
    <label class="field">
      <span>${label}</span>
      <select data-field="${field}">${optionHtml}</select>
    </label>
  `;
}

function renderTabs() {
  const target = document.querySelector("[data-tabs]");
  target.innerHTML = Object.entries(sectionMeta)
    .map(([key, meta]) => {
      const active = key === activeSection ? " active" : "";
      return `<button type="button" class="tab-button${active}" data-section="${key}">${meta.label}</button>`;
    })
    .join("");
}

function renderEditor() {
  const target = document.querySelector("[data-editor-list]");
  const items = sortItems(state[activeSection]);
  const meta = sectionMeta[activeSection];

  target.innerHTML = items
    .map((item, index) => {
      const compactClass = activeSection === "thoughts" ? " thought-editor-card" : "";
      const moveButtons =
        activeSection === "thoughts"
          ? ""
          : `
            <button type="button" data-action="move-up">上移</button>
            <button type="button" data-action="move-down">下移</button>
          `;
      return `
        <article class="editor-card${compactClass}" data-item-id="${escapeAttr(item.id)}">
          <header class="editor-card-header">
            <div>
              <span class="item-number">${String(index + 1).padStart(2, "0")}</span>
              <strong>${escapeText(item.title || item.text || meta.itemName)}</strong>
            </div>
            <label class="visible-toggle">
              <input type="checkbox" data-field="visible"${item.visible !== false ? " checked" : ""} />
              <span>显示</span>
            </label>
          </header>
          ${fieldMarkup(item, activeSection)}
          <footer class="editor-card-actions">
            ${moveButtons}
            <button type="button" class="danger-button" data-action="delete-item">删除</button>
          </footer>
        </article>
      `;
    })
    .join("");
}

function renderPreview() {
  document.querySelectorAll("[data-preview-section]").forEach((section) => {
    section.style.order = section.dataset.previewSection === activeSection ? "-1" : "0";
  });
  document.querySelector("[data-preview-projects]").innerHTML = renderProjects(state.projects);
  document.querySelector("[data-preview-todos]").innerHTML = renderTodos(state.todos);
  document.querySelector("[data-preview-thoughts]").innerHTML = renderThoughts(state.thoughts);
  document.querySelector("[data-preview-channels]").innerHTML = renderChannels(state.channels);
}

function render() {
  renderTabs();
  renderEditor();
  renderPreview();
}

function escapeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function getAuthDialogParts() {
  return {
    dialog: document.querySelector("[data-auth-dialog]"),
    form: document.querySelector("[data-auth-form]"),
    password: document.querySelector("[data-auth-password]"),
    trust: document.querySelector("[data-auth-trust]"),
    message: document.querySelector("[data-auth-message]"),
    submit: document.querySelector("[data-auth-submit]"),
  };
}

function resolveAuthDialog(value) {
  if (!pendingAuthResolve) return;
  const resolve = pendingAuthResolve;
  pendingAuthResolve = null;
  resolve(value);
}

function requestAdminSession() {
  const { dialog, password, trust, message, submit } = getAuthDialogParts();
  if (!dialog || !password || !trust || !message || !submit) return Promise.resolve(false);

  password.value = "";
  trust.checked = false;
  message.textContent = "";
  submit.disabled = false;

  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => password.focus(), 0);

  return new Promise((resolve) => {
    pendingAuthResolve = resolve;
  });
}

async function loginAdmin(password, trustDevice) {
  const response = await fetch("/api/admin-session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, trustDevice }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function refreshAdminSession() {
  await fetch("/api/admin-session", {
    method: "GET",
    credentials: "same-origin",
  }).catch(() => null);
}

async function clearDeviceSession() {
  await fetch("/api/admin-session", {
    method: "DELETE",
    credentials: "same-origin",
  }).catch(() => null);
  setStatus("已清除此设备授权。下次保存会重新要求输入口令。");
}

async function putOnline() {
  const headers = { "Content-Type": "application/json" };

  const response = await fetch("/api/site-data", {
    method: "PUT",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({
      data: prepareSiteDataForSave(state),
      expectedRevision: loadedContentRevision,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function saveOnline() {
  if (loadedContentSource === "static") {
    setStatus("没有保存：后台没有读到线上数据库，只读到了静态旧数据。请刷新后再保存。");
    return;
  }

  setStatus("正在保存到线上。");

  if (!loadedContentRevision && loadedContentSource !== "local") {
    persistDraft();
    setStatus("没有保存：这个编辑台缺少线上基准版本。当前内容已保留为草稿，请先恢复线上内容后再合并修改。");
    return;
  }

  if (onlineRevisionConflict) {
    persistDraft();
    setStatus("没有保存：线上内容已经变化，当前内容已保留为草稿。请先恢复线上内容，再重新合并你的修改。");
    return;
  }

  let result = await putOnline();

  if (result.response.status === 401) {
    const authorized = await requestAdminSession();
    if (!authorized) {
      setStatus("没有保存：需要后台保存口令。");
      return;
    }
    result = await putOnline();
  }

  if (result.response.status === 409) {
    onlineRevisionConflict = true;
    persistDraft();
    setStatus(result.payload.error || "没有保存：线上内容已经变化，当前草稿已保留。请先恢复线上内容后再保存。");
    return;
  }

  if (!result.response.ok) {
    setStatus(result.payload.error || "保存失败。");
    return;
  }

  state = clone(result.payload.data || state);
  loadedContentSource = result.payload.source || loadedContentSource;
  loadedContentRevision = result.payload.revision || loadedContentRevision;
  onlineRevisionConflict = false;
  localStorage.removeItem(STORAGE_KEY);
  render();

  const backupWarning = result.payload.backup && result.payload.backup.warning
    ? ` ${result.payload.backup.warning}`
    : "";

  if (result.payload.source === "local") {
    setStatus(`已保存到本地预览数据，首页刷新后可见。${backupWarning}`);
  } else {
    setStatus(`已保存到线上数据库，已生成保存前备份，首页刷新后可见。${backupWarning}`);
  }
}

async function restoreOnlineContent() {
  localStorage.removeItem(STORAGE_KEY);
  const payload = await loadLiveSitePayload(fetch, { timeoutMs: ADMIN_LOAD_TIMEOUT });
  state = clone(payload.data || siteData);
  loadedContentSource = payload.source || "static";
  loadedContentRevision = payload.revision || null;
  onlineRevisionConflict = false;
  render();
  if (loadedContentSource === "static") {
    setStatus("没有读到线上数据库，只恢复到静态旧数据；为避免覆盖，已禁止直接保存。");
  } else {
    setStatus("已恢复为当前线上内容。");
  }
}

async function checkOnlineRevision() {
  if (!loadedContentRevision || loadedContentSource === "static") return;

  const payload = await loadLiveSitePayload(fetch, { timeoutMs: ADMIN_LOAD_TIMEOUT });
  if (!payload.revision || payload.source === "static") return;

  if (payload.revision !== loadedContentRevision) {
    onlineRevisionConflict = true;
    persistDraft();
    setStatus("线上内容已经变化：当前编辑台基于旧版本，已保留为草稿。请先恢复线上内容，再合并你的修改。");
  }
}

function downloadDataFile() {
  const text = `export const siteData = ${JSON.stringify(prepareSiteDataForSave(state), null, 2)};\n`;
  const blob = new Blob([text], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "site-data.mjs";
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("已生成数据文件。也可以直接保存到线上。");
}

document.addEventListener("click", async (event) => {
  const sectionButton = event.target.closest("[data-section]");
  if (sectionButton) {
    activeSection = sectionButton.dataset.section;
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const card = actionButton.closest("[data-item-id]");
  const id = card?.dataset.itemId;

  if (action === "save-draft") {
    saveDraft();
  } else if (action === "save-online") {
    await saveOnline();
  } else if (action === "download") {
    downloadDataFile();
  } else if (action === "reset-draft") {
    await restoreOnlineContent();
  } else if (action === "clear-session") {
    await clearDeviceSession();
  } else if (action === "add-item") {
    state[activeSection].push(getDefaults(activeSection));
    normalizeOrder(activeSection);
    render();
    setStatus(`已新增一条${sectionMeta[activeSection].itemName}。`);
  } else if (action === "delete-item" && id) {
    deleteItem(activeSection, id);
  } else if (action === "move-up" && id) {
    moveItem(activeSection, id, -1);
  } else if (action === "move-down" && id) {
    moveItem(activeSection, id, 1);
  }
});

document.addEventListener("input", (event) => {
  const fieldTarget = event.target.closest("[data-field]");
  if (!fieldTarget) return;

  const card = fieldTarget.closest("[data-item-id]");
  if (!card) return;

  const field = fieldTarget.dataset.field;
  let value = fieldTarget.value;
  if (fieldTarget.type === "checkbox") value = fieldTarget.checked;
  if (field === "progress") value = Math.max(0, Math.min(100, Number(value || 0)));

  updateItem(activeSection, card.dataset.itemId, field, value);
});

document.addEventListener("change", (event) => {
  const fieldTarget = event.target.closest("[data-field]");
  if (!fieldTarget) return;
  fieldTarget.dispatchEvent(new Event("input", { bubbles: true }));
});

document.querySelector(".preview-panel").addEventListener("click", (event) => {
  if (event.target.closest("a")) event.preventDefault();
});

document.querySelector("[data-auth-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const { dialog, password, trust, message, submit } = getAuthDialogParts();
  const token = password.value.trim();
  if (!token) {
    message.textContent = "请输入后台口令。";
    return;
  }

  submit.disabled = true;
  message.textContent = "正在授权。";
  const result = await loginAdmin(token, trust.checked);
  submit.disabled = false;

  if (!result.response.ok) {
    message.textContent = result.payload.error || "授权失败。";
    return;
  }

  dialog.close();
  setStatus(trust.checked ? "已授权，并信任这台设备。" : "已授权，3 小时内可保存。");
  resolveAuthDialog(true);
});

document.querySelector("[data-auth-cancel]").addEventListener("click", () => {
  const { dialog } = getAuthDialogParts();
  dialog.close();
  resolveAuthDialog(false);
});

document.querySelector("[data-auth-dialog]").addEventListener("cancel", () => {
  resolveAuthDialog(false);
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    checkOnlineRevision();
  }
});

render();
clearLegacyAdminToken();
loadCurrentContent();
refreshAdminSession();
