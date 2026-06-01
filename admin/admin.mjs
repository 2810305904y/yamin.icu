import { siteData } from "/v1/content/site-data.mjs";
import {
  renderChannels,
  renderProjects,
  renderThoughts,
  renderTodos,
} from "/v1/scripts/render-site.mjs";

const STORAGE_KEY = "yamin.siteDataDraft.v1";

const sectionMeta = {
  projects: { label: "项目卡片", itemName: "项目" },
  todos: { label: "待办横条", itemName: "待办" },
  thoughts: { label: "奇怪念头", itemName: "念头" },
  channels: { label: "视频账号", itemName: "频道" },
};

const iconOptions = ["coffee", "leaf", "video", "phone", "cube"];
const toneOptions = ["blue", "green", "orange", "purple", "pink", "red"];
const statusToneOptions = ["live", "building", "plan", "quiet"];
const variantOptions = ["large", "wide"];

let activeSection = "projects";
let state = loadDraft() || clone(siteData);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  setStatus("草稿已保存在当前浏览器。");
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
      tone: "blue",
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
  state[section] = items;
  normalizeOrder(section);
  render();
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
      return `
        <article class="editor-card" data-item-id="${escapeAttr(item.id)}">
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
            <button type="button" data-action="move-up">上移</button>
            <button type="button" data-action="move-down">下移</button>
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

function downloadDataFile() {
  const text = `export const siteData = ${JSON.stringify(state, null, 2)};\n`;
  const blob = new Blob([text], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "site-data.mjs";
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("已生成数据文件。真正自动写入线上内容需要后续接存储。");
}

document.addEventListener("click", (event) => {
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
  } else if (action === "download") {
    downloadDataFile();
  } else if (action === "reset-draft") {
    localStorage.removeItem(STORAGE_KEY);
    state = clone(siteData);
    render();
    setStatus("已恢复为当前线上内容。");
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

render();
