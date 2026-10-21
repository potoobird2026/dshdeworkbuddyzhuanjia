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
import type { SquareConfig, ResolvedPaths } from './config.js';
import type { DetectedServices, HostCtx } from './capabilities.js';
import type { SkillDetail, SkillRow } from './types.js';
/** 可写的文件系统来源。 */
declare const WRITABLE_SOURCES: Set<string>;
/** 技能名规范（与 dsh-skill 一致）。 */
declare const SKILL_NAME: RegExp;
/** 就近的项目根：最近的含 .git 的祖先目录，找不到则返回 cwd。 */
export declare function findProjectRoot(cwd: string): Promise<string>;
/** 技能域实现。 */
export declare class SkillsDomain {
    private readonly ctx;
    private readonly config;
    private readonly paths;
    private readonly services;
    constructor(ctx: HostCtx, config: SquareConfig, paths: ResolvedPaths, services: DetectedServices);
    /** 列出技能；cwd 决定项目根的解析。 */
    list(cwd: string | undefined): Promise<{
        cwd: string;
        complete: boolean;
        skills: SkillRow[];
    }>;
    /** 读取一个技能的可编辑字段与正文。 */
    read(name: string, expectPath: string | undefined, cwd: string | undefined): Promise<SkillDetail>;
    /** 新建技能（user 或 project 根）。 */
    create(input: {
        root: 'user' | 'project';
        cwd?: string;
        name: string;
        description: string;
        whenToUse?: string;
        content: string;
    }): Promise<{
        path: string;
    }>;
    /** 编辑既有技能（不改名、不改位置，保留禁用状态）。 */
    update(input: {
        name: string;
        path: string;
        cwd?: string;
        description: string;
        whenToUse?: string;
        content: string;
    }): Promise<{
        path: string;
    }>;
    /** 启用/禁用（改写 disable-model-invocation）。 */
    setEnabled(input: {
        name: string;
        path: string;
        cwd?: string;
        enabled: boolean;
    }): Promise<{
        disabled: boolean;
        path: string;
    }>;
    /** 删除到回收站（`<root>/.system/.trash/`）。 */
    remove(input: {
        name: string;
        path: string;
        cwd?: string;
    }): Promise<{
        trashedTo: string;
    }>;
    /** 解析并复核技能文件路径（同名 + 同路径），漂移则 409。 */
    private resolveSkill;
    /** 该文件属于哪个技能根。 */
    private rootOf;
    /** 按官方根规则扫描磁盘（也用于补齐 ctx.skills 缺失的 path）。 */
    private scanFilesystem;
    /**
     * 导入技能：支持 zip 压缩包、一批文件（浏览器文件夹上传）或单个 .md。
     *
     * 要求与面板里写的一致：必须含 SKILL.md（zip/文件夹）或本身就是 .md，
     * 且 frontmatter 里 name（kebab-case）与 description 齐全。
     */
    importSkill(input: {
        root: 'user' | 'project';
        cwd?: string;
        source: 'archive' | 'files' | 'markdown';
        dataBase64?: string;
        files?: Array<{
            path: string;
            text?: string;
            base64?: string;
        }>;
        fileName?: string;
        enable?: boolean;
    }): Promise<{
        name: string;
        path: string;
        files: number;
        enabled: boolean;
        warnings: string[];
    }>;
    /** 生成「创建技能」用的提示词（指名 creatorSkill；该技能不存在时退化为纯提示词）。 */
    creatorPrompt(requirement: string): Promise<{
        skill: string;
        available: boolean;
        prompt: string;
        userSkillRoot: string;
    }>;
    /** ctx.skills 摘要 → 面板行。 */
    private toRow;
}
/** 带 HTTP 状态码的领域错误。 */
export declare class HttpError extends Error {
    readonly status: number;
    readonly code?: string | undefined;
    constructor(status: number, message: string, code?: string | undefined);
}
/** 技能名规范导出（供测试与路由校验复用）。 */
export { SKILL_NAME, WRITABLE_SOURCES };
