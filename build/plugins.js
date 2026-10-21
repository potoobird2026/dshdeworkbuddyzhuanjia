/**
 * profile 插件（bundle）视图。
 *
 * 两条数据路径，同一种输出：
 *   1) 宿主提供 `ctx.pluginManager`（`@deepseek-ai/dsh-plugin-manager`）时，
 *      用它的 `listPlugins()/listBundles()`——那是 profile 组合的权威答案
 *      （bundle 选中状态、加载错误、每行的启停与被谁覆盖都在里面）；
 *   2) 没有该服务的部署（老 profile / headless）退化成**直接读 profile 清单**：
 *      `package.json` 的 dependencies 与 `dsh.profile.bundles`，只读展示。
 *
 * 所有上游字段都按可选处理：宿主版本间可能增减字段，缺了就兜底，不抛错。
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { changeErrorText } from './catalog-install.js';
import { service } from './capabilities.js';
/** 取本地化文案（zh → en → 原串 → 兜底）。 */
export function localizedText(value, fallback = '') {
    if (value === undefined)
        return fallback;
    if (typeof value === 'string')
        return value === '' ? fallback : value;
    return value.zh ?? value.en ?? fallback;
}
/** bundle 的 error 字段可能是对象或字符串。 */
export function bundleErrorText(error) {
    if (error === undefined)
        return undefined;
    if (typeof error === 'string')
        return error === '' ? undefined : error;
    const parts = [error.code, error.diagnostic].filter((part) => typeof part === 'string' && part !== '');
    return parts.length === 0 ? undefined : parts.join(': ');
}
/** 当前 profile 的名字与目录（拿不到目录时 dir 为空串）。 */
export function profileLocation() {
    const envDir = process.env.DSH_PROFILE_DIR;
    const envName = process.env.DSH_PROFILE;
    const name = envName !== undefined && envName !== ''
        ? envName
        : envDir === undefined || envDir === ''
            ? ''
            : (envDir.split('/').filter((part) => part !== '').pop() ?? '');
    if (envDir !== undefined && envDir !== '')
        return { name, dir: envDir };
    const home = process.env.DSH_HOME;
    if (home !== undefined && home !== '' && name !== '') {
        return { name, dir: join(home, 'profiles', name) };
    }
    return { name, dir: '' };
}
/**
 * 从 `ctx.profileContext` 读当前 profile —— **首选来源**。
 *
 * 桌面端由 Electron 拉起宿主进程，`DSH_PROFILE*` 不一定在它的环境里：只认环境
 * 变量时这里会解析出空目录，于是「自己装的插件」判定全部落空、页面直接空掉
 * （实机踩过）。环境变量路径只作为 CLI/headless 场景的兜底。
 */
export function profileFromContext(ctx) {
    const profile = service(ctx, 'profileContext');
    const dir = typeof profile?.dir === 'string' ? profile.dir : '';
    if (dir === '')
        return undefined;
    const name = typeof profile?.name === 'string' && profile.name !== ''
        ? profile.name
        : (dir.split('/').filter((part) => part !== '').pop() ?? '');
    return { name, dir };
}
/** listPlugins/listBundles 的原始结果 → 面板要的形状。 */
export function normalizePluginsView(entries, bundles) {
    // 行 → 所属 bundle：bundle.rows 里同时给了 patch 行 id 与运行期 entry id。
    const ownerOf = new Map();
    for (const bundle of bundles) {
        for (const row of bundle.rows ?? []) {
            ownerOf.set(row.rowId, bundle.name);
            if (row.entryId !== undefined)
                ownerOf.set(row.entryId, bundle.name);
        }
    }
    const rows = entries.map((entry) => {
        const owner = (entry.patchId === undefined ? undefined : ownerOf.get(entry.patchId)) ??
            ownerOf.get(entry.entryId);
        const icon = entry.meta?.icon;
        // 只读判定：官方契约是 `patchId` 与 `readOnlyReason` 二选一（union），
        // 但宿主版本可能两边都缺——那时按不可写处理，免得面板给出一个点了必失败的开关。
        const readOnlyReason = entry.readOnlyReason ?? (entry.patchId === undefined ? 'unaddressable' : undefined);
        return {
            entryId: entry.entryId,
            moduleName: entry.moduleName,
            title: localizedText(entry.meta?.title, entry.moduleName),
            description: localizedText(entry.meta?.description),
            ...(icon === undefined || icon === '' ? {} : { icon }),
            enabled: entry.enabled === true,
            fiberPhase: entry.fiberPhase ?? '',
            ...(entry.patchId === undefined ? {} : { patchId: entry.patchId }),
            ...(readOnlyReason === undefined ? {} : { readOnlyReason }),
            ...(owner === undefined ? {} : { bundle: owner }),
        };
    });
    const normalized = bundles.map((bundle) => {
        const title = localizedText(bundle.meta?.title);
        const description = localizedText(bundle.meta?.description, bundle.description ?? '');
        const error = bundleErrorText(bundle.error) ?? localizedText(bundle.meta?.error);
        return {
            name: bundle.name,
            ...(bundle.version === undefined ? {} : { version: bundle.version }),
            ...(title === '' ? {} : { title }),
            description,
            enabled: bundle.enabled === true,
            installed: bundle.installed === true,
            optional: bundle.optional === true,
            removable: bundle.removable !== false,
            ...(bundle.readOnlyReason === undefined ? {} : { readOnlyReason: bundle.readOnlyReason }),
            ...(error === undefined || error === '' ? {} : { error }),
            // 行的键：优先用运行期 entry id（客户端拿它去 listPlugins 里找行），
            // 宿主没给 entryId 时才退回 patch 行 id。
            rows: (bundle.rows ?? []).map((row) => row.entryId ?? row.rowId),
            overrides: bundle.overrides ?? [],
        };
    });
    return { bundles: normalized, rows };
}
/** 读 profile 的 `package.json`（读不到给空清单）。 */
export async function readProfileManifest(profileDir) {
    if (profileDir === '')
        return { dependencies: {}, bundles: [] };
    let manifest;
    try {
        manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'));
    }
    catch {
        return { dependencies: {}, bundles: [] };
    }
    const rawDeps = manifest['dependencies'] !== null && typeof manifest['dependencies'] === 'object'
        ? manifest['dependencies']
        : {};
    const dependencies = Object.fromEntries(Object.entries(rawDeps)
        .filter(([, value]) => typeof value === 'string')
        .map(([name, value]) => [name, value]));
    const dsh = manifest['dsh'];
    const profile = dsh !== null && typeof dsh === 'object'
        ? dsh['profile']
        : undefined;
    const bundles = Array.isArray(profile?.['bundles'])
        ? (profile?.['bundles']).filter((name) => typeof name === 'string')
        : [];
    return { dependencies, bundles };
}
/**
 * 标出「用户自己装的插件」并补齐缺失的行。
 *
 * `listBundles()` 只保证列出可管理的 bundle：一个**已安装但被取消选中**的依赖
 * 会从它的结果里消失（README：未选中的普通依赖不列出），面板就会少一行。所以这里
 * 以 profile 清单的 dependencies 为准：命中的标 `mine` 并带上安装规格，缺的补一行。
 */
