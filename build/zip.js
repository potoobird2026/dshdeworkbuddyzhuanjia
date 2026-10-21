/**
 * 极简 ZIP 读取（只依赖 Node 内置 `node:zlib`）。
 *
 * 技能导入只需要「读出条目名 → 解压字节」，因此只实现：
 *   - End of Central Directory 定位（含注释偏移的回扫）；
 *   - 中央目录遍历（文件名/压缩方法/大小/本地头偏移）；
 *   - 本地文件头定位 + store(0) / deflate(8) 两种方法。
 * 不支持：加密、ZIP64、多卷。遇到不支持的情况抛错，由路由转成 400。
 */
import { inflateRawSync } from 'node:zlib';
/** 本地文件头 / 中央目录 / EOCD 的签名。 */
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
/** 解压全部条目；目录项（以 / 结尾）也会返回，由调用方忽略。 */
export function unzipEntries(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const eocd = findEndOfCentralDirectory(view);
    if (eocd < 0)
        throw new Error('不是有效的 zip（找不到中央目录结尾）');
    const count = view.getUint16(eocd + 10, true);
    const decoder = new TextDecoder('utf-8');
    const out = new Map();
    let offset = view.getUint32(eocd + 16, true);
    for (let index = 0; index < count; index += 1) {
        if (offset + 46 > data.length || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
            throw new Error('zip 中央目录损坏');
        }
        const flags = view.getUint16(offset + 8, true);
        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        if ((flags & 0x1) !== 0)
            throw new Error('不支持加密的 zip 条目');
        const name = decoder.decode(data.subarray(offset + 46, offset + 46 + nameLength));
        const content = readLocalEntry(view, data, localOffset, method, compressedSize);
        out.set(name, content);
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return out;
}
/** 从尾部回扫 EOCD（注释最长 65535 字节）。 */
function findEndOfCentralDirectory(view) {
    const start = Math.max(0, view.byteLength - 22 - 0xffff);
    for (let index = view.byteLength - 22; index >= start; index -= 1) {
        if (view.getUint32(index, true) === EOCD_SIGNATURE)
            return index;
    }
    return -1;
}
/** 读取一个条目的本地头并解压。 */
function readLocalEntry(view, data, localOffset, method, compressedSize) {
    if (localOffset + 30 > data.length || view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
        throw new Error('zip 本地文件头损坏');
    }
    const nameLength = view.getUint16(localOffset + 26, true);
    const extraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + nameLength + extraLength;
    const raw = data.subarray(start, start + compressedSize);
    if (method === 0)
        return raw;
    if (method === 8)
        return new Uint8Array(inflateRawSync(raw));
    throw new Error(`不支持的 zip 压缩方法：${String(method)}`);
}
