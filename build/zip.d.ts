/**
 * 极简 ZIP 读取（只依赖 Node 内置 `node:zlib`）。
 *
 * 技能导入只需要「读出条目名 → 解压字节」，因此只实现：
 *   - End of Central Directory 定位（含注释偏移的回扫）；
 *   - 中央目录遍历（文件名/压缩方法/大小/本地头偏移）；
 *   - 本地文件头定位 + store(0) / deflate(8) 两种方法。
 * 不支持：加密、ZIP64、多卷。遇到不支持的情况抛错，由路由转成 400。
 */
/** 解压全部条目；目录项（以 / 结尾）也会返回，由调用方忽略。 */
export declare function unzipEntries(data: Uint8Array): Map<string, Uint8Array>;
