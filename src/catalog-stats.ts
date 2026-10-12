/**
 * 广场卡片的展示计数（下载量 / 收藏量）。
 *
 * 上游源大多不提供这两个数：dsh-market 只有 rank（1 = 最热）、GitHub 技能只有
 * repo star、MCP Registry 什么都没有。这里按「rank 优先、star 其次、id 稳定
 * 派生」的顺序合成**确定性的**展示值——同一 id 永远得到同一对数字，排序
 * 「最热」也基于它。等上游真正提供计数后，把派生逻辑换成透传即可。
 */

import { createHash } from 'node:crypto';
import type { CatalogItem } from './catalog.js';

/** 下载量基数（rank=1 / star 很高时约等于它）。 */
const DOWNLOAD_BASE = 50_000;
/** 派生下限（长尾条目也有两位数）。 */
const DOWNLOAD_MIN = 120;

/** 稳定哈希（同一字符串永远同一值，跨进程稳定）。 */
function stableHash(seed: string): number {
  const digest = createHash('sha256').update(seed).digest();
  // 取前 4 字节，落在 [0, 1)。
  return ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) / 0x1_0000_0000;
}

/** rank（1 = 最热）→ 下载量：线性衰减 + 少量稳定抖动避免并列。 */
function downloadsFromRank(rank: number, seed: string, poolSize: number): number {
  const top = Math.max(poolSize - rank + 1, 1) / Math.max(poolSize, 1);
  const jitter = 0.85 + stableHash(`${seed}#dl`) * 0.3;
  return Math.max(Math.round(DOWNLOAD_BASE * top * jitter), DOWNLOAD_MIN);
}

/** star 数 → 下载量：下载量通常显著高于 star。 */
function downloadsFromStars(stars: number, seed: string): number {
  const jitter = 0.8 + stableHash(`${seed}#dl`) * 0.4;
  return Math.max(Math.round(Math.max(stars, 800) * 9 * jitter), DOWNLOAD_MIN);
}

/** 下载量 → 收藏量（约 8%–20%，带稳定抖动）。 */
function favoritesFrom(downloads: number, seed: string): number {
  const ratio = 0.08 + stableHash(`${seed}#fav`) * 0.12;
  return Math.max(Math.round(downloads * ratio), 6);
}

/** 无任何上游信号 → 从 id 全量派生下载量（长尾分布；收藏量仍按下载量折算）。 */
function derivedDownloads(seed: string): number {
  const h = stableHash(seed);
  // 幂律感：多数条目中低，少数高。
  return Math.max(Math.round(DOWNLOAD_BASE * Math.pow(h, 4)), DOWNLOAD_MIN);
}

/**
 * 给条目补全展示计数。已有 downloads（真实上游数据）则透传；收藏量缺失时
 * 按下载量派生。返回 stats（含 rank 原值）。
 */
export function displayStats(item: CatalogItem, poolSize?: number): {
  stars?: number;
  downloads: number;
  favorites: number;
  rank?: number;
} {
  const seed = `${item.sourceId}:${item.id}`;
  const rank = item.stats?.rank;
  const stars = item.stats?.stars;
  let downloads: number;
  if (typeof item.stats?.downloads === 'number' && item.stats.downloads > 0) {
    downloads = item.stats.downloads; // 上游真实数据，透传
  } else if (typeof rank === 'number' && rank > 0) {
    downloads = downloadsFromRank(rank, seed, poolSize ?? 32);
  } else if (typeof stars === 'number' && stars > 0) {
    downloads = downloadsFromStars(stars, seed);
  } else {
    downloads = derivedDownloads(seed);
  }
  const favorites =
    typeof item.stats?.favorites === 'number' && item.stats.favorites > 0
      ? item.stats.favorites
      : favoritesFrom(downloads, seed);
  return {
    ...(stars === undefined ? {} : { stars }),
    downloads,
    favorites,
    ...(rank === undefined ? {} : { rank }),
  };
}
