window.__ModuleLoader__.load({
	id: "dsh-squares",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
		  for (var name in all)
		    __defProp(target, name, { get: all[name], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
		  if (from && typeof from === "object" || typeof from === "function") {
		    for (let key of __getOwnPropNames(from))
		      if (!__hasOwnProp.call(to, key) && key !== except)
		        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
		  }
		  return to;
		};
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

		// src/client/index.tsx
		var index_exports = {};
		__export(index_exports, {
		  PANEL_ID: () => PANEL_ID,
		  apply: () => apply,
		  inject: () => inject
		});
		module.exports = __toCommonJS(index_exports);

		// src/client/panel.tsx
		var import_react7 = require("react");

		// src/client/api.ts
		var API_BASE = "api/dsh-squares";
		var ApiError = class extends Error {
		  constructor(message, status, code) {
		    super(message);
		    this.status = status;
		    this.code = code;
		    this.name = "ApiError";
		  }
		};
		async function request(path, init = {}) {
		  const search = new URLSearchParams();
		  for (const [key, value] of Object.entries(init.query ?? {})) {
		    if (value !== void 0 && value !== "") search.set(key, value);
		  }
		  const query = search.toString();
		  const url = `${API_BASE}${path}${query === "" ? "" : `?${query}`}`;
		  const response = await fetch(url, {
		    method: init.method ?? "GET",
		    headers: init.body === void 0 ? void 0 : { "content-type": "application/json" },
		    body: init.body === void 0 ? void 0 : JSON.stringify(init.body)
		  });
		  const text = await response.text();
		  let payload;
		  try {
		    payload = text === "" ? {} : JSON.parse(text);
		  } catch {
		    payload = { error: text };
		  }
		  if (!response.ok) {
		    const record = payload;
		    throw new ApiError(
		      typeof record.error === "string" ? record.error : `HTTP ${String(response.status)}`,
		      response.status,
		      typeof record.code === "string" ? record.code : void 0
		    );
		  }
		  return payload;
		}
		var api = {
		  capabilities: () => request("/capabilities"),
		  status: () => request("/status"),
		  skills: (cwd) => request("/skills", { query: { cwd } }),
		  skillRead: (name, path, cwd) => request("/skills/read", { query: { name, path, cwd } }),
		  skillCreate: (input) => request("/skills/create", { method: "POST", body: input }),
		  skillUpdate: (input) => request("/skills/update", { method: "POST", body: input }),
		  skillSetEnabled: (input) => request("/skills/set-enabled", {
		    method: "POST",
		    body: input
		  }),
		  skillDelete: (input) => request("/skills/delete", { method: "POST", body: input }),
		  skillImport: (input) => request(
		    "/skills/import",
		    { method: "POST", body: input }
		  ),
		  skillCreatorPrompt: (requirement) => request(
		    "/skills/creator-prompt",
		    { method: "POST", body: { requirement } }
		  ),
		  experts: () => request("/experts"),
		  expertRead: (id) => request("/experts/read", { query: { id } }),
		  expertCreate: (input) => request("/experts/create", {
		    method: "POST",
		    body: input
		  }),
		  expertUpdate: (input) => request("/experts/update", {
		    method: "POST",
		    body: input
		  }),
		  expertDelete: (id) => request("/experts/delete", { method: "POST", body: { id } }),
		  expertDuplicate: (id) => request("/experts/duplicate", { method: "POST", body: { id } }),
		  // ---------------------------------------------------------------- 广场
		  catalogSources: () => request("/catalog/sources"),
		  catalogCategories: (kind) => request("/catalog/categories", { query: { kind } }),
		  catalog: (query) => request("/catalog", {
		    query: {
		      kind: query.kind,
		      source: query.source,
		      q: query.q,
		      category: query.category,
		      sort: query.sort,
		      cursor: query.cursor,
		      limit: query.limit === void 0 ? void 0 : String(query.limit)
		    }
		  }),
		  catalogItem: (source, id) => request("/catalog/item", { query: { source, id } }),
		  catalogInstall: (input) => request("/catalog/install", { method: "POST", body: input }),
		  catalogUninstall: (kind, key) => request("/catalog/uninstall", { method: "POST", body: { kind, key } }),
		  catalogInstalled: () => request("/catalog/installed"),
		  catalogSubmitCandidates: (kind) => request("/catalog/submit/candidates", {
		    query: { kind }
		  }),
		  catalogSubmit: (input) => request("/catalog/submit", { method: "POST", body: input }),
		  expertSetDefault: (id) => request("/experts/set-default", { method: "POST", body: { id } }),
		  // ---------------------------------------------------------------- 插件（profile）
		  /** 本地插件页：当前 profile 的 bundle 与插件行。 */
		  plugins: () => request("/plugins"),
		  /** 启停单个插件行（写 profile 的 cordis.patch.yml）。 */
		  pluginSetEnabled: (id, enabled) => request("/plugins/set-enabled", {
		    method: "POST",
		    body: { id, enabled }
		  }),
		  /** 选中/取消一个 bundle 层（保留已安装依赖）。 */
		  pluginBundleSetEnabled: (name, enabled) => request("/plugins/set-bundle-enabled", {
		    method: "POST",
		    body: { name, enabled }
		  }),
		  /** 卸载一个 bundle（同时移除依赖）。 */
		  pluginRemove: (name) => request("/plugins/remove", { method: "POST", body: { name } }),
		  connectors: () => request("/connectors"),
		  connectorCreate: (input) => request("/connectors/create", { method: "POST", body: input }),
		  connectorUpdate: (input) => request("/connectors/update", { method: "POST", body: input }),
		  connectorDelete: (id) => request("/connectors/delete", { method: "POST", body: { id } }),
		  connectorSetEnabled: (id, enabled) => request("/connectors/set-enabled", {
		    method: "POST",
		    body: { id, enabled }
		  }),
		  connectorReconnect: (id) => request("/connectors/reconnect", { method: "POST", body: { id } }),
		  connectorTest: (input) => request("/connectors/test", { method: "POST", body: input })
		};

		// src/client/components.tsx
		var import_react = require("react");

		// src/client/icons.tsx
		var import_jsx_runtime = require("react/jsx-runtime");
		function Shell({ size = 16, children, ...rest }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		    "svg",
		    {
		      width: size,
		      height: size,
		      viewBox: "0 0 16 16",
		      fill: "none",
		      stroke: "currentColor",
		      strokeWidth: "1.4",
		      strokeLinecap: "round",
		      strokeLinejoin: "round",
		      "aria-hidden": "true",
		      ...rest,
		      children
		    }
		  );
		}
		function IconSearch(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { ...props, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7.2", cy: "7.2", r: "4.4" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10.5 10.5 13.6 13.6" })
		  ] });
		}
		function IconPlus(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 3.4v9.2M3.4 8h9.2" }) });
		}
		function IconMore(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { strokeWidth: "0", ...props, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "3.6", cy: "8", r: "1.15", fill: "currentColor" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "1.15", fill: "currentColor" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12.4", cy: "8", r: "1.15", fill: "currentColor" })
		  ] });
		}
		function IconRefresh(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { ...props, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13 8a5 5 0 1 1-1.6-3.7" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13.2 2.6v3.2h-3.2" })
		  ] });
		}
		function IconExpert(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { ...props, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "6.8", cy: "5.6", r: "2.6" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.6 13.2c0-2.3 1.9-3.6 4.2-3.6 1.3 0 2.4.4 3.2 1.1" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10.9 10.4 12 11.5l2.2-2.2" })
		  ] });
		}
		function IconSkill(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { ...props, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 2.4 9.5 6 13.2 7.5 9.5 9 8 12.6 6.5 9 2.8 7.5 6.5 6z" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12.6 11.6l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z" })
		  ] });
		}
		function IconConnector(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { ...props, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.2 2.4v3.1M9.8 2.4v3.1" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.4 5.5h7.2v2a3.6 3.6 0 0 1-3.6 3.6A3.6 3.6 0 0 1 4.4 7.5z" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 11.1v2.5" })
		  ] });
		}
		function IconPlugin(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3.4 3h2.9a1.7 1.7 0 0 0 3.4 0h2.9a.8.8 0 0 1 .8.8v2.5a1.7 1.7 0 0 1 0 3.4v2.5a.8.8 0 0 1-.8.8H3.4a.8.8 0 0 1-.8-.8V3.8a.8.8 0 0 1 .8-.8z" }) });
		}
		function IconSparkle(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, { ...props, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 2.6l1.3 2.9 2.9 1.3-2.9 1.3L8 11l-1.3-2.9L3.8 6.8l2.9-1.3z" }),
		    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3.2 12.2h3.1M10.6 12.2h2.2" })
		  ] });
		}
		function IconClose(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 4l8 8M12 4l-8 8" }) });
		}
		function IconDownload(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 2.6v7.2M4.9 7l3.1 3 3.1-3M3.2 12.8h9.6" }) });
		}
		function IconFavorite(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { strokeWidth: "0", ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
		    "path",
		    {
		      d: "M8 2.3l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11l-3.4 1.8.7-3.8L2.5 6.3l3.8-.5z",
		      fill: "currentColor"
		    }
		  ) });
		}
		function IconFolder(props) {
		  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.4 4.4h3.4l1.2 1.6h6.6v5.6a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1z" }) });
		}

		// src/client/components.tsx
		var import_jsx_runtime2 = require("react/jsx-runtime");
		function PillTabs({
		  items,
		  value,
		  onChange
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "adk-tabs", role: "tablist", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
		    "button",
		    {
		      type: "button",
		      role: "tab",
		      className: "adk-tab",
		      "data-active": value === item.key ? "true" : "false",
		      "aria-selected": value === item.key,
		      onClick: () => onChange(item.key),
		      children: [
		        item.icon,
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: item.label }),
		        item.badge === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { opacity: 0.7 }, children: item.badge })
		      ]
		    },
		    item.key
		  )) });
		}
		function SearchPill({
		  value,
		  onChange,
		  placeholder
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "adk-search", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconSearch, { size: 15 }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { value, placeholder, onChange: (event) => onChange(event.target.value) })
		  ] });
		}
		function ActionButton({
		  children,
		  onClick,
		  primary,
		  danger,
		  disabled,
		  title
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		    "button",
		    {
		      type: "button",
		      className: "adk-action",
		      "data-primary": primary === true ? "true" : "false",
		      "data-danger": danger === true ? "true" : "false",
		      disabled: disabled === true,
		      title,
		      onClick,
		      children
		    }
		  );
		}
		function CardMenu({ items, label }) {
		  const [open, setOpen] = (0, import_react.useState)(false);
		  const ref = (0, import_react.useRef)(null);
		  (0, import_react.useEffect)(() => {
		    if (!open) return void 0;
		    const onDocumentClick = (event) => {
		      if (ref.current !== null && !ref.current.contains(event.target)) setOpen(false);
		    };
		    document.addEventListener("mousedown", onDocumentClick);
		    return () => document.removeEventListener("mousedown", onDocumentClick);
		  }, [open]);
		  if (items.length === 0) return null;
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "adk-menu-wrap", ref, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      "button",
		      {
		        type: "button",
		        className: "adk-menu-trigger",
		        title: label,
		        "aria-label": label,
		        "aria-expanded": open,
		        onClick: () => setOpen((value) => !value),
		        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconMore, { size: 16 })
		      }
		    ),
		    open ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "adk-menu", role: "menu", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		      "button",
		      {
		        type: "button",
		        role: "menuitem",
		        "data-danger": item.danger === true ? "true" : "false",
		        disabled: item.disabled === true,
		        onClick: () => {
		          setOpen(false);
		          item.onSelect();
		        },
		        children: item.label
		      },
		      item.label
		    )) }) : null
		  ] });
		}
		function Chips({
		  items,
		  value,
		  onChange
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "adk-chips", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		    "button",
		    {
		      type: "button",
		      className: "adk-chip",
		      "data-active": value === item.key ? "true" : "false",
		      onClick: () => onChange(item.key),
		      children: item.label
		    },
		    item.key
		  )) });
		}
		function Subtabs({
		  items,
		  value,
		  onChange
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "adk-subtabs", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		    "button",
		    {
		      type: "button",
		      className: "adk-subtab",
		      "data-active": value === item.key ? "true" : "false",
		      onClick: () => onChange(item.key),
		      children: item.label
		    },
		    item.key
		  )) });
		}
		function SortSegments({
		  items,
		  value,
		  onChange
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "adk-sort", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		    "button",
		    {
		      type: "button",
		      "data-active": value === item.key ? "true" : "false",
		      onClick: () => onChange(item.key),
		      children: item.label
		    },
		    item.key
		  )) });
		}
		function Tile({ children, tone }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "adk-tile", "data-tone": tone === void 0 ? void 0 : String(tone % 6), children });
		}
		function Tag({ children, tone }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "adk-tag", "data-tone": tone, children });
		}
		function SectionHead({
		  title,
		  count,
		  children
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "adk-section-head", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "adk-section-title", children: title }),
		    count === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "adk-section-count", children: String(count) }),
		    children === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "adk-section-right", children })
		  ] });
		}
		function Banner({ children, tone }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "adk-banner", "data-tone": tone === "error" ? "error" : "info", children });
		}
		function useNotice() {
		  const [notice, setNotice] = (0, import_react.useState)();
		  const timer = (0, import_react.useRef)(null);
		  const show = (message) => {
		    setNotice(message);
		    if (timer.current !== null) clearTimeout(timer.current);
		    timer.current = setTimeout(() => setNotice(void 0), 3e3);
		  };
		  (0, import_react.useEffect)(
		    () => () => {
		      if (timer.current !== null) clearTimeout(timer.current);
		    },
		    []
		  );
		  return [notice, show];
		}
		function Empty({ t }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "adk-empty", children: t("panel.empty") });
		}
		function Loading({ t }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "adk-loading", role: "status", "aria-label": t("panel.loading"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { className: "adk-spin", width: "22", height: "22", viewBox: "0 0 22 22", "aria-hidden": "true", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "11", cy: "11", r: "8.5", fill: "none", stroke: "currentColor", strokeOpacity: "0.2", strokeWidth: "2.4" }),
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M11 2.5a8.5 8.5 0 0 1 8.5 8.5", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round" })
		  ] }) });
		}
		function Field({ label, hint, children }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "adk-field", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: label }),
		    children,
		    hint === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "adk-hint", children: hint })
		  ] });
		}
		function Checkbox({
		  label,
		  checked,
		  onChange
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "adk-check", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked, onChange: (event) => onChange(event.target.checked) }),
		    label
		  ] });
		}
		function Modal({
		  title,
		  subtitle,
		  onClose,
		  children,
		  footer,
		  t
		}) {
		  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
		    "div",
		    {
		      className: "adk-overlay",
		      role: "presentation",
		      onClick: (event) => {
		        if (event.target === event.currentTarget) onClose();
		      },
		      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "adk-modal", role: "dialog", "aria-label": title, children: [
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "flex-start" }, children: [
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "adk-modal-title", style: { flex: 1 }, children: [
		            title,
		            subtitle === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "adk-modal-subtitle", children: subtitle })
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "adk-menu-trigger", "aria-label": t("action.close"), onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconClose, { size: 15 }) })
		        ] }),
		        children,
		        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "adk-modal-actions", children: [
		          footer,
		          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "adk-action", onClick: onClose, children: t("action.close") })
		        ] })
		      ] })
		    }
		  );
		}
		function linesToRecord(text) {
		  const out = {};
		  for (const rawLine of text.split("\n")) {
		    const line = rawLine.trim();
		    if (line === "" || line.startsWith("#")) continue;
		    const index = line.indexOf("=");
		    if (index <= 0) continue;
		    out[line.slice(0, index).trim()] = line.slice(index + 1).trim();
		  }
		  return out;
		}
		function recordToLines(record) {
		  return Object.entries(record).map(([key, value]) => `${key}=${value}`).join("\n");
		}
		function splitList(text) {
		  return text.split(/[,，\n]/).map((item) => item.trim()).filter((item) => item !== "");
		}
		function toneOf(seed) {
		  let hash = 0;
		  for (let index = 0; index < seed.length; index += 1) {
		    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
		  }
		  return hash % 6;
		}

		// src/client/connectors.tsx
		var import_react3 = require("react");

		// src/client/plaza.tsx
		var import_react2 = require("react");
		var import_jsx_runtime3 = require("react/jsx-runtime");
		function SubmitModal({
		  kind,
		  t,
		  onClose,
		  onSubmitted
		}) {
		  const [candidates, setCandidates] = (0, import_react2.useState)();
		  const [picked, setPicked] = (0, import_react2.useState)();
		  const [name, setName] = (0, import_react2.useState)("");
		  const [description, setDescription] = (0, import_react2.useState)("");
		  const [tags, setTags] = (0, import_react2.useState)("");
		  const [busy, setBusy] = (0, import_react2.useState)(false);
		  const [error, setError] = (0, import_react2.useState)();
		  const [done, setDone] = (0, import_react2.useState)();
		  (0, import_react2.useEffect)(() => {
		    let alive = true;
		    (async () => {
		      try {
		        const response = await api.catalogSubmitCandidates(kind);
		        if (!alive) return;
		        setCandidates(response.candidates);
		      } catch (failure) {
		        if (!alive) return;
		        setError(failure instanceof ApiError ? failure.message : String(failure));
		      }
		    })();
		    return () => {
		      alive = false;
		    };
		  }, [kind]);
		  const pickedCandidate = candidates?.find((entry) => entry.id === picked);
		  const doSubmit = async () => {
		    if (picked === void 0) return;
		    setBusy(true);
		    setError(void 0);
		    try {
		      const result = await api.catalogSubmit({
		        kind,
		        id: picked,
		        ...name.trim() === "" ? {} : { name: name.trim() },
		        ...description.trim() === "" ? {} : { description: description.trim() },
		        ...tags.trim() === "" ? {} : { tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter((tag) => tag !== "") }
		      });
		      setDone(result);
		      onSubmitted();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
		    Modal,
		    {
		      title: `${t("plaza.submit.title")} \xB7 ${t(`plaza.submit.${kind}`)}`,
		      onClose,
		      t,
		      footer: done === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ActionButton, { primary: true, disabled: busy || picked === void 0, onClick: () => void doSubmit(), children: t("plaza.submit.go") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ActionButton, { primary: true, onClick: onClose, children: t("action.close") }),
		      children: [
		        error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Banner, { tone: "error", children: error }),
		        done === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Banner, { tone: "info", children: `${t("plaza.submit.done")}: ${String(done.item["name"] ?? done.item["id"] ?? "")}` }),
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.submit.hintTitle"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { style: { margin: 0, paddingLeft: 18 }, children: done.hints.map((hint) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("li", { children: hint }, hint)) }) })
		        ] }),
		        done !== void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.submit.pick"), hint: t(`plaza.submit.pickHint.${kind}`), children: candidates === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-pre", children: t("panel.loading") }) : candidates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-pre", children: t(`plaza.submit.empty.${kind}`) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
		            "select",
		            {
		              className: "adk-select",
		              value: picked ?? "",
		              onChange: (event) => {
		                setPicked(event.target.value === "" ? void 0 : event.target.value);
		                const candidate = candidates.find((entry) => entry.id === event.target.value);
		                setName(candidate?.name ?? "");
		                setDescription(candidate?.description ?? "");
		              },
		              children: [
		                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: "", children: t("plaza.submit.pick") }),
		                candidates.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("option", { value: entry.id, children: [
		                  entry.name,
		                  entry.extra === void 0 ? "" : ` \xB7 ${entry.extra}`
		                ] }, entry.id))
		              ]
		            }
		          ) }),
		          pickedCandidate === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.submit.name"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { className: "adk-input", value: name, onChange: (event) => setName(event.target.value) }) }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.submit.description"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		              "textarea",
		              {
		                className: "adk-textarea",
		                rows: 2,
		                value: description,
		                onChange: (event) => setDescription(event.target.value)
		              }
		            ) }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.submit.tags"), hint: t("plaza.submit.tagsHint"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { className: "adk-input", value: tags, onChange: (event) => setTags(event.target.value) }) })
		          ] })
		        ] })
		      ]
		    }
		  );
		}
		function SubmitMenu({
		  kind,
		  t,
		  onPick
		}) {
		  const [open, setOpen] = (0, import_react2.useState)(false);
		  const ref = (0, import_react2.useRef)(null);
		  (0, import_react2.useEffect)(() => {
		    if (!open) return void 0;
		    const onDocumentClick = (event) => {
		      if (ref.current !== null && !ref.current.contains(event.target)) setOpen(false);
		    };
		    document.addEventListener("mousedown", onDocumentClick);
		    return () => document.removeEventListener("mousedown", onDocumentClick);
		  }, [open]);
		  const order = [kind, ...KINDS.filter((entry) => entry !== kind)];
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "adk-menu-wrap", ref, children: [
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
		      "button",
		      {
		        type: "button",
		        className: "adk-action",
		        "data-primary": "true",
		        "aria-expanded": open,
		        onClick: () => setOpen((value) => !value),
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconPlus, { size: 14 }),
		          t("plaza.submit.menu"),
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "adk-caret", "aria-hidden": "true", children: "\u25BE" })
		        ]
		      }
		    ),
		    open ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-menu adk-menu-compact", role: "menu", children: order.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
		      "button",
		      {
		        type: "button",
		        role: "menuitem",
		        onClick: () => {
		          setOpen(false);
		          onPick(entry);
		        },
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "adk-menu-icon", "aria-hidden": "true", children: entry === "skill" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconSkill, { size: 14 }) : entry === "expert" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconExpert, { size: 14 }) : entry === "plugin" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconPlugin, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconConnector, { size: 14 }) }),
		          t(`plaza.submit.button.${entry}`)
		        ]
		      },
		      entry
		    )) }) : null
		  ] });
		}
		var KINDS = ["skill", "expert", "connector", "plugin"];
		function formatCount(value) {
		  if (value >= 1e8) return `${(value / 1e8).toFixed(1).replace(/\.0$/, "")}\u4EBF`;
		  if (value >= 1e4) return `${(value / 1e4).toFixed(1).replace(/\.0$/, "")}\u4E07`;
		  return String(value);
		}
		function PlazaView({ kind, t, query, onChanged }) {
		  const [data, setData] = (0, import_react2.useState)();
		  const [loading, setLoading] = (0, import_react2.useState)(true);
		  const [error, setError] = (0, import_react2.useState)();
		  const [notice, setNotice] = useNotice();
		  const [category, setCategory] = (0, import_react2.useState)("all");
		  const [sort, setSort] = (0, import_react2.useState)("default");
		  const [categoryOptions, setCategoryOptions] = (0, import_react2.useState)([]);
		  const [busy, setBusy] = (0, import_react2.useState)(false);
		  const [detail, setDetail] = (0, import_react2.useState)();
		  const [installing, setInstalling] = (0, import_react2.useState)();
		  const [enableAfter, setEnableAfter] = (0, import_react2.useState)(false);
		  const [envValues, setEnvValues] = (0, import_react2.useState)({});
		  const [page, setPage] = (0, import_react2.useState)(0);
		  const [cursor, setCursor] = (0, import_react2.useState)();
		  const load = (0, import_react2.useCallback)(async () => {
		    setLoading(true);
		    setError(void 0);
		    try {
		      setData(
		        await api.catalog({
		          kind,
		          ...category === "all" ? {} : { category },
		          ...query.trim() === "" ? {} : { q: query.trim() },
		          sort,
		          ...cursor === void 0 ? {} : { cursor }
		        })
		      );
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setLoading(false);
		    }
		  }, [kind, query, category, sort, cursor]);
		  (0, import_react2.useEffect)(() => {
		    void load();
		  }, [load]);
		  const items = data?.items ?? [];
		  (0, import_react2.useEffect)(() => {
		    let alive = true;
		    (async () => {
		      try {
		        const response = await api.catalogCategories(kind);
		        if (alive) setCategoryOptions(response.categories);
		      } catch {
		        if (alive) setCategoryOptions([]);
		      }
		    })();
		    return () => {
		      alive = false;
		    };
		  }, [kind]);
		  const categories = categoryOptions;
		  const doInstall = async () => {
		    if (installing === void 0) return;
		    setBusy(true);
		    setError(void 0);
		    try {
		      const result = await api.catalogInstall({
		        source: installing.sourceId,
		        id: installing.id,
		        ...installing.kind === "skill" ? { enable: enableAfter } : {},
		        ...Object.keys(envValues).length === 0 ? {} : { env: envValues }
		      });
		      const extra = result.warnings.length === 0 ? "" : `\uFF08${result.warnings.join("\uFF1B")}\uFF09`;
		      setNotice(`${t("plaza.installed")}: ${installing.name}${extra}`);
		      setInstalling(void 0);
		      setDetail(void 0);
		      setEnvValues({});
		      onChanged();
		      await load();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const doUninstall = async (item) => {
		    const key = item.installed?.key;
		    if (key === void 0) return;
		    if (!window.confirm(`${t("plaza.uninstall")}: ${item.name}?`)) return;
		    setBusy(true);
		    setError(void 0);
		    try {
		      await api.catalogUninstall(item.kind, key);
		      setNotice(`${t("plaza.uninstalled")}: ${item.name}`);
		      onChanged();
		      await load();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const openDetail = async (item) => {
		    setBusy(true);
		    setError(void 0);
		    try {
		      const response = await api.catalogItem(item.sourceId, item.id);
		      setDetail(response);
		      setInstalling(item);
		      setEnableAfter(false);
		      setEnvValues(
		        Object.fromEntries(
		          (item.install.kind === "connector" ? item.install.envRequired ?? [] : []).map((name) => [name, ""])
		        )
		      );
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const pluginInstall = installing?.install.kind === "plugin" ? installing.install : void 0;
		  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
		    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Banner, { tone: "error", children: [
		      error,
		      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "adk-action", style: { marginLeft: 8 }, onClick: () => void load(), children: t("panel.retry") })
		    ] }),
		    notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Banner, { children: notice }),
		    (data?.sources ?? []).filter((entry) => entry.ok === false).length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Banner, { children: (data?.sources ?? []).filter((entry) => entry.ok === false).map((entry) => `${entry.label}: ${entry.lastError ?? ""}`).join("\n") }),
		    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(SectionHead, { title: t("plaza.title"), count: data?.total ?? items.length, children: [
		      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		        SortSegments,
		        {
		          items: [
		            { key: "default", label: t("plaza.sort.default") },
		            { key: "hot", label: t("plaza.sort.hot") },
		            { key: "new", label: t("plaza.sort.new") }
		          ],
		          value: sort,
		          onChange: (next) => {
		            setCursor(void 0);
		            setPage(0);
		            setSort(next);
		          }
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(ActionButton, { onClick: () => void load(), children: [
		        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconRefresh, { size: 14 }),
		        t("panel.refresh")
		      ] })
		    ] }),
		    categories.length === 0 && kind !== "connector" ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		      Chips,
		      {
		        items: kind === "connector" ? [{ key: "all", label: t("skills.filter.all") }] : [{ key: "all", label: t("skills.filter.all") }, ...categories.map((key) => ({ key, label: key }))],
		        value: category,
		        onChange: (next) => {
		          setCursor(void 0);
		          setPage(0);
		          setCategory(next);
		        }
		      }
		    ),
		    loading ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Loading, { t }) : items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Empty, { t }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-grid", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "adk-card", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "adk-card-head", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
		          "button",
		          {
		            type: "button",
		            className: "adk-card-hit",
		            title: item.name,
		            onClick: () => void openDetail(item),
		            children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tile, { tone: toneOf(item.id), children: item.name.slice(0, 1).toUpperCase() }),
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "adk-card-hitblock", children: [
		                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "adk-card-title-line", children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "adk-card-title-text", children: item.name }),
		                  item.trust?.official === true ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tag, { tone: "accent", children: t("plaza.official") }) : null
		                ] }),
		                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "adk-card-meta", children: [
		                  item.stats?.downloads === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { title: t("plaza.stats.downloads"), children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconDownload, { size: 11 }),
		                    " ",
		                    formatCount(item.stats.downloads)
		                  ] }),
		                  item.stats?.favorites === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { title: t("plaza.stats.favorites"), children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconFavorite, { size: 11 }),
		                    " ",
		                    formatCount(item.stats.favorites)
		                  ] })
		                ] })
		              ] })
		            ]
		          }
		        ),
		        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		          CardMenu,
		          {
		            label: t("action.more"),
		            items: [
		              { label: t("plaza.detail"), onSelect: () => void openDetail(item) },
		              ...item.installed === void 0 ? [] : [{ label: t("plaza.uninstall"), onSelect: () => void doUninstall(item) }],
		              ...item.homepage === void 0 ? [] : [{ label: t("plaza.homepage"), onSelect: () => window.open(item.homepage, "_blank") }]
		            ]
		          }
		        )
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-card-desc", "data-lines": "3", children: item.description === "" ? item.id : item.description }),
		      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "adk-tags", children: [
		        item.category === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tag, { children: item.category }),
		        item.install.kind === "unsupported" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tag, { tone: "error", children: t("plaza.unsupported") }) : null,
		        item.installed === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tag, { tone: "ok", children: t("plaza.installedBadge") }),
		        item.tags.slice(0, 2).map((tag) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tag, { children: tag }, tag))
		      ] })
		    ] }, `${item.sourceId}:${item.id}`)) }),
		    data?.nextCursor === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-inline", style: { justifyContent: "center", marginTop: 14 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		      ActionButton,
		      {
		        onClick: () => {
		          setCursor(data.nextCursor);
		          setPage((value) => value + 1);
		        },
		        children: `${t("plaza.more")} (#${String(page + 2)})`
		      }
		    ) }),
		    detail === void 0 || installing === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
		      Modal,
		      {
		        title: `${t("plaza.confirmTitle")} \xB7 ${installing.name}`,
		        subtitle: t(`plaza.risk.${installing.kind}`),
		        onClose: () => {
		          setDetail(void 0);
		          setInstalling(void 0);
		        },
		        t,
		        footer: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ActionButton, { primary: true, disabled: busy, onClick: () => void doInstall(), children: installing.installed === void 0 ? t("plaza.install") : t("plaza.reinstall") }),
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "adk-detail-meta", children: [
		            installing.author === void 0 || installing.author === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { title: t("plaza.author"), children: [
		              t("plaza.author"),
		              ": ",
		              installing.author
		            ] }),
		            installing.version === void 0 || installing.version === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { title: t("plaza.version"), children: [
		              t("plaza.version"),
		              ": ",
		              installing.version
		            ] }),
		            installing.stats?.stars === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { title: t("plaza.stats.stars"), children: [
		              "\u2605 ",
		              formatCount(installing.stats.stars)
		            ] }),
		            installing.stats?.downloads === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { title: t("plaza.stats.downloads"), children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconDownload, { size: 11 }),
		              " ",
		              formatCount(installing.stats.downloads)
		            ] }),
		            installing.stats?.favorites === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { title: t("plaza.stats.favorites"), children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconFavorite, { size: 11 }),
		              " ",
		              formatCount(installing.stats.favorites)
		            ] })
		          ] }),
		          installing.description === "" ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.description"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-detail-desc", children: installing.description }) }),
		          installing.kind === "skill" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.files"), hint: `${String(detail.files?.length ?? 0)} ${t("plaza.fileCount")}`, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-pre", style: { maxHeight: 120 }, children: (detail.files ?? []).map((file) => file.path).join("\n") }) }),
		            detail.preview === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: "SKILL.md", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-pre", style: { maxHeight: 180 }, children: detail.preview }) }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: "adk-check", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		                "input",
		                {
		                  type: "checkbox",
		                  checked: enableAfter,
		                  onChange: (event) => setEnableAfter(event.target.checked)
		                }
		              ),
		              t("plaza.enableAfter")
		            ] })
		          ] }) : null,
		          installing.kind === "expert" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
		            (installing.install.kind === "expert" ? installing.install.pluginRows ?? [] : []).length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.pluginRows"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-pre", style: { maxHeight: 120 }, children: (installing.install.kind === "expert" ? installing.install.pluginRows ?? [] : []).join("\n") }) }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.composition"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-pre", style: { maxHeight: 220 }, children: detail.compositionPreview ?? "" }) })
		          ] }) : null,
		          installing.kind === "connector" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("connectors.transport"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-mono", children: installing.install.kind === "connector" ? installing.install.transport : "" }) }),
		            installing.install.kind === "connector" && installing.install.url !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: "URL", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-mono", children: installing.install.url }) }) : null,
		            installing.install.kind === "connector" && installing.install.command !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("connectors.command"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-mono", children: installing.install.command }) }) : null,
		            (installing.install.kind === "connector" ? installing.install.envRequired ?? [] : []).map((name) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: name, hint: t("plaza.secretHint"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		              "input",
		              {
		                className: "adk-input",
		                value: envValues[name] ?? "",
		                onChange: (event) => setEnvValues({ ...envValues, [name]: event.target.value })
		              }
		            ) }, name))
		          ] }) : null,
		          installing.kind === "plugin" ? pluginInstall === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Banner, { tone: "error", children: `${t("plaza.unsupported")}: ${installing.install.kind === "unsupported" ? installing.install.reason : ""}` }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.pluginPackage"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-mono", children: pluginInstall.package }) }),
		            (pluginInstall.version ?? installing.version) === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.version"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-mono", children: pluginInstall.version ?? installing.version }) }),
		            pluginInstall.command === void 0 || pluginInstall.command === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
		              Field,
		              {
		                label: t("plaza.pluginCommand"),
		                hint: pluginInstall.profile === void 0 || pluginInstall.profile === "" ? void 0 : `${t("plaza.pluginProfile")}: ${pluginInstall.profile}`,
		                children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-pre", style: { maxHeight: 120 }, children: pluginInstall.command })
		              }
		            ),
		            pluginInstall.managed === true ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Banner, { children: t("plaza.pluginManaged") }) : null,
		            pluginInstall.upstreamCommand === void 0 || pluginInstall.upstreamCommand === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.pluginUpstreamCommand"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-mono", children: pluginInstall.upstreamCommand }) }),
		            (pluginInstall.capabilities ?? []).length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.pluginCapabilities"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-tags", children: (pluginInstall.capabilities ?? []).map((capability) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tag, { children: capability }, capability)) }) }),
		            (pluginInstall.redLines ?? []).length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: t("plaza.pluginRedLines"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "adk-tags", children: (pluginInstall.redLines ?? []).map((redLine) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tag, { tone: "error", children: redLine }, redLine)) }) }),
		            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Banner, { tone: "info", children: t("plaza.pluginEffect") })
		          ] }) : null
		        ]
		      }
		    )
		  ] });
		}

		// src/client/connectors.tsx
		var import_jsx_runtime4 = require("react/jsx-runtime");
		function emptyForm() {
		  return {
		    mode: "create",
		    id: "",
		    label: "",
		    description: "",
		    transport: "stdio",
		    serverName: "",
		    command: "",
		    args: "",
		    env: "",
		    cwd: "",
		    url: "",
		    headers: "",
		    toolCallTimeoutMs: 6e4,
		    failOnStartupError: false,
		    enabled: true
		  };
		}
		function ConnectorsTab({ t, query }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PlazaView, { kind: "connector", t, query, onChanged: () => void 0 });
		}
		function MyConnectorsPage({
		  t,
		  query,
		  addOpen,
		  onCloseAdd
		}) {
		  const [data, setData] = (0, import_react3.useState)();
		  const [loading, setLoading] = (0, import_react3.useState)(true);
		  const [error, setError] = (0, import_react3.useState)();
		  const [busy, setBusy] = (0, import_react3.useState)(false);
		  const [form, setForm] = (0, import_react3.useState)();
		  const [notice, setNotice] = useNotice();
		  const load = (0, import_react3.useCallback)(async () => {
		    setLoading(true);
		    setError(void 0);
		    try {
		      setData(await api.connectors());
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setLoading(false);
		    }
		  }, []);
		  (0, import_react3.useEffect)(() => {
		    void load();
		  }, [load]);
		  const lastAddSignal = (0, import_react3.useRef)(false);
		  (0, import_react3.useEffect)(() => {
		    if (addOpen && !lastAddSignal.current) {
		      lastAddSignal.current = true;
		      setForm(emptyForm());
		    }
		    if (!addOpen) lastAddSignal.current = false;
		  }, [addOpen]);
		  const needle = query.trim().toLowerCase();
		  const rows = (0, import_react3.useMemo)(() => {
		    const list = data?.connectors ?? [];
		    if (needle === "") return list;
		    return list.filter(
		      (row) => [row.label, row.serverName, row.description].some((field) => field.toLowerCase().includes(needle))
		    );
		  }, [data, needle]);
		  const run = async (action, message) => {
		    setBusy(true);
		    setError(void 0);
		    if (message !== void 0) setNotice(message);
		    try {
		      await action();
		      await load();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const submit = async () => {
		    if (form === void 0) return;
		    const payload = {
		      label: form.label,
		      description: form.description,
		      transport: form.transport,
		      serverName: form.serverName,
		      command: form.command,
		      args: form.args.split("\n").map((line) => line.trim()).filter((line) => line !== ""),
		      env: linesToRecord(form.env),
		      cwd: form.cwd,
		      url: form.url,
		      headers: linesToRecord(form.headers),
		      toolCallTimeoutMs: Number(form.toolCallTimeoutMs),
		      failOnStartupError: form.failOnStartupError,
		      enabled: form.enabled
		    };
		    setBusy(true);
		    setError(void 0);
		    try {
		      if (form.mode === "create") await api.connectorCreate(payload);
		      else await api.connectorUpdate({ ...payload, id: form.id });
		      setForm(void 0);
		      onCloseAdd();
		      await load();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const openEdit = (row) => {
		    setForm({
		      mode: "edit",
		      id: row.id,
		      label: row.label,
		      description: row.description,
		      transport: row.transport,
		      serverName: row.serverName,
		      command: row.command,
		      args: row.args.join("\n"),
		      env: recordToLines(row.env),
		      cwd: row.cwd,
		      url: row.url,
		      headers: recordToLines(row.headers),
		      toolCallTimeoutMs: row.toolCallTimeoutMs,
		      failOnStartupError: row.failOnStartupError,
		      enabled: row.enabled
		    });
		  };
		  const test = async (row) => {
		    await run(async () => {
		      const result = await api.connectorTest({ id: row.id });
		      setNotice(
		        `${row.label}: ${result.ok ? t("connectors.testOk") : t("connectors.testFail")}` + (result.tools.length === 0 ? "" : ` \u2014 ${result.tools.join(", ")}`)
		      );
		    });
		  };
		  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
		    data?.available === false ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Banner, { children: t("connectors.unavailable") }) : null,
		    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Banner, { tone: "error", children: error }),
		    notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Banner, { children: notice }),
		    loading ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Loading, { t }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "adk-section", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SectionHead, { title: t("connectors.title"), count: rows.length }),
		        rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Empty, { t }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "adk-grid", children: rows.map((row) => {
		          const state = row.status.state;
		          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		            "div",
		            {
		              className: "adk-card",
		              "data-broken": state === "error" ? "true" : "false",
		              children: [
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "adk-card-head", children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tile, { tone: toneOf(row.serverName), children: row.label.slice(0, 1).toUpperCase() }),
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "adk-card-titleblock", children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "adk-card-title", title: row.label, children: [
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "adk-dot", "data-state": state }),
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "adk-card-title-text", children: row.label }),
		                      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		                        CardMenu,
		                        {
		                          label: t("action.more"),
		                          items: [
		                            {
		                              label: row.enabled ? t("action.disable") : t("action.enable"),
		                              onSelect: () => void run(() => api.connectorSetEnabled(row.id, !row.enabled)),
		                              disabled: busy || data?.available === false
		                            },
		                            { label: t("action.test"), onSelect: () => void test(row), disabled: busy },
		                            { label: t("action.reconnect"), onSelect: () => void run(() => api.connectorReconnect(row.id)), disabled: busy },
		                            { label: t("action.edit"), onSelect: () => openEdit(row) },
		                            {
		                              label: t("action.delete"),
		                              danger: true,
		                              onSelect: () => {
		                                if (window.confirm(`${t("action.delete")}: ${row.label}?`)) {
		                                  void run(() => api.connectorDelete(row.id));
		                                }
		                              }
		                            }
		                          ]
		                        }
		                      )
		                    ] }),
		                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "adk-card-meta", children: `${row.transport} \xB7 mcp__${row.serverName}__*` })
		                  ] })
		                ] }),
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "adk-card-desc", children: row.description === "" ? `${t("connectors.serverName")}: ${row.serverName}` : row.description }),
		                row.status.lastError === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "adk-card-desc", "data-lines": "2", style: { color: "var(--adk-danger)" }, children: row.status.lastError }),
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "adk-tags", children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tag, { tone: state === "connected" ? "ok" : state === "error" ? "error" : void 0, children: t(`connectors.state.${state}`) }),
		                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tag, { children: `${t("connectors.tools")} ${String(row.status.toolCount)}` }),
		                  row.status.tools.slice(0, 1).map((tool) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tag, { children: tool }, tool))
		                ] })
		              ]
		            },
		            row.id
		          );
		        }) })
		      ] }),
		      (data?.profileConfigured ?? []).length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "adk-section", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SectionHead, { title: t("connectors.profile"), count: (data?.profileConfigured ?? []).length }),
		        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "adk-grid", children: (data?.profileConfigured ?? []).map((row) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "adk-card", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "adk-card-head", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tile, { tone: toneOf(row.serverName), children: row.serverName.slice(0, 1).toUpperCase() }),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "adk-card-titleblock", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "adk-card-title", children: row.serverName }),
		              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "adk-card-meta", children: `${row.transport} \xB7 ${row.entryId}` })
		            ] }),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tag, { tone: row.enabled ? "ok" : void 0, children: row.enabled ? t("action.enable") : t("action.disable") })
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "adk-card-desc", children: `${t("connectors.profile")}: ${row.source}` })
		        ] }, `${row.source}:${row.entryId}`)) })
		      ] })
		    ] }),
		    form === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		      Modal,
		      {
		        title: form.mode === "create" ? t("connectors.createTitle") : t("action.edit"),
		        onClose: () => {
		          setForm(void 0);
		          onCloseAdd();
		        },
		        t,
		        footer: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ActionButton, { primary: true, disabled: busy, onClick: () => void submit(), children: [
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconPlus, { size: 14 }),
		          t("action.save")
		        ] }),
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("connectors.transport"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
		            "select",
		            {
		              className: "adk-select",
		              value: form.transport,
		              onChange: (event) => setForm({ ...form, transport: event.target.value }),
		              children: [
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "stdio", children: t("connectors.transport.stdio") }),
		                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "streamable-http", children: t("connectors.transport.http") })
		              ]
		            }
		          ) }),
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("connectors.label"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "input",
		            {
		              className: "adk-input",
		              value: form.label,
		              onChange: (event) => setForm({ ...form, label: event.target.value })
		            }
		          ) }),
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("connectors.serverName"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "input",
		            {
		              className: "adk-input",
		              value: form.serverName,
		              onChange: (event) => setForm({ ...form, serverName: event.target.value })
		            }
		          ) }),
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("experts.description"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "input",
		            {
		              className: "adk-input",
		              value: form.description,
		              onChange: (event) => setForm({ ...form, description: event.target.value })
		            }
		          ) }),
		          form.transport === "stdio" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("connectors.command"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "input",
		              {
		                className: "adk-input",
		                value: form.command,
		                placeholder: "npx",
		                onChange: (event) => setForm({ ...form, command: event.target.value })
		              }
		            ) }),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("connectors.args"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "textarea",
		              {
		                className: "adk-textarea",
		                value: form.args,
		                placeholder: "-y\n@modelcontextprotocol/server-filesystem\n/tmp",
		                onChange: (event) => setForm({ ...form, args: event.target.value })
		              }
		            ) }),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("connectors.env"), hint: t("connectors.secretsHint"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "textarea",
		              {
		                className: "adk-textarea",
		                value: form.env,
		                placeholder: "GITHUB_TOKEN=\u2022\u2022\u2022\u2022\u2022\u2022",
		                onChange: (event) => setForm({ ...form, env: event.target.value })
		              }
		            ) }),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("connectors.cwd"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "input",
		              {
		                className: "adk-input",
		                value: form.cwd,
		                onChange: (event) => setForm({ ...form, cwd: event.target.value })
		              }
		            ) })
		          ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("connectors.url"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "input",
		              {
		                className: "adk-input",
		                value: form.url,
		                placeholder: "http://localhost:3000/mcp",
		                onChange: (event) => setForm({ ...form, url: event.target.value })
		              }
		            ) }),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("connectors.headers"), hint: t("connectors.secretsHint"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              "textarea",
		              {
		                className: "adk-textarea",
		                value: form.headers,
		                placeholder: "Authorization=\u2022\u2022\u2022\u2022\u2022\u2022",
		                onChange: (event) => setForm({ ...form, headers: event.target.value })
		              }
		            ) })
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: t("connectors.timeout"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		            "input",
		            {
		              className: "adk-input",
		              type: "number",
		              value: form.toolCallTimeoutMs,
		              onChange: (event) => setForm({ ...form, toolCallTimeoutMs: Number(event.target.value) || 6e4 })
		            }
		          ) }),
		          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "adk-checkrow", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              Checkbox,
		              {
		                label: t("action.enable"),
		                checked: form.enabled,
		                onChange: (next) => setForm({ ...form, enabled: next })
		              }
		            ),
		            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
		              Checkbox,
		              {
		                label: t("connectors.failOnStartup"),
		                checked: form.failOnStartupError,
		                onChange: (next) => setForm({ ...form, failOnStartupError: next })
		              }
		            )
		          ] })
		        ]
		      }
		    )
		  ] });
		}

		// src/client/experts.tsx
		var import_react4 = require("react");
		var import_jsx_runtime5 = require("react/jsx-runtime");
		var CAPABILITIES = [
		  "shell",
		  "fs",
		  "skills",
		  "todo",
		  "web",
		  "ask",
		  "subagents",
		  "compaction"
		];
		function defaultCaps() {
		  return {
		    shell: true,
		    fs: true,
		    skills: true,
		    todo: true,
		    web: true,
		    ask: true,
		    subagents: false,
		    compaction: true
		  };
		}
		function ExpertsTab({ t, query }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PlazaView, { kind: "expert", t, query, onChanged: () => void 0 });
		}
		function MyExpertsPage({
		  t,
		  query,
		  addOpen,
		  onCloseAdd
		}) {
		  const [data, setData] = (0, import_react4.useState)();
		  const [loading, setLoading] = (0, import_react4.useState)(true);
		  const [error, setError] = (0, import_react4.useState)();
		  const [busy, setBusy] = (0, import_react4.useState)(false);
		  const [form, setForm] = (0, import_react4.useState)();
		  const [detail, setDetail] = (0, import_react4.useState)();
		  const [tag, setTag] = (0, import_react4.useState)("all");
		  const [view, setView] = (0, import_react4.useState)("mine");
		  const [options, setOptions] = (0, import_react4.useState)({
		    skills: [],
		    connectors: []
		  });
		  const load = (0, import_react4.useCallback)(async () => {
		    setLoading(true);
		    setError(void 0);
		    try {
		      setData(await api.experts());
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setLoading(false);
		    }
		  }, []);
		  (0, import_react4.useEffect)(() => {
		    void load();
		  }, [load]);
		  const lastAddSignal = (0, import_react4.useRef)(false);
		  (0, import_react4.useEffect)(() => {
		    if (addOpen && !lastAddSignal.current) {
		      lastAddSignal.current = true;
		      void openCreate();
		    }
		    if (!addOpen) lastAddSignal.current = false;
		  }, [addOpen]);
		  const needle = query.trim().toLowerCase();
		  const match = (0, import_react4.useCallback)(
		    (...fields) => needle === "" || fields.some((field) => (field ?? "").toLowerCase().includes(needle)),
		    [needle]
		  );
		  const mineAll = data?.mine ?? [];
		  const officialAll = data?.official ?? [];
		  const tagItems = (0, import_react4.useMemo)(() => {
		    const found = /* @__PURE__ */ new Set();
		    for (const row of mineAll) for (const item of row.tags) found.add(item);
		    return [
		      { key: "all", label: t("skills.filter.all") },
		      ...[...found].sort((a, b) => a.localeCompare(b)).map((key) => ({ key, label: key }))
		    ];
		  }, [mineAll, t]);
		  const mine = (0, import_react4.useMemo)(
		    () => mineAll.filter(
		      (row) => match(row.name, row.description, row.tags.join(" ")) && (tag === "all" || row.tags.includes(tag))
		    ),
		    [mineAll, match, tag]
		  );
		  const official = (0, import_react4.useMemo)(
		    () => officialAll.filter((row) => match(row.id, row.name, row.description)),
		    [officialAll, match]
		  );
		  const loadOptions = async () => {
		    try {
		      const [skills, connectors] = await Promise.all([api.skills(), api.connectors()]);
		      setOptions({ skills: skills.skills, connectors: connectors.connectors });
		    } catch (failure) {
		      console.warn("[square] option load failed", failure);
		    }
		  };
		  const openCreate = async () => {
		    await loadOptions();
		    setForm({
		      mode: "create",
		      id: "",
		      name: "",
		      icon: "\u{1F916}",
		      description: "",
		      tags: "",
		      systemPrompt: "",
		      capabilities: defaultCaps(),
		      skillNames: [],
		      connectorIds: []
		    });
		  };
		  const openEdit = async (row) => {
		    await loadOptions();
		    setForm({
		      mode: "edit",
		      id: row.id,
		      name: row.name,
		      icon: row.icon,
		      description: row.description,
		      tags: row.tags.join(", "),
		      systemPrompt: row.systemPrompt,
		      capabilities: row.capabilities,
		      skillNames: row.skillNames,
		      connectorIds: row.connectorIds
		    });
		  };
		  const run = async (action) => {
		    setBusy(true);
		    setError(void 0);
		    try {
		      await action();
		      await load();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const submit = async () => {
		    if (form === void 0) return;
		    setBusy(true);
		    setError(void 0);
		    const payload = {
		      name: form.name,
		      icon: form.icon,
		      description: form.description,
		      tags: splitList(form.tags),
		      systemPrompt: form.systemPrompt,
		      capabilities: form.capabilities,
		      skillNames: form.skillNames,
		      connectorIds: form.connectorIds
		    };
		    try {
		      if (form.mode === "create") await api.expertCreate(payload);
		      else await api.expertUpdate({ ...payload, id: form.id });
		      setForm(void 0);
		      onCloseAdd();
		      await load();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const showOfficialDetail = async (id) => {
		    setBusy(true);
		    try {
		      const response = await api.expertRead(id);
		      setDetail({ title: id, body: response.official?.compositionYaml ?? "\u2014" });
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const mineCard = (row) => {
		    const broken = data?.broken[row.id];
		    const isDefault = data?.defaultId === `square-${row.id}`;
		    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-card", "data-broken": broken === void 0 ? "false" : "true", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-card-head", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Tile, { tone: toneOf(row.id), children: row.icon === "" ? "\u{1F916}" : row.icon }),
		        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-card-titleblock", children: [
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-card-title", title: row.name, children: [
		            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "adk-card-title-text", children: row.name }),
		            isDefault ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Tag, { tone: "accent", children: t("experts.default") }) : null,
		            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		              CardMenu,
		              {
		                label: t("action.more"),
		                items: [
		                  ...isDefault ? [] : [{ label: t("action.setDefault"), onSelect: () => void run(() => api.expertSetDefault(`square-${row.id}`)) }],
		                  { label: t("action.edit"), onSelect: () => void openEdit(row) },
		                  { label: t("action.duplicate"), onSelect: () => void run(() => api.expertDuplicate(row.id)) },
		                  {
		                    label: t("action.delete"),
		                    danger: true,
		                    onSelect: () => {
		                      if (window.confirm(`${t("action.delete")}: ${row.name}?`)) {
		                        void run(() => api.expertDelete(row.id));
		                      }
		                    }
		                  }
		                ]
		              }
		            )
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-card-meta", children: `${String(row.skillNames.length)} ${t("experts.skillUnit")} \xB7 ${String(row.connectorIds.length)} ${t("experts.connectorUnit")}` })
		        ] })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-card-desc", children: row.description === "" ? row.systemPrompt : row.description }),
		      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-tags", children: [
		        row.tags.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Tag, { children: item }, item)),
		        broken === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Tag, { tone: "error", children: `${t("experts.broken")}: ${broken}` })
		      ] })
		    ] }, row.id);
		  };
		  const officialCard = (row) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-card", "data-broken": row.broken === void 0 ? "false" : "true", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-card-head", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Tile, { tone: toneOf(row.id), children: (row.name ?? row.id).slice(0, 1).toUpperCase() }),
		      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-card-titleblock", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-card-title", title: row.id, children: [
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "adk-card-title-text", children: row.name ?? row.id }),
		          row.isDefault ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Tag, { tone: "accent", children: t("experts.default") }) : null,
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		            CardMenu,
		            {
		              label: t("action.more"),
		              items: [
		                ...row.isDefault ? [] : [{ label: t("action.setDefault"), onSelect: () => void run(() => api.expertSetDefault(row.id)) }],
		                { label: t("action.detail"), onSelect: () => void showOfficialDetail(row.id) },
		                { label: t("action.duplicate"), onSelect: () => void run(() => api.expertDuplicate(row.id)) }
		              ]
		            }
		          )
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-card-meta", children: row.id })
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-card-desc", children: row.description ?? t("experts.officialHint") }),
		    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-tags", children: row.broken === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Tag, { tone: "ok", children: t("experts.active") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Tag, { tone: "error", children: row.broken }) })
		  ] }, row.id);
		  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
		    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Banner, { tone: "error", children: error }),
		    loading ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Loading, { t }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-section", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		        Subtabs,
		        {
		          items: [
		            { key: "mine", label: t("experts.tab.mine") },
		            { key: "official", label: t("experts.tab.official") }
		          ],
		          value: view,
		          onChange: setView
		        }
		      ) }),
		      view === "mine" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-section", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SectionHead, { title: t("experts.title"), count: mine.length }),
		        tagItems.length > 2 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Chips, { items: tagItems, value: tag, onChange: setTag }) : null,
		        mine.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Empty, { t }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-grid", children: mine.map((row) => mineCard(row)) })
		      ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-section", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SectionHead, { title: t("experts.official"), count: official.length }),
		        official.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Empty, { t }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-grid", children: official.map((row) => officialCard(row)) })
		      ] })
		    ] }),
		    detail === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Modal, { title: `${t("experts.composition")} \u2014 ${detail.title}`, onClose: () => setDetail(void 0), t, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-pre", children: detail.body }) }),
		    form === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
		      Modal,
		      {
		        title: form.mode === "create" ? t("experts.create") : t("action.edit"),
		        onClose: () => {
		          setForm(void 0);
		          onCloseAdd();
		        },
		        t,
		        footer: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(ActionButton, { primary: true, disabled: busy, onClick: () => void submit(), children: [
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconPlus, { size: 14 }),
		          t("action.save")
		        ] }),
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "adk-inline", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { width: 92 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: t("experts.icon"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		              "input",
		              {
		                className: "adk-input",
		                value: form.icon,
		                onChange: (event) => setForm({ ...form, icon: event.target.value })
		              }
		            ) }) }),
		            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { flex: 1, minWidth: 200 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: t("experts.name"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		              "input",
		              {
		                className: "adk-input",
		                value: form.name,
		                onChange: (event) => setForm({ ...form, name: event.target.value })
		              }
		            ) }) })
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: t("experts.description"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		            "input",
		            {
		              className: "adk-input",
		              value: form.description,
		              onChange: (event) => setForm({ ...form, description: event.target.value })
		            }
		          ) }),
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: t("experts.tags"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		            "input",
		            {
		              className: "adk-input",
		              value: form.tags,
		              onChange: (event) => setForm({ ...form, tags: event.target.value })
		            }
		          ) }),
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: t("experts.prompt"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		            "textarea",
		            {
		              className: "adk-textarea",
		              "data-tall": "true",
		              value: form.systemPrompt,
		              onChange: (event) => setForm({ ...form, systemPrompt: event.target.value })
		            }
		          ) }),
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: t("experts.capabilities"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-checkrow", children: CAPABILITIES.map((key) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		            Checkbox,
		            {
		              label: t(`cap.${key}`),
		              checked: form.capabilities[key],
		              onChange: (next) => setForm({ ...form, capabilities: { ...form.capabilities, [key]: next } })
		            },
		            key
		          )) }) }),
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: t("experts.boundSkills"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-checkrow", children: options.skills.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "adk-hint", children: "\u2014" }) : options.skills.slice(0, 80).map((skill) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		            Checkbox,
		            {
		              label: skill.name,
		              checked: form.skillNames.includes(skill.name),
		              onChange: (next) => setForm({
		                ...form,
		                skillNames: next ? [...form.skillNames, skill.name] : form.skillNames.filter((name) => name !== skill.name)
		              })
		            },
		            skill.name
		          )) }) }),
		          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: t("experts.boundConnectors"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "adk-checkrow", children: options.connectors.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "adk-hint", children: "\u2014" }) : options.connectors.map((connector) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
		            Checkbox,
		            {
		              label: connector.label,
		              checked: form.connectorIds.includes(connector.id),
		              onChange: (next) => setForm({
		                ...form,
		                connectorIds: next ? [...form.connectorIds, connector.id] : form.connectorIds.filter((id) => id !== connector.id)
		              })
		            },
		            connector.id
		          )) }) })
		        ]
		      }
		    )
		  ] });
		}

		// src/client/plugins.tsx
		var import_react5 = require("react");
		var import_jsx_runtime6 = require("react/jsx-runtime");
		function PluginsTab({ t, query }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PlazaView, { kind: "plugin", t, query, onChanged: () => void 0 });
		}
		var APPLICATIONS = ["applied", "restart-required", "overridden", "failed", "cancelled"];
		function describeResult(t, result, subject) {
		  const parts = [
		    result.changed ? `${t("plugins.changed")}: ${subject}` : `${t("plugins.unchanged")}: ${subject}`
		  ];
		  if (result.warnings.length > 0) parts.push(`${t("plugins.warnings")}: ${result.warnings.join("\uFF1B")}`);
		  if (result.application === "restart-required") {
		    parts.push(t("plugins.restartRequired"));
		  } else if (result.application !== "applied" && result.application !== "") {
		    parts.push(
		      APPLICATIONS.includes(result.application) ? t(`plugins.application.${result.application}`) : result.application
		    );
		  }
		  return parts.join(" \xB7 ");
		}
		function MyPluginsPage({ t, query }) {
		  const [data, setData] = (0, import_react5.useState)();
		  const [loading, setLoading] = (0, import_react5.useState)(true);
		  const [error, setError] = (0, import_react5.useState)();
		  const [busy, setBusy] = (0, import_react5.useState)(false);
		  const [notice, setNotice] = useNotice();
		  const [detail, setDetail] = (0, import_react5.useState)();
		  const load = (0, import_react5.useCallback)(async () => {
		    setLoading(true);
		    setError(void 0);
		    try {
		      const view = await api.plugins();
		      setData(view);
		      return view;
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		      return void 0;
		    } finally {
		      setLoading(false);
		    }
		  }, []);
		  (0, import_react5.useEffect)(() => {
		    void load();
		  }, [load]);
		  const readonlyDeployment = data?.available === false;
		  const lockedReason = (readOnlyReason) => readOnlyReason ?? (readonlyDeployment ? t("plugins.unavailable") : void 0);
		  const readOnlyText = (reason) => {
		    const text = t(`plugins.readOnly.${reason}`);
		    return text === `plugins.readOnly.${reason}` ? reason : text;
		  };
		  const mine = (0, import_react5.useMemo)(() => (data?.bundles ?? []).filter((bundle) => bundle.mine === true), [data]);
		  const needle = query.trim().toLowerCase();
		  const visible = (0, import_react5.useMemo)(() => {
		    if (needle === "") return mine;
		    return mine.filter(
		      (bundle) => [bundle.name, bundle.title ?? "", bundle.description, bundle.spec ?? ""].some(
		        (field) => field.toLowerCase().includes(needle)
		      )
		    );
		  }, [mine, needle]);
		  const run = async (action, subject) => {
		    setBusy(true);
		    setError(void 0);
		    try {
		      const result = await action();
		      if (result.error !== void 0 && result.error !== "") setError(result.error);
		      setNotice(describeResult(t, result, subject));
		      const view = await load();
		      if (view === void 0 || detail === void 0) return;
		      setDetail(view.bundles.find((bundle) => bundle.name === detail.name));
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const toggleEnabled = async (bundle) => {
		    await run(
		      () => api.pluginBundleSetEnabled(bundle.name, !bundle.enabled).then((r) => r.result),
		      bundle.title ?? bundle.name
		    );
		  };
		  const uninstall = async (bundle) => {
		    if (!window.confirm(`${t("plugins.uninstall")}: ${bundle.name}?
		${t("plugins.confirmRemove")}`)) return;
		    const name = bundle.name;
		    setBusy(true);
		    setError(void 0);
		    try {
		      const result = await api.pluginRemove(name).then((r) => r.result);
		      if (result.error !== void 0 && result.error !== "") setError(result.error);
		      setNotice(describeResult(t, result, bundle.title ?? name));
		      setDetail(void 0);
		      await load();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const findRow = (entryId) => (data?.rows ?? []).find((row) => row.entryId === entryId);
		  const rowsOf = (bundle) => bundle.rows.map((id) => findRow(id));
		  const renderCard = (bundle) => {
		    const locked = lockedReason(bundle.readOnlyReason);
		    const title = bundle.title ?? bundle.name;
		    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
		      "div",
		      {
		        className: "adk-card",
		        "data-broken": bundle.error === void 0 ? "false" : "true",
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "adk-card-head", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "adk-card-hit", title, onClick: () => setDetail(bundle), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "adk-card-hitblock", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "adk-card-title-line", children: [
		                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "adk-card-title-text", children: title }),
		                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Tag, { tone: bundle.enabled ? "ok" : void 0, children: bundle.enabled ? t("plugins.rowEnabled") : t("plugins.rowDisabled") })
		              ] }),
		              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "adk-card-meta", children: [
		                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "adk-mono", children: bundle.name }),
		                bundle.version === void 0 || bundle.version === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: `v${bundle.version}` })
		              ] })
		            ] }) }),
		            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
		              CardMenu,
		              {
		                label: t("action.more"),
		                items: [
		                  { label: t("plugins.detail"), onSelect: () => setDetail(bundle) },
		                  {
		                    label: bundle.enabled ? t("plugins.disable") : t("plugins.enable"),
		                    disabled: busy || locked !== void 0,
		                    onSelect: () => void toggleEnabled(bundle)
		                  },
		                  {
		                    label: t("plugins.uninstall"),
		                    danger: true,
		                    disabled: busy || locked !== void 0,
		                    onSelect: () => void uninstall(bundle)
		                  }
		                ]
		              }
		            )
		          ] }),
		          bundle.description === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "adk-card-desc", children: bundle.description }),
		          bundle.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { tone: "error", children: bundle.error }),
		          locked === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "adk-hint", children: readOnlyText(locked) })
		        ]
		      },
		      bundle.name
		    );
		  };
		  const renderDetail = (bundle) => {
		    const locked = lockedReason(bundle.readOnlyReason);
		    const declared = rowsOf(bundle);
		    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
		      Modal,
		      {
		        title: `${t("plugins.detailTitle")} \xB7 ${bundle.title ?? bundle.name}`,
		        subtitle: bundle.name,
		        onClose: () => setDetail(void 0),
		        t,
		        footer: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
		            ActionButton,
		            {
		              primary: true,
		              disabled: busy || locked !== void 0,
		              title: locked === void 0 ? void 0 : readOnlyText(locked),
		              onClick: () => void toggleEnabled(bundle),
		              children: bundle.enabled ? t("plugins.disable") : t("plugins.enable")
		            }
		          ),
		          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
		            ActionButton,
		            {
		              danger: true,
		              disabled: busy || locked !== void 0,
		              title: locked === void 0 ? void 0 : readOnlyText(locked),
		              onClick: () => void uninstall(bundle),
		              children: t("plugins.uninstall")
		            }
		          )
		        ] }),
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "adk-detail-meta", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Tag, { tone: bundle.enabled ? "ok" : void 0, children: bundle.enabled ? t("plugins.rowEnabled") : t("plugins.rowDisabled") }),
		            bundle.version === void 0 || bundle.version === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: `v${bundle.version}` }),
		            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: locked === void 0 ? t("plugins.removable") : t("plugins.readOnly") })
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Field, { label: t("plugins.spec"), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "adk-mono", children: bundle.spec ?? bundle.name }) }),
		          bundle.description === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Field, { label: t("plaza.description"), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "adk-detail-desc", children: bundle.description }) }),
		          bundle.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { tone: "error", children: bundle.error }),
		          locked === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { children: readOnlyText(locked) }),
		          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
		            Field,
		            {
		              label: t("plugins.rows"),
		              hint: declared.length === 0 ? t("plugins.noRows") : t("plugins.rowsHint"),
		              children: declared.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "adk-rows", children: declared.map(
		                (row, index) => (
		                  // 宿主声明了行但 listPlugins 里没有（例如加载失败）：保留 id，别静默丢掉。
		                  row === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "adk-row", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "adk-mono", children: `${bundle.rows[index] ?? ""} \xB7 ${t("plugins.rowMissing")}` }) }, `missing-${String(index)}`) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "adk-row", children: [
		                    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "adk-row-head", children: [
		                      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "adk-row-title", children: row.title === "" ? row.moduleName : row.title }),
		                      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "adk-tags", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Tag, { tone: row.enabled ? "ok" : void 0, children: row.enabled ? t("plugins.rowEnabled") : t("plugins.rowDisabled") }) })
		                    ] }),
		                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "adk-hint", children: row.moduleName })
		                  ] }, row.entryId)
		                )
		              ) })
		            }
		          ),
		          bundle.overrides.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Field, { label: t("plugins.overrides"), hint: t("plugins.overridesHint"), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "adk-mono", children: bundle.overrides.join(", ") }) })
		        ]
		      }
		    );
		  };
		  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
		    readonlyDeployment ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { children: t("plugins.unavailable") }) : null,
		    (data?.notes ?? []).length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { children: (data?.notes ?? []).join("\n") }),
		    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { tone: "error", children: error }),
		    notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { children: notice }),
		    (data?.pendingBuilds ?? []).length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Banner, { tone: "error", children: `${t("plugins.pendingBuilds")}: ${(data?.pendingBuilds ?? []).join(", ")}` }),
		    loading ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Loading, { t }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "adk-section", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SectionHead, { title: t("plugins.title"), count: visible.length }),
		      data === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "adk-hint", style: { marginBottom: 12 }, children: `${t("plugins.mineHint")} \xB7 ${t("plugins.profile")}: ${data.profile.name} \xB7 ${t("plugins.dir")}: ${data.profile.dir}` }),
		      visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Empty, { t }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "adk-grid", children: visible.map((bundle) => renderCard(bundle)) })
		    ] }),
		    detail === void 0 ? null : renderDetail(detail)
		  ] });
		}

		// src/client/skills.tsx
		var import_react6 = require("react");

		// src/client/session.ts
		function selectedSessionId() {
		  try {
		    const element = document.querySelector('[data-row-key][aria-selected="true"]');
		    const key = element?.getAttribute("data-row-key");
		    if (typeof key === "string" && key !== "") return key;
		  } catch {
		  }
		  return void 0;
		}
		function showConversation(ctx) {
		  try {
		    const layout = ctx.get?.("layout");
		    layout?.selectPanel?.("conversation");
		  } catch {
		  }
		}
		async function copyToClipboard(text) {
		  try {
		    await navigator.clipboard.writeText(text);
		    return true;
		  } catch {
		    return false;
		  }
		}
		async function sendPrompt(ctx, text) {
		  try {
		    const sessions = ctx.get?.("sessions");
		    const sessionId = selectedSessionId() ?? sessions?.list?.getSnapshot?.().ids?.[0];
		    if (sessions !== void 0 && typeof sessionId === "string") {
		      const binding = sessions.binding?.(sessionId);
		      const prompt = binding?.session?.prompt;
		      if (typeof prompt === "function") {
		        const result = await prompt([{ type: "text", text }], "queue");
		        if (result?.ok === true) {
		          showConversation(ctx);
		          return { ok: true, mode: "sent" };
		        }
		        return {
		          ok: false,
		          mode: "sent",
		          error: result?.error?.message ?? "\u53D1\u9001\u5931\u8D25"
		        };
		      }
		    }
		  } catch (error) {
		    const message = error instanceof Error ? error.message : String(error);
		    const copied2 = await copyToClipboard(text);
		    return { ok: copied2, mode: "copied", error: message };
		  }
		  const copied = await copyToClipboard(text);
		  return copied ? { ok: true, mode: "copied" } : { ok: false, mode: "copied", error: "\u5F53\u524D\u90E8\u7F72\u6CA1\u6709\u4F1A\u8BDD API\uFF0C\u4E14\u526A\u8D34\u677F\u4E0D\u53EF\u7528" };
		}

		// src/client/skills.tsx
		var import_jsx_runtime7 = require("react/jsx-runtime");
		var TEXT_FILE = /\.(md|markdown|txt|json|ya?ml|csv)$/i;
		async function fileToBase64(file) {
		  const bytes = new Uint8Array(await file.arrayBuffer());
		  let binary = "";
		  const chunk = 32768;
		  for (let index = 0; index < bytes.length; index += chunk) {
		    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
		  }
		  return btoa(binary);
		}
		var FILTERS = ["all", "project", "user", "custom", "builtin", "runtime"];
		function inFilter(row, filter) {
		  const source = String(row.source);
		  switch (filter) {
		    case "all":
		      return true;
		    case "project":
		      return source.startsWith("project");
		    case "user":
		      return source.startsWith("user");
		    case "custom":
		      return source === "custom";
		    case "builtin":
		      return source === "bundled";
		    case "runtime":
		      return source === "runtime";
		    default:
		      return true;
		  }
		}
		function pickFeatured(rows, page, size = 6) {
		  const priority = (row) => {
		    const source = String(row.source);
		    if (source === "custom") return 0;
		    if (source.startsWith("user")) return 1;
		    if (source.startsWith("project")) return 2;
		    return 3;
		  };
		  const ordered = [...rows].sort(
		    (a, b) => priority(a) - priority(b) || a.name.localeCompare(b.name)
		  );
		  if (ordered.length <= size) return ordered;
		  const offset = page * size % ordered.length;
		  const rotated = [...ordered.slice(offset), ...ordered.slice(0, offset)];
		  return rotated.slice(0, size);
		}
		function SkillsTab({ t, query }) {
		  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PlazaView, { kind: "skill", t, query, onChanged: () => void 0 });
		}
		function MySkillsPage({
		  t,
		  query,
		  cwd,
		  addOpen,
		  onCloseAdd,
		  ctx
		}) {
		  const [rows, setRows] = (0, import_react6.useState)([]);
		  const [loading, setLoading] = (0, import_react6.useState)(true);
		  const [error, setError] = (0, import_react6.useState)();
		  const [filter, setFilter] = (0, import_react6.useState)("all");
		  const [form, setForm] = (0, import_react6.useState)();
		  const [busy, setBusy] = (0, import_react6.useState)(false);
		  const [notice, setNotice] = useNotice();
		  const [page, setPage] = (0, import_react6.useState)(0);
		  const [upload, setUpload] = (0, import_react6.useState)();
		  const [dragOver, setDragOver] = (0, import_react6.useState)(false);
		  const [creator, setCreator] = (0, import_react6.useState)();
		  const load = (0, import_react6.useCallback)(async () => {
		    setLoading(true);
		    setError(void 0);
		    try {
		      setRows((await api.skills(cwd)).skills);
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setLoading(false);
		    }
		  }, [cwd]);
		  (0, import_react6.useEffect)(() => {
		    void load();
		  }, [load]);
		  const visible = (0, import_react6.useMemo)(() => {
		    const needle = query.trim().toLowerCase();
		    return rows.filter((row) => {
		      if (!inFilter(row, filter)) return false;
		      if (needle === "") return true;
		      return row.name.toLowerCase().includes(needle) || row.description.toLowerCase().includes(needle) || (row.whenToUse ?? "").toLowerCase().includes(needle);
		    });
		  }, [rows, filter, query]);
		  const featured = (0, import_react6.useMemo)(() => pickFeatured(rows, page, 5), [rows, page]);
		  const run = async (action, message) => {
		    setBusy(true);
		    setError(void 0);
		    if (message !== void 0) setNotice(message);
		    try {
		      await action();
		      await load();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const toggle = async (row) => {
		    const path = row.path;
		    if (path === void 0) return;
		    await run(() => api.skillSetEnabled({ name: row.name, path, cwd, enabled: row.disabled }));
		  };
		  const openEdit = async (row) => {
		    if (row.path === void 0) return;
		    setBusy(true);
		    try {
		      const detail = await api.skillRead(row.name, row.path, cwd);
		      setForm({
		        mode: "edit",
		        name: detail.name,
		        description: detail.description,
		        whenToUse: detail.whenToUse ?? "",
		        content: detail.content,
		        root: "user",
		        path: detail.path,
		        cwd: cwd ?? "",
		        warnings: detail.warnings
		      });
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const remove = async (row) => {
		    const path = row.path;
		    if (path === void 0) return;
		    if (!window.confirm(`${t("action.delete")}: ${row.name}?
		${t("skills.deleteHint")}`)) return;
		    await run(() => api.skillDelete({ name: row.name, path, cwd }));
		  };
		  const submit = async () => {
		    if (form === void 0) return;
		    setBusy(true);
		    setError(void 0);
		    try {
		      if (form.mode === "create") {
		        await api.skillCreate({
		          root: form.root,
		          cwd: form.cwd === "" ? void 0 : form.cwd,
		          name: form.name,
		          description: form.description,
		          whenToUse: form.whenToUse === "" ? void 0 : form.whenToUse,
		          content: form.content
		        });
		      } else {
		        await api.skillUpdate({
		          name: form.name,
		          path: form.path,
		          cwd: form.cwd === "" ? void 0 : form.cwd,
		          description: form.description,
		          whenToUse: form.whenToUse === "" ? void 0 : form.whenToUse,
		          content: form.content
		        });
		      }
		      setForm(void 0);
		      onCloseAdd();
		      await load();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const pickFiles = async (files) => {
		    if (files.length === 0 || upload === void 0) return;
		    const zip = files.find((file) => file.name.toLowerCase().endsWith(".zip"));
		    if (zip !== void 0) {
		      const dataBase64 = await fileToBase64(zip);
		      setUpload({
		        ...upload,
		        source: "archive",
		        dataBase64,
		        files: void 0,
		        fileName: zip.name,
		        label: `${zip.name}\uFF08${String(Math.max(1, Math.round(zip.size / 1024)))} KB\uFF09`
		      });
		      return;
		    }
		    if (files.length === 1 && /\.(md|markdown)$/i.test(files[0]?.name ?? "")) {
		      const file = files[0];
		      const text = await file.text();
		      setUpload({
		        ...upload,
		        source: "markdown",
		        dataBase64: void 0,
		        files: [{ path: "SKILL.md", text }],
		        fileName: file.name,
		        label: file.name
		      });
		      return;
		    }
		    const entries = [];
		    let folder = "";
		    for (const file of files.slice(0, 200)) {
		      const relative = (file.webkitRelativePath ?? file.name).replace(/\\/g, "/");
		      if (!relative.includes("/")) continue;
		      folder ||= relative.split("/")[0] ?? "";
		      if (TEXT_FILE.test(relative)) entries.push({ path: relative, text: await file.text() });
		      else if (file.size <= 256 * 1024) entries.push({ path: relative, base64: await fileToBase64(file) });
		    }
		    if (entries.length === 0) {
		      setError(t("skills.dropHint"));
		      return;
		    }
		    setUpload({
		      ...upload,
		      source: "files",
		      dataBase64: void 0,
		      files: entries,
		      fileName: void 0,
		      label: `${folder === "" ? t("skills.pickFolder") : folder}\uFF08${String(entries.length)} \u4E2A\u6587\u4EF6\uFF09`
		    });
		  };
		  const submitUpload = async () => {
		    if (upload === void 0) return;
		    setBusy(true);
		    setError(void 0);
		    try {
		      const result = await api.skillImport({
		        root: upload.root,
		        cwd: cwd === "" ? void 0 : cwd,
		        source: upload.source,
		        ...upload.dataBase64 === void 0 ? {} : { dataBase64: upload.dataBase64 },
		        ...upload.files === void 0 ? {} : { files: upload.files },
		        ...upload.fileName === void 0 ? {} : { fileName: upload.fileName },
		        enable: upload.enable
		      });
		      setNotice(
		        `${t("skills.imported")}: ${result.name} \u2192 ${result.path}` + (result.warnings.length === 0 ? "" : `\uFF08${result.warnings.join("; ")}\uFF09`)
		      );
		      setUpload(void 0);
		      onCloseAdd();
		      await load();
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    } finally {
		      setBusy(false);
		    }
		  };
		  const generatePrompt = async (requirement) => {
		    try {
		      const info = await api.skillCreatorPrompt(requirement);
		      const note = info.available ? void 0 : t("skills.creatorMissing");
		      setCreator({
		        requirement,
		        prompt: info.prompt,
		        skill: info.skill,
		        available: info.available,
		        ...note === void 0 ? {} : { note }
		      });
		      return { prompt: info.prompt, skill: info.skill };
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		      return void 0;
		    }
		  };
		  const runCreator = async () => {
		    if (creator === void 0) return;
		    const requirement = creator.requirement.trim();
		    if (requirement === "") return;
		    setBusy(true);
		    try {
		      const prepared = creator.prompt === "" ? await generatePrompt(requirement) : { prompt: creator.prompt, skill: creator.skill };
		      if (prepared === void 0) return;
		      const outcome = await sendPrompt(ctx, prepared.prompt);
		      if (outcome.ok && outcome.mode === "sent") {
		        setNotice(`${t("skills.sentToSession")}${prepared.skill === "" ? "" : `\uFF08${prepared.skill}\uFF09`}`);
		        setCreator(void 0);
		        onCloseAdd();
		      } else if (outcome.ok) {
		        setNotice(t("skills.copiedPrompt"));
		      } else {
		        setError(outcome.error ?? t("panel.error"));
		      }
		    } finally {
		      setBusy(false);
		    }
		  };
		  const card = (row, inStrip) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-card", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-card-head", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tile, { tone: toneOf(row.name), children: row.name.slice(0, 1).toUpperCase() }),
		      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-card-titleblock", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-card-title", title: row.name, children: [
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "adk-card-title-text", children: row.name }),
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		            CardMenu,
		            {
		              label: t("action.more"),
		              items: [
		                ...row.toggleable ? [{ label: row.disabled ? t("action.enable") : t("action.disable"), onSelect: () => void toggle(row) }] : [],
		                ...row.path === void 0 ? [] : [{ label: t("action.edit"), onSelect: () => void openEdit(row) }],
		                ...row.path === void 0 ? [] : [{ label: t("action.delete"), onSelect: () => void remove(row), danger: true }]
		              ]
		            }
		          )
		        ] }),
		        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-card-meta", children: `${String(row.source)} \xB7 ${row.provider}` })
		      ] })
		    ] }),
		    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-card-desc", "data-lines": inStrip ? "2" : "3", children: row.description === "" ? "\u2014" : row.description }),
		    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-tags", children: [
		      row.disabled ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tag, { tone: "error", children: t("skills.disabled") }) : null,
		      row.invocation.userInvocable ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tag, { children: "user:off" }),
		      row.path === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tag, { tone: "accent", children: t("skills.readonly") }) : null,
		      row.whenToUse === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tag, { children: row.whenToUse })
		    ] })
		  ] }, `${inStrip ? "strip" : "grid"}-${row.name}`);
		  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
		    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Banner, { tone: "error", children: error }),
		    notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Banner, { children: notice }),
		    loading ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Loading, { t }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
		      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-section", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(SectionHead, { title: t("skills.featured"), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(ActionButton, { onClick: () => setPage((value) => value + 1), children: [
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconRefresh, { size: 14 }),
		          t("skills.shuffle")
		        ] }) }),
		        featured.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Empty, { t }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-strip", children: featured.map((row) => card(row, true)) })
		      ] }),
		      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-section", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(SectionHead, { title: t("skills.title"), count: visible.length }),
		        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		          Chips,
		          {
		            items: FILTERS.map((key) => ({ key, label: t(`skills.filter.${key}`) })),
		            value: filter,
		            onChange: setFilter
		          }
		        ),
		        visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Empty, { t }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-grid", children: visible.map((row) => card(row, false)) })
		      ] })
		    ] }),
		    form === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
		      Modal,
		      {
		        title: form.mode === "create" ? t("skills.createTitle") : t("action.edit"),
		        onClose: () => {
		          setForm(void 0);
		          onCloseAdd();
		        },
		        t,
		        footer: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ActionButton, { primary: true, disabled: busy, onClick: () => void submit(), children: t("action.save") }),
		        children: [
		          form.warnings.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Banner, { children: form.warnings.join("\n") }),
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-inline", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { flex: 1, minWidth: 220 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: t("skills.name"), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		              "input",
		              {
		                className: "adk-input",
		                value: form.name,
		                readOnly: form.mode === "edit",
		                onChange: (event) => setForm({ ...form, name: event.target.value })
		              }
		            ) }) }),
		            form.mode === "create" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { marginBottom: 12 }, children: [
		              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-hint", style: { marginBottom: 6 }, children: t("skills.root") }),
		              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-checkrow", children: [
		                /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "adk-check", children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		                    "input",
		                    {
		                      type: "radio",
		                      checked: form.root === "user",
		                      onChange: () => setForm({ ...form, root: "user" })
		                    }
		                  ),
		                  t("skills.root.user")
		                ] }),
		                /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "adk-check", children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		                    "input",
		                    {
		                      type: "radio",
		                      checked: form.root === "project",
		                      onChange: () => setForm({ ...form, root: "project" })
		                    }
		                  ),
		                  t("skills.root.project")
		                ] })
		              ] })
		            ] }) : null
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: t("skills.description"), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		            "input",
		            {
		              className: "adk-input",
		              value: form.description,
		              onChange: (event) => setForm({ ...form, description: event.target.value })
		            }
		          ) }),
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: t("skills.whenToUse"), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		            "input",
		            {
		              className: "adk-input",
		              value: form.whenToUse,
		              onChange: (event) => setForm({ ...form, whenToUse: event.target.value })
		            }
		          ) }),
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: t("skills.content"), hint: form.path === "" ? void 0 : form.path, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		            "textarea",
		            {
		              className: "adk-textarea",
		              "data-tall": "true",
		              value: form.content,
		              onChange: (event) => setForm({ ...form, content: event.target.value })
		            }
		          ) }),
		          form.path === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-mono", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconFolder, { size: 12 }),
		            " ",
		            form.path
		          ] })
		        ]
		      }
		    ),
		    addOpen ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Modal, { title: t("skills.add"), onClose: onCloseAdd, t, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-choices", children: [
		      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
		        "button",
		        {
		          type: "button",
		          className: "adk-choice",
		          onClick: () => {
		            onCloseAdd();
		            setUpload({ root: "user", source: "archive", enable: true, label: "" });
		          },
		          children: [
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconFolder, { size: 18 }),
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "adk-choice-title", children: t("skills.import") }),
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "adk-choice-desc", children: t("skills.importDesc") })
		          ]
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
		        "button",
		        {
		          type: "button",
		          className: "adk-choice",
		          onClick: () => {
		            onCloseAdd();
		            setCreator({ requirement: "", prompt: "", skill: "", available: false });
		          },
		          children: [
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconSparkle, { size: 18 }),
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "adk-choice-title", children: t("skills.createByAi") }),
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "adk-choice-desc", children: t("skills.createByAiDesc") })
		          ]
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
		        "button",
		        {
		          type: "button",
		          className: "adk-choice",
		          onClick: () => {
		            onCloseAdd();
		            setForm({
		              mode: "create",
		              name: "",
		              description: "",
		              whenToUse: "",
		              content: "",
		              root: "user",
		              path: "",
		              cwd: cwd ?? "",
		              warnings: []
		            });
		          },
		          children: [
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconPlus, { size: 18 }),
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "adk-choice-title", children: t("skills.createManual") }),
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "adk-choice-desc", children: t("skills.createManualDesc") })
		          ]
		        }
		      )
		    ] }) }) : null,
		    upload === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
		      Modal,
		      {
		        title: t("skills.import"),
		        onClose: () => {
		          setUpload(void 0);
		          onCloseAdd();
		        },
		        t,
		        footer: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		          ActionButton,
		          {
		            primary: true,
		            disabled: busy || upload.label === "",
		            onClick: () => void submitUpload(),
		            children: t("skills.importAction")
		          }
		        ),
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
		            "div",
		            {
		              className: "adk-drop",
		              "data-over": dragOver ? "true" : "false",
		              onDragOver: (event) => {
		                event.preventDefault();
		                setDragOver(true);
		              },
		              onDragLeave: () => setDragOver(false),
		              onDrop: (event) => {
		                event.preventDefault();
		                setDragOver(false);
		                void pickFiles(Array.from(event.dataTransfer.files));
		              },
		              children: [
		                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconFolder, { size: 26 }),
		                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-drop-title", children: upload.label === "" ? t("skills.dropHint") : upload.label }),
		                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-hint", children: t("skills.dropFormats") }),
		                /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-inline", style: { justifyContent: "center", marginTop: 10 }, children: [
		                  /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "adk-action", children: [
		                    t("skills.pickZip"),
		                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		                      "input",
		                      {
		                        type: "file",
		                        accept: ".zip,application/zip",
		                        style: { display: "none" },
		                        onChange: (event) => void pickFiles(Array.from(event.target.files ?? []))
		                      }
		                    )
		                  ] }),
		                  /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "adk-action", children: [
		                    t("skills.pickMd"),
		                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		                      "input",
		                      {
		                        type: "file",
		                        accept: ".md,text/markdown",
		                        style: { display: "none" },
		                        onChange: (event) => void pickFiles(Array.from(event.target.files ?? []))
		                      }
		                    )
		                  ] }),
		                  /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "adk-action", children: [
		                    t("skills.pickFolder"),
		                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		                      "input",
		                      {
		                        type: "file",
		                        multiple: true,
		                        style: { display: "none" },
		                        ...{ webkitdirectory: "", directory: "" },
		                        onChange: (event) => void pickFiles(Array.from(event.target.files ?? []))
		                      }
		                    )
		                  ] })
		                ] })
		              ]
		            }
		          ),
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-inline", style: { marginTop: 12 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-hint", style: { marginBottom: 6 }, children: t("skills.root") }),
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-checkrow", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "adk-check", children: [
		                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		                  "input",
		                  {
		                    type: "radio",
		                    checked: upload.root === "user",
		                    onChange: () => setUpload({ ...upload, root: "user" })
		                  }
		                ),
		                t("skills.root.user")
		              ] }),
		              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "adk-check", children: [
		                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		                  "input",
		                  {
		                    type: "radio",
		                    checked: upload.root === "project",
		                    onChange: () => setUpload({ ...upload, root: "project" })
		                  }
		                ),
		                t("skills.root.project")
		              ] })
		            ] })
		          ] }) }),
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "adk-check", style: { marginTop: 10 }, children: [
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		              "input",
		              {
		                type: "checkbox",
		                checked: upload.enable,
		                onChange: (event) => setUpload({ ...upload, enable: event.target.checked })
		              }
		            ),
		            t("skills.autoEnable")
		          ] }),
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "adk-requirements", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontWeight: 600, marginBottom: 6 }, children: t("skills.requirements") }),
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("ul", { style: { margin: 0, paddingLeft: 18 }, children: [
		              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("li", { children: t("skills.requirementArchive") }),
		              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("li", { children: t("skills.requirementMarkdown") })
		            ] })
		          ] })
		        ]
		      }
		    ),
		    creator === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
		      Modal,
		      {
		        title: t("skills.createByAi"),
		        onClose: () => {
		          setCreator(void 0);
		          onCloseAdd();
		        },
		        t,
		        footer: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		            ActionButton,
		            {
		              disabled: busy || creator.requirement.trim() === "",
		              onClick: () => void generatePrompt(creator.requirement),
		              children: t("skills.previewPrompt")
		            }
		          ),
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		            ActionButton,
		            {
		              primary: true,
		              disabled: busy || creator.requirement.trim() === "",
		              onClick: () => void runCreator(),
		              children: t("skills.createByAiAction")
		            }
		          )
		        ] }),
		        children: [
		          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "adk-composer", children: [
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "adk-skill-chip", children: [
		              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconSparkle, { size: 13 }),
		              creator.skill === "" ? t("skills.creatorSkill") : creator.skill
		            ] }),
		            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
		              "input",
		              {
		                className: "adk-composer-input",
		                autoFocus: true,
		                value: creator.requirement,
		                placeholder: t("skills.requirementPlaceholder"),
		                onChange: (event) => setCreator({ ...creator, requirement: event.target.value }),
		                onKeyDown: (event) => {
		                  if (event.key === "Enter") void runCreator();
		                }
		              }
		            )
		          ] }),
		          creator.note === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-hint", style: { marginTop: 6 }, children: creator.note }),
		          creator.prompt === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "adk-pre", style: { marginTop: 12 }, children: creator.prompt })
		        ]
		      }
		    )
		  ] });
		}

		// src/client/panel.tsx
		var import_jsx_runtime8 = require("react/jsx-runtime");
		var CWD_KEY = "dsh-squares.cwd";
		function SquarePage({
		  ctx,
		  t,
		  initialTab = "plugins"
		}) {
		  const [tab, setTab] = (0, import_react7.useState)(initialTab);
		  const [query, setQuery] = (0, import_react7.useState)("");
		  const [caps, setCaps] = (0, import_react7.useState)();
		  const [status, setStatus] = (0, import_react7.useState)();
		  const [error, setError] = (0, import_react7.useState)();
		  const [token, setToken] = (0, import_react7.useState)(0);
		  const [addOpen, setAddOpen] = (0, import_react7.useState)(false);
		  const [page, setPage] = (0, import_react7.useState)("plaza");
		  const [submitKind, setSubmitKind] = (0, import_react7.useState)();
		  const [cwd, setCwd] = (0, import_react7.useState)(() => {
		    try {
		      return window.localStorage.getItem(CWD_KEY) ?? "";
		    } catch {
		      return "";
		    }
		  });
		  const [, forceRender] = (0, import_react7.useState)(0);
		  (0, import_react7.useEffect)(() => {
		    try {
		      const disposer = ctx.locale.subscribe?.(() => forceRender((value) => value + 1));
		      return () => {
		        if (typeof disposer === "function") disposer();
		      };
		    } catch {
		      return void 0;
		    }
		  }, [ctx]);
		  const load = (0, import_react7.useCallback)(async () => {
		    setError(void 0);
		    try {
		      const [capabilities, deckStatus] = await Promise.all([api.capabilities(), api.status()]);
		      setCaps(capabilities);
		      setStatus(deckStatus);
		    } catch (failure) {
		      setError(failure instanceof ApiError ? failure.message : String(failure));
		    }
		  }, []);
		  (0, import_react7.useEffect)(() => {
		    void load();
		  }, [load, token]);
		  const saveCwd = (next) => {
		    setCwd(next);
		    try {
		      window.localStorage.setItem(CWD_KEY, next);
		    } catch {
		    }
		    setToken((value) => value + 1);
		  };
		  const ui = caps?.ui ?? { skills: true, experts: true, connectors: true };
		  const counts = status?.counts;
		  const tabs = [
		    {
		      key: "plugins",
		      label: t("tab.plugins"),
		      icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconPlugin, { size: 16 })
		    },
		    {
		      key: "skills",
		      label: t("tab.skills"),
		      icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconSkill, { size: 16 })
		    },
		    {
		      key: "connectors",
		      label: t("tab.connectors"),
		      icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconConnector, { size: 16 })
		    },
		    {
		      key: "experts",
		      label: t("tab.experts"),
		      icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconExpert, { size: 16 })
		    }
		  ];
		  const mineLabel = (kind) => {
		    const count = kind === "experts" ? counts?.myExperts : kind === "skills" ? counts?.skills : kind === "connectors" ? counts?.connectors : counts?.plugins;
		    return count === void 0 ? t(`mine.${kind}`) : `${t(`mine.${kind}`)} ${String(count)}`;
		  };
		  const switchTab = (next) => {
		    setTab(next);
		    setQuery("");
		    setAddOpen(false);
		    setPage("plaza");
		  };
		  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("section", { className: "adk-root", children: [
		    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("header", { className: "adk-top", children: [
		      page === "mine" ? (
		        // 子页面顶栏：返回 + 标题 + 搜索
		        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
		          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
		            "button",
		            {
		              type: "button",
		              className: "adk-back",
		              title: t("panel.back"),
		              onClick: () => setPage("plaza"),
		              children: [
		                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M9.5 3.5 5 8l4.5 4.5" }) }),
		                t("panel.back")
		              ]
		            }
		          ),
		          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "adk-page-title", children: tab === "experts" ? t("mine.experts") : tab === "skills" ? t("mine.skills") : tab === "connectors" ? t("mine.connectors") : t("mine.plugins") })
		        ] })
		      ) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
		        PillTabs,
		        {
		          items: tabs,
		          value: tab,
		          onChange: (next) => {
		            setTab(next);
		            setQuery("");
		            setAddOpen(false);
		          }
		        }
		      ),
		      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { className: "adk-top-right", children: [
		        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
		          SearchPill,
		          {
		            value: query,
		            onChange: setQuery,
		            placeholder: tab === "skills" ? t("panel.searchSkills") : tab === "experts" ? t("panel.searchExperts") : tab === "connectors" ? t("panel.searchConnectors") : t("panel.searchPlugins")
		          }
		        ),
		        page === "plaza" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ActionButton, { onClick: () => setPage("mine"), title: mineLabel(tab), children: mineLabel(tab) }) : null,
		        page === "mine" && tab === "skills" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ActionButton, { primary: true, onClick: () => setAddOpen(true), children: t("skills.add") }) : null,
		        page === "mine" && tab === "experts" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ActionButton, { primary: true, onClick: () => setAddOpen(true), children: t("experts.create") }) : null,
		        page === "mine" && tab === "connectors" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ActionButton, { primary: true, onClick: () => setAddOpen(true), children: t("connectors.create") }) : null,
		        page === "plaza" && caps?.ui?.plaza !== false ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
		          SubmitMenu,
		          {
		            kind: tab === "skills" ? "skill" : tab === "experts" ? "expert" : tab === "plugins" ? "plugin" : "connector",
		            t,
		            onPick: (entry) => setSubmitKind(entry)
		          }
		        ) : null,
		        page === "mine" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ActionButton, { onClick: () => setToken((value) => value + 1), title: t("panel.refresh"), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(IconRefresh, { size: 14 }) }) : null
		      ] })
		    ] }),
		    submitKind === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
		      SubmitModal,
		      {
		        kind: submitKind,
		        t,
		        onClose: () => setSubmitKind(void 0),
		        onSubmitted: () => {
		          setToken((value) => value + 1);
		        }
		      }
		    ),
		    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Banner, { tone: "error", children: [
		      error,
		      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: "adk-action", style: { marginLeft: 8 }, onClick: () => void load(), children: t("panel.retry") })
		    ] }),
		    (caps?.notes ?? []).length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Banner, { children: (caps?.notes ?? []).join("\n") }),
		    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "adk-body", children: page === "plaza" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
		      tab === "skills" ? ui.skills ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(SkillsTab, { t, query }, `skills-plaza-${String(token)}`) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "adk-empty", children: t("panel.disabledSkills") }) : null,
		      tab === "experts" ? ui.experts ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ExpertsTab, { t, query }, `experts-plaza-${String(token)}`) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "adk-empty", children: t("panel.disabledExperts") }) : null,
		      tab === "connectors" ? ui.connectors ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ConnectorsTab, { t, query }, `connectors-plaza-${String(token)}`) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "adk-empty", children: t("panel.disabledConnectors") }) : null,
		      tab === "plugins" ? ui.plugins !== false ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PluginsTab, { t, query }, `plugins-plaza-${String(token)}`) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "adk-empty", children: t("panel.disabledPlugins") }) : null
		    ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
		      tab === "skills" ? ui.skills ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
		        MySkillsPage,
		        {
		          t,
		          ctx,
		          query,
		          addOpen,
		          onCloseAdd: () => setAddOpen(false),
		          ...cwd === "" ? {} : { cwd }
		        },
		        `skills-mine-${String(token)}`
		      ) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "adk-empty", children: t("panel.disabledSkills") }) : null,
		      tab === "experts" ? ui.experts ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
		        MyExpertsPage,
		        {
		          t,
		          query,
		          addOpen,
		          onCloseAdd: () => setAddOpen(false)
		        },
		        `experts-mine-${String(token)}`
		      ) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "adk-empty", children: t("panel.disabledExperts") }) : null,
		      tab === "connectors" ? ui.connectors ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
		        MyConnectorsPage,
		        {
		          t,
		          query,
		          addOpen,
		          onCloseAdd: () => setAddOpen(false)
		        },
		        `connectors-mine-${String(token)}`
		      ) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "adk-empty", children: t("panel.disabledConnectors") }) : null,
		      tab === "plugins" ? ui.plugins !== false ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MyPluginsPage, { t, query }, `plugins-mine-${String(token)}`) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "adk-empty", children: t("panel.disabledPlugins") }) : null
		    ] }) })
		  ] });
		}

		// src/client/i18n.ts
		var NS = "square";
		var zh = {
		  "panel.title": "\u5E7F\u573A",
		  "panel.subtitle": "\u6280\u80FD \xB7 \u4E13\u5BB6 \xB7 \u8FDE\u63A5\u5668 \xB7 \u63D2\u4EF6",
		  "panel.search": "\u641C\u7D22\u2026",
		  "panel.searchSkills": "\u641C\u7D22\u6280\u80FD",
		  "panel.searchExperts": "\u641C\u7D22\u4E13\u5BB6\u804C\u79F0\u6216\u63CF\u8FF0",
		  "panel.searchConnectors": "\u641C\u7D22\u8FDE\u63A5\u5668",
		  "panel.searchPlugins": "\u641C\u7D22\u63D2\u4EF6",
		  "panel.workspace": "\u9879\u76EE\u76EE\u5F55\uFF08\u53EF\u9009\uFF0C\u7528\u4E8E\u9879\u76EE\u7EA7\u6280\u80FD\uFF09",
		  "panel.back": "\u8FD4\u56DE\u5E7F\u573A",
		  "panel.disabledSkills": "\u6280\u80FD\u7BA1\u7406\u5DF2\u901A\u8FC7\u63D2\u4EF6\u914D\u7F6E\u5173\u95ED\uFF08enableSkills=false\uFF09\u3002",
		  "panel.disabledExperts": "\u4E13\u5BB6\u7BA1\u7406\u5DF2\u901A\u8FC7\u63D2\u4EF6\u914D\u7F6E\u5173\u95ED\uFF08enableExperts=false\uFF09\u3002",
		  "panel.disabledConnectors": "\u8FDE\u63A5\u5668\u7BA1\u7406\u5DF2\u901A\u8FC7\u63D2\u4EF6\u914D\u7F6E\u5173\u95ED\uFF08enableConnectors=false\uFF09\u3002",
		  "panel.disabledPlugins": "\u63D2\u4EF6\u7BA1\u7406\u5DF2\u901A\u8FC7\u63D2\u4EF6\u914D\u7F6E\u5173\u95ED\uFF08enablePlugins=false\uFF09\u3002",
		  "panel.refresh": "\u5237\u65B0",
		  "panel.loading": "\u52A0\u8F7D\u4E2D\u2026",
		  "panel.empty": "\u6682\u65E0\u6570\u636E",
		  "panel.error": "\u51FA\u9519\u4E86",
		  "panel.retry": "\u91CD\u8BD5",
		  "panel.count": "{n} \u9879",
		  "panel.storage.domain": "\u6301\u4E45\u5316",
		  "panel.storage.memory": "\u5185\u5B58\uFF08\u91CD\u542F\u4E22\u5931\uFF09",
		  "tab.skills": "\u6280\u80FD",
		  "tab.experts": "\u4E13\u5BB6",
		  "tab.connectors": "\u8FDE\u63A5\u5668",
		  "tab.plugins": "\u63D2\u4EF6",
		  "mine.experts": "\u6211\u7684\u4E13\u5BB6",
		  "mine.skills": "\u6211\u7684\u6280\u80FD",
		  "mine.connectors": "\u6211\u7684 MCP",
		  "mine.plugins": "\u6211\u7684\u63D2\u4EF6",
		  "action.create": "\u65B0\u5EFA",
		  "action.edit": "\u7F16\u8F91",
		  "action.delete": "\u5220\u9664",
		  "action.save": "\u4FDD\u5B58",
		  "action.cancel": "\u53D6\u6D88",
		  "action.close": "\u5173\u95ED",
		  "action.more": "\u66F4\u591A\u64CD\u4F5C",
		  "action.enable": "\u542F\u7528",
		  "action.disable": "\u505C\u7528",
		  "action.test": "\u6D4B\u8BD5",
		  "action.reconnect": "\u91CD\u8FDE",
		  "action.setDefault": "\u8BBE\u4E3A\u9ED8\u8BA4",
		  "action.duplicate": "\u590D\u5236",
		  "action.detail": "\u67E5\u770B\u7EC4\u5408",
		  "action.confirmDelete": "\u786E\u8BA4\u5220\u9664\uFF1F",
		  "skills.title": "\u6280\u80FD",
		  "skills.create": "\u6DFB\u52A0\u6280\u80FD",
		  "skills.createTitle": "\u65B0\u5EFA\u6280\u80FD",
		  "skills.featured": "\u63A8\u8350\u6280\u80FD",
		  "skills.shuffle": "\u6362\u4E00\u6362",
		  "skills.all": "\u5168\u90E8",
		  "skills.installed": "\u6211\u5B89\u88C5\u7684",
		  "skills.root": "\u5B89\u88C5\u4F4D\u7F6E",
		  "skills.root.user": "\u7528\u6237\uFF08~/.dsh/skills\uFF09",
		  "skills.root.project": "\u9879\u76EE\uFF08<\u9879\u76EE\u6839>/.dsh/skills\uFF09",
		  "skills.add": "\u6DFB\u52A0\u6280\u80FD",
		  "skills.import": "\u5BFC\u5165\u6280\u80FD",
		  "skills.importDesc": "\u4E0A\u4F20 .zip / \u6587\u4EF6\u5939 / .md",
		  "skills.importAction": "\u5BFC\u5165",
		  "skills.imported": "\u5DF2\u5BFC\u5165",
		  "skills.dropHint": "\u62D6\u62FD\u6587\u4EF6\u6216\u70B9\u51FB\u4E0A\u4F20",
		  "skills.dropFormats": "\u652F\u6301 .zip\u3001\u6587\u4EF6\u5939\u3001\u5355\u4E2A .md",
		  "skills.pickZip": "\u9009\u62E9 .zip",
		  "skills.pickMd": "\u9009\u62E9 .md",
		  "skills.pickFolder": "\u9009\u62E9\u6587\u4EF6\u5939",
		  "skills.autoEnable": "\u975E\u9AD8\u98CE\u9669\u81EA\u52A8\u5B89\u88C5\uFF08\u5BFC\u5165\u540E\u7ACB\u5373\u53EF\u88AB\u6A21\u578B\u8C03\u7528\uFF09",
		  "skills.requirements": "\u6587\u4EF6\u8981\u6C42",
		  "skills.requirementArchive": "\u6587\u4EF6\u5939\u6216\u8005 .zip \u9700\u8981\u5305\u542B SKILL.md \u6587\u4EF6",
		  "skills.requirementMarkdown": ".md \u6587\u4EF6\u9700\u5305\u542B YAML \u683C\u5F0F\u7684\u6280\u80FD\u540D\u79F0\u548C\u63CF\u8FF0",
		  "skills.createByAi": "AI \u521B\u5EFA",
		  "skills.createByAiDesc": "\u6307\u540D skill-creator \u6280\u80FD\uFF0C\u76F4\u63A5\u628A\u9700\u6C42\u53D1\u8FDB\u4F1A\u8BDD\u521B\u5EFA",
		  "skills.createByAiAction": "\u521B\u5EFA",
		  "skills.createManual": "\u624B\u52A8\u521B\u5EFA",
		  "skills.createManualDesc": "\u81EA\u5DF1\u586B\u5199\u540D\u79F0\u3001\u63CF\u8FF0\u4E0E\u6B63\u6587",
		  "skills.creatorSkill": "skill-creator",
		  "skills.requirementPlaceholder": "\u8BF7\u5E2E\u6211\u521B\u5EFA\u4E00\u4E2A\u53EF\u4EE5\u5B9E\u73B0\u300C\u2026\u2026\u300D\u7684 skill",
		  "skills.previewPrompt": "\u9884\u89C8\u63D0\u793A\u8BCD",
		  "skills.creatorMissing": "\u5F53\u524D\u90E8\u7F72\u6CA1\u6709\u8FD9\u4E2A\u6280\u80FD\uFF0C\u5C06\u53D1\u9001\u901A\u7528\u521B\u5EFA\u63D0\u793A\u8BCD",
		  "skills.sentToSession": "\u5DF2\u53D1\u9001\u5230\u5F53\u524D\u4F1A\u8BDD\uFF0C\u5207\u5230\u4F1A\u8BDD\u5373\u53EF\u770B\u5230\u521B\u5EFA\u8FC7\u7A0B",
		  "skills.copiedPrompt": "\u5DF2\u590D\u5236\u63D0\u793A\u8BCD\uFF0C\u7C98\u8D34\u5230\u8F93\u5165\u6846\u56DE\u8F66\u5373\u53EF",
		  "skills.source": "\u6765\u6E90",
		  "skills.provider": "\u63D0\u4F9B\u8005",
		  "skills.path": "\u8DEF\u5F84",
		  "skills.readonly": "\u53EA\u8BFB\uFF08\u65E0\u78C1\u76D8\u6587\u4EF6\uFF09",
		  "skills.disabled": "\u5DF2\u7981\u7528",
		  "skills.name": "\u540D\u79F0\uFF08kebab-case\uFF09",
		  "skills.description": "\u63CF\u8FF0",
		  "skills.whenToUse": "\u4F55\u65F6\u4F7F\u7528",
		  "skills.content": "\u6B63\u6587\uFF08Markdown\uFF09",
		  "skills.filter.all": "\u5168\u90E8",
		  "skills.filter.project": "\u9879\u76EE",
		  "skills.filter.user": "\u7528\u6237",
		  "skills.filter.custom": "\u81EA\u5B9A\u4E49",
		  "skills.filter.builtin": "\u5185\u7F6E",
		  "skills.filter.runtime": "\u8FD0\u884C\u65F6",
		  "skills.deleteHint": "\u5220\u9664\u4F1A\u79FB\u5165\u8BE5\u6280\u80FD\u6839\u7684 .system/.trash\uFF0C\u53EF\u624B\u52A8\u6062\u590D\u3002",
		  "experts.official": "\u5B98\u65B9\u9884\u8BBE",
		  "experts.title": "\u6211\u7684\u4E13\u5BB6",
		  "experts.tab.mine": "\u6211\u7684\u4E13\u5BB6",
		  "experts.tab.official": "\u5B98\u65B9\u9884\u8BBE",
		  "experts.active": "\u5DF2\u6FC0\u6D3B",
		  "experts.officialHint": "\u5B98\u65B9 Agent Preset\uFF1A\u4F1A\u8BDD\u5F00\u59CB\u524D\u53EF\u9009\u7528\uFF0C\u8FD0\u884C\u4E2D\u7684\u4F1A\u8BDD\u4FDD\u6301\u542F\u52A8\u65F6\u7684\u7EC4\u5408\u3002",
		  "experts.skillUnit": "\u6280\u80FD",
		  "experts.connectorUnit": "\u8FDE\u63A5\u5668",
		  "experts.create": "\u65B0\u5EFA\u4E13\u5BB6",
		  "experts.name": "\u540D\u79F0",
		  "experts.icon": "\u56FE\u6807\uFF08emoji\uFF09",
		  "experts.description": "\u7B80\u4ECB",
		  "experts.tags": "\u6807\u7B7E\uFF08\u9017\u53F7\u5206\u9694\uFF09",
		  "experts.prompt": "\u7CFB\u7EDF\u63D0\u793A\u8BCD",
		  "experts.capabilities": "\u80FD\u529B\u5F00\u5173",
		  "experts.boundSkills": "\u7ED1\u5B9A\u6280\u80FD",
		  "experts.boundConnectors": "\u7ED1\u5B9A\u8FDE\u63A5\u5668",
		  "experts.default": "\u9ED8\u8BA4",
		  "experts.broken": "\u6FC0\u6D3B\u5931\u8D25",
		  "experts.composition": "\u7EC4\u5408\uFF08\u53EA\u8BFB\uFF09",
		  "experts.duplicateHint": "\u4ECE\u5B98\u65B9\u9884\u8BBE\u8BA1\u7B97\u7684\u526F\u672C\u53EA\u590D\u5236\u5C55\u793A\u4FE1\u606F\uFF0C\u7EC4\u5408\u6309\u80FD\u529B\u5F00\u5173\u91CD\u65B0\u751F\u6210\u3002",
		  "cap.shell": "\u7EC8\u7AEF",
		  "cap.fs": "\u6587\u4EF6",
		  "cap.skills": "\u6280\u80FD",
		  "cap.todo": "\u5F85\u529E",
		  "cap.web": "\u8054\u7F51",
		  "cap.ask": "\u63D0\u95EE",
		  "cap.subagents": "\u5B50\u4EE3\u7406",
		  "cap.compaction": "\u538B\u7F29",
		  "connectors.title": "\u8FDE\u63A5\u5668\uFF08MCP\uFF09",
		  "connectors.create": "\u81EA\u5B9A\u4E49\u8FDE\u63A5\u5668",
		  "connectors.createTitle": "\u6DFB\u52A0\u8FDE\u63A5\u5668",
		  "connectors.label": "\u5C55\u793A\u540D",
		  "connectors.serverName": "serverName\uFF08mcp__<\u540D>__<\u5DE5\u5177>\uFF09",
		  "connectors.transport": "\u4F20\u8F93\u65B9\u5F0F",
		  "connectors.transport.stdio": "stdio\uFF08\u672C\u5730\u8FDB\u7A0B\uFF09",
		  "connectors.transport.http": "streamable-http\uFF08\u8FDC\u7A0B\u670D\u52A1\uFF09",
		  "connectors.command": "\u547D\u4EE4",
		  "connectors.args": "\u53C2\u6570\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09",
		  "connectors.env": "\u73AF\u5883\u53D8\u91CF\uFF08\u6BCF\u884C KEY=VALUE\uFF09",
		  "connectors.cwd": "\u5DE5\u4F5C\u76EE\u5F55",
		  "connectors.url": "URL",
		  "connectors.headers": "\u8BF7\u6C42\u5934\uFF08\u6BCF\u884C KEY=VALUE\uFF09",
		  "connectors.timeout": "\u5DE5\u5177\u8C03\u7528\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
		  "connectors.failOnStartup": "\u542F\u52A8\u5931\u8D25\u5373\u62A5\u9519",
		  "connectors.tools": "\u5DE5\u5177",
		  "connectors.state.disabled": "\u672A\u542F\u7528",
		  "connectors.state.connecting": "\u8FDE\u63A5\u4E2D",
		  "connectors.state.connected": "\u5DF2\u8FDE\u63A5",
		  "connectors.state.error": "\u9519\u8BEF",
		  "connectors.profile": "profile \u4E2D\u5DF2\u914D\u7F6E\uFF08\u53EA\u8BFB\uFF09",
		  "connectors.unavailable": "\u5F53\u524D\u8FD0\u884C\u65F6\u65E0\u6CD5\u89E3\u6790 @deepseek-ai/dsh-mcp-client\uFF0C\u8FDE\u63A5\u5668\u53EA\u8BFB\u3002",
		  "connectors.secretsHint": "\u5BC6\u94A5\u4EE5 \u2022\u2022\u2022\u2022\u2022\u2022 \u56DE\u663E\uFF1B\u4E0D\u6539\u52A8\u8BE5\u884C\u5373\u4FDD\u6301\u539F\u503C\u3002",
		  "connectors.testOk": "\u8FDE\u63A5\u6210\u529F",
		  "plaza.title": "\u5E7F\u573A",
		  "plaza.source.all": "\u5168\u90E8\u6765\u6E90",
		  "plaza.sort.default": "\u7EFC\u5408",
		  "plaza.sort.hot": "\u6700\u70ED",
		  "plaza.sort.new": "\u6700\u65B0",
		  "plaza.stats.downloads": "\u4E0B\u8F7D\u91CF",
		  "plaza.stats.favorites": "\u6536\u85CF\u91CF",
		  "plaza.stats.stars": "\u661F\u6807\u6570",
		  "plaza.author": "\u53D1\u5E03\u4EBA",
		  "plaza.version": "\u7248\u672C",
		  "plaza.description": "\u63CF\u8FF0",
		  "plaza.install": "\u5B89\u88C5",
		  "plaza.reinstall": "\u91CD\u65B0\u5B89\u88C5",
		  "plaza.uninstall": "\u5378\u8F7D",
		  "plaza.installed": "\u5DF2\u5B89\u88C5",
		  "plaza.installedBadge": "\u5DF2\u5B89\u88C5",
		  "plaza.uninstalled": "\u5DF2\u5378\u8F7D",
		  "plaza.detail": "\u8BE6\u60C5",
		  "plaza.homepage": "\u6253\u5F00\u4E3B\u9875",
		  "plaza.official": "\u5B98\u65B9",
		  "plaza.unsupported": "\u6682\u4E0D\u652F\u6301",
		  "plaza.more": "\u52A0\u8F7D\u66F4\u591A",
		  "plaza.confirmTitle": "\u5B89\u88C5\u786E\u8BA4",
		  "plaza.files": "\u6587\u4EF6\u6E05\u5355",
		  "plaza.fileCount": "\u4E2A\u6587\u4EF6",
		  "plaza.pluginRows": "\u5C06\u52A0\u8F7D\u7684\u63D2\u4EF6\u884C",
		  "plaza.composition": "\u7EC4\u5408\u9884\u89C8",
		  "plaza.enableAfter": "\u5B89\u88C5\u540E\u7ACB\u5373\u53EF\u7528\uFF08\u6A21\u578B\u53EF\u76F4\u63A5\u8C03\u7528\uFF09",
		  "plaza.secretHint": "\u901A\u5E38\u4E3A\u5BC6\u94A5\uFF1B\u53EA\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u63A5\u53E3\u56DE\u663E\u4F1A\u8131\u654F",
		  "plaza.risk.skill": "\u6280\u80FD\u5185\u5BB9\u4F1A\u4F5C\u4E3A\u6A21\u578B\u6307\u4EE4\u52A0\u8F7D\u3002\u5B89\u88C5\u540E\u9ED8\u8BA4\u7981\u7528\uFF0C\u786E\u8BA4\u5185\u5BB9\u65E0\u8BEF\u518D\u542F\u7528\u3002",
		  "plaza.risk.expert": "\u4E13\u5BB6\u9884\u8BBE\u662F\u4E00\u6BB5\u5BBF\u4E3B\u63D2\u4EF6\u7EC4\u5408\uFF0C\u5B89\u88C5\u540E\u4F1A\u5728 DSH \u5185\u6267\u884C\u7B2C\u4E09\u65B9\u4EE3\u7801\u3002\u8BF7\u786E\u8BA4\u4E0B\u65B9\u63D2\u4EF6\u884C\u6765\u6E90\u53EF\u4FE1\u3002",
		  "plaza.risk.connector": "\u8FDE\u63A5\u5668\u4F1A\u4EE5\u672C\u5730\u8FDB\u7A0B\u6216\u8FDC\u7A0B\u670D\u52A1\u65B9\u5F0F\u63A5\u5165\uFF0C\u5E76\u628A\u5DE5\u5177\u66B4\u9732\u7ED9\u6A21\u578B\u3002\u8BF7\u786E\u8BA4\u6765\u6E90\u53EF\u4FE1\u3002",
		  "plaza.risk.plugin": "\u63D2\u4EF6\u4F5C\u4E3A\u5BBF\u4E3B\u6A21\u5757\u5728 DSH \u5185\u8FD0\u884C\uFF0C\u62E5\u6709\u4E0E App \u540C\u7B49\u7684\u6743\u9650\u3002\u5B89\u88C5\u4F1A\u5199\u5165\u5F53\u524D profile \u7684\u63D2\u4EF6\u6E05\u5355\u5E76\u6267\u884C pnpm \u5B89\u88C5\uFF0C\u8BF7\u786E\u8BA4\u6765\u6E90\u4E0E\u4E0B\u65B9\u80FD\u529B\u6E05\u5355\u53EF\u4FE1\u3002",
		  "plaza.pluginPackage": "\u5B89\u88C5\u89C4\u683C",
		  "plaza.pluginCommand": "\u5B89\u88C5\u547D\u4EE4\uFF08\u5F53\u524D profile\uFF09",
		  "plaza.pluginProfile": "\u5F53\u524D profile",
		  "plaza.pluginManaged": "\u684C\u9762\u7AEF profile \u7531 App \u72EC\u5360\u7BA1\u7406\uFF0C\u4E0A\u9762\u8FD9\u6761\u547D\u4EE4\u884C\u4F1A\u88AB CLI \u62D2\u7EDD\uFF1B\u8BF7\u76F4\u63A5\u70B9\u4E0B\u9762\u7684\u300C\u5B89\u88C5\u300D\uFF08\u7B49\u4EF7\u4E8E App \u63D2\u4EF6\u9875\u7684\u64CD\u4F5C\uFF09\u3002",
		  "plaza.pluginUpstreamCommand": "\u4E0A\u6E38\u547D\u4EE4\uFF08\u4EC5\u4F9B\u53C2\u8003\uFF0Cprofile \u53EF\u80FD\u4E0D\u5BF9\uFF09",
		  "plaza.pluginCapabilities": "\u80FD\u529B",
		  "plaza.pluginRedLines": "\u9700\u8981\u4EBA\u5DE5\u786E\u8BA4\u7684\u7EA2\u7EBF\u80FD\u529B",
		  "plaza.pluginEffect": "\u5C06\u5199\u5165\u5F53\u524D profile \u7684\u63D2\u4EF6\u6E05\u5355\u5E76\u6267\u884C pnpm \u5B89\u88C5\uFF0C\u53EF\u80FD\u9700\u8981\u91CD\u542F App \u751F\u6548\u3002",
		  "plaza.submit.title": "\u63D0\u4EA4\u5230\u5E7F\u573A",
		  "plaza.submit.menu": "\u63D0\u4EA4",
		  "plaza.submit.skill": "\u6280\u80FD",
		  "plaza.submit.expert": "\u4E13\u5BB6",
		  "plaza.submit.connector": "MCP",
		  "plaza.submit.plugin": "\u63D2\u4EF6",
		  "plaza.submit.button.skill": "\u63D0\u4EA4\u6280\u80FD",
		  "plaza.submit.button.expert": "\u63D0\u4EA4\u4E13\u5BB6",
		  "plaza.submit.button.connector": "\u63D0\u4EA4 MCP",
		  "plaza.submit.button.plugin": "\u63D0\u4EA4\u63D2\u4EF6",
		  "plaza.submit.pick": "\u9009\u62E9\u672C\u5730\u6761\u76EE",
		  "plaza.submit.pickHint.skill": "\u672C\u673A\u5DF2\u5B89\u88C5\u7684\u6280\u80FD\uFF08\u542B\u5B98\u65B9\u4E0E\u81EA\u5EFA\uFF09",
		  "plaza.submit.pickHint.expert": "\u672C\u673A\u7684\u81EA\u5EFA\u4E0E\u5E7F\u573A\u5B89\u88C5\u7684\u4E13\u5BB6",
		  "plaza.submit.pickHint.connector": "\u672C\u673A\u5DF2\u914D\u7F6E\u7684 MCP \u8FDE\u63A5\u5668",
		  "plaza.submit.pickHint.plugin": "\u5F53\u524D profile \u5DF2\u5B89\u88C5\u7684\u63D2\u4EF6\u5305\uFF08\u63D0\u4EA4\u7684\u662F\u5B83\u7684\u5B89\u88C5\u89C4\u683C\uFF09",
		  "plaza.submit.empty.skill": "\u672C\u673A\u8FD8\u6CA1\u6709\u53EF\u63D0\u4EA4\u7684\u6280\u80FD",
		  "plaza.submit.empty.expert": "\u672C\u673A\u8FD8\u6CA1\u6709\u53EF\u63D0\u4EA4\u7684\u4E13\u5BB6",
		  "plaza.submit.empty.connector": "\u672C\u673A\u8FD8\u6CA1\u6709\u53EF\u63D0\u4EA4\u7684 MCP \u8FDE\u63A5\u5668",
		  "plaza.submit.empty.plugin": "\u5F53\u524D profile \u8FD8\u6CA1\u6709\u53EF\u63D0\u4EA4\u7684\u63D2\u4EF6\u5305",
		  "plaza.submit.name": "\u5C55\u793A\u540D",
		  "plaza.submit.description": "\u7B80\u4ECB",
		  "plaza.submit.tags": "\u6807\u7B7E",
		  "plaza.submit.tagsHint": "\u9017\u53F7\u5206\u9694\uFF0C\u5982\uFF1A\u6548\u7387, \u62A5\u8868",
		  "plaza.submit.go": "\u63D0\u4EA4",
		  "plaza.submit.done": "\u5DF2\u63D0\u4EA4\uFF0C\u6761\u76EE\u5DF2\u8FDB\u5165\u5E7F\u573A\u300C\u6211\u7684\u63D0\u4EA4\u300D\u6E90",
		  "plaza.submit.hintTitle": "\u540E\u7EED\u6307\u5F15",
		  "connectors.testFail": "\u8FDE\u63A5\u5931\u8D25",
		  // ------------------------------------------------------- 插件（profile）
		  "plugins.title": "\u6211\u7684\u63D2\u4EF6",
		  "plugins.profile": "\u5F53\u524D profile",
		  "plugins.dir": "\u5B89\u88C5\u76EE\u5F55",
		  "plugins.unavailable": "\u5F53\u524D\u90E8\u7F72\u6CA1\u6709 profile \u63D2\u4EF6\u7BA1\u7406\u670D\u52A1\uFF08@deepseek-ai/dsh-plugin-manager\uFF09\uFF0C\u4E0B\u9762\u7684\u63D2\u4EF6\u5217\u8868\u53EA\u8BFB\u3002",
		  "plugins.rows": "\u63D2\u4EF6\u884C",
		  "plugins.rowsHint": "\u7531\u8BE5\u63D2\u4EF6\u58F0\u660E\u3001\u5BBF\u4E3B\u52A0\u8F7D\u7684\u884C",
		  "plugins.mineHint": "\u53EA\u663E\u793A\u4F60\u81EA\u5DF1\u5B89\u88C5\u7684\u63D2\u4EF6\uFF08profile \u7684 dependencies\uFF09",
		  "plugins.removable": "\u53EF\u5378\u8F7D",
		  "plugins.readOnly": "\u53EA\u8BFB",
		  "plugins.readOnly.management-required": "\u7531\u5BBF\u4E3B\u7BA1\u7406\uFF0C\u9762\u677F\u4E0D\u80FD\u542F\u505C",
		  "plugins.readOnly.unaddressable": "\u6CA1\u6709\u53EF\u5199\u7684\u914D\u7F6E\u9879\uFF0C\u9762\u677F\u4E0D\u80FD\u542F\u505C",
		  "plugins.rowEnabled": "\u5DF2\u542F\u7528",
		  "plugins.rowDisabled": "\u5DF2\u505C\u7528",
		  "plugins.enable": "\u542F\u7528",
		  "plugins.disable": "\u7981\u7528",
		  "plugins.uninstall": "\u5378\u8F7D",
		  "plugins.detail": "\u8BE6\u60C5",
		  "plugins.detailTitle": "\u63D2\u4EF6\u8BE6\u60C5",
		  "plugins.spec": "\u5B89\u88C5\u6765\u6E90",
		  "plugins.noRows": "\u8BE5\u63D2\u4EF6\u6CA1\u6709\u58F0\u660E\u63D2\u4EF6\u884C",
		  "plugins.overrides": "\u8986\u76D6",
		  "plugins.overridesHint": "\u88AB\u8BE5\u63D2\u4EF6\u5305\u8986\u76D6\u7684\u65E2\u6709\u63D2\u4EF6\u884C",
		  "plugins.rowMissing": "\u672A\u51FA\u73B0\u5728\u63D2\u4EF6\u5217\u8868\u4E2D",
		  "plugins.pendingBuilds": "\u6709\u4F9D\u8D56\u5B89\u88C5\u811A\u672C\u88AB pnpm \u62E6\u622A\u672A\u6267\u884C\uFF0C\u5B89\u88C5\u53EF\u80FD\u4E0D\u5B8C\u6574",
		  "plugins.changed": "\u5DF2\u66F4\u65B0",
		  "plugins.unchanged": "\u672A\u53D1\u751F\u53D8\u5316",
		  "plugins.warnings": "\u8B66\u544A",
		  "plugins.restartRequired": "\u9700\u8981\u91CD\u542F App \u751F\u6548",
		  "plugins.application.applied": "\u5DF2\u751F\u6548",
		  "plugins.application.restart-required": "\u9700\u8981\u91CD\u542F App",
		  "plugins.application.overridden": "\u88AB\u8986\u76D6",
		  "plugins.application.failed": "\u6267\u884C\u5931\u8D25",
		  "plugins.application.cancelled": "\u5DF2\u53D6\u6D88",
		  "plugins.confirmRemove": "\u5C06\u4ECE\u5F53\u524D profile \u79FB\u9664\u8BE5\u63D2\u4EF6\u5305\u5E76\u5378\u8F7D\u5176\u4F9D\u8D56\uFF0C\u786E\u8BA4\uFF1F"
		};
		var en = {
		  "panel.title": "Square",
		  "panel.subtitle": "Skills \xB7 Experts \xB7 Connectors \xB7 Plugins",
		  "panel.search": "Search\u2026",
		  "panel.searchSkills": "Search skills",
		  "panel.searchExperts": "Search experts by name or description",
		  "panel.searchConnectors": "Search connectors",
		  "panel.searchPlugins": "Search plugins",
		  "panel.workspace": "Workspace (optional, for project skills)",
		  "panel.back": "Back to plaza",
		  "panel.disabledSkills": "Skill management is disabled by plugin config (enableSkills=false).",
		  "panel.disabledExperts": "Expert management is disabled by plugin config (enableExperts=false).",
		  "panel.disabledConnectors": "Connector management is disabled by plugin config (enableConnectors=false).",
		  "panel.disabledPlugins": "Plugin management is disabled by plugin config (enablePlugins=false).",
		  "panel.refresh": "Refresh",
		  "panel.loading": "Loading\u2026",
		  "panel.empty": "Nothing here yet",
		  "panel.error": "Something went wrong",
		  "panel.retry": "Retry",
		  "panel.count": "{n} item(s)",
		  "panel.storage.domain": "Persisted",
		  "panel.storage.memory": "In-memory (lost on restart)",
		  "tab.skills": "Skills",
		  "tab.experts": "Experts",
		  "tab.connectors": "Connectors",
		  "tab.plugins": "Plugins",
		  "mine.experts": "My experts",
		  "mine.skills": "My skills",
		  "mine.connectors": "My MCP",
		  "mine.plugins": "My plugins",
		  "action.create": "New",
		  "action.edit": "Edit",
		  "action.delete": "Delete",
		  "action.save": "Save",
		  "action.cancel": "Cancel",
		  "action.close": "Close",
		  "action.more": "More actions",
		  "action.enable": "Enable",
		  "action.disable": "Disable",
		  "action.test": "Test",
		  "action.reconnect": "Reconnect",
		  "action.setDefault": "Set default",
		  "action.duplicate": "Duplicate",
		  "action.detail": "View composition",
		  "action.confirmDelete": "Delete?",
		  "skills.title": "Skills",
		  "skills.create": "Add skill",
		  "skills.createTitle": "New skill",
		  "skills.featured": "Featured skills",
		  "skills.shuffle": "Shuffle",
		  "skills.all": "All",
		  "skills.installed": "Installed",
		  "skills.root": "Install location",
		  "skills.root.user": "User (~/.dsh/skills)",
		  "skills.root.project": "Project (<root>/.dsh/skills)",
		  "skills.add": "Add skill",
		  "skills.import": "Import skill",
		  "skills.importDesc": "Upload .zip / folder / .md",
		  "skills.importAction": "Import",
		  "skills.imported": "Imported",
		  "skills.dropHint": "Drop a file here or click to upload",
		  "skills.dropFormats": ".zip, a folder, or a single .md",
		  "skills.pickZip": "Pick .zip",
		  "skills.pickMd": "Pick .md",
		  "skills.pickFolder": "Pick folder",
		  "skills.autoEnable": "Auto-install non-high-risk (usable by the model right away)",
		  "skills.requirements": "File requirements",
		  "skills.requirementArchive": "A folder or .zip must contain SKILL.md",
		  "skills.requirementMarkdown": "A .md file must carry YAML name and description",
		  "skills.createByAi": "Create with AI",
		  "skills.createByAiDesc": "Hand it to the skill-creator skill in a conversation",
		  "skills.createByAiAction": "Create",
		  "skills.createManual": "Create manually",
		  "skills.createManualDesc": "Fill in name, description and body yourself",
		  "skills.creatorSkill": "skill-creator",
		  "skills.requirementPlaceholder": "Please create a skill that can\u2026",
		  "skills.previewPrompt": "Preview prompt",
		  "skills.creatorMissing": "This deployment has no such skill; a generic prompt will be sent",
		  "skills.sentToSession": "Sent to the current conversation \u2014 switch there to watch it create the skill",
		  "skills.copiedPrompt": "Prompt copied; paste it into the composer and press Enter",
		  "skills.source": "Source",
		  "skills.provider": "Provider",
		  "skills.path": "Path",
		  "skills.readonly": "Read-only (no file on disk)",
		  "skills.disabled": "Disabled",
		  "skills.name": "Name (kebab-case)",
		  "skills.description": "Description",
		  "skills.whenToUse": "When to use",
		  "skills.content": "Body (Markdown)",
		  "skills.filter.all": "All",
		  "skills.filter.project": "Project",
		  "skills.filter.user": "User",
		  "skills.filter.custom": "Custom",
		  "skills.filter.builtin": "Bundled",
		  "skills.filter.runtime": "Runtime",
		  "skills.deleteHint": "Deletion moves the skill into <root>/.system/.trash; restore manually.",
		  "experts.official": "Official presets",
		  "experts.title": "My experts",
		  "experts.tab.mine": "My experts",
		  "experts.tab.official": "Official presets",
		  "experts.active": "Active",
		  "experts.officialHint": "Official Agent Presets: choose one before a session starts; running sessions keep the composition they began with.",
		  "experts.skillUnit": "skills",
		  "experts.connectorUnit": "connectors",
		  "experts.create": "New expert",
		  "experts.name": "Name",
		  "experts.icon": "Icon (emoji)",
		  "experts.description": "Summary",
		  "experts.tags": "Tags (comma separated)",
		  "experts.prompt": "System prompt",
		  "experts.capabilities": "Capabilities",
		  "experts.boundSkills": "Bound skills",
		  "experts.boundConnectors": "Bound connectors",
		  "experts.default": "Default",
		  "experts.broken": "Activation failed",
		  "experts.composition": "Composition (read-only)",
		  "experts.duplicateHint": "A copy of an official preset only copies display metadata; the composition is rebuilt from the capability switches.",
		  "cap.shell": "Shell",
		  "cap.fs": "Files",
		  "cap.skills": "Skills",
		  "cap.todo": "Todo",
		  "cap.web": "Web",
		  "cap.ask": "Ask user",
		  "cap.subagents": "Subagents",
		  "cap.compaction": "Compaction",
		  "connectors.title": "Connectors (MCP)",
		  "connectors.create": "Custom connector",
		  "connectors.createTitle": "Add connector",
		  "connectors.label": "Display name",
		  "connectors.serverName": "serverName (mcp__<name>__<tool>)",
		  "connectors.transport": "Transport",
		  "connectors.transport.stdio": "stdio (local process)",
		  "connectors.transport.http": "streamable-http (remote service)",
		  "connectors.command": "Command",
		  "connectors.args": "Arguments (one per line)",
		  "connectors.env": "Environment (KEY=VALUE per line)",
		  "connectors.cwd": "Working directory",
		  "connectors.url": "URL",
		  "connectors.headers": "Headers (KEY=VALUE per line)",
		  "connectors.timeout": "Tool call timeout (ms)",
		  "connectors.failOnStartup": "Fail on startup error",
		  "connectors.tools": "Tools",
		  "connectors.state.disabled": "Disabled",
		  "connectors.state.connecting": "Connecting",
		  "connectors.state.connected": "Connected",
		  "connectors.state.error": "Error",
		  "connectors.profile": "Configured in profile (read-only)",
		  "connectors.unavailable": "This runtime cannot resolve @deepseek-ai/dsh-mcp-client; connectors are read-only.",
		  "connectors.secretsHint": "Secrets echo as \u2022\u2022\u2022\u2022\u2022\u2022; leave the line untouched to keep the value.",
		  "connectors.testOk": "Connection OK",
		  "plaza.title": "Plaza",
		  "plaza.source.all": "All sources",
		  "plaza.sort.default": "Default",
		  "plaza.sort.hot": "Popular",
		  "plaza.sort.new": "Newest",
		  "plaza.stats.downloads": "Downloads",
		  "plaza.stats.favorites": "Favorites",
		  "plaza.stats.stars": "Stars",
		  "plaza.author": "Publisher",
		  "plaza.version": "Version",
		  "plaza.description": "Description",
		  "plaza.install": "Install",
		  "plaza.reinstall": "Reinstall",
		  "plaza.uninstall": "Uninstall",
		  "plaza.installed": "Installed",
		  "plaza.installedBadge": "Installed",
		  "plaza.uninstalled": "Uninstalled",
		  "plaza.detail": "Details",
		  "plaza.homepage": "Open homepage",
		  "plaza.official": "Official",
		  "plaza.unsupported": "Unsupported",
		  "plaza.more": "Load more",
		  "plaza.confirmTitle": "Confirm install",
		  "plaza.files": "Files",
		  "plaza.fileCount": "file(s)",
		  "plaza.pluginRows": "Plugin rows to load",
		  "plaza.composition": "Composition preview",
		  "plaza.enableAfter": "Enable right after install (model usable)",
		  "plaza.secretHint": "Usually a secret; stored locally and redacted in responses",
		  "plaza.risk.skill": "Skill content is loaded as model instructions. It installs disabled \u2014 enable it only after reviewing.",
		  "plaza.risk.expert": "A preset is a host plugin composition: installing runs third-party code inside DSH. Review the rows below.",
		  "plaza.risk.connector": "A connector attaches a local process or remote service and exposes its tools to the model.",
		  "plaza.risk.plugin": "A plugin runs as a host module inside DSH with the same privileges as the app. Installing writes it into the current profile and runs pnpm; review the source and the capabilities below.",
		  "plaza.pluginPackage": "Install spec",
		  "plaza.pluginCommand": "Install command (current profile)",
		  "plaza.pluginProfile": "Current profile",
		  "plaza.pluginManaged": "The desktop profile is managed exclusively by the app; the CLI refuses that command. Use the Install button below instead (same operation as the app\u2019s Plugins page).",
		  "plaza.pluginUpstreamCommand": "Upstream command (reference only; profile may differ)",
		  "plaza.pluginCapabilities": "Capabilities",
		  "plaza.pluginRedLines": "Red-line capabilities needing manual review",
		  "plaza.pluginEffect": "Writes into the current profile plugin list and runs pnpm install; the app may need a restart.",
		  "plaza.submit.title": "Submit to plaza",
		  "plaza.submit.menu": "Submit",
		  "plaza.submit.skill": "skill",
		  "plaza.submit.expert": "expert",
		  "plaza.submit.connector": "MCP",
		  "plaza.submit.plugin": "plugin",
		  "plaza.submit.button.skill": "Submit skill",
		  "plaza.submit.button.expert": "Submit expert",
		  "plaza.submit.button.connector": "Submit MCP",
		  "plaza.submit.button.plugin": "Submit plugin",
		  "plaza.submit.pick": "Pick a local item",
		  "plaza.submit.pickHint.skill": "Skills installed on this machine (official & custom)",
		  "plaza.submit.pickHint.expert": "Local and plaza-installed experts",
		  "plaza.submit.pickHint.connector": "MCP connectors configured on this machine",
		  "plaza.submit.pickHint.plugin": "Plugins installed in this profile (its install spec is submitted)",
		  "plaza.submit.empty.skill": "No local skills to submit yet",
		  "plaza.submit.empty.expert": "No local experts to submit yet",
		  "plaza.submit.empty.connector": "No local MCP connectors to submit yet",
		  "plaza.submit.empty.plugin": "No plugins installed in this profile to submit yet",
		  "plaza.submit.name": "Display name",
		  "plaza.submit.description": "Description",
		  "plaza.submit.tags": "Tags",
		  "plaza.submit.tagsHint": "Comma separated, e.g. efficiency, reports",
		  "plaza.submit.go": "Submit",
		  "plaza.submit.done": 'Submitted \u2014 the item now appears in the plaza "my submissions" source',
		  "plaza.submit.hintTitle": "Next steps",
		  "connectors.testFail": "Connection failed",
		  // -------------------------------------------------- plugins (profile)
		  "plugins.title": "My plugins",
		  "plugins.profile": "Current profile",
		  "plugins.dir": "Install directory",
		  "plugins.unavailable": "This deployment has no profile plugin management service (@deepseek-ai/dsh-plugin-manager); the list below is read-only.",
		  "plugins.rows": "plugin rows",
		  "plugins.rowsHint": "Rows declared by this plugin and loaded by the host",
		  "plugins.mineHint": "Only plugins you installed (profile dependencies)",
		  "plugins.removable": "Removable",
		  "plugins.readOnly": "Read-only",
		  "plugins.readOnly.management-required": "Managed by the host; the panel cannot toggle it",
		  "plugins.readOnly.unaddressable": "No writable configuration entry; the panel cannot toggle it",
		  "plugins.rowEnabled": "Enabled",
		  "plugins.rowDisabled": "Disabled",
		  "plugins.enable": "Enable",
		  "plugins.disable": "Disable",
		  "plugins.uninstall": "Uninstall",
		  "plugins.detail": "Details",
		  "plugins.detailTitle": "Plugin details",
		  "plugins.spec": "Install source",
		  "plugins.noRows": "This plugin declares no plugin rows",
		  "plugins.overrides": "Overrides",
		  "plugins.overridesHint": "Existing plugin rows overridden by this bundle",
		  "plugins.rowMissing": "Not present in the plugin list",
		  "plugins.pendingBuilds": "Some dependency install scripts were blocked by pnpm and never ran; the install may be incomplete",
		  "plugins.changed": "Updated",
		  "plugins.unchanged": "No change",
		  "plugins.warnings": "Warnings",
		  "plugins.restartRequired": "Restart the app to apply",
		  "plugins.application.applied": "Applied",
		  "plugins.application.restart-required": "Restart required",
		  "plugins.application.overridden": "Overridden",
		  "plugins.application.failed": "Failed",
		  "plugins.application.cancelled": "Cancelled",
		  "plugins.confirmRemove": "This removes the bundle from the current profile and uninstalls its dependencies. Continue?"
		};
		function createTranslator(ctx, onLocaleChange) {
		  try {
		    ctx.locale.register(NS, { zh, en });
		  } catch (error) {
		    console.warn("[square] locale.register failed", error);
		  }
		  if (onLocaleChange !== void 0) {
		    try {
		      ctx.locale.subscribe?.(onLocaleChange);
		    } catch {
		    }
		  }
		  const local = (key, vars) => format(zh[key] ?? key, vars);
		  try {
		    const bound = ctx.locale.bind(NS);
		    return (key, vars) => {
		      try {
		        const value = bound(key, vars);
		        return value === key ? local(key, vars) : value;
		      } catch {
		        return local(key, vars);
		      }
		    };
		  } catch {
		    return local;
		  }
		}
		function format(template, vars) {
		  if (vars === void 0) return template;
		  return template.replace(
		    /\{(\w+)\}/g,
		    (match, key) => Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
		  );
		}

		// src/client/styles.ts
		var STYLE_ID = "dsh-squares/client.css";
		var CSS = `
		.adk-root {
		  --adk-page: var(--dsw-alias-bg-l1, #f5f6f8);
		  --adk-surface: var(--dsw-alias-bg-base, #ffffff);
		  --adk-line: var(--dsw-alias-border-l1, #e9eaee);
		  --adk-line-strong: var(--dsw-alias-border-l2, #dcdee3);
		  --adk-text: var(--dsw-alias-label-primary, #1f2329);
		  --adk-muted: var(--dsw-alias-label-secondary, #8a8f99);
		  --adk-body: var(--dsw-alias-label-tertiary, #5b6068);
		  --adk-chip: var(--dsw-alias-bg-l2, #f2f3f5);
		  --adk-ink: #1f2329;
		  --adk-danger: var(--dsw-alias-label-danger, #e5484d);
		  --adk-ok: var(--dsw-alias-label-success, #16a34a);
		  --adk-radius: 14px;
		  display: flex;
		  flex-direction: column;
		  height: 100%;
		  min-height: 0;
		  color: var(--adk-text);
		  background: var(--adk-page);
		  font-size: 13px;
		  line-height: 1.5;
		}
		.adk-root * { box-sizing: border-box; }

		/* ---------------------------------------------------------------- \u9876\u680F */
		.adk-top {
		  display: flex;
		  align-items: center;
		  gap: 10px;
		  padding: 14px 20px 10px;
		  flex: none;
		}
		.adk-tabs { display: inline-flex; align-items: center; gap: 2px; }
		.adk-tab {
		  display: inline-flex;
		  align-items: center;
		  gap: 7px;
		  padding: 8px 15px;
		  border: none;
		  border-radius: 999px;
		  background: transparent;
		  color: var(--adk-body);
		  font-size: 13.5px;
		  cursor: pointer;
		  transition: background 0.15s, color 0.15s;
		}
		.adk-tab:hover { background: var(--adk-chip); }
		.adk-tab[data-active="true"] { background: var(--adk-ink); color: #fff; }
		.adk-tab[data-active="true"]:hover { background: var(--adk-ink); }
		.adk-top-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }

		.adk-back {
		  display: inline-flex;
		  align-items: center;
		  gap: 5px;
		  padding: 8px 14px;
		  border: 1px solid var(--adk-line);
		  border-radius: 999px;
		  background: var(--adk-surface);
		  color: var(--adk-text);
		  font-size: 13px;
		  cursor: pointer;
		  white-space: nowrap;
		  transition: background 0.15s, border-color 0.15s;
		}
		.adk-back:hover { background: var(--adk-chip); }
		.adk-page-title { font-size: 15px; font-weight: 600; color: var(--adk-text); }

		.adk-search {
		  display: flex;
		  align-items: center;
		  gap: 8px;
		  min-width: 220px;
		  padding: 8px 14px;
		  border: 1px solid transparent;
		  border-radius: 999px;
		  background: var(--adk-chip);
		  color: var(--adk-muted);
		}
		.adk-search:focus-within { border-color: var(--adk-line-strong); background: var(--adk-surface); }
		.adk-search input {
		  flex: 1;
		  min-width: 0;
		  border: none;
		  outline: none;
		  background: transparent;
		  color: var(--adk-text);
		  font-size: 13px;
		  font-family: inherit;
		}
		.adk-search input::placeholder { color: var(--adk-muted); }

		.adk-action {
		  display: inline-flex;
		  align-items: center;
		  gap: 7px;
		  padding: 8px 14px;
		  border: 1px solid var(--adk-line);
		  border-radius: 999px;
		  background: var(--adk-surface);
		  color: var(--adk-text);
		  font-size: 13px;
		  cursor: pointer;
		  white-space: nowrap;
		  transition: background 0.15s, border-color 0.15s;
		}
		.adk-action:hover:not(:disabled) { background: var(--adk-chip); }
		.adk-action:disabled { opacity: 0.45; cursor: not-allowed; }
		.adk-action[data-primary="true"] { background: var(--adk-ink); color: #fff; border-color: var(--adk-ink); }
		.adk-action[data-primary="true"]:hover:not(:disabled) { opacity: 0.88; background: var(--adk-ink); }
		.adk-action[data-danger="true"] { color: var(--adk-danger); }

		/* ------------------------------------------------------------ \u63D0\u793A\u6761 */
		.adk-banner {
		  margin: 0 20px 10px;
		  padding: 9px 12px;
		  border: 1px solid var(--adk-line);
		  border-radius: 10px;
		  background: var(--adk-surface);
		  color: var(--adk-body);
		  font-size: 12.5px;
		  white-space: pre-wrap;
		}
		.adk-banner[data-tone="error"] { border-color: var(--adk-danger); color: var(--adk-danger); }

		/* -------------------------------------------------------------- \u4E3B\u4F53 */
		.adk-body { flex: 1; min-height: 0; overflow: auto; padding: 4px 20px 32px; }
		.adk-section { margin-bottom: 26px; }
		.adk-section-head { display: flex; align-items: center; gap: 12px; margin: 8px 0 12px; }
		.adk-section-title { font-size: 17px; font-weight: 600; letter-spacing: 0.2px; }
		.adk-section-count { font-size: 12px; color: var(--adk-muted); }
		.adk-section-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }

		.adk-subtabs { display: flex; align-items: center; gap: 16px; }
		.adk-subtab {
		  padding: 2px 0;
		  border: none;
		  background: none;
		  color: var(--adk-muted);
		  font-size: 13.5px;
		  cursor: pointer;
		}
		.adk-subtab[data-active="true"] { color: var(--adk-text); font-weight: 600; }

		.adk-sort { display: inline-flex; padding: 2px; border-radius: 9px; background: var(--adk-chip); }
		.adk-sort button {
		  padding: 4px 11px;
		  border: none;
		  border-radius: 7px;
		  background: transparent;
		  color: var(--adk-body);
		  font-size: 12.5px;
		  cursor: pointer;
		}
		.adk-sort button[data-active="true"] { background: var(--adk-surface); color: var(--adk-text); font-weight: 600; }

		.adk-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 14px; scrollbar-width: thin; }
		.adk-chips::-webkit-scrollbar { height: 6px; }
		.adk-chips::-webkit-scrollbar-thumb { background: var(--adk-line-strong); border-radius: 3px; }
		.adk-chip {
		  flex: none;
		  padding: 6px 13px;
		  border: 1px solid transparent;
		  border-radius: 9px;
		  background: var(--adk-chip);
		  color: var(--adk-body);
		  font-size: 12.5px;
		  cursor: pointer;
		  white-space: nowrap;
		}
		.adk-chip:hover { background: var(--adk-line); }
		.adk-chip[data-active="true"] { background: var(--adk-ink); color: #fff; }

		/* -------------------------------------------------------------- \u5361\u7247 */
		.adk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(296px, 1fr)); gap: 14px; }
		.adk-strip { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; }
		.adk-strip > .adk-card { flex: none; width: 316px; }
		.adk-strip::-webkit-scrollbar { height: 6px; }
		.adk-strip::-webkit-scrollbar-thumb { background: var(--adk-line-strong); border-radius: 3px; }

		.adk-card {
		  position: relative;
		  display: flex;
		  flex-direction: column;
		  gap: 8px;
		  padding: 15px 16px 14px;
		  border: 1px solid var(--adk-line);
		  border-radius: var(--adk-radius);
		  background: var(--adk-surface);
		  transition: box-shadow 0.15s, border-color 0.15s;
		}
		.adk-card:hover { border-color: var(--adk-line-strong); box-shadow: 0 6px 20px rgba(16, 24, 40, 0.07); }
		.adk-card[data-broken="true"] { border-color: var(--adk-danger); }
		.adk-card-head { display: flex; align-items: center; gap: 12px; }
		.adk-card-hit {
		  display: flex;
		  align-items: center;
		  gap: 12px;
		  min-width: 0;
		  flex: 1;
		  padding: 0;
		  border: none;
		  background: none;
		  text-align: left;
		  font: inherit;
		  cursor: pointer;
		  color: var(--adk-text);
		}
		.adk-card-hitblock { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
		.adk-card-title-line { display: flex; align-items: center; gap: 7px; min-width: 0; }
		.adk-card-hit .adk-card-title-text { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
		.adk-card-hit:hover .adk-card-title-text { text-decoration: underline; text-underline-offset: 3px; }
		.adk-card-hit .adk-card-meta { margin-top: 0; }
		.adk-card-titleblock { min-width: 0; flex: 1; }
		.adk-card-title {
		  display: flex;
		  align-items: center;
		  gap: 7px;
		  font-size: 14px;
		  font-weight: 600;
		  color: var(--adk-text);
		}
		.adk-card-title-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.adk-card-title .adk-menu-wrap { flex: none; margin-left: auto; }
		.adk-card-title .adk-menu-trigger { width: 24px; height: 24px; }
		.adk-card-meta {
		  margin-top: 3px;
		  font-size: 12px;
		  line-height: 1;
		  color: var(--adk-muted);
		  overflow: hidden;
		  text-overflow: ellipsis;
		  white-space: nowrap;
		  display: flex;
		  align-items: center;
		}
		.adk-card-meta span { display: inline-flex; align-items: center; gap: 3px; line-height: 1; }
		.adk-card-meta span + span::before { content: '\xB7'; margin: 0 5px; opacity: 0.6; }
		.adk-card-meta span svg { flex: none; opacity: 0.85; }
		/* \u5361\u7247/\u5F39\u7A97\u5185\u7684\u63D0\u793A\u6761\uFF1A\u8D34\u9F50\u7236\u5BB9\u5668\uFF0C\u4E0D\u518D\u5403 20px \u5916\u8FB9\u8DDD\u3002 */
		.adk-card .adk-banner,
		.adk-modal .adk-banner { margin: 0 0 10px; }
		.adk-card-desc {
		  font-size: 12.5px;
		  color: var(--adk-body);
		  line-height: 1.6;
		  display: -webkit-box;
		  -webkit-line-clamp: 3;
		  -webkit-box-orient: vertical;
		  overflow: hidden;
		  word-break: break-word;
		}
		.adk-card-desc[data-lines="2"] { -webkit-line-clamp: 2; }
		.adk-tile {
		  display: grid;
		  place-items: center;
		  width: 40px;
		  height: 40px;
		  flex: none;
		  border-radius: 11px;
		  background: var(--adk-chip);
		  font-size: 20px;
		  line-height: 1;
		  overflow: hidden;
		}
		.adk-tile svg { width: 20px; height: 20px; }
		.adk-tile[data-tone="0"] { background: #eef2ff; }
		.adk-tile[data-tone="1"] { background: #fef3e7; }
		.adk-tile[data-tone="2"] { background: #e8f7ef; }
		.adk-tile[data-tone="3"] { background: #fdeef2; }
		.adk-tile[data-tone="4"] { background: #eef7fb; }
		.adk-tile[data-tone="5"] { background: #f3eefc; }


		.adk-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; padding-top: 4px; }
		.adk-tag {
		  padding: 3px 9px;
		  border-radius: 7px;
		  background: var(--adk-chip);
		  color: var(--adk-body);
		  font-size: 11.5px;
		  white-space: nowrap;
		}
		.adk-tag[data-tone="ok"] { color: var(--adk-ok); }
		.adk-tag[data-tone="error"] { color: var(--adk-danger); }
		.adk-tag[data-tone="accent"] { color: var(--adk-ink); background: var(--adk-line); }

		/* \u5361\u7247\u5185\u5C55\u5F00\u7684\u63D2\u4EF6\u884C\uFF1A\u6BD4\u5361\u7247\u8F7B\u4E00\u7EA7\uFF08\u9875\u9762\u5E95\u8272 + \u66F4\u5C0F\u5706\u89D2\uFF09\u3002 */
		.adk-rows { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
		.adk-row {
		  display: flex;
		  flex-direction: column;
		  gap: 6px;
		  padding: 9px 11px;
		  border: 1px solid var(--adk-line);
		  border-radius: 10px;
		  background: var(--adk-page);
		}
		.adk-row-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
		.adk-row-head .adk-check { min-width: 0; }
		.adk-row-title {
		  min-width: 0;
		  overflow: hidden;
		  font-size: 12.5px;
		  font-weight: 600;
		  color: var(--adk-text);
		  text-overflow: ellipsis;
		  white-space: nowrap;
		}
		.adk-row-head .adk-mono {
		  flex: none;
		  margin-left: auto;
		  max-width: 46%;
		  overflow: hidden;
		  text-overflow: ellipsis;
		  white-space: nowrap;
		}

		/* -------------------------------------------------------- \u6EA2\u51FA\u83DC\u5355 */
		.adk-menu-wrap { position: relative; flex: none; margin-left: 6px; }
		.adk-caret { margin-left: 2px; font-size: 10px; opacity: 0.8; }
		.adk-menu-wrap .adk-action .adk-caret { display: inline; }
		.adk-menu-trigger {
		  display: grid;
		  place-items: center;
		  width: 28px;
		  height: 28px;
		  border: 1px solid transparent;
		  border-radius: 8px;
		  background: transparent;
		  color: var(--adk-muted);
		  cursor: pointer;
		}
		.adk-menu-trigger:hover { background: var(--adk-chip); color: var(--adk-text); }
		.adk-menu {
		  position: absolute;
		  right: 0;
		  top: 32px;
		  z-index: 30;
		  display: flex;
		  flex-direction: column;
		  min-width: 150px;
		  padding: 5px;
		  border: 1px solid var(--adk-line);
		  border-radius: 11px;
		  background: var(--adk-surface);
		  box-shadow: 0 12px 32px rgba(16, 24, 40, 0.14);
		}
		/* \u9876\u680F\u300C\u63D0\u4EA4\u300D\u4E0B\u62C9\u7B49\u7A84\u83DC\u5355\u3002 */
		.adk-menu.adk-menu-compact { min-width: 0; width: max-content; max-width: 180px; }
		.adk-menu-compact button { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
		.adk-menu-icon { display: inline-flex; align-items: center; flex: none; color: var(--adk-muted); }
		.adk-menu button {
		  padding: 8px 10px;
		  border: none;
		  border-radius: 7px;
		  background: none;
		  color: var(--adk-text);
		  font-size: 12.5px;
		  text-align: left;
		  cursor: pointer;
		}
		.adk-menu button:hover { background: var(--adk-chip); }
		.adk-menu button[data-danger="true"] { color: var(--adk-danger); }

		/* \u5361\u7247\u5185\u7684\u4E0B\u62C9\u83DC\u5355\uFF1A\u56FA\u5B9A\u7A84\u7248\uFF08100px\uFF09\u3002 */
		.adk-card-head .adk-menu,
		.adk-card-title .adk-menu,
		.adk-card-hit .adk-menu {
		  min-width: 0;
		  width: 100px;
		}
		.adk-card-head .adk-menu button,
		.adk-card-title .adk-menu button,
		.adk-card-hit .adk-menu button {
		  padding: 6px 10px;
		  white-space: nowrap;
		}

		/* ------------------------------------------------------ \u72B6\u6001\u4E0E\u7A7A\u6001 */
		.adk-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--adk-muted); }
		.adk-dot[data-state="connected"] { background: var(--adk-ok); }
		.adk-dot[data-state="error"] { background: var(--adk-danger); }
		.adk-dot[data-state="connecting"] { background: #d4a017; }
		.adk-empty {
		  display: flex;
		  flex-direction: column;
		  align-items: center;
		  gap: 6px;
		  padding: 36px 0;
		  color: var(--adk-muted);
		  font-size: 13px;
		}
		.adk-loading { min-height: 220px; display: flex; align-items: center; justify-content: center; color: var(--adk-muted); transform: translateY(120px); }
		.adk-detail-desc {
		  margin-top: 2px;
		  font-size: 12.5px;
		  line-height: 1.7;
		  color: var(--adk-body);
		  word-break: break-word;
		  white-space: pre-line;
		  max-height: 180px;
		  overflow-y: auto;
		}
		.adk-detail-meta {
		  display: flex;
		  flex-wrap: wrap;
		  align-items: center;
		  gap: 6px 0;
		  margin: 2px 0 14px;
		  font-size: 12px;
		  color: var(--adk-muted);
		}
		.adk-detail-meta span { display: inline-flex; align-items: center; gap: 3px; line-height: 1; }
		.adk-detail-meta span + span::before { content: '\xB7'; margin: 0 5px; opacity: 0.6; }
		.adk-detail-meta span svg { flex: none; opacity: 0.85; }
		.adk-spin { animation: adk-spin 0.9s linear infinite; }
		@keyframes adk-spin { to { transform: rotate(360deg); } }
		.adk-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--adk-muted); word-break: break-all; }

		/* ------------------------------------------------------------- \u5F39\u7A97 */
		.adk-overlay {
		  position: fixed;
		  inset: 0;
		  z-index: 60;
		  display: flex;
		  align-items: center;
		  justify-content: center;
		  background: rgba(17, 20, 24, 0.35);
		}
		.adk-modal {
		  width: min(680px, 92vw);
		  max-height: 86vh;
		  overflow: auto;
		  padding: 20px;
		  border-radius: 16px;
		  background: var(--adk-surface);
		  color: var(--adk-text);
		  font-size: 13px;
		  box-shadow: 0 24px 60px rgba(16, 24, 40, 0.24);
		}
		.adk-modal-title { margin-bottom: 14px; font-size: 16px; font-weight: 600; }
		.adk-modal-subtitle { margin-top: 3px; font-size: 11.5px; font-weight: 400; line-height: 1.6; color: var(--adk-muted); }
		.adk-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
		.adk-field > label { font-size: 12px; color: var(--adk-muted); }
		.adk-input, .adk-select, .adk-textarea {
		  width: 100%;
		  padding: 8px 10px;
		  border: 1px solid var(--adk-line);
		  border-radius: 9px;
		  background: var(--adk-surface);
		  color: var(--adk-text);
		  font-size: 13px;
		  font-family: inherit;
		  outline: none;
		}
		.adk-input:focus, .adk-select:focus, .adk-textarea:focus { border-color: var(--adk-line-strong); }
		.adk-textarea { min-height: 92px; resize: vertical; }
		.adk-textarea[data-tall="true"] { min-height: 150px; }
		.adk-checkrow { display: flex; flex-wrap: wrap; gap: 10px 14px; max-height: 168px; overflow: auto; }
		.adk-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--adk-body); cursor: pointer; }
		.adk-inline { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
		.adk-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
		.adk-hint { font-size: 11.5px; color: var(--adk-muted); }
		.adk-pre {
		  max-height: 320px;
		  overflow: auto;
		  padding: 12px;
		  border: 1px solid var(--adk-line);
		  border-radius: 10px;
		  background: var(--adk-chip);
		  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		  font-size: 11.5px;
		  line-height: 1.6;
		  white-space: pre-wrap;
		}
		/* ------------------------------------------------- \u9009\u62E9\u5361 / \u4E0A\u4F20 / \u7EC4\u5408 */
		.adk-choices { display: flex; flex-direction: column; gap: 10px; }
		.adk-choice {
		  display: grid;
		  grid-template-columns: 24px 1fr;
		  grid-template-rows: auto auto;
		  gap: 2px 12px;
		  align-items: center;
		  padding: 14px 16px;
		  border: 1px solid var(--adk-line);
		  border-radius: 12px;
		  background: var(--adk-surface);
		  color: var(--adk-text);
		  text-align: left;
		  cursor: pointer;
		  transition: border-color 0.15s, background 0.15s;
		}
		.adk-choice:hover { border-color: var(--adk-line-strong); background: var(--adk-chip); }
		.adk-choice > svg { grid-row: 1 / span 2; color: var(--adk-body); }
		.adk-choice-title { font-size: 13.5px; font-weight: 600; }
		.adk-choice-desc { font-size: 12px; color: var(--adk-muted); }

		.adk-drop {
		  display: flex;
		  flex-direction: column;
		  align-items: center;
		  gap: 6px;
		  padding: 26px 16px;
		  border: 1px dashed var(--adk-line-strong);
		  border-radius: 12px;
		  background: var(--adk-surface);
		  color: var(--adk-body);
		  text-align: center;
		}
		.adk-drop[data-over="true"] { border-color: var(--adk-ink); background: var(--adk-chip); }
		.adk-drop-title { font-size: 13.5px; font-weight: 600; color: var(--adk-text); }
		.adk-requirements { margin-top: 16px; font-size: 12.5px; color: var(--adk-body); line-height: 1.8; }

		.adk-composer {
		  display: flex;
		  align-items: center;
		  gap: 10px;
		  padding: 8px 12px;
		  border: 1px solid var(--adk-line);
		  border-radius: 999px;
		  background: var(--adk-surface);
		}
		.adk-composer:focus-within { border-color: var(--adk-line-strong); }
		.adk-skill-chip {
		  display: inline-flex;
		  align-items: center;
		  gap: 5px;
		  padding: 4px 10px;
		  border-radius: 999px;
		  background: var(--adk-chip);
		  color: var(--adk-text);
		  font-size: 12px;
		  white-space: nowrap;
		  flex: none;
		}
		.adk-composer-input {
		  flex: 1;
		  min-width: 0;
		  border: none;
		  outline: none;
		  background: transparent;
		  color: var(--adk-text);
		  font-size: 13.5px;
		  font-family: inherit;
		}
		`;
		function injectStyles() {
		  if (typeof document === "undefined") return;
		  const selector = `style[data-plugin-css="${STYLE_ID}"]`;
		  if (document.querySelector(selector) !== null) return;
		  const tag = document.createElement("style");
		  tag.dataset.plugin = "dsh-squares";
		  tag.dataset.pluginCss = STYLE_ID;
		  tag.textContent = CSS;
		  document.head.appendChild(tag);
		}

		// src/client/index.tsx
		var import_jsx_runtime9 = require("react/jsx-runtime");
		var PANEL_ID = "square";
		var inject = ["slots", "locale"];
		function PanelIcon({ size }) {
		  const edge = typeof size === "number" && size > 0 ? size : 16;
		  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
		    "svg",
		    {
		      width: edge,
		      height: edge,
		      viewBox: "0 0 16 16",
		      fill: "none",
		      stroke: "currentColor",
		      strokeWidth: "1.2",
		      strokeLinecap: "round",
		      strokeLinejoin: "round",
		      "aria-hidden": "true",
		      children: [
		        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("rect", { x: "1.5", y: "3", width: "13", height: "10", rx: "2" }),
		        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M5.5 3v10" }),
		        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M8.2 6.4h4.2M8.2 9.6h4.2" })
		      ]
		    }
		  );
		}
		function apply(ctx) {
		  injectStyles();
		  const t = createTranslator(ctx);
		  ctx.slots.inject(
		    "sidebar.panellist",
		    () => ctx.slots.register(
		      {
		        name: "sidebar.panellist",
		        id: PANEL_ID,
		        order: 30,
		        label: () => t("panel.title"),
		        locale: NS
		      },
		      PanelIcon
		    )
		  );
		  ctx.slots.inject(
		    "main",
		    () => ctx.slots.register(
		      {
		        name: "main",
		        key: PANEL_ID,
		        locale: NS
		      },
		      () => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SquarePage, { ctx, t })
		    )
		  );
		}
		return module.exports;
	}
});
