/**
 * 宿主 HTTP 数据面：`<routePrefix>/*` 的一组 exact 路由，供面板的
 * 文档相对 `fetch("api/dsh-squares/…")` 调用。
 *
 * 与 Web 端 / 桌面端的兼容性：路由注册在 `ctx.webServer` 上，桌面端
 * `dsh-app://app/…` 的协议处理器会把非静态路径原样转发到同一个宿主
 * HTTP 服务（并带上宿主 cookie），因此同一份代码两边都可用。
 * 客户端**必须**使用文档相对路径（无前导斜杠），见 src/client/api.ts。
 */

import type { SquareConfig } from './config.js';
import type { ConnectionService, Disposer, HostCtx, IncomingLike, ServerResponseLike, WebServerService } from './capabilities.js';
import type { CatalogKind } from './catalog.js';
import { CatalogError } from './catalog.js';
import { ConnectorInputError, normalizeConnector } from './connectors.js';
import { ExpertInputError } from './experts.js';
import { guard, message, queryParam, readJsonBody, sendError, sendJson } from './http.js';
import { HttpError } from './skills.js';
import type { SquareService } from './service.js';
import type { ConnectorRecord, ExpertRecord } from './types.js';

/** 一条路由的定义。 */
interface RouteSpec {
  method: 'GET' | 'POST';
  /** 相对 routePrefix 的路径片段（'' 或 '/xxx'）。 */
  path: string;
  /** 有请求体时读取 JSON。 */
  body?: boolean;
  handler: (input: {
    query: (name: string) => string | undefined;
    body: Record<string, unknown>;
  }) => Promise<unknown> | unknown;
}

/** 组装并注册全部路由，返回 disposer 列表。 */
export function registerRoutes(
  ctx: HostCtx,
  service: SquareService,
  config: SquareConfig,
  webServer: WebServerService,
  /** 每请求现取 connection（服务可能晚于本插件激活，也可能被替换）。 */
  connection: () => ConnectionService | undefined,
): Disposer[] {
  const routes = buildRoutes(service);
  const prefix = normalizePrefix(config.routePrefix);
  const disposers: Disposer[] = [];
  for (const route of routes) {
    const path = `${prefix}${route.path}`;
    const handler = async (req: IncomingLike, res: ServerResponseLike): Promise<void> => {
      if (!guard(ctx, connection(), req, res, route.method)) return;
      let body: Record<string, unknown> = {};
      if (route.body === true) {
        const parsed = await readJsonBody(req, config.maxBodyBytes);
        if (!parsed.ok) {
          sendError(res, parsed.status, parsed.error, 'invalid-body');
          return;
        }
        body = parsed.value;
      }
      try {
        const value = await route.handler({
          query: (name) => queryParam(req, name),
          body,
        });
        sendJson(res, 200, value ?? { ok: true });
      } catch (error) {
        const mapped = mapError(error);
        if (mapped.status >= 500) service.noteError(`${route.method} ${path}: ${message(error)}`);
        sendError(res, mapped.status, mapped.text, mapped.code);
      }
    };
    disposers.push(
      webServer.register({ kind: 'exact', path, handler }),
    );
  }
  ctx.logger.info('[square] registered %d routes under %s', disposers.length, prefix);
  return disposers;
}

/** 归一化前缀（保证前导斜杠、无尾随斜杠）。 */
export function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/\/+$/, '');
  if (trimmed === '') return '/api/dsh-squares';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** 校验查询参数里的 kind。 */
function requireKind(value: string | undefined): CatalogKind {
  if (value === 'skill' || value === 'expert' || value === 'connector' || value === 'plugin') {
    return value;
  }
  throw new HttpError(400, 'kind 必须是 skill / expert / connector / plugin', 'invalid-kind');
}

