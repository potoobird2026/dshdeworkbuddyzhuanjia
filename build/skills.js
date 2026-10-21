/**
 * 技能域：目录浏览（走 ctx.skills，缺失时自行按官方根规则扫描）、
 * 详情读取、新建、编辑、启停（改写 frontmatter）、删除到回收站。
 *
 * 与 `@deepseek-ai/dsh-skill-filesystem` 的约定保持一致：
 *   - 只认 `<root>/<name>/SKILL.md` 与 `<root>/<name>.md`，只扫一层；
 *   - 根优先级（数字小者胜）：100 项目 .dsh/skills → 200 .agents/skills →
 *     300 自定义目录 → 400 <DSH_HOME>/skills（跳过 .system）→ 500 ~/.agents/skills；
 *   - frontmatter 的 `disable-model-invocation` 控制模型可见性。
 *
 * 所有写操作都先做「同名 + 同路径」复核，路径漂移返回 409，避免同名串改。
 */
import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { unzipEntries } from './zip.js';
import { parseBoolean, parseFrontmatter } from './frontmatter.js';
/** 可写的文件系统来源。 */
const WRITABLE_SOURCES = new Set([
    'project-dsh',
    'project-agents',
    'custom',
    'user-dsh',
    'user-agents',
]);
/** 技能名规范（与 dsh-skill 一致）。 */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** 路径不存在（含权限错误时保守返回 true 的场景由调用方处理）。 */
async function exists(path) {
    try {
        await access(path, constants.F_OK);
        return true;
    }
    catch {
        return false;
    }
}
/** 就近的项目根：最近的含 .git 的祖先目录，找不到则返回 cwd。 */
export async function findProjectRoot(cwd) {
    let current = resolve(cwd);
    for (;;) {
        if (await exists(join(current, '.git')))
            return current;
        const parent = dirname(current);
        if (parent === current)
            return resolve(cwd);
        current = parent;
    }
}
/** 技能域实现。 */
export class SkillsDomain {
    ctx;
    config;
    paths;
    services;
    constructor(ctx, config, paths, services) {
        this.ctx = ctx;
        this.config = config;
        this.paths = paths;
        this.services = services;
    }
    /** 列出技能；cwd 决定项目根的解析。 */
    async list(cwd) {
        const effectiveCwd = cwd !== undefined && cwd !== '' ? resolve(cwd) : process.cwd();
        const rows = [];
        const seen = new Set();
        let complete = true;
        if (this.services.skills !== undefined) {
            try {
                const snapshot = await this.services.skills.snapshot({ cwd: effectiveCwd });
                complete = snapshot.complete ?? true;
                for (const summary of snapshot.skills) {
                    if (seen.has(summary.name))
                        continue;
                    seen.add(summary.name);
                    rows.push(this.toRow(summary));
                }
            }
            catch (error) {
                this.ctx.logger.warn('[square] skills.snapshot failed: %o', error);
                complete = false;
            }
        }
        // 用文件系统扫描补齐 ctx.skills 给不出的路径（旧版本 summary 没有 path），
        // 同时作为 ctx.skills 缺失时的完整降级数据源。
        const scan = await this.scanFilesystem(effectiveCwd);
        for (const found of scan) {
            const existing = rows.find((row) => row.name === found.name);
            if (existing === undefined) {
                rows.push({
                    name: found.name,
                    description: found.description,
                    whenToUse: found.whenToUse,
                    source: found.source,
                    provider: 'filesystem',
                    path: found.path,
                    invocation: { modelInvocable: true, userInvocable: true },
                    toggleable: true,
                    disabled: false,
                });
                continue;
            }
            if (existing.path === undefined || resolve(existing.path) === resolve(found.path)) {
                // 以文件系统扫描为准：它按根优先级判定 source，比注册表摘要更精确
                // （例如 ~/.agents/skills 属于 user-agents，而不是 project-agents）。
                existing.path = found.path;
                existing.source = found.source;
                existing.toggleable = WRITABLE_SOURCES.has(String(found.source));
            }
        }
        rows.sort((a, b) => a.name.localeCompare(b.name));
        return { cwd: effectiveCwd, complete, skills: rows };
    }
    /** 读取一个技能的可编辑字段与正文。 */
    async read(name, expectPath, cwd) {
        const target = await this.resolveSkill(name, expectPath, cwd);
        const text = await readFile(target.path, 'utf8');
        const fm = parseFrontmatter(text);
        const disabled = parseBoolean(fm.values['disable-model-invocation']) === true;
        const userInvocable = parseBoolean(fm.values['user-invocable']) !== false;
        const extraKeys = fm.order.filter((key) => !['name', 'description', 'whenToUse', 'disable-model-invocation', 'user-invocable'].includes(key));
        return {
            name: fm.values.name ?? target.name,
            description: fm.values.description ?? target.description,
            whenToUse: fm.values.whenToUse,
            content: fm.body.replace(/^\n/, ''),
            disabled,
            userInvocable,
            path: target.path,
            source: target.source,
            extraKeys,
            warnings: fm.warnings,
        };
    }
    /** 新建技能（user 或 project 根）。 */
    async create(input) {
        const name = input.name.trim();
        if (!SKILL_NAME.test(name)) {
            throw new HttpError(400, `技能名必须为 kebab-case（^[a-z0-9]+(-[a-z0-9]+)*$）：${name}`, 'invalid-name');
        }
        if (input.description.trim() === '') {
            throw new HttpError(400, 'description 不能为空', 'invalid-description');
        }
        const bytes = Buffer.byteLength(input.content, 'utf8');
        if (bytes > this.config.maxSkillBytes) {
            throw new HttpError(400, `技能正文超过上限 ${String(this.config.maxSkillBytes)} 字节`, 'too-large');
        }
        const root = input.root === 'user'
            ? this.paths.userSkillRoot
            : join(await findProjectRoot(input.cwd ?? process.cwd()), this.config.projectSkillDir);
        const dir = join(root, name);
        const file = join(dir, 'SKILL.md');
        if (await exists(dir) || (await exists(join(root, `${name}.md`)))) {
            throw new HttpError(409, `技能 ${name} 已存在于 ${root}`, 'already-exists');
        }
        const body = input.content.trim() === '' ? `# ${name}\n` : input.content;
        const frontmatter = [
            '---',
            `name: ${name}`,
            `description: ${input.description.trim()}`,
            ...(input.whenToUse !== undefined && input.whenToUse.trim() !== ''
                ? [`whenToUse: ${input.whenToUse.trim()}`]
                : []),
            '---',
            '',
        ].join('\n');
        await mkdir(dir, { recursive: true });
        const text = `${frontmatter}${body.startsWith('\n') ? body.slice(1) : body}`;
        await atomicWrite(file, text);
        return { path: file };
    }
    /** 编辑既有技能（不改名、不改位置，保留禁用状态）。 */
    async update(input) {
        const target = await this.resolveSkill(input.name, input.path, input.cwd);
        if (input.description.trim() === '') {
            throw new HttpError(400, 'description 不能为空', 'invalid-description');
        }
        if (Buffer.byteLength(input.content, 'utf8') > this.config.maxSkillBytes) {
            throw new HttpError(400, `技能正文超过上限 ${String(this.config.maxSkillBytes)} 字节`, 'too-large');
        }
        const text = await readFile(target.path, 'utf8');
        const fm = parseFrontmatter(text);
        if (!fm.present) {
            throw new HttpError(400, '该技能没有 frontmatter，Square 不会为其改写文件', 'no-frontmatter');
        }
        const next = fm.render({
            description: input.description.trim(),
            ...(input.whenToUse === undefined ? {} : { whenToUse: input.whenToUse.trim() }),
        });
        const bodyStart = next.indexOf('\n---\n');
        const head = bodyStart === -1 ? next : next.slice(0, bodyStart + 5);
        const rebuilt = `${head}${input.content.startsWith('\n') ? input.content.slice(1) : input.content}`;
        await atomicWrite(target.path, rebuilt);
        return { path: target.path };
    }
    /** 启用/禁用（改写 disable-model-invocation）。 */
    async setEnabled(input) {
        const target = await this.resolveSkill(input.name, input.path, input.cwd);
        const text = await readFile(target.path, 'utf8');
        const fm = parseFrontmatter(text);
        if (!fm.present) {
            throw new HttpError(400, '该技能没有 frontmatter，无法启停', 'no-frontmatter');
        }
        const next = fm.render({
            'disable-model-invocation': input.enabled ? 'false' : 'true',
        });
        await atomicWrite(target.path, next);
        return { disabled: !input.enabled, path: target.path };
    }
    /** 删除到回收站（`<root>/.system/.trash/`）。 */
    async remove(input) {
        const target = await this.resolveSkill(input.name, input.path, input.cwd);
        const root = this.rootOf(target.path);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const trashDir = join(root, '.system', '.trash');
        await mkdir(trashDir, { recursive: true });
        // 目录型技能整体搬走；单文件技能搬走那个文件。
        const isBundle = target.path.endsWith('SKILL.md');
        const source = isBundle ? dirname(target.path) : target.path;
        const destination = join(trashDir, `${target.name}-${stamp}`);
        await rename(source, destination);
        return { trashedTo: destination };
    }
    /** 解析并复核技能文件路径（同名 + 同路径），漂移则 409。 */
    async resolveSkill(name, expectPath, cwd) {
        const effectiveCwd = cwd !== undefined && cwd !== '' ? resolve(cwd) : process.cwd();
        const scan = await this.scanFilesystem(effectiveCwd);
        const found = scan.find((entry) => entry.name === name);
        if (found === undefined) {
            // 退化：ctx.skills 里存在但没有文件路径（bundled / runtime）。
            throw new HttpError(404, `技能 ${name} 没有可编辑的文件（bundled/runtime 技能只读）`, 'not-writable');
        }
        if (expectPath !== undefined && expectPath !== '' && resolve(expectPath) !== resolve(found.path)) {
            throw new HttpError(409, `技能 ${name} 的路径已变化（面板显示 ${expectPath}，实际 ${found.path}），请刷新后重试`, 'stale-path');
        }
        return found;
    }
    /** 该文件属于哪个技能根。 */
    rootOf(path) {
        const parent = path.endsWith('SKILL.md') ? dirname(dirname(path)) : dirname(path);
        return parent;
    }
    /** 按官方根规则扫描磁盘（也用于补齐 ctx.skills 缺失的 path）。 */
    async scanFilesystem(cwd) {
        const roots = [];
        const projectRoot = await findProjectRoot(cwd);
        roots.push({ root: join(projectRoot, this.config.projectSkillDir), source: 'project-dsh', skipSystem: false });
        roots.push({
            root: join(projectRoot, this.config.projectAgentsSkillDir),
            source: 'project-agents',
            skipSystem: false,
        });
        for (const dir of this.config.customSkillDirs) {
            roots.push({ root: resolve(dir), source: 'custom', skipSystem: false });
        }
        roots.push({ root: this.paths.userSkillRoot, source: 'user-dsh', skipSystem: true });
        roots.push({ root: join(this.paths.agentsHome, 'skills'), source: 'user-agents', skipSystem: false });
        const found = [];
        const seen = new Set();
        for (const entry of roots) {
            const discovered = await scanRoot(entry.root, entry.source, entry.skipSystem);
            for (const skill of discovered) {
                if (seen.has(skill.name))
                    continue;
                seen.add(skill.name);
                found.push(skill);
            }
        }
        return found;
    }
    /**
     * 导入技能：支持 zip 压缩包、一批文件（浏览器文件夹上传）或单个 .md。
     *
     * 要求与面板里写的一致：必须含 SKILL.md（zip/文件夹）或本身就是 .md，
     * 且 frontmatter 里 name（kebab-case）与 description 齐全。
     */
    async importSkill(input) {
        const warnings = [];
        const entries = new Map();
        if (input.source === 'archive') {
            if (typeof input.dataBase64 !== 'string' || input.dataBase64 === '') {
                throw new HttpError(400, '缺少 zip 数据', 'invalid-import');
            }
            let unpacked;
            try {
                unpacked = unzipEntries(base64ToBytes(input.dataBase64));
            }
            catch (error) {
                throw new HttpError(400, `zip 解析失败：${error instanceof Error ? error.message : String(error)}`, 'invalid-zip');
            }
            for (const [name, bytes] of unpacked) {
                if (name.endsWith('/'))
                    continue; // 目录项
                entries.set(normalizeEntryPath(name), bytes);
            }
        }
        else if (input.source === 'files') {
            for (const file of input.files ?? []) {
                const bytes = typeof file.text === 'string'
                    ? new Uint8Array(Buffer.from(file.text, 'utf8'))
                    : base64ToBytes(file.base64 ?? '');
                entries.set(normalizeEntryPath(file.path), bytes);
            }
        }
        else {
            // 单文件导入：无论原文件名是什么，都按 SKILL.md 落盘（fileName 只用于展示）。
            const text = input.files?.[0]?.text ?? '';
            entries.set('SKILL.md', new Uint8Array(Buffer.from(text, 'utf8')));
        }
        if (entries.size === 0)
            throw new HttpError(400, '没有可导入的文件', 'empty-import');
        let total = 0;
        for (const bytes of entries.values())
            total += bytes.byteLength;
        if (total > this.config.maxImportBytes) {
            throw new HttpError(400, `导入内容 ${String(total)} 字节超过上限 ${String(this.config.maxImportBytes)}（可用 maxImportBytes 调整）`, 'import-too-large');
        }
        // 找 SKILL.md：取层级最浅的一个，其余文件按它所在目录为基准。
        const skillFiles = [...entries.keys()].filter((path) => path === 'SKILL.md' || path.endsWith('/SKILL.md'));
        if (skillFiles.length === 0) {
            throw new HttpError(400, '压缩包/文件夹里必须包含 SKILL.md', 'missing-skill-md');
        }
        skillFiles.sort((a, b) => a.split('/').length - b.split('/').length);
        const skillEntry = skillFiles[0] ?? 'SKILL.md';
        const baseDir = skillEntry.includes('/') ? `${skillEntry.slice(0, skillEntry.lastIndexOf('/'))}/` : '';
        if (skillFiles.length > 1)
            warnings.push(`发现 ${String(skillFiles.length)} 个 SKILL.md，使用 ${skillEntry}`);
        const skillText = new TextDecoder().decode(entries.get(skillEntry) ?? new Uint8Array());
        const fm = parseFrontmatter(skillText);
        if (!fm.present)
            throw new HttpError(400, 'SKILL.md 缺少 YAML frontmatter（--- 包裹块）', 'invalid-frontmatter');
        const name = (fm.values.name ?? '').trim();
        const description = (fm.values.description ?? '').trim();
        if (!SKILL_NAME.test(name)) {
            throw new HttpError(400, `SKILL.md 的 name 必须是 kebab-case：${name === '' ? '(空)' : name}`, 'invalid-name');
        }
        if (description === '')
            throw new HttpError(400, 'SKILL.md 的 description 不能为空', 'invalid-description');
        const root = input.root === 'user'
            ? this.paths.userSkillRoot
            : join(await findProjectRoot(input.cwd ?? process.cwd()), this.config.projectSkillDir);
        const dir = join(root, name);
        if (await exists(dir))
            throw new HttpError(409, `技能 ${name} 已存在于 ${root}`, 'already-exists');
        // 只写 SKILL.md 所在目录的内容，剥离外层包装目录；拒绝越界路径。
        const members = [];
        for (const [path, bytes] of entries) {
            if (baseDir !== '' && !path.startsWith(baseDir))
                continue;
            const relative = baseDir === '' ? path : path.slice(baseDir.length);
            if (relative === '' || relative.startsWith('..'))
                continue;
            members.push({ relative, bytes });
            if (members.length > 200)
                throw new HttpError(400, '导入文件数超过 200', 'too-many-files');
        }
        if (members.length === 0)
            members.push({ relative: 'SKILL.md', bytes: entries.get(skillEntry) ?? new Uint8Array() });
        const enabled = input.enable !== false;
        const rewritten = fm.render({ 'disable-model-invocation': enabled ? 'false' : 'true' });
        await mkdir(dir, { recursive: true });
        for (const member of members) {
            const target = join(dir, member.relative);
            if (!target.startsWith(dir))
                continue; // 双保险
            await mkdir(dirname(target), { recursive: true });
            const payload = member.relative === 'SKILL.md' ? new Uint8Array(Buffer.from(rewritten, 'utf8')) : member.bytes;
            await atomicWriteBytes(target, payload);
        }
        return { name, path: join(dir, 'SKILL.md'), files: members.length, enabled, warnings };
    }
    /** 生成「创建技能」用的提示词（指名 creatorSkill；该技能不存在时退化为纯提示词）。 */
    async creatorPrompt(requirement) {
        const trimmed = requirement.trim();
        if (trimmed === '')
            throw new HttpError(400, '请先描述要创建什么技能', 'empty-requirement');
        let available = false;
        try {
            const catalog = await this.list(undefined);
            available = catalog.skills.some((row) => row.name === this.config.creatorSkill && !row.disabled);
        }
        catch {
            /* 目录取不到就当不可用，仍然给出提示词 */
        }
        // 首句与面板输入框里的文案一致：`请帮我创建一个可以实现「……」的 skill`。
        const prompt = [
            available
                ? `${this.config.creatorSkill}  请帮我创建一个可以实现「${trimmed}」的 skill`
                : `请帮我创建一个可以实现「${trimmed}」的 skill`,
            '',
            '要求：',
            `1. 技能名用 kebab-case，写入 ${join(this.paths.userSkillRoot, '<name>', 'SKILL.md')}；`,
            '2. frontmatter 必须含 name 与 description（description 决定模型何时加载它，要具体）；',
            '3. 正文按「做什么 / 何时用 / 步骤」组织，自包含、可直接执行；',
            '4. 只创建这一个技能，完成后回报文件路径与一句话说明。',
        ].join('\n');
        return {
            skill: this.config.creatorSkill,
            available,
            prompt,
            userSkillRoot: this.paths.userSkillRoot,
        };
    }
    /** ctx.skills 摘要 → 面板行。 */
    toRow(summary) {
        const source = (summary.source ?? 'runtime');
        const invocation = {
            modelInvocable: summary.invocation?.modelInvocable !== false,
            userInvocable: summary.invocation?.userInvocable !== false,
        };
        const path = summary.path;
        return {
            name: summary.name,
            description: summary.description ?? '',
            whenToUse: summary.whenToUse,
            source,
            provider: summary.provider ?? 'runtime',
            ...(path === undefined ? {} : { path }),
            invocation,
            toggleable: path !== undefined && WRITABLE_SOURCES.has(String(source)),
            disabled: !invocation.modelInvocable,
        };
    }
}
/** 扫描单个技能根（一层深度）。 */
async function scanRoot(root, source, skipSystem) {
    let entries;
    try {
        entries = await readdir(root);
    }
    catch {
        return [];
    }
    const out = [];
    for (const entry of entries.sort((a, b) => a.localeCompare(b))) {
        if (entry.startsWith('.') && entry !== '.')
            continue;
        if (skipSystem && entry === '.system')
            continue;
        const candidate = join(root, entry);
        const bundleFile = join(candidate, 'SKILL.md');
        let file;
        try {
            const info = await stat(candidate);
            if (info.isDirectory()) {
                if (await exists(bundleFile))
                    file = bundleFile;
            }
            else if (info.isFile() && entry.endsWith('.md')) {
                file = candidate;
            }
        }
        catch {
            continue;
        }
        if (file === undefined)
            continue;
        try {
            const text = await readFile(file, 'utf8');
            const fm = parseFrontmatter(text);
            const name = fm.values.name ?? entry.replace(/\.md$/, '');
            if (!SKILL_NAME.test(name))
                continue;
            if ((fm.values.description ?? '').trim() === '')
                continue;
            out.push({
                name,
                path: file,
                source,
                description: fm.values.description ?? '',
                ...(fm.values.whenToUse === undefined ? {} : { whenToUse: fm.values.whenToUse }),
            });
        }
        catch {
            continue;
        }
    }
    return out;
}
/** 原子写：先写临时文件再 rename，避免半截文件被扫描到。 */
async function atomicWrite(file, text) {
    await atomicWriteBytes(file, Buffer.from(text, 'utf8'));
}
/** 原子写（二进制）。 */
async function atomicWriteBytes(file, bytes) {
    const tmp = `${file}.square-${String(process.pid)}-${Date.now()}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, file);
}
/** base64 → 字节。 */
function base64ToBytes(value) {
    return new Uint8Array(Buffer.from(value, 'base64'));
}
/** 归一化导入条目路径：去掉 ./ 前缀，拒绝绝对路径与 ..。 */
function normalizeEntryPath(path) {
    const normalized = path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '');
    if (isAbsolute(normalized) || normalized.split('/').includes('..')) {
        throw new HttpError(400, `导入内容包含非法路径：${path}`, 'unsafe-path');
    }
    return normalized;
}
/** 带 HTTP 状态码的领域错误。 */
export class HttpError extends Error {
    status;
    code;
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'HttpError';
    }
}
/** 技能名规范导出（供测试与路由校验复用）。 */
export { SKILL_NAME, WRITABLE_SOURCES };
