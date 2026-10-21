/**
 * 广场提交：把本地已安装的技能 / 专家 / 连接器 / 插件直接提交进广场。
 *
 * 落地方式：条目写入本地目录文件 `<dshHome>/square/catalog.json`
 * （square-catalog/1 格式），MySubmissionsSource 把它作为一个数据源
 * 注册进广场 —— 提交完成后条目立即出现在广场列表里（源标签「我的提交」），
 * 可搜索、可安装、可分享（把该文件托管到任意静态服务器并加进
 * customCatalogs，其他机器的广场也能看到）。
 *
 * 四条导出管线：
 *   - skill     读技能目录全部文件（文本内联、二进制 base64），剥离绝对路径。
 *   - expert    market 专家带组合原文；local 专家由能力开关现场合成组合。
 *   - connector 导出连接参数，env 值一律脱敏为空串（键进 envRequired）。
 *   - plugin    只导出安装规格（npm 名 / github:owner/repo / .tgz 地址）+ 包版本。
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { catalogItemFromRaw, hashContent, sortItems } from './catalog-sources.js';
import { CatalogError } from './catalog.js';
import { HttpError } from './skills.js';
/** 判断文件是否为文本（与安装器一致）。 */
const TEXT_EXT = /\.(md|markdown|txt|json|ya?ml|toml|csv|tsv|js|mjs|cjs|ts|tsx|py|sh|bash|zsh|ps1|html|css|svg|xml|ini|conf|env|gitignore|license|rst|sql)$/i;
/** 单个导出文件上限（字节）：防止巨型技能目录把导出撑爆。 */
const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** 目录内文件数上限。 */
const MAX_FILES = 200;
/** 目录文件条目上限（超出后最旧的被淘汰）。 */
const MAX_CATALOG_ITEMS = 200;
/** 提交目录文件路径。 */
export function submissionsCatalogPath(paths) {
    return join(paths.dshHome, 'square', 'catalog.json');
}
/**
 * 「我的提交」源：把本地提交目录（square-catalog/1 JSON 文件）当作一个
 * 广场数据源。提交完成后条目立即出现在广场列表里。
 *
 * 条目归一化复用 catalogItemFromRaw；详情（安装载荷）与 CustomCatalogSource
 * 同构：技能给 files、专家给 composition、连接器给 mcp。
 */
export class MySubmissionsSource {
    filePath;
    id = 'my-submissions';
    label = '我的提交';
    kind = 'all';
    installable = true;
    constructor(filePath) {
        this.filePath = filePath;
    }
    async list(query, _ctx) {
        const raws = await this.loadRawItems();
        const items = [];
        for (const raw of raws) {
            const item = catalogItemFromRaw(raw, this.id);
            if (item === undefined || item.kind !== query.kind)
                continue;
            if (query.q !== undefined && query.q !== '' && !matchItem(item, query.q))
                continue;
            items.push(item);
        }
        return { items: sortItems(items, query.sort), total: items.length };
    }
    async item(id, _ctx) {
        const raws = await this.loadRawItems();
        const raw = raws.find((entry) => entry['id'] === id);
        if (raw === undefined)
            throw new CatalogError(`我的提交里没有 ${id}`, 'not-found', 404);
        const item = catalogItemFromRaw(raw, this.id);
        if (item.kind === 'connector') {
            const mcp = raw['mcp'];
            if (mcp !== undefined)
                return { item, connector: { ...mcp, label: String(raw['name'] ?? id) } };
            return { item };
        }
        const files = (Array.isArray(raw['files']) ? raw['files'] : []).map((entry) => entry);
        const catalogFiles = files.map((entry) => ({
            path: String(entry['path'] ?? 'file'),
            ...(typeof entry['text'] === 'string' ? { text: entry['text'] } : {}),
            ...(typeof entry['base64'] === 'string' ? { base64: entry['base64'] } : {}),
        }));
        return {
            item,
            files: catalogFiles,
            ...(typeof raw['composition'] === 'string' ? { composition: raw['composition'] } : {}),
        };
    }
    /** 读目录原始条目（无提交/读失败给空数组）。 */
    async loadRawItems() {
        let text;
        try {
            text = await readFile(this.filePath, 'utf8');
        }
        catch {
            return [];
        }
        try {
            const parsed = JSON.parse(text);
            const items = parsed['items'];
            return Array.isArray(items) ? items.filter((e) => e !== null && typeof e === 'object') : [];
        }
        catch (error) {
            throw new CatalogError(`提交目录损坏：${this.filePath} 不是合法 JSON（${error instanceof Error ? error.message : String(error)}）`, 'bad-catalog', 500);
        }
    }
}
/** 名称/描述/标签匹配（与 catalog-sources 的 matchQuery 同构）。 */
function matchItem(item, query) {
    const needle = query.toLowerCase();
    return (item.name.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle) ||
        item.tags.some((tag) => tag.toLowerCase().includes(needle)));
}
/**
 * 导出器：生成条目并写入本地提交目录。
 */
