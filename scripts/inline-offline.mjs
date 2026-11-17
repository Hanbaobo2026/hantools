import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 把离线构建产物内联成单个 HTML：
 *  - JS 内联进 <script>（并转义 </script）
 *  - CSS 内联进 <style>
 *  - 移除 modulepreload（单 chunk 下已无意义）
 * 输出：dist-offline/hantools-offline.html，并复制到 dist/hantools-offline.html 供站点下载。
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const offlineDir = join(root, 'dist-offline');

let html = await readFile(join(offlineDir, 'index.html'), 'utf8');
const js = await readFile(join(offlineDir, 'app.js'), 'utf8');

let css = '';
try {
  css = await readFile(join(offlineDir, 'app.css'), 'utf8');
} catch {
  css = '';
}

html = html.replace(/<script[^>]*src="\.?\/?app\.js"[^>]*><\/script>/i, () => {
  const safe = js.replace(/<\/script/gi, '<\\/script');
  // 产物是 ES module（含 import.meta），必须用 type="module" 内联，否则整包语法错误不执行
  return `<script type="module">${safe}</script>`;
});

if (css) {
  html = html.replace(/<link[^>]*href="\.?\/?app\.css"[^>]*>/i, () => `<style>${css}</style>`);
}

html = html.replace(/<link[^>]*rel="modulepreload"[^>]*>/gi, '');
html = html.replace(/<script[^>]*type="module"[^>]*>\s*<\/script>/gi, '');

await writeFile(join(offlineDir, 'hantools-offline.html'), html, 'utf8');
await writeFile(join(root, 'dist', 'hantools-offline.html'), html, 'utf8');

const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`[offline] 已生成 hantools-offline.html（${sizeKb} KiB，单文件，可双击离线使用）`);
