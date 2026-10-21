/**
 * 连接器域：MCP 服务器定义的增删改查、运行时挂载/卸载、状态与工具统计。
 *
 * 落地方式是**运行时挂载官方 `@deepseek-ai/dsh-mcp-client`**：
 *   `await ctx.plugin({ name, inject, apply }, config)` → 返回的 Fiber 即一个
 * 已连接的 MCP 服务器；`fiber.dispose()` 断开并撤销它注册的工具。这样
 * 添加/删除连接器不需要改 profile 配置，也不需要重启。
 *
 * 只有 `@deepseek-ai/dsh-mcp-client` 是真实运行时导入；其余服务都通过 ctx 取。
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
/** 脱敏占位符：客户端原样回传时视为「不修改」。 */
export const REDACTED = '••••••';
/** MCP serverName 规范（与 dsh-mcp-client 一致）。 */
export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
/** 校验后的输入（zod）。 */
const InputSchema = z.object({
    id: z.string().optional(),
    label: z.string().optional(),
    description: z.string().optional(),
    transport: z.enum(['stdio', 'streamable-http']).optional(),
    serverName: z.string().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    url: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    toolCallTimeoutMs: z.number().optional(),
    failOnStartupError: z.boolean().optional(),
    enabled: z.boolean().optional(),
});
/** 带状态码的输入错误。 */
export class ConnectorInputError extends Error {
    code;
    constructor(message, code = 'invalid-connector') {
        super(message);
        this.code = code;
        this.name = 'ConnectorInputError';
    }
}
/** 把原始输入规范化成一条记录；existing 用于保留脱敏字段与不可变字段。 */
export function normalizeConnector(raw, existing) {
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) {
        throw new ConnectorInputError(`连接器字段非法：${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
    }
    const input = parsed.data;
    const transport = input.transport ?? existing?.transport ?? 'stdio';
    const serverName = (input.serverName ?? existing?.serverName ?? '').trim();
    if (!SERVER_NAME_PATTERN.test(serverName)) {
        throw new ConnectorInputError(`serverName 必须匹配 ${String(SERVER_NAME_PATTERN)}（1–32 位字母/数字/下划线/连字符），当前：${serverName === '' ? '(空)' : serverName}`, 'invalid-server-name');
    }
    const label = (input.label ?? existing?.label ?? serverName).trim() || serverName;
    const now = new Date().toISOString();
    const mergeSecrets = (incoming, previous) => {
        const base = previous ?? {};
        if (incoming === undefined)
            return { ...base };
        const out = {};
        for (const [key, value] of Object.entries(incoming)) {
            out[key] = value === REDACTED ? (base[key] ?? '') : value;
        }
        return out;
    };
    const record = {
        id: existing?.id ?? input.id ?? `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        label,
        description: (input.description ?? existing?.description ?? '').trim(),
        transport,
        serverName,
        command: (input.command ?? existing?.command ?? '').trim(),
        args: input.args ?? existing?.args ?? [],
        env: mergeSecrets(input.env, existing?.env),
        cwd: (input.cwd ?? existing?.cwd ?? '').trim(),
        url: (input.url ?? existing?.url ?? '').trim(),
        headers: mergeSecrets(input.headers, existing?.headers),
        toolCallTimeoutMs: input.toolCallTimeoutMs ?? existing?.toolCallTimeoutMs ?? 60000,
        failOnStartupError: input.failOnStartupError ?? existing?.failOnStartupError ?? false,
        enabled: input.enabled ?? existing?.enabled ?? true,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };
    if (transport === 'stdio') {
        if (record.command === '')
            throw new ConnectorInputError('stdio 连接器必须提供 command', 'missing-command');
    }
    else if (record.url === '') {
        throw new ConnectorInputError('streamable-http 连接器必须提供 url', 'missing-url');
    }
    if (record.toolCallTimeoutMs <= 0 || !Number.isFinite(record.toolCallTimeoutMs)) {
        throw new ConnectorInputError('toolCallTimeoutMs 必须是正数', 'invalid-timeout');
    }
    return record;
}
/** 记录 → `@deepseek-ai/dsh-mcp-client` 的 Config（只保留它认识的字段）。 */
export function mcpClientConfig(record) {
    const common = {
        serverName: record.serverName,
        toolCallTimeoutMs: record.toolCallTimeoutMs,
        failOnStartupError: record.failOnStartupError,
    };
    if (record.transport === 'stdio') {
        return {
            transport: 'stdio',
            ...common,
            command: record.command,
            args: record.args,
            env: record.env,
            cwd: record.cwd,
        };
    }
    return {
        transport: 'streamable-http',
        ...common,
        url: record.url,
        headers: record.headers,
    };
}
/** 连接器域实现。 */
export class ConnectorsDomain {
    ctx;
    config;
    paths;
    services;
    fibers = new Map();
    statuses = new Map();
    modulePromise;
    constructor(ctx, config, paths, services) {
        this.ctx = ctx;
        this.config = config;
        this.paths = paths;
        this.services = services;
    }
    /** 列出连接器（含运行态与脱敏）。 */
    list(records) {
        return records.map((record) => {
            const redactedKeys = [];
            const redact = (values) => {
                if (!this.config.redactSecrets)
                    return { ...values };
                const out = {};
                for (const [key, value] of Object.entries(values)) {
                    out[key] = value === '' ? '' : REDACTED;
                    if (value !== '')
                        redactedKeys.push(key);
                }
                return out;
            };
            return {
                ...record,
                env: redact(record.env),
                headers: redact(record.headers),
                status: this.status(record),
                redactedKeys,
            };
        });
    }
    /** 单个连接器的运行态。 */
    status(record) {
        const current = this.statuses.get(record.id);
        if (current !== undefined)
            return current;
        return { state: record.enabled ? 'disabled' : 'disabled', toolCount: 0, tools: [] };
    }
    /** 按记录启用状态挂载/卸载。 */
    async reconcile(records) {
        const wanted = new Set(records.filter((record) => record.enabled).map((record) => record.id));
        for (const id of [...this.fibers.keys()]) {
            if (!wanted.has(id))
                await this.unmount(id, 'disabled');
        }
        for (const record of records) {
            if (!record.enabled)
                continue;
            if (this.fibers.has(record.id))
                continue;
            await this.mount(record);
        }
    }
    /** 挂载一个连接器（失败记录在状态里，不抛出）。 */
    async mount(record) {
        if (!this.services.mcpClient) {
            const status = {
                state: 'error',
                toolCount: 0,
                tools: [],
                lastError: '@deepseek-ai/dsh-mcp-client 不可解析：无法挂载连接器',
            };
            this.statuses.set(record.id, status);
            return status;
        }
        if (this.fibers.has(record.id))
            return this.status(record);
        this.statuses.set(record.id, { state: 'connecting', toolCount: 0, tools: [] });
        try {
            const module = await this.loadModule();
            const fiber = this.ctx.plugin({
                name: module.name,
                inject: module.inject,
                apply: module.apply,
            }, mcpClientConfig(record));
            await fiber;
            this.fibers.set(record.id, fiber);
            const status = this.collectStatus(record);
            this.statuses.set(record.id, status);
            return status;
        }
        catch (error) {
            const status = {
                state: 'error',
                toolCount: 0,
                tools: [],
                lastError: errorText(error),
            };
            this.statuses.set(record.id, status);
            this.ctx.logger.warn('[square] connector %s failed: %o', record.serverName, error);
            return status;
        }
    }
    /** 卸载一个连接器。 */
    async unmount(id, state = 'disabled') {
        const fiber = this.fibers.get(id);
        this.fibers.delete(id);
        if (fiber !== undefined) {
            try {
                await fiber.dispose();
            }
            catch (error) {
                this.ctx.logger.warn('[square] connector dispose failed: %o', error);
            }
        }
        this.statuses.set(id, { state, toolCount: 0, tools: [] });
    }
    /** 断开重连。 */
    async reconnect(record) {
        await this.unmount(record.id, 'connecting');
        return this.mount(record);
    }
    /** 测试：挂载 → 收集工具 → 卸载（不改变启用状态）。 */
    async test(record) {
        const wasMounted = this.fibers.has(record.id);
        if (wasMounted)
            await this.unmount(record.id, 'disabled');
        const status = await this.mount(record);
        const result = {
            ok: status.state === 'connected',
            tools: status.tools,
            ...(status.lastError === undefined ? {} : { error: status.lastError }),
        };
        await this.unmount(record.id, 'disabled');
        return result;
    }
    /** 释放全部连接器（插件卸载）。 */
    async disposeAll() {
        for (const id of [...this.fibers.keys()])
            await this.unmount(id, 'disabled');
    }
    /** 统计所有已连接连接器的工具数。 */
    totalTools() {
        let total = 0;
        for (const status of this.statuses.values())
            total += status.toolCount;
        return total;
    }
    /** 所有连接器的运行态快照。 */
    statusSnapshot() {
        return [...this.statuses.values()];
    }
    /** 只读：profile 里已配置的 mcp-client 行。 */
    async profileRows() {
        const dir = existsSync(join(process.cwd(), 'cordis.yml')) ? process.cwd() : undefined;
        if (dir === undefined)
            return [];
        const out = [];
        for (const file of ['cordis.yml', 'cordis.patch.yml']) {
            let text;
            try {
                text = await readFile(join(dir, file), 'utf8');
            }
            catch {
                continue;
            }
            for (const block of splitYamlEntries(text)) {
                if (!block.includes('@deepseek-ai/dsh-mcp-client'))
                    continue;
                out.push({
                    entryId: firstMatch(block, /-?\s*id:\s*['"]?([\w.$-]+)['"]?/) ?? '(anonymous)',
                    serverName: firstMatch(block, /serverName:\s*['"]?([^'"\n]+)['"]?/) ?? '(unknown)',
                    transport: firstMatch(block, /transport:\s*['"]?([^'"\n]+)['"]?/) ?? '(unknown)',
                    enabled: !/disabled:\s*true/.test(block),
                    source: file,
                });
            }
        }
        return out;
    }
    /** 动态导入官方 MCP 桥（只导一次）。 */
    async loadModule() {
        this.modulePromise ??= import('@deepseek-ai/dsh-mcp-client').then((mod) => mod);
        return this.modulePromise;
    }
    /** 从 ctx.tools 里收集某连接器注册出来的工具名。 */
    collectStatus(record) {
        const prefix = `mcp__${record.serverName}__`;
        const tools = [];
        try {
            const toolsService = this.ctx.get('tools');
            const schemas = toolsService?.schemas?.();
            if (Array.isArray(schemas)) {
                for (const schema of schemas) {
                    const name = schema?.name;
                    if (typeof name === 'string' && name.startsWith(prefix))
                        tools.push(name);
                }
            }
        }
        catch (error) {
            this.ctx.logger.debug('[square] tool enumeration failed: %o', error);
        }
        return {
            state: 'connected',
            toolCount: tools.length,
            tools: tools.sort((a, b) => a.localeCompare(b)),
            connectedAt: new Date().toISOString(),
        };
    }
}
/** 按顶层 `- ` 切分 YAML 条目（够用的只读解析）。 */
function splitYamlEntries(text) {
    const lines = text.split('\n');
    const blocks = [];
    let current = [];
    for (const line of lines) {
        if (/^\s*-\s/.test(line) && !/^\s{4,}/.test(line)) {
            if (current.length > 0)
                blocks.push(current.join('\n'));
            current = [line];
            continue;
        }
        current.push(line);
    }
    if (current.length > 0)
        blocks.push(current.join('\n'));
    return blocks;
}
/** 取第一个捕获组。 */
function firstMatch(text, pattern) {
    const match = pattern.exec(text);
    return match?.[1]?.trim();
}
/** 错误 → 文本。 */
function errorText(error) {
    if (error instanceof Error)
        return error.message;
    return typeof error === 'string' ? error : String(error);
}
