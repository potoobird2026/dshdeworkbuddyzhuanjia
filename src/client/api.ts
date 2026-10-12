/**
 * 面板 → 宿主的数据面客户端。
 *
 * 关键约定：**文档相对路径**（无前导斜杠）。宿主把 GUI 以 `<base href="./">`
 * 提供给子路径部署，根绝对路径 `/api/...` 会逃出该前缀；桌面端
 * `dsh-app://app/` 的协议处理器同样按文档相对路径解析后再转发给宿主 HTTP 服务，
 * 因此这一种写法在 Web 端与桌面端都正确。
 */

import type {
  Capabilities,
  ConnectorRecord,
  ConnectorRow,
  ConnectorStatus,
  DeckStatus,
  ExpertRecord,
  PluginChangeResult,
  PluginsView,
  PresetRow,
  ProfileConnectorRow,
  SkillDetail,
  SkillRow,
} from '../types.js';

/** 路由基址（与宿主 config.routePrefix 对应，必须无前导斜杠）。 */
export const API_BASE = 'api/dsh-squares';

/** 接口错误。 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 请求选项。 */
interface RequestInit_ {
  method?: 'GET' | 'POST';
  query?: Record<string, string | undefined>;
  body?: unknown;
}

/** 发一次 JSON 请求。 */
async function request<T>(path: string, init: RequestInit_ = {}): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  const query = search.toString();
  const url = `${API_BASE}${path}${query === '' ? '' : `?${query}`}`;
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text === '' ? {} : JSON.parse(text);
  } catch {
    payload = { error: text };
  }
  if (!response.ok) {
    const record = payload as { error?: unknown; code?: unknown };
    throw new ApiError(
      typeof record.error === 'string' ? record.error : `HTTP ${String(response.status)}`,
      response.status,
      typeof record.code === 'string' ? record.code : undefined,
    );
  }
  return payload as T;
}

/** 能力快照响应。 */
export interface CapabilitiesResponse {
  panelId: string;
  routePrefix: string;
  capabilities: Capabilities;
  notes: string[];
  storage: 'domain' | 'memory';
  ui: { skills: boolean; experts: boolean; connectors: boolean; plugins?: boolean; plaza?: boolean };
}

/** 技能列表响应。 */
export interface SkillsResponse {
  cwd: string;
  complete: boolean;
  skills: SkillRow[];
}

/** 专家列表响应。 */
export interface ExpertsResponse {
  official: PresetRow[];
  mine: ExpertRecord[];
  defaultId?: string;
  broken: Record<string, string>;
}

/** 专家详情响应。 */
export interface ExpertReadResponse {
  mine?: ExpertRecord;
  official?: {
    id: string;
    name?: string;
    description?: string;
    isDefault: boolean;
    broken?: string;
    compositionYaml?: string;
  };
}

/** 连接器列表响应。 */
export interface ConnectorsResponse {
  connectors: ConnectorRow[];
  profileConfigured: ProfileConnectorRow[];
  available: boolean;
}

/** 连接器写操作响应。 */
export interface ConnectorWriteResponse {
  connector: ConnectorRecord;
  status: ConnectorStatus;
}

/** 测试响应。 */
export interface ConnectorTestResponse {
  ok: boolean;
  tools: string[];
  error?: string;
}

/** 广场：源状态。 */
export interface CatalogSourceStatus {
  id: string;
  label: string;
  kind: 'skill' | 'expert' | 'connector' | 'plugin' | 'all';
  enabled: boolean;
  installable: boolean;
  ok: boolean;
  lastError?: string;
  fetchedAt?: string;
}

/** 广场：归一化条目。 */
export interface CatalogItem {
  sourceId: string;
  kind: 'skill' | 'expert' | 'connector' | 'plugin';
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  author?: string;
  homepage?: string;
  repo?: string;
  version?: string;
  tags: string[];
  category?: string;
  stats?: { stars?: number; downloads?: number; favorites?: number; rank?: number };
  trust?: { official?: boolean; capabilities?: string[]; redLines?: string[] };
  install:
    | { kind: 'skill'; fileCount?: number; hasScripts?: boolean }
    | { kind: 'expert'; pluginRows?: string[]; hasJsExpr?: boolean }
    | { kind: 'connector'; transport: 'stdio' | 'streamable-http'; command?: string; url?: string; envRequired?: string[] }
    | {
        kind: 'plugin';
        /** 安装规格：npm 包名或 `github:owner/repo`。 */
        package: string;
        version?: string;
        source?: 'npm' | 'github' | 'tarball';
        /** 当前 profile 下可执行的安装命令（宿主按环境生成）。 */
        command?: string;
        /** 上游原始命令（写死了别的 profile，仅供参考）。 */
        upstreamCommand?: string;
        /** 当前 profile 名。 */
        profile?: string;
        /** 该 profile 的包操作由 App 独占（CLI 会被拒绝）。 */
        managed?: boolean;
        capabilities?: string[];
        redLines?: string[];
      }
    | { kind: 'unsupported'; reason: string };
  installed?: { key: string; version?: string; updatable?: boolean };
}

