/**
 * 广场目录分类（领域语义分类，按 kind 一组标准分类）。
 *
 * 远端源没有统一的目录分类（dsh-market 是 roleplay 等场景标签、GitHub 技能是
 * 目录结构、MCP Registry 什么都没有），这里用「关键词 → 标准分类」映射把
 * CatalogItem 归一到统一的目录分类，供广场的分类筛选条使用。
 *
 * 分类体系与主流智能体平台的应用市场目录保持同构（专家 15 类、技能 12 类）。
 */
import type { CatalogItem, CatalogKind } from './catalog.js';
/**
 * 插件目录分类：**运行时以 upstream 为准**。
 *
 * `awesome-dsh-plugin` 的 plugins.json 自带 categories 段（23 类，中英双语），
 * 这里只放一份同序兜底（拉取失败 / 尚未拉到时用），保证分类条不会空。
 */
export declare const PLUGIN_CATEGORIES: string[];
/** 各 kind 的标准分类列表。 */
export declare function categoryList(kind: CatalogKind): string[];
/** 归一一个条目的目录分类。 */
export declare function normalizeCategory(item: CatalogItem): string | undefined;
