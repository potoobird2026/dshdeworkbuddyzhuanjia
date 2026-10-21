/**
 * 数据源框架：统一条目模型、磁盘/内存缓存、源注册表。
 *
 * 设计要点：
 *   - **所有网络访问都在宿主侧**（Node fetch），避开 CORS、可缓存、token 不出主进程；
 *   - 源是可插拔的：每个源实现 `list/item`，返回归一化后的 CatalogItem；
 *   - 缓存按「源 + URL」记忆，带 TTL 与 ETag；**过期且拉取失败时报错，不静默用旧数据**
 *     （与 dshmarket 的取舍一致：过期答案不是「差一点」，而是「错的」）。
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
/** 网络/协议错误（带状态码，路由层可直接映射）。 */
export class CatalogError extends Error {
    code;
    status;
    constructor(message, code, status = 502) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'CatalogError';
    }
}
/** 请求超时（毫秒）。 */
const REQUEST_TIMEOUT_MS = 20000;
/** 磁盘缓存条目上限（条）。 */
const MAX_DISK_ENTRIES = 40;
/** 带缓存的拉取器。 */
export class CachedFetcher {
    ctx;
    paths;
    defaultTtlMs;
    memory = new Map();
    constructor(ctx, paths, defaultTtlMs) {
        this.ctx = ctx;
        this.paths = paths;
        this.defaultTtlMs = defaultTtlMs;
    }
    /** 拉文本；命中未过期缓存直接返回。 */
    async text(url, options = {}) {
        const cacheKey = `${url}${options.cacheKey ?? ''}`;
        const ttl = options.ttlMs ?? this.defaultTtlMs;
        const cached = this.memory.get(cacheKey);
        if (options.noCache !== true && cached !== undefined && Date.now() - cached.fetchedAt < ttl) {
            return cached.body;
        }
        const headers = {
            accept: '*/*',
            'user-agent': 'dsh-squares',
            ...options.headers,
        };
        if (options.noCache !== true && cached?.etag !== undefined)
            headers['if-none-match'] = cached.etag;
        const started = Date.now();
        let response;
        try {
            response = await fetch(url, {
                headers,
                redirect: 'follow',
                signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
            });
        }
        catch (error) {
            throw new CatalogError(`请求 ${url} 失败（${String(Date.now() - started)}ms）：${error instanceof Error ? error.message : String(error)}`, 'network');
        }
        if (response.status === 304 && cached !== undefined) {
            cached.fetchedAt = Date.now();
            return cached.body;
        }
        if (!response.ok) {
            throw new CatalogError(`请求 ${url} 返回 HTTP ${String(response.status)}`, `http-${String(response.status)}`);
        }
        const body = await response.text();
        const etag = response.headers.get('etag') ?? undefined;
        const entry = {
            url,
            fetchedAt: Date.now(),
            body,
            ...(etag === undefined ? {} : { etag }),
        };
        this.memory.set(cacheKey, entry);
        void this.persist(cacheKey, entry);
        return body;
    }
    /** 拉 JSON。 */
    async json(url, options = {}) {
        const body = await this.text(url, options);
        try {
            return JSON.parse(body);
        }
        catch (error) {
            throw new CatalogError(`${url} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`, 'bad-json');
        }
    }
    /** 拉二进制（安装用，不缓存）。 */
    async raw(url) {
        let response;
        try {
            response = await fetch(url, {
                headers: { 'user-agent': 'dsh-squares' },
                redirect: 'follow',
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        }
        catch (error) {
            throw new CatalogError(`下载 ${url} 失败：${error instanceof Error ? error.message : String(error)}`, 'network');
        }
        if (!response.ok) {
            throw new CatalogError(`下载 ${url} 返回 HTTP ${String(response.status)}`, 'download-failed');
        }
        return new Uint8Array(await response.arrayBuffer());
    }
    /** 磁盘缓存目录。 */
    cacheDir() {
        return join(this.paths.dshHome, 'square', 'cache');
    }
    /** 异步落盘（失败只记日志）。 */
    async persist(key, entry) {
        try {
            const dir = this.cacheDir();
            await mkdir(dir, { recursive: true });
            const name = `${createHash('sha256').update(key).digest('hex').slice(0, 24)}.json`;
            await writeFile(join(dir, name), JSON.stringify(entry), 'utf8');
        }
        catch (error) {
            this.ctx.logger.debug('[square] catalog cache write failed: %o', error);
        }
    }
    /** 启动时预热磁盘缓存（只读未过期条目）。 */
    async warm(ttlMs) {
        try {
            const dir = this.cacheDir();
            const { readdir } = await import('node:fs/promises');
            const names = (await readdir(dir)).slice(0, MAX_DISK_ENTRIES);
            let loaded = 0;
            for (const name of names) {
                try {
                    const entry = JSON.parse(await readFile(join(dir, name), 'utf8'));
                    if (typeof entry.url !== 'string' || typeof entry.body !== 'string')
                        continue;
                    if (Date.now() - entry.fetchedAt > ttlMs)
                        continue;
                    this.memory.set(entry.url, entry);
                    loaded += 1;
                }
                catch {
                    /* 坏条目直接跳过 */
                }
            }
            return loaded;
        }
        catch {
            return 0;
        }
    }
}