export class CatalogExporter {
    ctx;
    config;
    paths;
    skills;
    connectors;
    getExpert;
    getConnector;
    getPlugin;
    constructor(ctx, config, paths, skills, connectors, 
    /** 记录 id → 专家记录。 */
    getExpert, 
    /** 记录 id → 连接器记录。 */
    getConnector, 
    /**
     * 插件包名 → 本机已安装插件的导出信息（规格/版本/描述）。
     *
     * 插件不是我们自己的数据（装在 profile 里），所以这里只做只读查询：
     * 拿不到就没有可提交的条目。
     */
    getPlugin) {
        this.ctx = ctx;
        this.config = config;
        this.paths = paths;
        this.skills = skills;
        this.connectors = connectors;
        this.getExpert = getExpert;
        this.getConnector = getConnector;
        this.getPlugin = getPlugin;
    }
    /** 目录文件路径。 */
    get catalogPath() {
        return submissionsCatalogPath(this.paths);
    }
    /** 提交：生成本地条目 → 写入提交目录（同 id 覆盖，最旧淘汰）。 */
    async submit(input) {
        switch (input.kind) {
            case 'skill':
                return this.submitSkill(input);
            case 'expert':
                return this.submitExpert(input);
            case 'connector':
                return this.submitConnector(input);
            case 'plugin':
                return this.submitPlugin(input);
            default:
                throw new HttpError(400, `不支持的提交种类：${String(input.kind)}`, 'bad-kind');
        }
    }
    /**
     * 插件：只导出**安装规格**（npm 名 / `github:owner/repo` / .tgz 地址）。
     *
     * 插件代码本身不在我们这里（它在 npm 或某个仓库），广场条目只需要告诉
     * 安装方「装哪个规格」；版本、描述、首页从 profile 里读到的信息补齐。
     */
    async submitPlugin(input) {
        if (input.id === undefined || input.id === '')
            throw new HttpError(400, '缺少插件包名', 'missing-id');
        const local = await this.getPlugin?.(input.id);
        if (local === undefined) {
            throw new HttpError(404, `本机没有已安装的插件 ${input.id}`, 'plugin-not-found');
        }
        const item = {
            id: input.id,
            kind: 'plugin',
            name: input.name ?? local.title ?? input.id,
            description: input.description ?? local.description ?? '',
            // `finish()` 只在没有 version 时才写入提交时间——插件的 version 是包版本，必须保留。
            ...(local.version === undefined || local.version === '' ? {} : { version: local.version }),
            package: local.spec,
            specSource: local.source,
            ...(local.homepage === undefined ? {} : { homepage: local.homepage }),
            tags: input.tags ?? [],
            author: 'me',
        };
        const payload = JSON.stringify(item);
        return this.finish(input, item, hashContent([local.spec, local.version ?? '']), payload.length);
    }
    /** 技能：读目录全部文件 → 内联。 */
    async submitSkill(input) {
        if (input.id === undefined || input.id === '')
            throw new HttpError(400, '缺少技能名', 'missing-id');
        let detail;
        try {
            detail = await this.skills.read(input.id, input.path, input.cwd);
        }
        catch (error) {
            throw new HttpError(404, `技能 ${input.id} 不可读：${error instanceof Error ? error.message : String(error)}`, 'skill-not-found');
        }
        const dir = dirname(detail.path);
        const files = await this.readDirFiles(dir);
        if (files.length === 0)
            throw new HttpError(400, '技能目录为空', 'empty-skill');
        const skillFile = files.find((file) => file.path === 'SKILL.md');
        if (skillFile?.text === undefined) {
            throw new HttpError(400, '缺少 SKILL.md 文本', 'missing-skill-md');
        }
        const item = {
            id: input.id,
            kind: 'skill',
            name: input.name ?? detail.name,
            description: input.description ?? detail.description,
            files: files.map((file) => ({
                path: file.path,
                ...(file.text === undefined ? {} : { text: file.text }),
                ...(file.base64 === undefined ? {} : { base64: file.base64 }),
            })),
            tags: input.tags ?? [],
            author: 'me',
        };
        const bytes = files.reduce((total, file) => total + (file.text?.length ?? file.base64?.length ?? 0), 0);
        return this.finish(input, item, hashContent(files.map((file) => `${file.path}:${file.text ?? file.base64 ?? ''}`)), bytes);
    }
    /** 专家：market 带组合原文；local 现场合成组合。 */
    async submitExpert(input) {
        const record = this.getExpert(input.id);
        if (record === undefined)
            throw new HttpError(404, `专家 ${input.id} 不存在`, 'expert-not-found');
        const composition = record.compositionYaml !== undefined && record.compositionYaml !== ''
            ? record.compositionYaml
            : composeExpertForExport(record, (id) => this.getConnector(id));
        const item = {
            id: record.id,
            kind: 'expert',
            name: input.name ?? record.name,
            description: input.description ?? record.description,
            ...(record.icon === '' ? {} : { icon: record.icon }),
            tags: input.tags ?? record.tags,
            composition,
            ...(record.presetYaml === undefined ? {} : { presetYaml: record.presetYaml }),
            author: 'me',
        };
        return this.finish(input, item, hashContent([composition, record.presetYaml ?? '']), composition.length);
    }
    /** 连接器：连接参数（env 值脱敏为空串）。 */
    async submitConnector(input) {
        const record = this.getConnector(input.id);
        if (record === undefined)
            throw new HttpError(404, `连接器 ${input.id} 不存在`, 'connector-not-found');
        const envKeys = Object.keys(record.env);
        const mcp = {
            transport: record.transport,
            serverName: record.serverName,
            label: record.label,
            description: input.description ?? record.description,
            ...(record.transport === 'stdio'
                ? { command: record.command, args: record.args, ...(record.cwd === '' ? {} : { cwd: record.cwd }) }
                : { url: record.url, headers: record.headers }),
            // 值一律不导出；键名进 envRequired，安装时会提示补齐。
            env: Object.fromEntries(envKeys.map((key) => [key, ''])),
            envRequired: envKeys,
            toolCallTimeoutMs: record.toolCallTimeoutMs,
            failOnStartupError: record.failOnStartupError,
        };
        const item = {
            id: record.id,
            kind: 'connector',
            name: input.name ?? record.label,
            description: input.description ?? record.description,
            mcp,
            tags: input.tags ?? [],
            author: 'me',
        };
        return this.finish(input, item, hashContent([JSON.stringify(mcp)]), JSON.stringify(mcp).length);
    }
    /** 写入目录（覆盖同 kind+id 条目，超出上限淘汰最旧）。 */
    async finish(input, item, sha256, bytes) {
        const catalog = await this.loadCatalog();
        const items = catalog['items'];
        const version = new Date().toISOString();
        // 条目自带 version（插件是包版本）时保留，其余种类用提交时间当版本号。
        if (typeof item['version'] !== 'string' || item['version'] === '')
            item['version'] = version;
        const at = items.findIndex((entry) => entry['id'] === item['id'] && entry['kind'] === item['kind']);
        if (at >= 0)
            items[at] = item; // 覆盖旧提交
        else
            items.unshift(item);
        while (items.length > MAX_CATALOG_ITEMS)
            items.pop();
        catalog['updatedAt'] = version;
        await mkdir(dirname(this.catalogPath), { recursive: true });
        await writeFile(this.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
        this.ctx.logger.info('[square] submitted %s %s → %s (%d bytes)', String(item['kind']), String(item['id']), this.catalogPath, bytes);
        return {
            item,
            sha256,
            bytes,
            hints: this.hints(String(item['kind']), String(item['id'])),
        };
    }
    /** 读当前提交目录（损坏时重建骨架并告警）。 */
    async loadCatalog() {
        try {
            const parsed = JSON.parse(await readFile(this.catalogPath, 'utf8'));
            if (Array.isArray(parsed['items']))
                return parsed;
        }
        catch {
            /* 文件不存在或损坏：重建 */
        }
        return { schema: 'square-catalog/1', items: [] };
    }
    /** 使用指引。 */
    hints(kind, id) {
        const target = this.config.customCatalogs[0] ?? '';
        const lines = [
            '提交已写入本地广场目录，现在就出现在广场的「我的提交」源里。',
            target === ''
                ? '想分享给其他人：把目录文件放到任意静态服务器，再把 URL 加进对方的 customCatalogs 配置。'
                : `想同步到自建目录（${target}）：把 items 里这一条合并进服务端目录。`,
            `安装方在广场点这条条目即可安装（kind=${kind}，id=${id}）。`,
        ];
        if (kind === 'connector')
            lines.push('连接器的密钥不会被提交：安装方需要自己填 env。');
        if (kind === 'plugin') {
            lines.push('插件提交的是安装规格（npm 名 / github:owner/repo / .tgz 地址），插件代码本身仍在原来的源上。');
        }
        return lines;
    }
    /** 递归读目录（≤4 层、≤200 文件、文本按扩展名内联）。 */
    async readDirFiles(root) {
        const out = [];
        const walk = async (dir, prefix, depth) => {
            if (out.length >= MAX_FILES)
                return;
            const entries = await readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (out.length >= MAX_FILES)
                    return;
                if (entry.name === '.DS_Store' || entry.name.startsWith('.'))
                    continue;
                const full = join(dir, entry.name);
                const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
                if (entry.isDirectory()) {
                    if (depth >= 4)
                        continue;
                    await walk(full, relative, depth + 1);
                    continue;
                }
                const info = await stat(full);
                if (!info.isFile() || info.size > MAX_FILE_BYTES)
                    continue;
                if (TEXT_EXT.test(entry.name) || entry.name.toUpperCase() === 'SKILL.MD') {
                    out.push({ path: relative, text: await readFile(full, 'utf8') });
                }
                else {
                    out.push({ path: relative, base64: Buffer.from(await readFile(full)).toString('base64') });
                }
            }
        };
        try {
            await walk(root, '', 0);
        }
        catch (error) {
            throw new HttpError(400, `读技能目录失败：${error instanceof Error ? error.message : String(error)}`, 'read-failed');
        }
        return out;
    }
}
/** local 专家 → 组合 YAML（与 composeDefinition 同构，导出用）。 */
function composeExpertForExport(record, getConnector) {
    const lines = [];
    const caps = record.capabilities;
    // agent 行：人格 + 能力开关（与 ExpertsDomain 注册的真实预设一致）。
    lines.push('- id: agent-persona');
    lines.push("  name: '@deepseek-ai/dsh-agent-persona'");
    lines.push('  config:');
    lines.push(`    prefix: ${JSON.stringify(record.systemPrompt)}`);
    if (caps.shell)
        lines.push('    tools: [bash, read, write, edit]');
    if (caps.fs)
        lines.push('    fs: true');
    if (caps.skills)
        lines.push('    skills: true');
    if (caps.todo)
        lines.push('    todo: true');
    if (caps.web)
        lines.push('    web: [web_search, web_fetch]');
    if (caps.ask)
        lines.push('    ask: true');
    if (caps.subagents)
        lines.push('    subagents: [subagent]');
    if (caps.compaction)
        lines.push('    compaction: true');
    // 技能绑定：技能名写入 persona 说明。
    if (record.skillNames.length > 0) {
        lines.push(`    skillNames: [${record.skillNames.map((name) => JSON.stringify(name)).join(', ')}]`);
    }
    // 连接器绑定：展开成 mcp-client 行。
    for (const id of record.connectorIds) {
        const connector = getConnector(id);
        if (connector === undefined)
            continue;
        lines.push(`- id: mcp-${connector.serverName}`);
        lines.push("  name: '@deepseek-ai/dsh-mcp-client'");
        lines.push('  config:');
        lines.push(`    serverName: ${JSON.stringify(connector.serverName)}`);
        if (connector.transport === 'stdio') {
            lines.push(`    command: ${JSON.stringify(connector.command)}`);
            lines.push(`    args: [${connector.args.map((arg) => JSON.stringify(arg)).join(', ')}]`);
            if (connector.cwd !== '')
                lines.push(`    cwd: ${JSON.stringify(connector.cwd)}`);
        }
        else {
            lines.push(`    url: ${JSON.stringify(connector.url)}`);
        }
        lines.push(`    toolCallTimeoutMs: ${String(connector.toolCallTimeoutMs)}`);
        if (connector.failOnStartupError)
            lines.push('    failOnStartupError: true');
    }
    return lines.join('\n');
}
