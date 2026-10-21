/**
 * 广场卡片的展示计数（下载量 / 收藏量）。
 *
 * 上游源大多不提供这两个数：dsh-market 只有 rank（1 = 最热）、GitHub 技能只有
 * repo star、MCP Registry 什么都没有。这里按「rank 优先、star 其次、id 稳定
 * 派生」的顺序合成**确定性的**展示值——同一 id 永远得到同一对数字，排序
 * 「最热」也基于它。等上游真正提供计数后，把派生逻辑换成透传即可。
 */
import type { CatalogItem } from './catalog.js';
/**
 * 给条目补全展示计数。已有 downloads（真实上游数据）则透传；收藏量缺失时
 * 按下载量派生。返回 stats（含 rank 原值）。
 */
export declare function displayStats(item: CatalogItem, poolSize?: number): {
    stars?: number;
    downloads: number;
    favorites: number;
    rank?: number;
};
