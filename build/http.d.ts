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
import type { ConnectionService, HostCtx, IncomingLike, ServerResponseLike } from './capabilities.js';
/** 写 JSON 响应。 */
export declare function sendJson(res: ServerResponseLike, status: number, payload: unknown): void;
/** 错误响应。 */
export declare function sendError(res: ServerResponseLike, status: number, error: string, code?: string): void;
/** 读取 URL 查询参数（首个值）。 */
export declare function queryParam(req: IncomingLike, name: string): string | undefined;
/** 读取 JSON 请求体（有大小上限，超限返回 413）。 */
export declare function readJsonBody(req: IncomingLike, maxBytes: number): Promise<{
    ok: true;
    value: Record<string, unknown>;
} | {
    ok: false;
    status: number;
    error: string;
}>;
/** 自带 loopback 栅栏（connection 服务缺失时的兜底）。 */
export declare function isLoopbackRequest(req: IncomingLike): boolean;
/** 该请求是否被允许进入本插件的路由。 */
export declare function isAllowed(ctx: HostCtx, connection: ConnectionService | undefined, req: IncomingLike): boolean;
/** 栅栏 + 方法校验；不通过时已写好响应。 */
export declare function guard(ctx: HostCtx, connection: ConnectionService | undefined, req: IncomingLike, res: ServerResponseLike, method: 'GET' | 'POST' | 'DELETE'): boolean;
/** 把未知错误转成可读文本。 */
export declare function message(error: unknown): string;