export function markInstalledPlugins(bundles, manifest) {
    const known = new Set(bundles.map((bundle) => bundle.name));
    const marked = bundles.map((bundle) => {
        const spec = manifest.dependencies[bundle.name];
        return spec === undefined
            ? { ...bundle, mine: false }
            : { ...bundle, mine: true, spec };
    });
    for (const [name, spec] of Object.entries(manifest.dependencies)) {
        if (known.has(name))
            continue;
        marked.push({
            name,
            spec,
            description: '',
            enabled: manifest.bundles.includes(name),
            installed: true,
            optional: false,
            removable: true,
            rows: [],
            overrides: [],
            mine: true,
        });
    }
    return marked;
}
/**
 * 降级路径：直接读 profile 的 `package.json`。
 *
 * 只读——启停/安装/卸载都需要 pluginManager，缺失时面板会禁用这些操作。
 */
export async function readProfilePlugins(profileDir) {
    const manifest = await readProfileManifest(profileDir);
    const names = [...new Set([...Object.keys(manifest.dependencies), ...manifest.bundles])];
    return names.map((name) => {
        const spec = manifest.dependencies[name];
        const version = spec !== undefined && /^[0-9]/.test(spec.replace(/^[\^~>=<\s]+/, ''))
            ? spec.replace(/^[\^~>=<\s]+/, '').split(/\s|\|/)[0]
            : undefined;
        return {
            name,
            ...(version === undefined || version === '' ? {} : { version }),
            description: '',
            enabled: manifest.bundles.includes(name),
            installed: spec !== undefined,
            optional: false,
            removable: true,
            rows: [],
            overrides: [],
            ...(spec === undefined ? {} : { spec, mine: true }),
        };
    });
}
/**
 * pnpm 11 拦下的依赖脚本（`node_modules/.modules.yaml` 的 pendingBuilds）。
 *
 * 安装报 failed 时面板要能把「待批准脚本」说清楚，否则用户只看到一个失败。
 */
export async function readPendingBuilds(profileDir) {
    if (profileDir === '')
        return [];
    try {
        const text = await readFile(join(profileDir, 'node_modules', '.modules.yaml'), 'utf8');
        const parsed = yaml.load(text);
        const pending = parsed?.['pendingBuilds'];
        return Array.isArray(pending)
            ? pending.filter((name) => typeof name === 'string')
            : [];
    }
    catch {
        return [];
    }
}
/** `ctx.pluginManager` 的写操作结果 → 面板要的形状。 */
export function toChangeResult(result, target) {
    const error = changeErrorText(result.error);
    const application = result.application ?? (result.changed === true ? 'applied' : 'failed');
    return {
        changed: result.changed === true,
        application,
        stage: result.stage ?? '',
        target: result.target ?? target,
        ...(result.enabled === undefined ? {} : { enabled: result.enabled }),
        ...(error === undefined ? {} : { error }),
        warnings: result.warnings ?? [],
        ...(result.pendingBuilds === undefined ? {} : { pendingBuilds: result.pendingBuilds }),
    };
}
/**
 * 插件条目 → 带**当前环境**安装命令的条目。
 *
 * 上游 awesome-dsh-plugin 的 `install` 字段写死了 `dsh plugin --profile web add …`，
 * 照抄到别的 profile（比如桌面端）就是错的：这里按宿主真正运行的 profile 重新拼
 * 命令，并把上游原文降级成「仅供参考」。桌面端 profile 的包操作由 App 独占
 * （`dsh plugin --profile desktop` 会被 CLI 拒绝），额外标 `managed` 供面板提示。
 */
export function withProfileInstallCommand(item, profile) {
    if (item.install.kind !== 'plugin')
        return item;
    const hint = item.install;
    const command = `dsh plugin --profile ${profile === '' ? '<profile>' : profile} add ${hint.package}`;
    return {
        ...item,
        install: {
            ...hint,
            command,
            ...(hint.command === undefined || hint.command === command
                ? {}
                : { upstreamCommand: hint.command }),
            profile,
            managed: profile === 'desktop',
        },
    };
}
