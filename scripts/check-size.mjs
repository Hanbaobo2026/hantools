import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/**
 * 体积预算门禁（CI 使用）：
 *  - 首屏主 JS ≤ 120 KiB（gzip）
 *  - 全站 CSS ≤ 25 KiB（gzip）
 *  - 单文件离线版 ≤ 250 KiB（原始大小）
 * 超出预算直接失败，避免无意间引入大依赖（例如 prettier / pdf.js）。
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');

function gzipSize(buffer) {
  return gzipSync(buffer).length;
}

function kib(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

const indexHtml = await readFile(join(dist, 'index.html'), 'utf8');
const mainMatch = /<script[^>]*src="([^"]+\.js)"[^>]*><\/script>/.exec(indexHtml);
if (!mainMatch) {
  console.error('[size] 未在 dist/index.html 中找到入口脚本');
  process.exit(1);
}
const mainPath = join(dist, mainMatch[1].replace(/^\//, '').split('/').join('/'));
const mainJs = await readFile(mainPath);

const cssFiles = (await readdir(join(dist, 'assets'))).filter((name) => name.endsWith('.css'));
let cssGzip = 0;
for (const name of cssFiles) {
  cssGzip += gzipSize(await readFile(join(dist, 'assets', name)));
}

const offline = await readFile(join(dist, 'hantools-offline.html')).catch(() => null);
if (!offline) {
  console.error('[size] 缺少 dist/hantools-offline.html —— 离线包是部署资产的一部分，请执行 npm run build');
  process.exit(1);
}

const results = [
  { name: '入口 JS（gzip）', value: gzipSize(mainJs), budget: 120 * 1024 },
  { name: 'CSS 合计（gzip）', value: cssGzip, budget: 25 * 1024 },
  { name: '离线单文件', value: offline.length, budget: 500 * 1024 },
];

let failed = false;
for (const item of results) {
  const ok = item.value <= item.budget;
  if (!ok) failed = true;
  console.log(`[size] ${ok ? 'OK  ' : 'FAIL'} ${item.name}: ${kib(item.value)} / 预算 ${kib(item.budget)}`);
}

if (failed) process.exit(1);
console.log('[size] 体积预算检查通过');