/** 全部路由。 */
function buildRoutes(service: SquareService): RouteSpec[] {
  const config = service.config;
  const requireExpertId = (body: Record<string, unknown>): string => {
    const id = body['id'];
    if (typeof id !== 'string' || id.trim() === '') throw new HttpError(400, '缺少 id', 'missing-id');
    return id.trim();
  };
  return [
    {
      method: 'GET',
      path: '/capabilities',
      handler: () => ({
        panelId: config.panelId,
        routePrefix: normalizePrefix(config.routePrefix),
        capabilities: service.capabilities,
        notes: service.notes,
        storage: service.store.kind,
        ui: {
          skills: config.enableSkills,
          experts: config.enableExperts,
          connectors: config.enableConnectors,
          plugins: config.enablePlugins,
          plaza: config.enablePlaza,
        },
      }),
    },
    {
      method: 'GET',
      path: '/status',
      handler: () => service.status(),
    },
    // ---------------------------------------------------------------- 技能
    {
      method: 'GET',
      path: '/skills',
      handler: async ({ query }) => {
        if (!config.enableSkills) throw new HttpError(400, '技能管理已通过配置关闭', 'disabled');
        return service.skills.list(query('cwd'));
      },
    },
    {
      method: 'GET',
      path: '/skills/read',
      handler: async ({ query }) => {
        const name = query('name');
        if (name === undefined) throw new HttpError(400, '缺少 name', 'missing-name');
        return service.skills.read(name, query('path'), query('cwd'));
      },
    },
    {
      method: 'POST',
      path: '/skills/create',
      body: true,
      handler: async ({ body }) => {
        const root = body['root'] === 'project' ? 'project' : 'user';
        return service.skills.create({
          root,
          cwd: stringField(body, 'cwd'),
          name: stringField(body, 'name') ?? '',
          description: stringField(body, 'description') ?? '',
          whenToUse: stringField(body, 'whenToUse'),
          content: stringField(body, 'content') ?? '',
        });
      },
    },
    {
      method: 'POST',
      path: '/skills/update',
      body: true,
      handler: async ({ body }) =>
        service.skills.update({
          name: stringField(body, 'name') ?? '',
          path: stringField(body, 'path') ?? '',
          cwd: stringField(body, 'cwd'),
          description: stringField(body, 'description') ?? '',
          whenToUse: stringField(body, 'whenToUse'),
          content: stringField(body, 'content') ?? '',
        }),
    },
    {
      method: 'POST',
      path: '/skills/set-enabled',
      body: true,
      handler: async ({ body }) =>
        service.skills.setEnabled({
          name: stringField(body, 'name') ?? '',
          path: stringField(body, 'path') ?? '',
          cwd: stringField(body, 'cwd'),
          enabled: body['enabled'] !== false,
        }),
    },
    {
      method: 'POST',
      path: '/skills/delete',
      body: true,
      handler: async ({ body }) =>
        service.skills.remove({
          name: stringField(body, 'name') ?? '',
          path: stringField(body, 'path') ?? '',
          cwd: stringField(body, 'cwd'),
        }),
    },
    // ---------------------------------------------------------------- 专家
    {
      method: 'GET',
      path: '/experts',
      handler: async () => {
        if (!config.enableExperts) throw new HttpError(400, '专家管理已通过配置关闭', 'disabled');
        return service.experts.listAll();
      },
    },
    {
      method: 'POST',
      path: '/skills/import',
      body: true,
      handler: async ({ body }) => {
        const source = body['source'];
        if (source !== 'archive' && source !== 'files' && source !== 'markdown') {
          throw new HttpError(400, 'source 必须是 archive / files / markdown', 'invalid-source');
        }
        return service.skills.importSkill({
          root: body['root'] === 'project' ? 'project' : 'user',
          cwd: stringField(body, 'cwd'),
          source,
          dataBase64: stringField(body, 'dataBase64'),
          files: Array.isArray(body['files'])
            ? (body['files'] as Array<{ path: string; text?: string; base64?: string }>)
            : undefined,
          fileName: stringField(body, 'fileName'),
          enable: body['enable'] !== false,
        });
      },
    },
    {
      method: 'POST',
      path: '/skills/creator-prompt',
      body: true,
      handler: async ({ body }) => service.skills.creatorPrompt(stringField(body, 'requirement') ?? ''),
    },
    // ---------------------------------------------------------------- 广场
    {
      method: 'GET',
      path: '/catalog/sources',
      handler: () => ({ enabled: config.enablePlaza, sources: service.catalogSources() }),
    },
    {
      method: 'GET',
      path: '/catalog/categories',
      handler: async ({ query }) => ({ categories: await service.catalogCategories(requireKind(query('kind'))) }),
    },
    {
      method: 'GET',
      path: '/catalog',
      handler: async ({ query }) => {
        const kind = requireKind(query('kind'));
        const sort = query('sort');
        const limitRaw = Number(query('limit') ?? '');
        const page = await service.catalogList({
          kind,
          ...(query('source') === undefined ? {} : { source: query('source') }),
          ...(query('q') === undefined ? {} : { q: query('q') }),
          ...(query('category') === undefined ? {} : { category: query('category') }),
          ...(sort === 'hot' || sort === 'new' || sort === 'default' ? { sort } : {}),
          ...(query('cursor') === undefined ? {} : { cursor: query('cursor') }),
          ...(Number.isFinite(limitRaw) && limitRaw > 0 ? { limit: Math.min(limitRaw, 100) } : {}),
        });
        const installed = service.catalogInstalled();
        return {
          ...page,
          installed: Object.fromEntries(
            Object.entries(installed).map(([key, record]) => [
              key,
              {
                sourceId: record.sourceId,
                itemId: record.itemId,
                version: record.version ?? '',
                installedAt: record.installedAt,
              },
            ]),
          ),
        };
      },
    },
    {
      method: 'GET',
      path: '/catalog/item',
      handler: async ({ query }) => {
        const source = query('source');
        const id = query('id');
        if (source === undefined || id === undefined) {
          throw new HttpError(400, '缺少 source 或 id', 'missing-parameter');
        }
        const detail = await service.catalogItem(source, id);
        return {
          item: detail.item,
          ...(detail.files === undefined ? {} : { files: detail.files.map((file) => ({ path: file.path })) }),
          ...(detail.preview === undefined ? {} : { preview: detail.preview.slice(0, 4096) }),
          ...(detail.composition === undefined
            ? {}
            : { compositionPreview: detail.composition.slice(0, 8192) }),
          ...(detail.connector === undefined ? {} : { connector: detail.connector }),
        };
      },
    },
    {
      method: 'POST',
      path: '/catalog/install',
      body: true,
      handler: async ({ body }) => {
        const source = stringField(body, 'source');
        const id = stringField(body, 'id');
        if (source === undefined || id === undefined) {
          throw new HttpError(400, '缺少 source 或 id', 'missing-parameter');
        }
        const env = body['env'];
        return service.catalogInstall(source, id, {
          enable: body['enable'] === true,
          ...(body['root'] === 'project' ? { root: 'project' as const } : {}),
          ...(stringField(body, 'cwd') === undefined ? {} : { cwd: stringField(body, 'cwd') as string }),
          ...(env !== null && typeof env === 'object'
            ? { env: Object.fromEntries(Object.entries(env as Record<string, unknown>).map(([k, v]) => [k, String(v)])) }
            : {}),
        });
      },
    },
    {
      method: 'POST',
      path: '/catalog/uninstall',
      body: true,
      handler: async ({ body }) => {
        const kind = body['kind'];
        const key = stringField(body, 'key');
        if (
          (kind !== 'skill' && kind !== 'expert' && kind !== 'connector' && kind !== 'plugin') ||
          key === undefined
        ) {
          throw new HttpError(400, 'kind 或 key 非法', 'missing-parameter');
        }
        await service.catalogUninstall(kind, key);
        return { ok: true };
      },
    },
    {
      method: 'GET',
      path: '/catalog/installed',
      handler: () => ({ installed: service.catalogInstalled() }),
    },
    {
      method: 'GET',
      path: '/catalog/submit/candidates',
      handler: async ({ query }) => ({ candidates: await service.catalogSubmitCandidates(requireKind(query('kind'))) }),
    },
    {
      method: 'POST',
      path: '/catalog/submit',
      body: true,
      handler: async ({ body }) => {
        const kind = requireKind(stringField(body, 'kind'));
        const id = stringField(body, 'id');
        if (id === undefined) {
          throw new HttpError(400, 'kind 或 id 非法', 'missing-parameter');
        }
        return service.catalogSubmit({
          kind,
          id,
          ...(stringField(body, 'path') === undefined ? {} : { path: stringField(body, 'path') as string }),
          ...(stringField(body, 'cwd') === undefined ? {} : { cwd: stringField(body, 'cwd') as string }),
          ...(stringField(body, 'name') === undefined ? {} : { name: stringField(body, 'name') as string }),
          ...(stringField(body, 'description') === undefined ? {} : { description: stringField(body, 'description') as string }),
          ...(Array.isArray(body['tags'])
            ? { tags: (body['tags'] as unknown[]).filter((tag): tag is string => typeof tag === 'string') }
            : {}),
        });
      },
    },
    // ------------------------------------------------------------ 插件（profile）
    {
      method: 'GET',
      path: '/plugins',
      handler: async () => {
        requirePlugins(config);
        return service.pluginsView();
      },
    },
    {
      method: 'POST',
      path: '/plugins/set-enabled',
      body: true,
      handler: async ({ body }) => {
        requirePlugins(config);
        const id = stringRequired(body, 'id');
        return { result: await service.pluginSetEnabled(id, body['enabled'] !== false) };
      },
    },
    {
      method: 'POST',
      path: '/plugins/set-bundle-enabled',
      body: true,
      handler: async ({ body }) => {
        requirePlugins(config);
        const name = stringRequired(body, 'name');
        return { result: await service.pluginBundleSetEnabled(name, body['enabled'] !== false) };
      },
    },
    {
      method: 'POST',
      path: '/plugins/remove',
      body: true,
      handler: async ({ body }) => {
        requirePlugins(config);
        const name = stringRequired(body, 'name');
        return { result: await service.pluginRemove(name) };
      },
    },
    // ---------------------------------------------------------------- 专家
    {
      method: 'GET',
      path: '/experts/read',
      handler: async ({ query }) => {
        const id = query('id');
        if (id === undefined) throw new HttpError(400, '缺少 id', 'missing-id');
        return service.experts.read(id);
      },
    },
    {
      method: 'POST',
      path: '/experts/create',
      body: true,
      handler: async ({ body }) => service.experts.create(body as Partial<ExpertRecord>),
    },
    {
      method: 'POST',
      path: '/experts/update',
      body: true,
      handler: async ({ body }) =>
        service.experts.update({ ...body, id: requireExpertId(body) } as Partial<ExpertRecord> & {
          id: string;
        }),
    },
    {
      method: 'POST',
      path: '/experts/delete',
      body: true,
      handler: async ({ body }) => ({ removed: await service.experts.remove(requireExpertId(body)) }),
    },
    {
      method: 'POST',
      path: '/experts/duplicate',
      body: true,
      handler: async ({ body }) => ({ expert: await service.experts.duplicate(requireExpertId(body)) }),
    },
    {
      method: 'POST',
      path: '/experts/set-default',
      body: true,
      handler: async ({ body }) => {
        await service.experts.setDefault(requireExpertId(body));
        return { ok: true };
      },
    },
    // ------------------------------------------------------------ 连接器
    {
      method: 'GET',
      path: '/connectors',
      handler: async () => ({
        connectors: service.connectors.list(service.store.listConnectors()),
        profileConfigured: await service.connectors.profileRows(),
        available: service.capabilities.mcpClient,
      }),
    },
    {
      method: 'POST',
      path: '/connectors/create',
      body: true,
      handler: async ({ body }) => {
        const record = normalizeConnector(body, undefined);
        assertUniqueName(service, record, undefined);
        await service.store.putConnector(record);
        await service.connectorsChanged();
        return { connector: record, status: service.connectors.status(record) };
      },
    },
    {
      method: 'POST',
      path: '/connectors/update',
      body: true,
      handler: async ({ body }) => {
        const id = requireExpertId(body);
        const existing = service.requireConnector(id);
        const record = normalizeConnector(body, existing);
        assertUniqueName(service, record, id);
        await service.store.putConnector(record);
        await service.connectorsChanged();
        return { connector: record, status: service.connectors.status(record) };
      },
    },
    {
      method: 'POST',
      path: '/connectors/delete',
      body: true,
      handler: async ({ body }) => {
        const id = requireExpertId(body);
        await service.connectors.unmount(id, 'disabled');
        await service.store.deleteConnector(id);
        await service.connectorsChanged();
        return { ok: true };
      },
    },
    {
      method: 'POST',
      path: '/connectors/set-enabled',
      body: true,
      handler: async ({ body }) => {
        const id = requireExpertId(body);
        const existing = service.requireConnector(id);
        const enabled = body['enabled'] !== false;
        const next: ConnectorRecord = { ...existing, enabled, updatedAt: new Date().toISOString() };
        await service.store.putConnector(next);
        await service.connectorsChanged();
        return { status: service.connectors.status(next) };
      },
    },
    {
      method: 'POST',
      path: '/connectors/reconnect',
      body: true,
      handler: async ({ body }) => {
        const existing = service.requireConnector(requireExpertId(body));
        return { status: await service.connectors.reconnect(existing) };
      },
    },
    {
      method: 'POST',
      path: '/connectors/test',
      body: true,
      handler: async ({ body }) => {
        const id = typeof body['id'] === 'string' ? body['id'] : undefined;
        const record =
          id === undefined
            ? normalizeConnector(body, undefined)
            : normalizeConnector(body, service.requireConnector(id));
        return service.connectors.test(record);
      },
    },
  ];
}