/** 广场：已安装记录。 */
export interface CatalogInstalledRecord {
  sourceId: string;
  itemId: string;
  version: string;
  installedAt: string;
}

/** 广场：列表响应。 */
export interface CatalogPageResponse {
  items: CatalogItem[];
  nextCursor?: string;
  total?: number;
  sources: CatalogSourceStatus[];
  installed: Record<string, CatalogInstalledRecord>;
}

/** 广场：详情响应。 */
export interface CatalogItemResponse {
  item: CatalogItem;
  files?: Array<{ path: string }>;
  preview?: string;
  compositionPreview?: string;
  connector?: Record<string, unknown>;
  /** plugin：awesome-dsh-plugin 原始条目（能力/红线/截图/安装命令等）。 */
  plugin?: Record<string, unknown>;
}

/** 广场：安装结果。 */
export interface CatalogInstallResult {
  kind: 'skill' | 'expert' | 'connector' | 'plugin';
  key: string;
  id: string;
  missing?: string[];
  warnings: string[];
}

/** 广场：可提交的本地条目。 */
export interface CatalogSubmitCandidate {
  id: string;
  name: string;
  description: string;
  extra?: string;
}

/** 广场：提交结果。 */
export interface CatalogSubmitResult {
  item: Record<string, unknown>;
  sha256: string;
  bytes: number;
  hints: string[];
}

