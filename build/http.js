/**
 * HTTP 助手：JSON 读写、请求信任栅栏、方法校验。
 *
 * 信任模型（与 @nanmicoder/dsh-agent-teams、@linxin666/dsh-skill-explorer 同族）：
 *   - 首选 `ctx.connection.requestRejection(req)` —— 平台自带的 Host/Origin 栅栏
 *     与浏览器 cookie 鉴权（桌面端 `dsh-app://` 代理会带上宿主 cookie，因此
 *     走这条路在 Web 与桌面端都放行）；
 *   - 该服务不存在时退化为自带的 loopback 栅栏（socket ∈ 127/8 或 ::1、Host 为
 *     loopback、`sec-fetch-site !== 'cross-site'`、Origin 同源）。
 *
 * 桌面端代理会剥掉 Origin / sec-fetch-site 并改写 Host，因此栅栏逻辑不得依赖
 * Origin 存在。
 */
/** 写 JSON 响应。 */
export function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(body);
}
/** 错误响应。 */
export function sendError(res, status, error, code) {
    sendJson(res, status, code === undefined ? { error } : { error, code });
}
/** 读取 URL 查询参数（首个值）。 */
export function queryParam(req, name) {
    const url = new URL(req.url ?? '/', 'http://square.local');
    const value = url.searchParams.get(name);
    return value === null || value === '' ? undefined : value;
}
/** 读取 JSON 请求体（有大小上限，超限返回 413）。 */
export async function readJsonBody(req, maxBytes) {
    const chunks = [];
    let size = 0;
    try {
        for await (const chunk of req) {
            size += chunk.byteLength;
            if (size > maxBytes) {
                req.resume();
                return { ok: false, status: 413, error: `request body exceeds ${String(maxBytes)} bytes` };
            }
            chunks.push(chunk);
        }
    }
    catch (error) {
        return { ok: false, status: 400, error: `cannot read request body: ${message(error)}` };
    }
    const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    if (text.trim() === '')
        return { ok: true, value: {} };
    try {
        const parsed = JSON.parse(text);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false, status: 400, error: 'request body must be a JSON object' };
        }
        return { ok: true, value: parsed };
    }
    catch {
        return { ok: false, status: 400, error: 'request body must be valid JSON' };
    }
}
/** IPv4 127/8 判定。 */
function isIPv4Loopback(value) {
    const parts = value.split('.');
    if (parts.length !== 4)
        return false;
    if (parts[0] !== '127')
        return false;
    return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** 套接字地址是否 loopback（127/8、::1、IPv4-mapped）。 */
function isLoopbackAddress(address) {
    if (address === undefined)
        return false;
    const normalized = address.toLowerCase();
    if (normalized === '::1')
        return true;
    if (normalized.startsWith('::ffff:'))
        return isIPv4Loopback(normalized.slice(7));
    return isIPv4Loopback(normalized);
}
/** Host 头是否是 loopback authority。 */
function isLoopbackHost(host) {
    if (host === undefined)
        return false;
    try {
        const url = new URL(`http://${host}`);
        const name = url.hostname;
        return name === 'localhost' || name === '[::1]' || isIPv4Loopback(name);
    }
    catch {
        return false;
    }
}
/** 自带 loopback 栅栏（connection 服务缺失时的兜底）。 */
export function isLoopbackRequest(req) {
    if (!isLoopbackAddress(req.socket?.remoteAddress))
        return false;
    const rawHost = req.headers.host;
    const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
    if (!isLoopbackHost(host))
        return false;
    const site = req.headers['sec-fetch-site'];
    if ((Array.isArray(site) ? site[0] : site) === 'cross-site')
        return false;
    const rawOrigin = req.headers.origin;
    const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
    if (origin === undefined)
        return true;
    try {
        return new URL(origin).host === host;
    }
    catch {
        return false;
    }
}
/** 该请求是否被允许进入本插件的路由。 */
export function isAllowed(ctx, connection, req) {
    if (connection?.requestRejection !== undefined) {
        try {
            const rejection = connection.requestRejection(req);
            if (rejection !== undefined)
                return false;
            return true;
        }
        catch {
            // 服务实现抛错时退回自带栅栏，避免把面板整体打死。
        }
    }
    void ctx;
    return isLoopbackRequest(req);
}
/** 栅栏 + 方法校验；不通过时已写好响应。 */
export function guard(ctx, connection, req, res, method) {
    if (!isAllowed(ctx, connection, req)) {
        sendError(res, 403, 'forbidden: loopback or authenticated browser session required', 'forbidden');
        return false;
    }
    if ((req.method ?? 'GET').toUpperCase() !== method) {
        sendError(res, 405, `method not allowed: ${req.method ?? ''}`, 'method-not-allowed');
        return false;
    }
    return true;
}
/** 把未知错误转成可读文本。 */
export function message(error) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === 'string')
        return error;
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
