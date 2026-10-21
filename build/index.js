/**
 * ============================================================================
 * dsh-squares —— Square 插件入口
 * ============================================================================
 *
 * 一个包、两半：
 *   - 宿主半（本文件与 src/*.ts）：Node 进程里的 Cordis 插件。注册一个只读
 *     诊断工具、一组 `/api/dsh-squares/*` HTTP 路由，并管理技能 / 专家 /
 *     连接器三个领域（专家与连接器都落在真实的宿主能力上）。
 *   - 浏览器半（src/client/*，构建为 lib/client.js）：Web UI 插件，向
 *     `sidebar.panellist` 注册一个全局面板图标行、向 `main` 注册面板本体。
 *
 * 加载方式（profile 插件行）：
 *   dsh plugin --profile web add /path/to/packages/dsh-squares
 *   # 或把 cordis.patch.yml 的 insert 段合并进 profile 的 cordis.patch.yml
 *
 * 所有注册都走"返回 disposer 的 API"或 ctx.effect，插件卸载/热重载时干净回滚。
 * ============================================================================
 */
import { Config, resolvePaths } from './config.js';
import { detectServices, service as getService } from './capabilities.js';
import { registerRoutes } from './routes.js';
import { SquareService } from './service.js';
import { registerStatusTool } from './tool.js';
export { Config };
/** 插件名（= npm 包名，必须与 profile 条目里的 name 一致）。 */
export const name = 'dsh-squares';
/**
 * 静态依赖：只需要工具注册表（挂载 MCP 连接器与注册诊断工具都要用它）。
 * 其余服务（skills / agentPresets / settings / storageDomain / webServer /
 * connection）都是可选的，一律用 ctx.get() 探测后降级。
 */
export const inject = ['tools'];
/**
 * 插件主体。
 *
 * apply 只做同步注册（生命周期 effect），真正的装配（打开存储、挂载连接器、
 * 注册预设）在后台 Promise 里完成；若在此之前插件就被卸载，装配会自行放弃。
 */
export function apply(ctx, config) {
    const host = ctx;
    host.logger.info('[square] loading (panelId=%s, routePrefix=%s)', config.panelId, config.routePrefix);
    let service;
    let stopping = false;
    // 卸载时释放连接器 / 预设 / 存储。
    host.effect(() => () => {
        stopping = true;
        const current = service;
        if (current !== undefined)
            void current.dispose();
    }, 'square: lifecycle');
    const ready = (async () => {
        let mcpClient = false;
        try {
            await import('@deepseek-ai/dsh-mcp-client');
            mcpClient = true;
        }
        catch (error) {
            host.logger.warn('[square] @deepseek-ai/dsh-mcp-client is not resolvable: %o', error);
        }
        const services = detectServices(host, mcpClient);
        const paths = resolvePaths(config);
        const created = await SquareService.create(host, config, paths, services, mcpClient);
        if (stopping) {
            await created.dispose();
            return undefined;
        }
        service = created;
        await created.init();
        return created;
    })().catch((error) => {
        host.logger.warn('[square] bootstrap failed: %o', error);
        return undefined;
    });
    // 诊断工具：服务一就绪就注册。
    if (config.enableTool) {
        void ready.then((created) => {
            if (created === undefined || stopping)
                return;
            try {
                registerStatusTool(host, created);
            }
            catch (error) {
                host.logger.warn('[square] status tool registration failed: %o', error);
            }
        });
    }
    // 数据面：webServer 何时可用就在何时注册；被替换时自动重挂。
    if (config.enableUi) {
        host.inject(['webServer'], (webCtx) => {
            const webServer = getService(webCtx, 'webServer');
            let active = true;
            let disposers = [];
            if (webServer !== undefined) {
                void ready.then((created) => {
                    if (!active || created === undefined || stopping)
                        return;
                    try {
                        disposers = registerRoutes(host, created, config, webServer, () => created.liveConnection());
                    }
                    catch (error) {
                        host.logger.warn('[square] route registration failed: %o', error);
                    }
                });
            }
            return () => {
                active = false;
                const closing = disposers;
                disposers = [];
                for (const dispose of closing) {
                    try {
                        dispose();
                    }
                    catch {
                        /* 卸载路径上的重复释放忽略 */
                    }
                }
            };
        });
    }
}