/** 全部接口。 */
export const api = {
  capabilities: () => request<CapabilitiesResponse>('/capabilities'),
  status: () => request<DeckStatus>('/status'),

  skills: (cwd?: string) => request<SkillsResponse>('/skills', { query: { cwd } }),
  skillRead: (name: string, path: string | undefined, cwd?: string) =>
    request<SkillDetail>('/skills/read', { query: { name, path, cwd } }),
  skillCreate: (input: {
    root: 'user' | 'project';
    cwd?: string;
    name: string;
    description: string;
    whenToUse?: string;
    content: string;
  }) => request<{ path: string }>('/skills/create', { method: 'POST', body: input }),
  skillUpdate: (input: {
    name: string;
    path: string;
    cwd?: string;
    description: string;
    whenToUse?: string;
    content: string;
  }) => request<{ path: string }>('/skills/update', { method: 'POST', body: input }),
  skillSetEnabled: (input: { name: string; path: string; cwd?: string; enabled: boolean }) =>
    request<{ disabled: boolean; path: string }>('/skills/set-enabled', {
      method: 'POST',
      body: input,
    }),
  skillDelete: (input: { name: string; path: string; cwd?: string }) =>
    request<{ trashedTo: string }>('/skills/delete', { method: 'POST', body: input }),
  skillImport: (input: {
    root: 'user' | 'project';
    cwd?: string;
    source: 'archive' | 'files' | 'markdown';
    dataBase64?: string;
    files?: Array<{ path: string; text?: string; base64?: string }>;
    fileName?: string;
    enable?: boolean;
  }) =>
    request<{ name: string; path: string; files: number; enabled: boolean; warnings: string[] }>(
      '/skills/import',
      { method: 'POST', body: input },
    ),
  skillCreatorPrompt: (requirement: string) =>
    request<{ skill: string; available: boolean; prompt: string; userSkillRoot: string }>(
      '/skills/creator-prompt',
      { method: 'POST', body: { requirement } },
    ),

  experts: () => request<ExpertsResponse>('/experts'),
  expertRead: (id: string) => request<ExpertReadResponse>('/experts/read', { query: { id } }),
  expertCreate: (input: Partial<ExpertRecord>) =>
    request<{ expert: ExpertRecord; broken?: string }>('/experts/create', {
      method: 'POST',
      body: input,
    }),
  expertUpdate: (input: Partial<ExpertRecord> & { id: string }) =>
    request<{ expert: ExpertRecord; broken?: string }>('/experts/update', {
      method: 'POST',
      body: input,
    }),
  expertDelete: (id: string) =>
    request<{ removed: boolean }>('/experts/delete', { method: 'POST', body: { id } }),
  expertDuplicate: (id: string) =>
    request<{ expert: ExpertRecord }>('/experts/duplicate', { method: 'POST', body: { id } }),
  // ---------------------------------------------------------------- 广场
  catalogSources: () =>
    request<{ enabled: boolean; sources: CatalogSourceStatus[] }>('/catalog/sources'),
  catalogCategories: (kind: 'skill' | 'expert' | 'connector' | 'plugin') =>
    request<{ categories: string[] }>('/catalog/categories', { query: { kind } }),
  catalog: (query: {
    kind: 'skill' | 'expert' | 'connector' | 'plugin';
    source?: string;
    q?: string;
    category?: string;
    sort?: 'default' | 'hot' | 'new';
    cursor?: string;
    limit?: number;
  }) =>
    request<CatalogPageResponse>('/catalog', {
      query: {
        kind: query.kind,
        source: query.source,
        q: query.q,
        category: query.category,
        sort: query.sort,
        cursor: query.cursor,
        limit: query.limit === undefined ? undefined : String(query.limit),
      },
    }),
  catalogItem: (source: string, id: string) =>
    request<CatalogItemResponse>('/catalog/item', { query: { source, id } }),
  catalogInstall: (input: {
    source: string;
    id: string;
    enable?: boolean;
    root?: 'user' | 'project';
    cwd?: string;
    env?: Record<string, string>;
  }) => request<CatalogInstallResult>('/catalog/install', { method: 'POST', body: input }),
  catalogUninstall: (kind: 'skill' | 'expert' | 'connector' | 'plugin', key: string) =>
    request<{ ok: true }>('/catalog/uninstall', { method: 'POST', body: { kind, key } }),
  catalogInstalled: () =>
    request<{ installed: Record<string, CatalogInstalledRecord> }>('/catalog/installed'),
  catalogSubmitCandidates: (kind: 'skill' | 'expert' | 'connector' | 'plugin') =>
    request<{ candidates: CatalogSubmitCandidate[] }>('/catalog/submit/candidates', {
      query: { kind },
    }),
  catalogSubmit: (input: {
    kind: 'skill' | 'expert' | 'connector' | 'plugin';
    id: string;
    path?: string;
    cwd?: string;
    name?: string;
    description?: string;
    tags?: string[];
  }) => request<CatalogSubmitResult>('/catalog/submit', { method: 'POST', body: input }),

  expertSetDefault: (id: string) =>
    request<{ ok: true }>('/experts/set-default', { method: 'POST', body: { id } }),

  // ---------------------------------------------------------------- 插件（profile）
  /** 本地插件页：当前 profile 的 bundle 与插件行。 */
  plugins: () => request<PluginsView>('/plugins'),
  /** 启停单个插件行（写 profile 的 cordis.patch.yml）。 */
  pluginSetEnabled: (id: string, enabled: boolean) =>
    request<{ result: PluginChangeResult }>('/plugins/set-enabled', {
      method: 'POST',
      body: { id, enabled },
    }),
  /** 选中/取消一个 bundle 层（保留已安装依赖）。 */
  pluginBundleSetEnabled: (name: string, enabled: boolean) =>
    request<{ result: PluginChangeResult }>('/plugins/set-bundle-enabled', {
      method: 'POST',
      body: { name, enabled },
    }),
  /** 卸载一个 bundle（同时移除依赖）。 */
  pluginRemove: (name: string) =>
    request<{ result: PluginChangeResult }>('/plugins/remove', { method: 'POST', body: { name } }),

  connectors: () => request<ConnectorsResponse>('/connectors'),
  connectorCreate: (input: Partial<ConnectorRecord>) =>
    request<ConnectorWriteResponse>('/connectors/create', { method: 'POST', body: input }),
  connectorUpdate: (input: Partial<ConnectorRecord> & { id: string }) =>
    request<ConnectorWriteResponse>('/connectors/update', { method: 'POST', body: input }),
  connectorDelete: (id: string) =>
    request<{ ok: true }>('/connectors/delete', { method: 'POST', body: { id } }),
  connectorSetEnabled: (id: string, enabled: boolean) =>
    request<{ status: ConnectorStatus }>('/connectors/set-enabled', {
      method: 'POST',
      body: { id, enabled },
    }),
  connectorReconnect: (id: string) =>
    request<{ status: ConnectorStatus }>('/connectors/reconnect', { method: 'POST', body: { id } }),
  connectorTest: (input: { id?: string } & Partial<ConnectorRecord>) =>
    request<ConnectorTestResponse>('/connectors/test', { method: 'POST', body: input }),
};
