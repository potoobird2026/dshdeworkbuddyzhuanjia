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
import type { ConnectionService, Disposer, HostCtx, WebServerService } from './capabilities.js';
import type { SquareService } from './service.js';
/** 组装并注册全部路由，返回 disposer 列表。 */
export declare function registerRoutes(ctx: HostCtx, service: SquareService, config: SquareConfig, webServer: WebServerService, 
/** 每请求现取 connection（服务可能晚于本插件激活，也可能被替换）。 */
connection: () => ConnectionService | undefined): Disposer[];
/** 归一化前缀（保证前导斜杠、无尾随斜杠）。 */
export declare function normalizePrefix(prefix: string): string;
