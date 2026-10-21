/**
 * 宿主上下文的最小类型面 + 可选服务能力探测。
 *
 * 本插件刻意**不**从 `@deepseek-ai/dsh-skill`、`dsh-host-webserver`、
 * `dsh-storage-domain` 等包做运行时导入：它们由宿主的 Cordis 容器提供，
 * 在这里只用最小结构化类型描述，缺失时降级而不是加载失败。
 * 这样插件在只有基础服务的部署（headless、CI、老版本 profile）里也能装配。
 */
/**
 * 取一个服务；不存在返回 undefined（不抛错）。
 *
 * 先按 Cordis 的**严格**语义取（`ctx.get(name)` 只认「提供方 fiber 当前 active」
 * 的服务），拿不到再退一步用非严格取值。原因：管理类服务（如 `pluginManager`）
 * 由宿主在启动期注册，其 fiber 状态与消费方看到的时机可能不同步，严格取值会
 * 稳定拿到 undefined —— 而服务本身其实可用（实机踩过一次）。
 */
export function service(ctx, name) {
    for (const strict of [true, false]) {
        try {
            const value = ctx.get(name, strict);
            if (value !== undefined && value !== null)
                return value;
        }
        catch {
            /* 换下一种取值方式 */
        }
    }
    return undefined;
}
/** 诊断探针：一个服务是严格可见、非严格可见，还是完全不可见。 */
export function probeService(ctx, name) {
    if (service(ctx, name) === undefined)
        return 'absent';
    try {
        return ctx.get(name) === undefined ? 'non-strict' : 'strict';
    }
    catch {
        return 'non-strict';
    }
}
/** 探测宿主提供了哪些可选服务。 */
export function detectServices(ctx, mcpClientAvailable) {
    return {
        skills: service(ctx, 'skills'),
        agentPresets: service(ctx, 'agentPresets'),
        settings: service(ctx, 'settings'),
        storageDomain: service(ctx, 'storageDomain'),
        webServer: service(ctx, 'webServer'),
        connection: service(ctx, 'connection'),
        pluginManager: service(ctx, 'pluginManager'),
        mcpClient: mcpClientAvailable,
    };
}
/** 把探测结果压成对客户端友好的布尔 + 说明。 */
export function describeCapabilities(services) {
    const notes = [];
    if (services.skills === undefined)
        notes.push('ctx.skills 不可用：技能页签降级为目录扫描。');
    if (services.agentPresets === undefined)
        notes.push('ctx.agentPresets 不可用：专家页签只读（无法注册自建专家）。');
    if (services.settings === undefined)
        notes.push('ctx.settings 不可用：无法修改默认预设。');
    if (services.storageDomain === undefined)
        notes.push('ctx.storageDomain 不可用：专家/连接器仅保存在内存中（重启即丢失）。');
    if (services.webServer === undefined)
        notes.push('ctx.webServer 不可用：面板无数据面。');
    if (!services.mcpClient)
        notes.push('@deepseek-ai/dsh-mcp-client 不可解析：连接器页签只读。');
    if (services.pluginManager === undefined)
        notes.push('ctx.pluginManager 不可用：插件页签只读（无法启停/安装 profile 插件）。');
    return {
        flags: {
            skills: services.skills !== undefined,
            agentPresets: services.agentPresets !== undefined,
            settings: services.settings !== undefined,
            storageDomain: services.storageDomain !== undefined,
            webServer: services.webServer !== undefined,
            connection: services.connection !== undefined,
            mcpClient: services.mcpClient,
            pluginManager: services.pluginManager !== undefined,
        },
        notes,
    };
}