/** serverName 唯一性校验。 */
function assertUniqueName(service: SquareService, record: ConnectorRecord, selfId: string | undefined): void {
  for (const other of service.store.listConnectors()) {
    if (other.id === selfId) continue;
    if (other.serverName === record.serverName) {
      throw new ConnectorInputError(
        `serverName "${record.serverName}" 已被连接器「${other.label}」占用`,
        'duplicate-server-name',
      );
    }
  }
}

/** 读一个字符串字段。 */
function stringField(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' ? value : undefined;
}

/** 读一个必填字符串字段（去空白）。 */
function stringRequired(body: Record<string, unknown>, key: string): string {
  const value = stringField(body, key)?.trim();
  if (value === undefined || value === '') throw new HttpError(400, `缺少 ${key}`, 'missing-parameter');
  return value;
}

/** 插件页签的开关闸门。 */
function requirePlugins(config: SquareConfig): void {
  if (!config.enablePlugins) throw new HttpError(400, '插件管理已通过配置关闭', 'disabled');
}

/** 领域错误 → HTTP 状态。 */
function mapError(error: unknown): { status: number; text: string; code?: string } {
  if (error instanceof HttpError) {
    return { status: error.status, text: error.message, ...(error.code === undefined ? {} : { code: error.code }) };
  }
  if (error instanceof CatalogError) {
    return { status: error.status, text: error.message, code: error.code };
  }
  if (error instanceof ConnectorInputError) {
    return { status: 400, text: error.message, code: error.code };
  }
  if (error instanceof ExpertInputError) {
    const status = error.code === 'not-found' ? 404 : error.code === 'already-exists' ? 409 : 400;
    return { status, text: error.message, code: error.code };
  }
  const text = message(error);
  if (text.includes('不存在')) return { status: 404, text, code: 'not-found' };
  return { status: 500, text, code: 'internal' };
}
